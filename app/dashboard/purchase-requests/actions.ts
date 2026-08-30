'use server'

import { refresh, revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

// ponytail: defer via next/server after() without breaking jest (which lacks Request)
function defer(fn: () => Promise<void>) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { after } = require('next/server') as { after: (f: () => void) => void };
    after(fn);
  } catch {
    void fn();
  }
}
import { createNotification, createNotificationForRoles } from '@/utils/notifications';
import { recordAuditLog } from '@/utils/audit';
import { requireCapability, getCurrentProfile, hasCapability } from '@/lib/auth/permissions';
import { sendPrPendingApprovalEmail } from '@/lib/email/pr-pending-approval';
import { sendPrPendingFinanceEmail } from '@/lib/email/pr-pending-finance';
import { sendPrApprovedEmail } from '@/lib/email/pr-approved';

type PRLineItem = { item_code?: string; description: string; qty: number; uom?: string; unit_price: number };
type PRSiteDetail = {
  region?: string;
  area_city?: string;
  node_id?: string;
  phase?: string;
  no_of_nodes?: number;
  cable_length_km?: number;
};

interface CreatePRInput {
  project_id?: string;
  vendor_id?: string;
  line_items: PRLineItem[];
  site_details?: PRSiteDetail[];
  description?: string;
  dp_amount?: number;
  dp_percent?: number;
}

// The percent is the primary input on the forms; the peso amount is always
// derived. A legacy dp_amount (chat tool / pre-existing callers) with no
// percent is kept as-is and its percent derived for display/re-prefill.
function resolveDownpayment(
  dpPercent: number | undefined,
  dpAmount: number | undefined,
  totalAmount: number
): { dp_amount: number; dp_percent: number } | string {
  if (dpPercent !== undefined && dpPercent !== null && !Number.isNaN(dpPercent)) {
    if (dpPercent < 0 || dpPercent > 100) {
      return 'Downpayment percent must be between 0 and 100.';
    }
    const percent = Math.round(dpPercent * 100) / 100;
    const amount = Math.round(((totalAmount * percent) / 100) * 100) / 100;
    return { dp_amount: amount, dp_percent: percent };
  }
  const dp = Math.max(0, Number(dpAmount) || 0);
  if (dp > totalAmount) {
    return 'Downpayment cannot exceed the estimated total.';
  }
  const percent = totalAmount > 0 ? (dp / totalAmount) * 100 : 0;
  return { dp_amount: Math.round(dp * 100) / 100, dp_percent: Math.round(percent * 100) / 100 };
}

function siteDetailRows(prId: string, siteDetails: PRSiteDetail[]) {
  return siteDetails.map((s, i) => ({
    pr_id: prId,
    sn: i + 1,
    region: s.region || '',
    area_city: s.area_city || '',
    node_id: s.node_id || '',
    phase: s.phase || '',
    no_of_nodes: Number(s.no_of_nodes) || 0,
    cable_length_km: Number(s.cable_length_km) || 0,
  }));
}

