'use server'

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { createNotification } from '@/utils/notifications';
import { recordAuditLog } from '@/utils/audit';
import { requireCapability, hasCapability } from '@/lib/auth/permissions';
import { sendPoIssuedEmail } from '@/lib/email/po';

type POLineItem = { item_code?: string; description: string; qty: number; uom?: string; unit_price: number };
type POSiteDetail = { region: string; area_city: string; no_of_nodes: number; cable_length_km: number };

interface CreatePOInput {
  vendor_id: string;
  project_id?: string;
  line_items: POLineItem[];
  site_details?: POSiteDetail[];
  description?: string;
  issued_date?: string;
  due_date?: string;
  dp_amount?: number;
  waive_requirements?: boolean;
}

function getTomorrowDateInTimeZone(timeZone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const tomorrow = new Date(
    Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day) + 1),
  );

  return tomorrow.toISOString().slice(0, 10);
}

export async function createPurchaseOrderCore(input: CreatePOInput) {
  const supabase = await createClient();
  const { user, role, error: authError } = await requireCapability('po.create', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const { vendor_id, project_id, line_items, site_details = [], description, due_date, dp_amount = 0, waive_requirements: waive = false } = input;
  const issued_date = input.issued_date ?? new Date().toISOString().slice(0, 10);
  const mobilization_date = getTomorrowDateInTimeZone('Asia/Manila');

  if (!vendor_id) return { error: 'Vendor is required.' };

  const totalAmount = line_items.reduce((sum, li) => sum + (Number(li.qty) || 0) * (Number(li.unit_price) || 0), 0);
  if (totalAmount <= 0) return { error: 'Total amount must be greater than zero. Add at least one line item with a price.' };

  const { data: ndaDoc } = await supabase
    .from('vendor_documents')
    .select('status')
    .eq('vendor_id', vendor_id)
    .eq('doc_type', 'signed_nda')
    .eq('status', 'approved')
    .is('archived_at', null)
    .maybeSingle();

  const ndaFailed = !ndaDoc;

  const { data: entity } = await supabase.from('internal_entities').select('id').limit(1).single();

  const { data: vendor } = await supabase.from('vendors').select('status, currency').eq('id', vendor_id).single();
  const statusFailed = !vendor || vendor.status !== 'active';
  const hasBlockers = ndaFailed || statusFailed;

  if (hasBlockers) {
    if (!waive) {
      if (statusFailed) return { error: 'Cannot create PO: This vendor is not currently active. Vendors must be activated (Accredited) before purchase orders can be issued.' };
      return { error: 'Cannot create PO: This vendor does not have an approved Signed NDA on file. Please submit and have the NDA approved first.' };
    }
    if (!hasCapability(role, 'po.waive_requirements')) return { error: 'You do not have permission to waive PO requirements.' };
  }

  const currency = vendor?.currency || 'PHP';
  const waivedRequirements: string[] = [];
  if (waive && hasBlockers) {
    if (ndaFailed) waivedRequirements.push('nda');
    if (statusFailed) waivedRequirements.push('vendor_status');
  }

  const { data: newPO, error } = await supabase.from('purchase_orders').insert({
    vendor_id,
    project_id: project_id || null,
    description: description || null,
    amount: totalAmount,
    dp_amount,
    issued_date,
    mobilization_date,
    due_date: due_date || null,
    status: 'draft',
    currency,
    internal_entity_id: entity?.id || null,
    created_by: user.id,
    ...(waive && hasBlockers ? {
      requirements_waived: true,
      waived_by: user.id,
      waived_at: new Date().toISOString(),
      waived_requirements: waivedRequirements,
      waiver_approved: false,
    } : {}),
  }).select('id, po_number').single();

  if (error) {
    console.error('Error creating PO:', error);
    return { error: error.message };
  }

  if (line_items.length > 0) {
    const { error: liError } = await supabase.from('po_line_items').insert(
      line_items.map((li, i) => ({
        po_id: newPO.id,
        line_no: i + 1,
        item_code: li.item_code || '',
        description: li.description || '',
        qty: Number(li.qty) || 1,
        uom: li.uom || 'LOT',
        unit_price: Number(li.unit_price) || 0,
        amount: (Number(li.qty) || 0) * (Number(li.unit_price) || 0),
      }))
    );
    if (liError) console.error('Error inserting line items:', liError);
  }

  const validSites = site_details.filter(
    (s) => s.region || s.area_city || s.no_of_nodes > 0 || s.cable_length_km > 0
  );
  if (validSites.length > 0) {
    const { error: siteError } = await supabase.from('po_site_details').insert(
      validSites.map((s, i) => ({
        po_id: newPO.id,
        sn: i + 1,
        region: s.region || '',
        area_city: s.area_city || '',
        no_of_nodes: Number(s.no_of_nodes) || 0,
        cable_length_km: Number(s.cable_length_km) || 0,
      }))
    );
    if (siteError) console.error('Error inserting site details:', siteError);
  }

  await recordAuditLog({
    entity_type: 'purchase_order',
    entity_id: newPO.id,
    action: 'CREATE',
    changes: { after: { vendor_id, amount: totalAmount, status: 'draft', currency, line_items_count: line_items.length, sites_count: validSites.length, ...(waive && hasBlockers ? { requirements_waived: true, waived_requirements: waivedRequirements } : {}) } },
    performed_by: user.id,
  });

  await createNotification({
    type: 'po',
    title: '📋 Purchase Order Created',
    message: `A new purchase order was drafted.`,
    link: `/dashboard/purchase-orders/${newPO.id}`,
    created_by: user.id,
  });

  revalidatePath('/dashboard/purchase-orders');

  return {
    id: newPO.id,
    po_number: newPO.po_number,
    url: `/dashboard/purchase-orders/${newPO.id}`,
    message: `Draft PO ${newPO.po_number} created successfully.`,
  };
}

export async function createPurchaseOrder(prevState: any, formData: FormData) {
  let lineItems: POLineItem[] = [];
  let siteDetails: POSiteDetail[] = [];

  try {
    const raw = formData.get('line_items') as string;
    if (raw) lineItems = JSON.parse(raw);
  } catch {
    return { error: 'Invalid line items data.' };
  }

  try {
    const raw = formData.get('site_details') as string;
    if (raw) siteDetails = JSON.parse(raw);
  } catch {
    return { error: 'Invalid site details data.' };
  }

  // Fallback: if no line items, try the legacy amount field so existing forms still work
  const rawAmount = parseFloat(formData.get('amount') as string) || 0;
  if (lineItems.length === 0 && rawAmount > 0) {
    lineItems = [{ description: formData.get('description') as string || 'Service', qty: 1, unit_price: rawAmount }];
  }

  const result = await createPurchaseOrderCore({
    vendor_id: formData.get('vendor_id') as string,
    project_id: formData.get('project_id') as string || undefined,
    line_items: lineItems,
    site_details: siteDetails,
    description: formData.get('description') as string || undefined,
    issued_date: formData.get('issued_date') as string || undefined,
    due_date: formData.get('due_date') as string || undefined,
    dp_amount: parseFloat(formData.get('dp_amount') as string) || 0,
    waive_requirements: formData.get('waive_requirements') === 'on',
  });

  if ('error' in result) return { error: result.error };
  redirect(result.url);
}

export async function submitPOForApproval(poId: string) {
  const supabase = await createClient();
  const { user, role, error: authError } = await requireCapability('po.status', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const { data: po } = await supabase
    .from('purchase_orders')
    .select('status')
    .eq('id', poId)
    .single();

  if (po?.status !== 'draft') {
    return { error: 'Only draft POs can be submitted for approval.' };
  }

  const { error } = await supabase
    .from('purchase_orders')
    .update({
      status: 'pending_approval',
      submitted_for_approval_by: user.id,
      submitted_for_approval_at: new Date().toISOString(),
      rejection_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', poId);

  if (error) return { error: error.message };

  await recordAuditLog({
    entity_type: 'purchase_order',
    entity_id: poId,
    action: 'UPDATE',
    changes: { after: { status: 'pending_approval', submitted_by: user.id } },
    performed_by: user.id,
  });

  await createNotification({
    type: 'po',
    title: '📋 PO Awaiting Approval',
    message: 'A purchase order has been submitted and requires executive approval before issuing.',
    link: `/dashboard/purchase-orders/${poId}`,
    created_by: user.id,
  });

  revalidatePath(`/dashboard/purchase-orders/${poId}`);
  revalidatePath('/dashboard/purchase-orders');
  return { success: true };
}

export async function approvePO(poId: string) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('po.approve', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const { data: po } = await supabase
    .from('purchase_orders')
    .select('status, requirements_waived, waiver_approved, submitted_for_approval_by')
    .eq('id', poId)
    .single();

  if (po?.status !== 'pending_approval') {
    return { error: 'This PO is not pending approval.' };
  }

  if (po.submitted_for_approval_by === user.id) {
    return { error: 'You cannot approve a PO you submitted for approval. Another admin or superadmin must approve it.' };
  }

  if (po.requirements_waived && !po.waiver_approved) {
    return { error: 'Cannot issue: this PO has waived requirements pending executive approval.' };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('purchase_orders')
    .update({ status: 'issued', approved_by_user_id: user.id, approved_at: now, updated_at: now })
    .eq('id', poId);

  if (error) return { error: error.message };

  await recordAuditLog({
    entity_type: 'purchase_order',
    entity_id: poId,
    action: 'UPDATE',
    changes: { after: { status: 'issued', approved_by_user_id: user.id } },
    performed_by: user.id,
  });

  const emailResult = await sendPoIssuedEmail(poId, { actorId: user.id });
  let emailWarning: string | undefined;
  if (emailResult.status === 'failed') {
    emailWarning = emailResult.error || 'The PO was issued but the email could not be sent.';
    await createNotification({
      type: 'po',
      title: '⚠️ PO email not sent',
      message: `${emailWarning} Open the PO to resend it to the vendor.`,
      link: `/dashboard/purchase-orders/${poId}`,
      created_by: user.id,
    });
  }

  revalidatePath(`/dashboard/purchase-orders/${poId}`);
  revalidatePath('/dashboard/purchase-orders');
  return { success: true, emailWarning };
}

export async function rejectPO(poId: string, reason: string) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('po.approve', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  if (!reason?.trim()) return { error: 'A rejection reason is required.' };

  const { data: po } = await supabase
    .from('purchase_orders')
    .select('status')
    .eq('id', poId)
    .single();

  if (po?.status !== 'pending_approval') {
    return { error: 'This PO is not pending approval.' };
  }

  const { error } = await supabase
    .from('purchase_orders')
    .update({
      status: 'draft',
      rejection_reason: reason.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', poId);

  if (error) return { error: error.message };

  await recordAuditLog({
    entity_type: 'purchase_order',
    entity_id: poId,
    action: 'UPDATE',
    changes: { after: { status: 'draft', rejected_by: user.id, rejection_reason: reason.trim() } },
    performed_by: user.id,
  });

  await createNotification({
    type: 'po',
    title: '❌ PO Approval Rejected',
    message: `The purchase order was sent back to draft. Reason: ${reason.trim()}`,
    link: `/dashboard/purchase-orders/${poId}`,
    created_by: user.id,
  });

  revalidatePath(`/dashboard/purchase-orders/${poId}`);
  revalidatePath('/dashboard/purchase-orders');
  return { success: true };
}

export async function updatePOStatus(poId: string, status: string) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('po.status', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  // Issuance is only allowed through the 4-eyes approval flow
  // (submitPOForApproval -> approvePO, which enforces the self-approval and
  // waiver gates). This generic status updater must NOT be able to move a PO to
  // 'issued' directly, otherwise a po.status holder could bypass approval.
  if (status === 'issued') {
    const { data: po } = await supabase
      .from('purchase_orders')
      .select('status')
      .eq('id', poId)
      .single();

    // Idempotent: already issued (e.g. double-click) — succeed without re-issuing.
    if (po?.status === 'issued') return { success: true };

    return {
      error: 'POs can only be issued through the approval flow. Submit the PO for approval, then have a different admin or superadmin approve it.',
    };
  }

  const { error } = await supabase
    .from('purchase_orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', poId);

  if (error) return { error: error.message };

  await recordAuditLog({
    entity_type: 'purchase_order',
    entity_id: poId,
    action: 'UPDATE',
    changes: { after: { status } },
    performed_by: user.id
  });

  await createNotification({
    type: 'po',
    title: `📋 PO Status Updated`,
    message: `Purchase order status changed to ${status}.`,
    link: `/dashboard/purchase-orders/${poId}`,
    created_by: user.id
  });

  // Auto-email the vendor when the PO is issued. Decoupled: a failed send never
  // blocks issuing — it's logged in email_log and surfaced for a manual resend.
  let emailWarning: string | undefined;
  if (status === 'issued') {
    const result = await sendPoIssuedEmail(poId, { actorId: user.id });
    if (result.status === 'failed') {
      emailWarning = result.error || 'The PO was issued but the email could not be sent.';
      await createNotification({
        type: 'po',
        title: '⚠️ PO email not sent',
        message: `${emailWarning} Open the PO to resend it to the vendor.`,
        link: `/dashboard/purchase-orders/${poId}`,
        created_by: user.id
      });
    }
  }

  revalidatePath(`/dashboard/purchase-orders/${poId}`);
  return { success: true, emailWarning };
}

export async function resendPurchaseOrderEmail(poId: string) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('email.send', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const result = await sendPoIssuedEmail(poId, { actorId: user.id });

  await recordAuditLog({
    entity_type: 'purchase_order',
    entity_id: poId,
    action: 'UPDATE',
    changes: { after: { email_resent: result.status === 'sent', email_error: result.error ?? null } },
    performed_by: user.id
  });

  revalidatePath(`/dashboard/purchase-orders/${poId}`);
  if (result.status === 'failed') {
    return { error: result.error || 'Failed to send email.' };
  }
  return { success: true };
}

export async function assignProjectToPO(poId: string, projectId: string | null) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('po.write', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const { error } = await supabase
    .from('purchase_orders')
    .update({ project_id: projectId, updated_at: new Date().toISOString() })
    .eq('id', poId);

  if (error) return { error: error.message };

  await recordAuditLog({
    entity_type: 'purchase_order',
    entity_id: poId,
    action: 'UPDATE',
    changes: { after: { project_id: projectId } },
    performed_by: user.id
  });

  revalidatePath(`/dashboard/purchase-orders/${poId}`);
  return { success: true };
}

export async function deletePurchaseOrder(poId: string) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('po.delete', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized.' };

  const { error } = await supabase
    .from('purchase_orders')
    .delete()
    .eq('id', poId);

  if (error) return { error: error.message };

  await recordAuditLog({
    entity_type: 'purchase_order',
    entity_id: poId,
    action: 'DELETE',
    performed_by: user.id
  });

  revalidatePath('/dashboard/purchase-orders');
  return { success: true };
}

/** Check if adding a cert's percent would push the project over the 100% completion cap. */
async function checkProjectCompletionLimit(supabase: Awaited<ReturnType<typeof createClient>>, poId: string, newPercent: number): Promise<string | null> {
  const { data: po } = await supabase
    .from('purchase_orders')
    .select('project_id')
    .eq('id', poId)
    .single();

  if (!po?.project_id) return null; // no project linked — no cap to enforce

  // Get all approved certs for all POs in this project
  const { data: projectPOs } = await supabase
    .from('purchase_orders')
    .select('id')
    .eq('project_id', po.project_id)
    .is('deleted_at', null);

  const projectPoIds = (projectPOs ?? []).map(p => p.id);

  if (projectPoIds.length === 0) return null;

  const { data: approvedCerts } = await supabase
    .from('po_completion_certificates')
    .select('po_id, percent_complete')
    .eq('status', 'approved')
    .in('po_id', projectPoIds);

  // Max approved % per PO, then straight sum
  const maxPerPO = new Map<string, number>();
  for (const c of approvedCerts ?? []) {
    const curr = maxPerPO.get(c.po_id) ?? 0;
    maxPerPO.set(c.po_id, Math.max(curr, Number(c.percent_complete)));
  }

  let currentSum = 0;
  for (const pct of maxPerPO.values()) currentSum += pct;

  const projected = currentSum + newPercent;
  if (projected > 100) {
    const remaining = Math.max(0, 100 - currentSum).toFixed(2);
    return `This submission would bring the project completion to ${projected.toFixed(2)}%, exceeding the 100% limit. Only ${remaining}% remaining.`;
  }

  return null;
}

export async function submitCompletionCertificate(formData: FormData) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('po.write', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const poId = formData.get('po_id') as string;
  const vendorId = formData.get('vendor_id') as string;
  const percentStr = formData.get('percent_complete') as string;
  const notes = formData.get('notes') as string | null;
  const file = formData.get('file') as File | null;

  const percent = parseFloat(percentStr);
  if (!poId || isNaN(percent) || percent <= 0 || percent > 100) {
    return { error: 'Invalid input. Provide a PO and a completion percentage between 1–100.' };
  }

  // Hard-block if this cert would push the project over 100%
  const limitError = await checkProjectCompletionLimit(supabase, poId, percent);
  if (limitError) return { error: limitError };

  let file_url: string | null = null;
  let file_name: string | null = null;

  if (file && file.size > 0) {
    const ext = file.name.split('.').pop();
    const filePath = `vendors/${vendorId}/certs/CERT_${poId}_${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('vendor-documents')
      .upload(filePath, file, { contentType: file.type, upsert: false });
    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage.from('vendor-documents').getPublicUrl(filePath);
      file_url = publicUrl;
      file_name = file.name;
    }
  }

  const { data: cert, error } = await supabase
    .from('po_completion_certificates')
    .insert({
      po_id: poId,
      percent_complete: percent,
      file_url,
      file_name,
      notes: notes || null,
      status: 'submitted',
      submitted_by: user.id,
    })
    .select('id')
    .single();

  if (error) return { error: error.message };

  await recordAuditLog({
    entity_type: 'purchase_order',
    entity_id: poId,
    action: 'UPDATE',
    changes: { after: { completion_cert_submitted: true, percent_complete: percent } },
    performed_by: user.id,
  });

  await createNotification({
    type: 'po',
    title: '📋 Completion Certificate Submitted',
    message: `A certificate of completion at ${percent}% was submitted and awaits approval.`,
    link: `/dashboard/purchase-orders/${poId}`,
    created_by: user.id,
  });

  revalidatePath(`/dashboard/purchase-orders/${poId}`);
  return { success: true };
}

export async function approveCompletionCertificate(certId: string) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('po.approve_completion', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const { data: cert } = await supabase
    .from('po_completion_certificates')
    .select('po_id, percent_complete, status, submitted_by')
    .eq('id', certId)
    .single();

  if (!cert || cert.status !== 'submitted') {
    return { error: 'This certificate is not pending approval.' };
  }

  if (cert.submitted_by === user.id) {
    return { error: 'You cannot approve a certificate you submitted.' };
  }

  // Hard-block if approving this cert would push the project over 100%
  const limitError = await checkProjectCompletionLimit(supabase, cert.po_id, Number(cert.percent_complete));
  if (limitError) return { error: limitError };

  const { error } = await supabase
    .from('po_completion_certificates')
    .update({ status: 'approved', approved_by: user.id, approved_at: new Date().toISOString() })
    .eq('id', certId);

  if (error) return { error: error.message };

  await recordAuditLog({
    entity_type: 'purchase_order',
    entity_id: cert.po_id,
    action: 'UPDATE',
    changes: { after: { completion_cert_approved: true, cert_id: certId } },
    performed_by: user.id,
  });

  revalidatePath(`/dashboard/purchase-orders/${cert.po_id}`);
  return { success: true };
}

export async function rejectCompletionCertificate(certId: string) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('po.approve_completion', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const { data: cert } = await supabase
    .from('po_completion_certificates')
    .select('po_id, status')
    .eq('id', certId)
    .single();

  if (!cert || cert.status !== 'submitted') {
    return { error: 'This certificate is not pending approval.' };
  }

  const { error } = await supabase
    .from('po_completion_certificates')
    .update({ status: 'rejected' })
    .eq('id', certId);

  if (error) return { error: error.message };

  await recordAuditLog({
    entity_type: 'purchase_order',
    entity_id: cert.po_id,
    action: 'UPDATE',
    changes: { after: { completion_cert_rejected: true, cert_id: certId } },
    performed_by: user.id,
  });

  revalidatePath(`/dashboard/purchase-orders/${cert.po_id}`);
  return { success: true };
}

export async function approveWaiver(poId: string) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('po.approve_waiver', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const { data: po } = await supabase
    .from('purchase_orders')
    .select('requirements_waived, waiver_approved, waived_by')
    .eq('id', poId)
    .single();

  if (!po?.requirements_waived || po?.waiver_approved) {
    return { error: 'This PO does not have a pending waiver to approve.' };
  }

  if (po.waived_by === user.id) {
    return { error: 'You cannot approve a waiver you created.' };
  }

  const { error } = await supabase
    .from('purchase_orders')
    .update({
      waiver_approved: true,
      waiver_approved_by: user.id,
      waiver_approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', poId);

  if (error) return { error: error.message };

  await recordAuditLog({
    entity_type: 'purchase_order',
    entity_id: poId,
    action: 'UPDATE',
    changes: { after: { waiver_approved: true, waiver_approved_by: user.id } },
    performed_by: user.id,
  });

  revalidatePath(`/dashboard/purchase-orders/${poId}`);
  return { success: true };
}

export async function rejectWaiver(poId: string) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('po.approve_waiver', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const { data: po } = await supabase
    .from('purchase_orders')
    .select('requirements_waived, waiver_approved')
    .eq('id', poId)
    .single();

  if (!po?.requirements_waived || po?.waiver_approved) {
    return { error: 'This PO does not have a pending waiver to reject.' };
  }

  // Cancel the PO — a rejected waiver means the underlying compliance gap was not excused.
  // The admin must recreate the PO once the vendor meets requirements.
  const { error } = await supabase
    .from('purchase_orders')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', poId);

  if (error) return { error: error.message };

  await recordAuditLog({
    entity_type: 'purchase_order',
    entity_id: poId,
    action: 'UPDATE',
    changes: { after: { status: 'cancelled', waiver_rejected_by: user.id } },
    performed_by: user.id,
  });

  revalidatePath(`/dashboard/purchase-orders/${poId}`);
  revalidatePath('/dashboard/purchase-orders');
  return { success: true };
}

// ─── Payment Reservations ────────────────────────────────────────────────────

export async function notifyFinanceForPayment(poId: string) {
  const supabase = await createClient();
  const { user, role, error: authError } = await requireCapability('payment_reservation.notify', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  // Compute reserved_amount: po.amount - dp_amount - total paid
  const { data: po } = await supabase
    .from('purchase_orders')
    .select('id, po_number, amount, dp_amount, project_id, vendor_id, vendors(name)')
    .eq('id', poId)
    .single();
  if (!po) return { error: 'PO not found' };

  const { data: invoices } = await supabase
    .from('service_invoices')
    .select('id')
    .eq('po_id', poId);
  const invoiceIds = (invoices || []).map((i: any) => i.id);

  let totalPaid = 0;
  if (invoiceIds.length > 0) {
    const { data: payments } = await supabase
      .from('payments')
      .select('amount_paid')
      .in('invoice_id', invoiceIds);
    totalPaid = (payments || []).reduce((s: number, p: any) => s + Number(p.amount_paid), 0);
  }

  const reservedAmount = Math.max(0, Number(po.amount) - Number(po.dp_amount || 0) - totalPaid);

  const { error: insertError } = await supabase.from('payment_reservations').insert({
    po_id: poId,
    project_id: po.project_id,
    vendor_id: po.vendor_id,
    reserved_amount: reservedAmount,
    notified_by: user.id,
  });
  if (insertError) return { error: insertError.message };

  const vendorName = (po.vendors as any)?.name || 'Vendor';
  await createNotification({
    type: 'payment',
    title: 'Payment Reservation Created',
    message: `${vendorName} may request payment for PO ${po.po_number}. ₱${reservedAmount.toLocaleString()} reserved.`,
    link: `/dashboard/purchase-orders/${poId}`,
    created_by: user.id,
  });

  revalidatePath(`/dashboard/purchase-orders/${poId}`);
  revalidatePath('/dashboard/accounting');
  return { success: true };
}

export async function acknowledgePaymentReservation(reservationId: string) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('payment_reservation.acknowledge', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const { data: res } = await supabase
    .from('payment_reservations')
    .select('id, po_id, reserved_amount, notified_by, purchase_orders(po_number, vendors(name))')
    .eq('id', reservationId)
    .single();
  if (!res) return { error: 'Reservation not found' };

  const { error } = await supabase
    .from('payment_reservations')
    .update({ status: 'acknowledged', acknowledged_by: user.id, acknowledged_at: new Date().toISOString() })
    .eq('id', reservationId)
    .eq('status', 'pending');
  if (error) return { error: error.message };

  const po = res.purchase_orders as any;
  const vendorName = po?.vendors?.name || 'Vendor';
  await createNotification({
    type: 'payment',
    title: 'Payment Reservation Acknowledged',
    message: `Finance acknowledged payment reservation for ${vendorName} (PO ${po?.po_number}). ₱${Number(res.reserved_amount).toLocaleString()} is being prepared.`,
    link: `/dashboard/purchase-orders/${res.po_id}`,
    created_by: user.id,
  });

  revalidatePath(`/dashboard/purchase-orders/${res.po_id}`);
  revalidatePath('/dashboard/accounting');
  return { success: true };
}

export async function cancelPaymentReservation(reservationId: string, reason: string) {
  const supabase = await createClient();
  const { user, role, error: authError } = await requireCapability('po.status', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const { data: res } = await supabase
    .from('payment_reservations')
    .select('id, po_id, reserved_amount, purchase_orders(po_number, vendors(name))')
    .eq('id', reservationId)
    .single();
  if (!res) return { error: 'Reservation not found' };

  const { error } = await supabase
    .from('payment_reservations')
    .update({ status: 'cancelled', cancelled_by: user.id, cancelled_reason: reason, cancelled_at: new Date().toISOString() })
    .eq('id', reservationId)
    .in('status', ['pending', 'acknowledged']);
  if (error) return { error: error.message };

  const po = res.purchase_orders as any;
  const vendorName = po?.vendors?.name || 'Vendor';
  await createNotification({
    type: 'payment',
    title: 'Payment Reservation Cancelled',
    message: `Payment reservation for ${vendorName} (PO ${po?.po_number}) was cancelled. Reason: ${reason}`,
    link: `/dashboard/purchase-orders/${res.po_id}`,
    created_by: user.id,
  });

  revalidatePath(`/dashboard/purchase-orders/${res.po_id}`);
  revalidatePath('/dashboard/accounting');
  return { success: true };
}

export async function markReservationPaid(reservationId: string) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('payment_reservation.acknowledge', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const { data: res } = await supabase
    .from('payment_reservations')
    .select('po_id')
    .eq('id', reservationId)
    .single();
  if (!res) return { error: 'Reservation not found' };

  const { error } = await supabase
    .from('payment_reservations')
    .update({ status: 'paid' })
    .eq('id', reservationId)
    .eq('status', 'acknowledged');
  if (error) return { error: error.message };

  revalidatePath(`/dashboard/purchase-orders/${res.po_id}`);
  revalidatePath('/dashboard/accounting');
  return { success: true };
}

// ─── Payment Requests ─────────────────────────────────────────────────────────

export async function createPaymentRequest(
  poId: string,
  amount: number,
  dueInDays?: number,
  notes?: string,
  completionCertId?: string,
) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('payment_request.create', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const { data: po } = await supabase
    .from('purchase_orders')
    .select('id, po_number, amount, project_id, vendor_id, vendors(name)')
    .eq('id', poId)
    .single();
  if (!po) return { error: 'PO not found' };

  const { data: activePR } = await supabase
    .from('payment_requests')
    .select('id')
    .eq('po_id', poId)
    .in('status', ['pending', 'approved'])
    .limit(1)
    .maybeSingle();
  if (activePR) return { error: 'An active Payment Request already exists for this PO.' };

  let percentComplete: number | null = null;

  if (completionCertId) {
    const { data: cert } = await supabase
      .from('po_completion_certificates')
      .select('percent_complete, status')
      .eq('id', completionCertId)
      .single();
    if (!cert) return { error: 'Completion certificate not found.' };
    if (cert.status !== 'approved') return { error: 'Only approved completion certificates can be referenced.' };
    percentComplete = Number(cert.percent_complete);

    const poAmount = Number(po.amount);
    const ceiling = (percentComplete / 100) * poAmount;
    if (amount > ceiling) {
      return {
        error: `Requested amount (₱${amount.toLocaleString()}) exceeds the completion certificate ceiling (${percentComplete}% = ₱${ceiling.toLocaleString()}).`,
      };
    }
  } else {
    if (amount > Number(po.amount)) {
      return { error: `Requested amount exceeds the PO total (₱${Number(po.amount).toLocaleString()}).` };
    }
  }

  const { error: insertError } = await supabase.from('payment_requests').insert({
    po_id: poId,
    project_id: po.project_id,
    vendor_id: po.vendor_id,
    amount,
    due_in_days: dueInDays ?? 30,
    notes: notes || null,
    completion_cert_id: completionCertId || null,
    percent_complete: percentComplete,
    created_by: user.id,
  });
  if (insertError) return { error: insertError.message };

  const vendorName = (po.vendors as any)?.name || 'Vendor';
  await createNotification({
    type: 'payment_request',
    title: 'Payment Request Created',
    message: `Payment request for ${vendorName} (PO ${po.po_number}) — ₱${amount.toLocaleString()}, due in ${dueInDays ?? 30} days.`,
    link: `/dashboard/purchase-orders/${poId}`,
    created_by: user.id,
  });

  revalidatePath(`/dashboard/purchase-orders/${poId}`);
  revalidatePath('/dashboard/accounting');
  return { success: true };
}

export async function approvePaymentRequest(requestId: string) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('payment_request.approve', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const { data: pr } = await supabase
    .from('payment_requests')
    .select('id, po_id, amount, purchase_orders(po_number, vendors(name))')
    .eq('id', requestId)
    .single();
  if (!pr) return { error: 'Payment Request not found' };

  const { error } = await supabase
    .from('payment_requests')
    .update({ status: 'approved', approved_by: user.id, approved_at: new Date().toISOString() })
    .eq('id', requestId)
    .eq('status', 'pending');
  if (error) return { error: error.message };

  const po = pr.purchase_orders as any;
  const vendorName = po?.vendors?.name || 'Vendor';
  await createNotification({
    type: 'payment_request',
    title: 'Payment Request Approved',
    message: `Payment request for ${vendorName} (PO ${po?.po_number}) — ₱${Number(pr.amount).toLocaleString()} approved. The subcontractor may now submit a progress-billing invoice.`,
    link: `/dashboard/purchase-orders/${pr.po_id}`,
    created_by: user.id,
  });

  revalidatePath(`/dashboard/purchase-orders/${pr.po_id}`);
  revalidatePath('/dashboard/accounting');
  return { success: true };
}

export async function rejectPaymentRequest(requestId: string, reason: string) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('payment_request.approve', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const { data: pr } = await supabase
    .from('payment_requests')
    .select('id, po_id, amount, purchase_orders(po_number, vendors(name))')
    .eq('id', requestId)
    .single();
  if (!pr) return { error: 'Payment Request not found' };

  const { error } = await supabase
    .from('payment_requests')
    .update({
      status: 'rejected',
      rejected_by: user.id,
      rejected_at: new Date().toISOString(),
      rejection_reason: reason,
    })
    .eq('id', requestId)
    .eq('status', 'pending');
  if (error) return { error: error.message };

  const po = pr.purchase_orders as any;
  const vendorName = po?.vendors?.name || 'Vendor';
  await createNotification({
    type: 'payment_request',
    title: 'Payment Request Rejected',
    message: `Payment request for ${vendorName} (PO ${po?.po_number}) — ₱${Number(pr.amount).toLocaleString()} rejected. Reason: ${reason}`,
    link: `/dashboard/purchase-orders/${pr.po_id}`,
    created_by: user.id,
  });

  revalidatePath(`/dashboard/purchase-orders/${pr.po_id}`);
  revalidatePath('/dashboard/accounting');
  return { success: true };
}