function parseJsonField(formData: FormData, name: string): any[] | null {
  const raw = formData.get(name) as string;
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function createPurchaseRequestCore(input: CreatePRInput) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('pr.create', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const { project_id, vendor_id, line_items, site_details = [], description, dp_amount = 0, dp_percent } = input;

  const totalAmount = line_items.reduce((sum, li) => sum + (Number(li.qty) || 0) * (Number(li.unit_price) || 0), 0);
  if (totalAmount <= 0) return { error: 'Total amount must be greater than zero. Add at least one line item with a price.' };

  const downpayment = resolveDownpayment(dp_percent, dp_amount, totalAmount);
  if (typeof downpayment === 'string') return { error: downpayment };

  const { data: entity } = await supabase.from('internal_entities').select('id').limit(1).single();

  const { data: newPR, error } = await supabase.from('purchase_requests').insert({
    project_id: project_id || null,
    vendor_id: vendor_id || null,
    description: description || null,
    amount: totalAmount,
    dp_amount: downpayment.dp_amount,
    dp_percent: downpayment.dp_percent,
    status: 'draft',
    internal_entity_id: entity?.id || null,
    created_by: user.id,
  }).select('id, pr_number').single();

  if (error) {
    console.error('Error creating PR:', error);
    return { error: error.message };
  }

  if (line_items.length > 0) {
    const { error: liError } = await supabase.from('pr_line_items').insert(
      line_items.map((li, i) => ({
        pr_id: newPR.id,
        line_no: i + 1,
        item_code: li.item_code || '',
        description: li.description || '',
        qty: Number(li.qty) || 1,
        uom: li.uom || 'LOT',
        unit_price: Number(li.unit_price) || 0,
        amount: (Number(li.qty) || 0) * (Number(li.unit_price) || 0),
      }))
    );
    if (liError) console.error('Error inserting PR line items:', liError);
  }

  if (site_details.length > 0) {
    const { error: sdError } = await supabase.from('pr_site_details').insert(siteDetailRows(newPR.id, site_details));
    if (sdError) console.error('Error inserting PR site details:', sdError);
  }

  await recordAuditLog({
    entity_type: 'purchase_request',
    entity_id: newPR.id,
    action: 'CREATE',
    changes: {
      after: {
        amount: totalAmount,
        dp_amount: downpayment.dp_amount,
        dp_percent: downpayment.dp_percent,
        vendor_id: vendor_id || null,
        status: 'draft',
        line_items_count: line_items.length,
        site_details_count: site_details.length,
      },
    },
    performed_by: user.id,
  });

  revalidatePath('/dashboard/purchase-requests');

  return {
    id: newPR.id,
    pr_number: newPR.pr_number,
    url: `/dashboard/purchase-requests/${newPR.id}`,
    message: `Draft PR ${newPR.pr_number} created successfully.`,
  };
}

export async function createPurchaseRequest(prevState: any, formData: FormData) {
  const lineItems = parseJsonField(formData, 'line_items');
  if (!lineItems) return { error: 'Invalid line items data.' };
  const siteDetails = parseJsonField(formData, 'site_details');
  if (!siteDetails) return { error: 'Invalid site details data.' };

  const result = await createPurchaseRequestCore({
    project_id: formData.get('project_id') as string || undefined,
    vendor_id: formData.get('vendor_id') as string || undefined,
    line_items: lineItems,
    site_details: siteDetails,
    description: formData.get('description') as string || undefined,
    dp_amount: parseFloat(formData.get('dp_amount') as string) || 0,
    dp_percent: formData.get('dp_percent') ? parseFloat(formData.get('dp_percent') as string) : undefined,
  });

  if ('error' in result) return { error: result.error };
  redirect(result.url);
}

export async function updatePurchaseRequestAction(prevState: any, formData: FormData) {
  const prId = formData.get('pr_id') as string;
  if (!prId) return { error: 'Purchase request not found.' };

  const result = await updatePurchaseRequest(prId, formData);
  if ('error' in result) return { error: result.error };
  redirect(`/dashboard/purchase-requests/${prId}`);
}

export async function updatePurchaseRequest(prId: string, formData: FormData) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('pr.create', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const { data: pr } = await supabase.from('purchase_requests').select('status').eq('id', prId).single();
  if (pr?.status !== 'draft') return { error: 'Only draft PRs can be edited.' };

  let lineItems: PRLineItem[] = [];
  let siteDetails: PRSiteDetail[] = [];
  const parsedLineItems = parseJsonField(formData, 'line_items');
  const parsedSiteDetails = parseJsonField(formData, 'site_details');
  if (!parsedLineItems) return { error: 'Invalid line items data.' };
  if (!parsedSiteDetails) return { error: 'Invalid site details data.' };
  lineItems = parsedLineItems;
  siteDetails = parsedSiteDetails;

  const totalAmount = lineItems.reduce((sum, li) => sum + (Number(li.qty) || 0) * (Number(li.unit_price) || 0), 0);
  if (totalAmount <= 0) return { error: 'Total amount must be greater than zero. Add at least one line item with a price.' };

  const downpayment = resolveDownpayment(
    formData.get('dp_percent') ? parseFloat(formData.get('dp_percent') as string) : undefined,
    parseFloat(formData.get('dp_amount') as string) || 0,
    totalAmount
  );
  if (typeof downpayment === 'string') return { error: downpayment };

  const now = new Date().toISOString();
  const { error, count } = await supabase
    .from('purchase_requests')
    .update({
      description: (formData.get('description') as string) || null,
      project_id: (formData.get('project_id') as string) || null,
      vendor_id: (formData.get('vendor_id') as string) || null,
      amount: totalAmount,
      dp_amount: downpayment.dp_amount,
      dp_percent: downpayment.dp_percent,
      updated_at: now,
    }, { count: 'exact' })
    .eq('id', prId)
    .eq('status', 'draft');
  if (error) return { error: error.message };
  if (count === 0) return { error: 'Only draft PRs can be edited.' };

  // Replace line items (draft-only, so a wholesale swap is safe)
  await supabase.from('pr_line_items').delete().eq('pr_id', prId);
  const { error: liError } = await supabase.from('pr_line_items').insert(
    lineItems.map((li, i) => ({
      pr_id: prId,
      line_no: i + 1,
      item_code: li.item_code || '',
      description: li.description || '',
      qty: Number(li.qty) || 1,
      uom: li.uom || 'LOT',
      unit_price: Number(li.unit_price) || 0,
      amount: (Number(li.qty) || 0) * (Number(li.unit_price) || 0),
    }))
  );
  if (liError) return { error: liError.message };

  // Replace site details (draft-only, so a wholesale swap is safe)
  await supabase.from('pr_site_details').delete().eq('pr_id', prId);
  if (siteDetails.length > 0) {
    const { error: sdError } = await supabase.from('pr_site_details').insert(siteDetailRows(prId, siteDetails));
    if (sdError) return { error: sdError.message };
  }

  await recordAuditLog({
    entity_type: 'purchase_request',
    entity_id: prId,
    action: 'UPDATE',
    changes: {
      after: { amount: totalAmount, dp_amount: downpayment.dp_amount, dp_percent: downpayment.dp_percent, vendor_id: (formData.get('vendor_id') as string) || null, line_items_count: lineItems.length, site_details_count: siteDetails.length },
    },
    performed_by: user.id,
  });

  revalidatePath(`/dashboard/purchase-requests/${prId}`);
  revalidatePath('/dashboard/purchase-requests');
  return { success: true };
}

export async function submitPRForApproval(prId: string, approverIds: string[] = [], financeApproverIds: string[] = []) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('pr.status', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const { data: pr } = await supabase
    .from('purchase_requests')
    .select('status')
    .eq('id', prId)
    .single();

  if (pr?.status !== 'draft') {
    return { error: 'Only draft PRs can be submitted for approval.' };
  }

  // Same 4-eyes validation as POs: at least one approver, all admins/superadmins,
  // never the submitter.
  const uniqueApproverIds = [...new Set(approverIds)].filter(Boolean);
  if (uniqueApproverIds.length === 0) {
    return { error: 'Select at least one admin or superadmin to approve this PR.' };
  }
  if (uniqueApproverIds.includes(user.id)) {
    return { error: 'You cannot select yourself as an approver.' };
  }

  const { data: approverProfiles } = await supabase
    .from('profiles')
    .select('id, role')
    .in('id', uniqueApproverIds);

  const validApproverIds = (approverProfiles || [])
    .filter((p) => p.role === 'superadmin' || p.role === 'admin')
    .map((p) => p.id);

  if (validApproverIds.length !== uniqueApproverIds.length) {
    return { error: 'Every selected approver must be an admin or superadmin.' };
  }

  // Finance approvers follow the same rules, scoped to finance/superadmin roles.
  const uniqueFinanceApproverIds = [...new Set(financeApproverIds)].filter(Boolean);
  if (uniqueFinanceApproverIds.length === 0) {
    return { error: 'Select at least one finance or superadmin to approve this PR.' };
  }
  if (uniqueFinanceApproverIds.includes(user.id)) {
    return { error: 'You cannot select yourself as a finance approver.' };
  }

  const { data: financeApproverProfiles } = await supabase
    .from('profiles')
    .select('id, role')
    .in('id', uniqueFinanceApproverIds);

  const validFinanceApproverIds = (financeApproverProfiles || [])
    .filter((p) => p.role === 'superadmin' || p.role === 'finance')
    .map((p) => p.id);

  if (validFinanceApproverIds.length !== uniqueFinanceApproverIds.length) {
    return { error: 'Every selected finance approver must be a finance or superadmin user.' };
  }

  const { error, count } = await supabase
    .from('purchase_requests')
    .update({
      status: 'pending_approval',
      submitted_for_approval_by: user.id,
      submitted_for_approval_at: new Date().toISOString(),
      approval_requested_from: uniqueApproverIds,
      finance_approval_requested_from: uniqueFinanceApproverIds,
      rejection_reason: null,
      admin_approved_by: [],
      admin_approved_at: [],
      approved_by_user_id: null,
      approved_at: null,
      updated_at: new Date().toISOString(),
    } as any, { count: 'exact' })
    .eq('id', prId)
    .eq('status', 'draft');

  if (error) return { error: error.message };
  if (count === 0) return { error: 'Only draft PRs can be submitted for approval.' };

  await recordAuditLog({
    entity_type: 'purchase_request',
    entity_id: prId,
    action: 'UPDATE',
    changes: {
      after: {
        status: 'pending_approval',
        submitted_by: user.id,
        approval_requested_from: uniqueApproverIds,
        finance_approval_requested_from: uniqueFinanceApproverIds,
      },
    },
    performed_by: user.id,
  });

  await createNotification({
    type: 'pr',
    title: '📋 PR Awaiting Approval',
    message: 'A purchase request has been submitted and requires approval before it can be converted to a PO.',
    link: `/dashboard/purchase-requests/${prId}`,
    created_by: user.id,
    recipientIds: uniqueApproverIds,
  });

  revalidatePath(`/dashboard/purchase-requests/${prId}`);
  revalidatePath('/dashboard/purchase-requests');

  // ponytail: email deferred via defer() so submit returns before SMTP/PDF work
  defer(async () => {
    const emailResult = await sendPrPendingApprovalEmail(prId, { actorId: user.id });
    if (emailResult.status === 'failed') {
      await createNotification({
        type: 'pr',
        title: '⚠️ Approval email not sent',
        message: `A PR was submitted for approval but the notification email to the selected approvers could not be sent. ${emailResult.error ?? ''}`.trim(),
        link: `/dashboard/purchase-requests/${prId}`,
        created_by: user.id,
        recipientIds: [user.id],
      });
    }
  });

  return { success: true };
}

export async function approvePR(prId: string) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('pr.approve', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const { data: pr } = await supabase
    .from('purchase_requests')
    .select('status, submitted_for_approval_by, approval_requested_from, admin_approved_by, admin_approved_at')
    .eq('id', prId)
    .single();

  if (pr?.status !== 'pending_approval') {
    return { error: 'This PR is not pending the admin approval.' };
  }

  if (pr.submitted_for_approval_by === user.id) {
    return { error: 'You cannot approve a PR you submitted for approval. Another admin or superadmin must approve it.' };
  }

  const requested: string[] = ((pr as any).approval_requested_from as string[] | null) || [];
  const already: string[] = ((pr as any).admin_approved_by as string[] | null) || [];
  const alreadyAt: string[] = ((pr as any).admin_approved_at as string[] | null) || [];

  // AND when >1 approvers chosen: must be in the requested set. Single-approver stays OR (notify-only) for backward compat.
  if (requested.length > 1 && !requested.includes(user.id)) {
    return { error: 'You are not one of the requested approvers for this PR.' };
  }
  if (already.includes(user.id)) {
    return { error: 'You have already approved this PR.' };
  }

  const now = new Date().toISOString();
  const newApprovedBy = [...already, user.id];
  const newApprovedAt = [...alreadyAt, now];
  // AND: N-of-N when >1, else single approval suffices
  const required = requested.length > 1 ? requested.length : 1;
  const isComplete = requested.length > 1 ? requested.every((id) => newApprovedBy.includes(id)) : newApprovedBy.length >= 1;

  if (!isComplete) {
    const { error, count } = await supabase
      .from('purchase_requests')
      .update({ admin_approved_by: newApprovedBy, admin_approved_at: newApprovedAt, updated_at: now } as any, { count: 'exact' })
      .eq('id', prId)
      .eq('status', 'pending_approval');
    if (error) return { error: error.message };
    if (count === 0) return { error: 'This PR is not pending the admin approval.' };

    await recordAuditLog({
      entity_type: 'purchase_request',
      entity_id: prId,
      action: 'UPDATE',
      changes: { after: { admin_approved_by: newApprovedBy, partial: true } },
      performed_by: user.id,
    });

    const remaining = requested.filter((id) => !newApprovedBy.includes(id));
    if (remaining.length > 0) {
      await createNotification({
        type: 'pr',
        title: '⏳ PR Partial Approval',
        message: `A purchase request received approval (${newApprovedBy.length}/${required}). Awaiting ${remaining.length} more admin approval(s).`,
        link: `/dashboard/purchase-requests/${prId}`,
        created_by: user.id,
        recipientIds: remaining,
      });
    }

    revalidatePath(`/dashboard/purchase-requests/${prId}`);
    revalidatePath('/dashboard/purchase-requests');
    return { success: true, partial: true } as any;
  }

  const { error, count } = await supabase
    .from('purchase_requests')
    .update({ status: 'pending_finance', approved_by_user_id: user.id, approved_at: now, admin_approved_by: newApprovedBy, admin_approved_at: newApprovedAt, updated_at: now } as any, { count: 'exact' })
    .eq('id', prId)
    .eq('status', 'pending_approval');

  if (error) return { error: error.message };
  if (count === 0) return { error: 'This PR is not pending the admin approval.' };

  await recordAuditLog({
    entity_type: 'purchase_request',
    entity_id: prId,
    action: 'UPDATE',
    changes: { after: { status: 'pending_finance', admin_approved_by: newApprovedBy } },
    performed_by: user.id,
  });

  await createNotificationForRoles({
    type: 'pr',
    title: '👤 PR Admin Approved',
    message: 'A purchase request was approved by the admin and is pending the finance budget check.',
    link: `/dashboard/purchase-requests/${prId}`,
    created_by: user.id,
    roles: ['finance'],
  });

  revalidatePath(`/dashboard/purchase-requests/${prId}`);
  revalidatePath('/dashboard/purchase-requests');
  refresh();

  defer(async () => {
    const emailResult = await sendPrPendingFinanceEmail(prId, { actorId: user.id });
    if (emailResult.status === 'failed') {
      await createNotification({
        type: 'pr',
        title: '⚠️ Finance email not sent',
        message: `A PR passed the admin stage but the finance notification email could not be sent. ${emailResult.error ?? ''}`.trim(),
        link: `/dashboard/purchase-requests/${prId}`,
        created_by: user.id,
        recipientIds: [user.id],
      });
    }
  });

  return { success: true };
}

export async function resendPrFinanceEmail(prId: string, financeApproverIds?: string[]) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('pr.approve', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const { data: pr } = await supabase
    .from('purchase_requests')
    .select('status, finance_approval_requested_from')
    .eq('id', prId)
    .single();
  if (!pr) return { error: 'Purchase request not found.' };
  if (pr.status !== 'pending_finance') return { error: 'Only PRs pending finance approval can be resent to finance.' };

  // If caller supplied new approvers (e.g. stuck PR with empty list), validate and persist them.
  let targetIds = (pr.finance_approval_requested_from as string[] | null) || [];
  if (financeApproverIds !== undefined) {
    const unique = [...new Set(financeApproverIds)].filter(Boolean);
    if (unique.length === 0) return { error: 'Select at least one finance or superadmin to approve this PR.' };
    const { data: profiles } = await supabase.from('profiles').select('id, role').in('id', unique);
    const valid = (profiles || []).filter((p) => p.role === 'superadmin' || p.role === 'finance').map((p) => p.id);
    if (valid.length !== unique.length) return { error: 'Every selected finance approver must be a finance or superadmin user.' };
    targetIds = unique;
    const { error: updErr } = await supabase
      .from('purchase_requests')
      .update({ finance_approval_requested_from: unique, updated_at: new Date().toISOString() })
      .eq('id', prId);
    if (updErr) return { error: updErr.message };
  }

  if (targetIds.length === 0) return { error: 'No finance approvers are assigned to this PR. Provide finance approver(s) to resend.' };

  const emailResult = await sendPrPendingFinanceEmail(prId, { actorId: user.id });
  if (emailResult.status === 'failed') return { error: emailResult.error || 'Failed to send finance notification email.' };

  await recordAuditLog({
    entity_type: 'purchase_request',
    entity_id: prId,
    action: 'UPDATE',
    changes: { after: { resent_to_finance: targetIds } },
    performed_by: user.id,
  });

  return { success: true };
}

export async function approvePRFinance(prId: string) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('pr.approve_finance', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const { data: pr } = await supabase
    .from('purchase_requests')
    .select('status, approved_by_user_id')
    .eq('id', prId)
    .single();

  if (pr?.status !== 'pending_finance') {
    return { error: 'This PR is not pending the finance approval.' };
  }

  if (pr.approved_by_user_id === user.id) {
    return { error: 'You cannot approve a PR you approved at the admin stage. Another finance or superadmin user must do the budget check.' };
  }

  const now = new Date().toISOString();
  const { error, count } = await supabase
    .from('purchase_requests')
    .update({ status: 'approved', finance_approved_by_user_id: user.id, finance_approved_at: now, updated_at: now }, { count: 'exact' })
    .eq('id', prId)
    .eq('status', 'pending_finance');

  if (error) return { error: error.message };
  if (count === 0) return { error: 'This PR is not pending the finance approval.' };

  await recordAuditLog({
    entity_type: 'purchase_request',
    entity_id: prId,
    action: 'UPDATE',
    changes: { after: { status: 'approved', finance_approved_by: user.id } },
    performed_by: user.id,
  });

  await createNotificationForRoles({
    type: 'pr',
    title: '✅ PR Approved',
    message: 'A purchase request passed the finance budget check and is ready to be converted into a purchase order.',
    link: `/dashboard/purchase-requests/${prId}`,
    created_by: user.id,
    roles: ['operations'],
  });

  revalidatePath(`/dashboard/purchase-requests/${prId}`);
  revalidatePath('/dashboard/purchase-requests');
  refresh();

  // ponytail: procurement email deferred via defer()
  defer(async () => {
    const emailResult = await sendPrApprovedEmail(prId, { actorId: user.id });
    if (emailResult.status === 'failed') {
      await createNotification({
        type: 'pr',
        title: '⚠️ Procurement email not sent',
        message: `${emailResult.error || 'The PR was approved but the procurement email could not be sent.'} Open the PR to convert it manually.`,
        link: `/dashboard/purchase-requests/${prId}`,
        created_by: user.id,
        recipientIds: [user.id],
      });
    }
  });

  return { success: true };
}

export async function rejectPR(prId: string, reason: string) {
  const supabase = await createClient();
  const { user, role, error: authError } = await getCurrentProfile(supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  if (!reason?.trim()) return { error: 'A rejection reason is required.' };

  const { data: pr } = await supabase
    .from('purchase_requests')
    .select('status, submitted_for_approval_by')
    .eq('id', prId)
    .single();

  // Rejection is allowed at either stage; the capability follows the stage the
  // PR is currently in. The update below guards the transition so a stale
  // status can never be rejected.
  const stageCapability = pr?.status === 'pending_finance' ? 'pr.approve_finance' : pr?.status === 'pending_approval' ? 'pr.approve' : null;
  if (!stageCapability || !hasCapability(role, stageCapability)) {
    return { error: 'This PR is not pending approval.' };
  }

  const { error, count } = await supabase
    .from('purchase_requests')
    .update({
      status: 'draft',
      rejection_reason: reason.trim(),
      admin_approved_by: [],
      admin_approved_at: [],
      approved_by_user_id: null,
      approved_at: null,
      updated_at: new Date().toISOString(),
    } as any, { count: 'exact' })
    .eq('id', prId)
    .in('status', ['pending_approval', 'pending_finance']);

  if (error) return { error: error.message };
  if (count === 0) return { error: 'This PR is not pending approval.' };

  await recordAuditLog({
    entity_type: 'purchase_request',
    entity_id: prId,
    action: 'UPDATE',
    changes: { after: { status: 'draft', rejected_by: user.id, rejection_reason: reason.trim() } },
    performed_by: user.id,
  });

  if ((pr as any)?.submitted_for_approval_by) {
    await createNotification({
      type: 'pr',
      title: '❌ PR Approval Rejected',
      message: `The purchase request was sent back to draft. Reason: ${reason.trim()}`,
      link: `/dashboard/purchase-requests/${prId}`,
      created_by: user.id,
      recipientIds: [(pr as any).submitted_for_approval_by],
    });
  } else {
    await createNotificationForRoles({
      type: 'pr',
      title: '❌ PR Approval Rejected',
      message: `The purchase request was sent back to draft. Reason: ${reason.trim()}`,
      link: `/dashboard/purchase-requests/${prId}`,
      created_by: user.id,
      roles: ['operations'],
    });
  }

  revalidatePath(`/dashboard/purchase-requests/${prId}`);
  revalidatePath('/dashboard/purchase-requests');
  refresh();
  return { success: true };
}

export async function cancelPurchaseRequest(prId: string) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('pr.create', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const { data: pr } = await supabase
    .from('purchase_requests')
    .select('status, created_by')
    .eq('id', prId)
    .single();

  if (!pr) return { error: 'Purchase request not found.' };
  if (pr.status === 'converted') return { error: 'A converted PR cannot be cancelled.' };
  if (pr.status === 'cancelled') return { success: true }; // idempotent double-click
  if (pr.created_by !== user.id) return { error: 'Only the requester can cancel this PR.' };

  const { error, count } = await supabase
    .from('purchase_requests')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() }, { count: 'exact' })
    .eq('id', prId)
    .in('status', ['draft', 'pending_approval', 'pending_finance', 'approved']);

  if (error) return { error: error.message };
  if (count === 0) return { error: 'A converted PR cannot be cancelled.' };

  await recordAuditLog({
    entity_type: 'purchase_request',
    entity_id: prId,
    action: 'UPDATE',
    changes: { after: { status: 'cancelled' } },
    performed_by: user.id,
  });

  revalidatePath(`/dashboard/purchase-requests/${prId}`);
  revalidatePath('/dashboard/purchase-requests');
  return { success: true };
}

export async function revivePurchaseRequest(prId: string) {
  const supabase = await createClient();
  const {
    user,
    role,
    error: authError,
  } = await requireCapability('pr.create', supabase);
  if (authError || !user || !role) return { error: authError || 'Unauthorized' };

  const { data: pr } = await supabase
    .from('purchase_requests')
    .select('status, created_by')
    .eq('id', prId)
    .single();

  if (!pr) return { error: 'Purchase request not found.' };
  if (pr.status !== 'cancelled') return { error: 'Only cancelled PRs can be revived.' };
  if (pr.created_by !== user.id && !['superadmin', 'admin'].includes(role)) {
    return { error: 'Only the requester or an admin can revive this PR.' };
  }

  const { error } = await supabase
    .from('purchase_requests')
    .update({
      status: 'draft',
      rejection_reason: null,
      submitted_for_approval_by: null,
      submitted_for_approval_at: null,
      approval_requested_from: null,
      finance_approval_requested_from: null,
      approved_by_user_id: null,
      approved_at: null,
      admin_approved_by: [],
      admin_approved_at: [],
      updated_at: new Date().toISOString(),
    } as any)
    .eq('id', prId);

  if (error) return { error: error.message };

  await recordAuditLog({
    entity_type: 'purchase_request',
    entity_id: prId,
    action: 'UPDATE',
    changes: { after: { status: 'draft', revived_from: 'cancelled' } },
    performed_by: user.id,
  });

  revalidatePath(`/dashboard/purchase-requests/${prId}`);
  revalidatePath('/dashboard/purchase-requests');
  return { success: true };
}

export async function deletePurchaseRequest(prId: string) {
  const supabase = await createClient();
  const { user, role, error: authError } = await getCurrentProfile(supabase);
  if (authError || !user) return { error: authError || 'Unauthorized.' };
  if (!hasCapability(role, 'pr.delete')) return { error: 'Unauthorized.' };

  const { data: pr } = await supabase
    .from('purchase_requests')
    .select('status')
    .eq('id', prId)
    .single();

  // Superadmins may delete a PR in any status; everyone else only drafts.
  const allowedStatuses = role === 'superadmin'
    ? ['draft', 'cancelled', 'pending_approval', 'pending_finance', 'approved', 'converted']
    : ['draft'];
  if (!pr || !allowedStatuses.includes(pr.status)) {
    return { error: role === 'superadmin' ? 'Purchase request not found.' : 'Only draft PRs can be deleted.' };
  }

  // A converted PR is referenced by its PO (no cascade on the FK), so unlink
  // it first. The PO keeps its pr_number snapshot as a historical record.
  if (pr.status === 'converted') {
    const { error: unlinkError } = await supabase
      .from('purchase_orders')
      .update({ purchase_request_id: null })
      .eq('purchase_request_id', prId);
    if (unlinkError) return { error: unlinkError.message };
  }

  const { error } = await supabase
    .from('purchase_requests')
    .delete()
    .eq('id', prId);

  if (error) return { error: error.message };

  revalidatePath('/dashboard/purchase-requests');
  // ponytail: audit is non-critical for UX, defer so delete returns without waiting for audit insert
  defer(() => recordAuditLog({
    entity_type: 'purchase_request',
    entity_id: prId,
    action: 'DELETE',
    performed_by: user.id
  }).catch(() => {}));

  return { success: true };
}
