'use server'

import { refresh, revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { createNotification, createNotificationForRoles } from '@/utils/notifications';
import { recordAuditLog } from '@/utils/audit';
import { getCurrentProfile, requireCapability, hasCapability } from '@/lib/auth/permissions';
import { sendPoIssuedEmail } from '@/lib/email/po';
import { sendPoForSignatureEmail } from '@/lib/email/po';
import { createPortalLink } from '@/lib/portal/links';
import { sendPoPendingApprovalEmail } from '@/lib/email/po-pending-approval';
import { sendPoPendingExecEmail } from '@/lib/email/po-pending-exec';
import { sendPoPendingFinanceEmail } from '@/lib/email/po-pending-finance';
import { sendPoSignedAcknowledgedEmail } from '@/lib/email/po-signed-acknowledged';
import { docTypeLabel, getMissingPaymentRequiredDocTypes, PAYMENT_REQUIRED_DOC_TYPES } from '@/lib/vendors/document-types';
import { createHash } from 'crypto';
import { parsePoSequenceNumber } from '@/lib/dashboard/po-sequence';
import { extractLegacyPoFromPdf } from '@/lib/pdf/extractLegacyPoFromPdf';

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

// ── Exec tier helpers ──────────────────────────────────────────────────────
// T1 <=500_000 : 0 exec, T2 500_001..1_000_000 : 1 exec (CTO OR CEO), T3 >=1_000_001 : 2 exec (CTO AND CEO distinct)
// Live purchase_orders.amount is the source of truth at each stage (per #110 clarification).
function getExecRequiredCount(amount: number | null | undefined): number {
  const n = Number(amount ?? 0);
  if (n <= 500_000) return 0;
  if (n <= 1_000_000) return 1;
  return 2;
}

type POLineItem = { item_code?: string; description: string; qty: number; uom?: string; unit_price: number };
type POSiteDetail = { region: string; area_city: string; no_of_nodes: number; cable_length_km: number; node_id?: string; phase?: string };

interface CreatePOInput {
  vendor_id: string;
  project_id?: string;
  line_items: POLineItem[];
  site_details?: POSiteDetail[];
  description?: string;
  issued_date?: string;
  due_date?: string;
  dp_amount?: number;
  dp_percent?: number;
  net_days?: number;
  dp_due_days?: number;
  penalty_rate?: number;
  penalty_type?: 'monthly' | 'fixed';
  waive_requirements?: boolean;
  purchase_request_id?: string;
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

  const { vendor_id, project_id, line_items, site_details = [], description, due_date, dp_amount = 0, dp_percent, waive_requirements: waive = false } = input;
  const issued_date = input.issued_date ?? new Date().toISOString().slice(0, 10);
  const mobilization_date = getTomorrowDateInTimeZone('Asia/Manila');
  const net_days = input.net_days ?? 30;
  const dp_due_days = input.dp_due_days ?? null;
  const penalty_rate = input.penalty_rate ?? null;
  const penalty_type = input.penalty_type ?? null;

  if (!vendor_id) return { error: 'Vendor is required.' };
  if (!Number.isInteger(net_days) || net_days <= 0) return { error: 'Net days must be a positive whole number.' };
  if (dp_due_days !== null && (!Number.isInteger(dp_due_days) || dp_due_days < 0)) return { error: 'DP due days must be a nonnegative whole number.' };
  if (penalty_rate !== null && (!Number.isFinite(penalty_rate) || penalty_rate < 0 || penalty_rate > 1)) return { error: 'Penalty rate must be between 0 and 1.' };
  if (penalty_type !== null && penalty_type !== 'monthly' && penalty_type !== 'fixed') return { error: 'Penalty type must be monthly or fixed.' };

  const totalAmount = line_items.reduce((sum, li) => sum + (Number(li.qty) || 0) * (Number(li.unit_price) || 0), 0);
  if (totalAmount <= 0) return { error: 'Total amount must be greater than zero. Add at least one line item with a price.' };

  // Percent is the primary input on the form; the peso amount is derived.
  // Legacy callers (chat tool) pass dp_amount only — kept as-is, percent derived.
  let dpAmount = Math.max(0, Number(dp_amount) || 0);
  let dpPercent = 0;
  if (dp_percent !== undefined && dp_percent !== null && !Number.isNaN(dp_percent)) {
    if (dp_percent < 0 || dp_percent > 100) return { error: 'Downpayment percent must be between 0 and 100.' };
    dpPercent = Math.round(dp_percent * 100) / 100;
    dpAmount = Math.round(((totalAmount * dpPercent) / 100) * 100) / 100;
  } else if (dpAmount > totalAmount) {
    return { error: 'Downpayment cannot exceed the PO total.' };
  } else if (dpAmount > 0 && totalAmount > 0) {
    dpPercent = Math.round((dpAmount / totalAmount) * 100 * 100) / 100;
  }

  // ponytail: parallelize independent pre-checks (was 3 sequential round-trips)
  const [{ data: ndaDoc }, { data: entity }, { data: vendor }] = await Promise.all([
    supabase.from('vendor_documents').select('status').eq('vendor_id', vendor_id).eq('doc_type', 'signed_nda').eq('status', 'approved').is('archived_at', null).maybeSingle(),
    supabase.from('internal_entities').select('id').limit(1).single(),
    supabase.from('vendors').select('status, currency').eq('id', vendor_id).single(),
  ]);
  const ndaFailed = !ndaDoc;
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

  // PR conversion path: the PO originates from an approved purchase request and
  // inherits its pr_number. The unique index on purchase_request_id is the race
  // guard — the status check below is only the friendly error.
  let prToConvert: { id: string; pr_number: string } | null = null;
  if (input.purchase_request_id) {
    const { data: pr } = await supabase
      .from('purchase_requests')
      .select('id, pr_number, status')
      .eq('id', input.purchase_request_id)
      .is('deleted_at', null)
      .single();
    if (!pr) return { error: 'Purchase request not found.' };
    if (pr.status === 'converted') return { error: 'This purchase request has already been converted to a PO.' };
    if (pr.status !== 'approved') return { error: 'Only approved purchase requests can be converted to a PO.' };
    prToConvert = pr;
  }

  // ── Duplicate check: single batched query instead of N per-site round-trips ──
  // ponytail: was N×2 queries (po_site_details + purchase_orders per site); now at most 2 total
  const sitesWithNode = site_details.filter((s) => s.node_id?.trim());
  if (sitesWithNode.length > 0) {
    const nodeIds = [...new Set(sitesWithNode.map((s) => s.node_id!.trim()))];
    const { data: existingRows } = await supabase
      .from('po_site_details')
      .select('po_id, region, area_city, node_id, phase')
      .in('node_id', nodeIds);

    if (existingRows && existingRows.length > 0) {
      // Match in JS on all four fields case-insensitively
      const norm = (v: string | null) => (v || '').toLowerCase();
      const matched = new Map<string, typeof sitesWithNode[0]>();
      for (const row of existingRows) {
        for (const site of sitesWithNode) {
          if (
            norm(row.node_id) === norm(site.node_id!.trim()) &&
            norm(row.region) === norm(site.region || '') &&
            norm(row.area_city) === norm(site.area_city || '') &&
            norm(row.phase) === norm(site.phase || '')
          ) {
            matched.set(site.node_id!.trim().toLowerCase(), site);
            break;
          }
        }
      }
      if (matched.size > 0) {
        const poIds = [...new Set(existingRows.filter((r) => matched.has(r.node_id.toLowerCase())).map((r) => r.po_id))];
        const { data: activePOs } = await supabase
          .from('purchase_orders')
          .select('po_number')
          .in('id', poIds)
          .neq('status', 'cancelled')
          .is('deleted_at', null);
        if (activePOs && activePOs.length > 0) {
          const firstDup = [...matched.values()][0]!;
          return {
            error: `Duplicate site detected: Node ID "${firstDup.node_id}" in ${firstDup.region}, ${firstDup.area_city} (Phase: "${firstDup.phase || 'N/A'}") already exists in ${activePOs.map((p) => p.po_number).join(', ')}. Please check and avoid duplicate entries.`,
          };
        }
      }
    }
  }

  const { data: newPO, error } = await supabase.from('purchase_orders').insert({
    vendor_id,
    project_id: project_id || null,
    description: description || null,
    amount: totalAmount,
    dp_amount: dpAmount,
    dp_percent: dpPercent,
    issued_date,
    mobilization_date,
    due_date: due_date || null,
    net_days,
    dp_due_days,
    penalty_rate,
    penalty_type,
    terms_configured_at: new Date().toISOString(),
    status: 'draft',
    currency,
    internal_entity_id: entity?.id || null,
    created_by: user.id,
    ...(prToConvert ? { purchase_request_id: prToConvert.id, pr_number: prToConvert.pr_number } : {}),
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
    // Unique index on purchase_request_id — someone converted this PR first.
    if (prToConvert && (error as { code?: string }).code === '23505') {
      return { error: 'This purchase request has already been converted to a PO.' };
    }
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
    (s) => s.region || s.area_city || s.node_id || s.phase || s.no_of_nodes > 0 || s.cable_length_km > 0
  );
  if (validSites.length > 0) {
    const { error: siteError } = await supabase.from('po_site_details').insert(
      validSites.map((s, i) => ({
        po_id: newPO.id,
        sn: i + 1,
        region: s.region || '',
        area_city: s.area_city || '',
        node_id: s.node_id || '',
        phase: s.phase || '',
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
    changes: { after: { vendor_id, amount: totalAmount, status: 'draft', currency, line_items_count: line_items.length, sites_count: validSites.length, ...(prToConvert ? { purchase_request_id: prToConvert.id, pr_number: prToConvert.pr_number } : {}), ...(waive && hasBlockers ? { requirements_waived: true, waived_requirements: waivedRequirements } : {}) } },
    performed_by: user.id,
  });

  // Conversion complete: freeze the PR. Guarded on status='approved' so a stale
  // retry can never resurrect it.
  if (prToConvert) {
    const { error: flipError } = await supabase
      .from('purchase_requests')
      .update({ status: 'converted', updated_at: new Date().toISOString() })
      .eq('id', prToConvert.id)
      .eq('status', 'approved');
    if (flipError) {
      console.error('Error marking PR as converted:', flipError);
      await createNotification({
        type: 'pr',
        title: '⚠️ PR conversion incomplete',
        message: `PO ${newPO.po_number} was created, but the purchase request could not be marked converted. Open the PR and verify its status.`,
        link: `/dashboard/purchase-requests/${prToConvert.id}`,
        created_by: user.id,
        recipientIds: [user.id],
      });
    }
    revalidatePath(`/dashboard/purchase-requests/${prToConvert.id}`);
    revalidatePath('/dashboard/purchase-requests');
  }

  await createNotificationForRoles({
    type: 'po',
    title: '📋 Purchase Order Created',
    message: `A new purchase order was drafted.`,
    link: `/dashboard/purchase-orders/${newPO.id}`,
    created_by: user.id,
    roles: ['operations'],
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

  // UI flow is PR-mandatory: the form only renders via an approved PR's
  // "Convert to PO" link, which carries this hidden field. The core action keeps
  // it optional for the AI chat tool.
  const purchaseRequestId = formData.get('purchase_request_id') as string;
  if (!purchaseRequestId) {
    return { error: 'Purchase orders must originate from an approved purchase request. Open an approved PR and use "Convert to PO".' };
  }

  const dpDueDays = formData.get('dp_due_days');
  const penaltyRate = formData.get('penalty_rate');
  const penaltyType = formData.get('penalty_type');
  const result = await createPurchaseOrderCore({
    vendor_id: formData.get('vendor_id') as string,
    project_id: formData.get('project_id') as string || undefined,
    line_items: lineItems,
    site_details: siteDetails,
    description: formData.get('description') as string || undefined,
    issued_date: formData.get('issued_date') as string || undefined,
    due_date: formData.get('due_date') as string || undefined,
    dp_amount: parseFloat(formData.get('dp_amount') as string) || 0,
    dp_percent: formData.get('dp_percent') ? parseFloat(formData.get('dp_percent') as string) : undefined,
    net_days: Number(formData.get('net_days') || 30),
    dp_due_days: dpDueDays == null || dpDueDays === '' ? undefined : Number(dpDueDays),
    penalty_rate: penaltyRate == null || penaltyRate === '' ? undefined : Number(penaltyRate),
    penalty_type: penaltyType == null || penaltyType === '' ? undefined : penaltyType as 'monthly' | 'fixed',
    waive_requirements: formData.get('waive_requirements') === 'on',
    purchase_request_id: purchaseRequestId,
  });

  return result;
}

function parseTerms(formData: FormData) {
  const net_days = Number(formData.get('net_days'));
  const dp_due_days = formData.get('dp_due_days') === '' ? null : Number(formData.get('dp_due_days'));
  const penalty_rate = formData.get('penalty_rate') === '' ? null : Number(formData.get('penalty_rate'));
  const penalty_type = formData.get('penalty_type') === '' ? null : formData.get('penalty_type');

  if (!Number.isInteger(net_days) || net_days <= 0) return { error: 'Net days must be a positive whole number.' } as const;
  if (dp_due_days !== null && (!Number.isInteger(dp_due_days) || dp_due_days < 0)) return { error: 'DP due days must be a nonnegative whole number.' } as const;
  if (penalty_rate !== null && (!Number.isFinite(penalty_rate) || penalty_rate < 0 || penalty_rate > 1)) return { error: 'Penalty rate must be between 0 and 1.' } as const;
  if (penalty_type !== null && penalty_type !== 'monthly' && penalty_type !== 'fixed') return { error: 'Penalty type must be monthly or fixed.' } as const;
  return { net_days, dp_due_days, penalty_rate, penalty_type } as const;
}

export async function updatePurchaseOrderTerms(poId: string, formData: FormData) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('po.write', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const { data: po } = await supabase.from('purchase_orders').select('status').eq('id', poId).single();
  if (po?.status !== 'draft') return { error: 'Terms can only be edited while the PO is a draft.' };

  const terms = parseTerms(formData);
  if ('error' in terms) return terms;
  const updated_at = new Date().toISOString();
  const { error, count } = await supabase
    .from('purchase_orders')
    .update({ ...terms, terms_configured_at: updated_at }, { count: 'exact' })
    .eq('id', poId)
    .eq('status', 'draft');
  if (error) return { error: error.message };
  if (count === 0) return { error: 'Terms can only be edited while the PO is a draft.' };

  await recordAuditLog({ entity_type: 'purchase_order', entity_id: poId, action: 'UPDATE', changes: { after: terms }, performed_by: user.id });
  revalidatePath(`/dashboard/purchase-orders/${poId}`);
  return { success: true };
}

export async function updatePOTermsAndConditions(poId: string, formData: FormData) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('po.write', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const { data: po } = await supabase.from('purchase_orders').select('status').eq('id', poId).single();
  if (po?.status !== 'draft') return { error: 'Terms and conditions can only be edited while the PO is a draft.' };

  // Empty = null restores the default golden template on the PDF. Non-empty
  // must be a structured PoTc object (items/instructions/sitesLead); validate
  // and canonicalize so the renderer never sees malformed data.
  const raw = String(formData.get('terms_and_conditions') || '').trim();
  let terms_and_conditions: string | null = null;
  if (raw) {
    try {
      const o = JSON.parse(raw);
      if (!o || !Array.isArray(o.items) || !Array.isArray(o.instructions)) {
        return { error: 'Invalid terms payload.' };
      }
      terms_and_conditions = JSON.stringify({
        items: o.items.map((it: any) => ({
          text: String(it?.text ?? ''),
          subs: Array.isArray(it?.subs) ? it.subs.map(String) : [],
          conts: Array.isArray(it?.conts) ? it.conts.map(String) : [],
        })),
        instructions: o.instructions.map((ins: any) => ({
          text: String(ins?.text ?? ''),
          conts: Array.isArray(ins?.conts) ? ins.conts.map(String) : [],
        })),
        sitesLead: Array.isArray(o.sitesLead) ? o.sitesLead.map(String) : [],
      });
    } catch {
      return { error: 'Invalid terms payload.' };
    }
  }
  const updated_at = new Date().toISOString();
  const { error, count } = await supabase
    .from('purchase_orders')
    .update({ terms_and_conditions, terms_configured_at: updated_at }, { count: 'exact' })
    .eq('id', poId)
    .eq('status', 'draft');
  if (error) return { error: error.message };
  if (count === 0) return { error: 'Terms and conditions can only be edited while the PO is a draft.' };

  await recordAuditLog({
    entity_type: 'purchase_order',
    entity_id: poId,
    action: 'UPDATE',
    changes: { after: { terms_and_conditions } },
    performed_by: user.id,
  });
  revalidatePath(`/dashboard/purchase-orders/${poId}`);
  return { success: true };
}

// ── Originator-only draft editing ────────────────────────────────────────
// The user who drafted the PO (created_by) may fix human errors while the PO
// is still a draft or pending approval. Legacy placeholder POs (source='legacy'
// + amount 0 + no artifact) are also editable after creation so a stub with
// only po_number+vendor can be completed. Other roles with po.write can edit
// those placeholders too.
async function assertOriginatorCanEdit(poId: string) {
  const supabase = await createClient();
  const { user, role, error: authError } = await getCurrentProfile(supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const { data: po } = await supabase
    .from('purchase_orders')
    .select('id, created_by, status, amount, dp_amount, description, due_date, source')
    .eq('id', poId)
    .single();

  if (!po) return { error: 'Purchase order not found.' };
  const isLegacyPlaceholder = (po as any).source === 'legacy' && Number((po as any).amount) === 0;
  if (isLegacyPlaceholder) {
    const canEditLegacy = po.created_by === user.id || hasCapability(role, 'po.write');
    if (!canEditLegacy) return { error: 'Only the creator or a user with PO write access can edit this placeholder legacy PO.' };
    return { user, po, supabase };
  }
  if (po.created_by !== user.id) return { error: 'Only the originator who drafted this PO can edit it.' };
  if (po.status !== 'draft' && po.status !== 'pending_approval') {
    return { error: 'This PO can only be edited while it is a draft or pending approval.' };
  }
  return { user, po, supabase };
}

export async function updatePODetails(poId: string, formData: FormData) {
  const context = await assertOriginatorCanEdit(poId);
  if ('error' in context) return context;
  const { user, po, supabase } = context;

  const description = String(formData.get('description') || '').trim() || null;
  const dueDateRaw = String(formData.get('due_date') || '').trim();
  const due_date = dueDateRaw || null;
  if (due_date && Number.isNaN(Date.parse(due_date))) return { error: 'Invalid due date.' };

  const before = { description: po.description ?? null, due_date: po.due_date ?? null };
  const { error } = await supabase
    .from('purchase_orders')
    .update({ description, due_date, updated_at: new Date().toISOString() })
    .eq('id', poId);
  if (error) return { error: error.message };

  await recordAuditLog({
    entity_type: 'purchase_order',
    entity_id: poId,
    action: 'UPDATE',
    changes: { before, after: { description, due_date } },
    performed_by: user.id,
  });
  revalidatePath(`/dashboard/purchase-orders/${poId}`);
  return { success: true };
}

export async function updatePOLineItems(poId: string, lineItems: POLineItem[]) {
  const context = await assertOriginatorCanEdit(poId);
  if ('error' in context) return context;
  const { user, po, supabase } = context;

  if (!Array.isArray(lineItems) || lineItems.length === 0) return { error: 'Add at least one line item.' };

  const clean = lineItems.map((li) => ({
    item_code: String(li.item_code || '').trim(),
    description: String(li.description || '').trim(),
    qty: Number(li.qty) || 0,
    uom: String(li.uom || 'LOT').trim() || 'LOT',
    unit_price: Number(li.unit_price) || 0,
  }));

  if (clean.some((li) => li.qty < 0 || li.unit_price < 0)) return { error: 'Qty and unit price must be nonnegative numbers.' };
  if (clean.some((li) => !li.description)) return { error: 'Every line item needs a description.' };

  const totalAmount = clean.reduce((sum, li) => sum + li.qty * li.unit_price, 0);
  if (totalAmount <= 0) return { error: 'Total amount must be greater than zero.' };
  if (Number(po.dp_amount || 0) > totalAmount) {
    return { error: `Cannot lower the PO total below the downpayment (₱${Number(po.dp_amount).toLocaleString()}). Adjust the downpayment first.` };
  }

  const { data: existing } = await supabase.from('po_line_items').select('id').eq('po_id', poId);
  const beforeCount = existing?.length ?? 0;

  const { error: deleteError } = await supabase.from('po_line_items').delete().eq('po_id', poId);
  if (deleteError) return { error: deleteError.message };

  const { error: insertError } = await supabase.from('po_line_items').insert(
    clean.map((li, i) => ({
      po_id: poId,
      line_no: i + 1,
      item_code: li.item_code,
      description: li.description,
      qty: li.qty,
      uom: li.uom,
      unit_price: li.unit_price,
      amount: li.qty * li.unit_price,
    })),
  );
  if (insertError) return { error: insertError.message };

  const { error: updateError } = await supabase
    .from('purchase_orders')
    .update({ amount: totalAmount, updated_at: new Date().toISOString() })
    .eq('id', poId);
  if (updateError) return { error: updateError.message };

  await recordAuditLog({
    entity_type: 'purchase_order',
    entity_id: poId,
    action: 'UPDATE',
    changes: {
      before: { amount: po.amount, line_items: beforeCount },
      after: { amount: totalAmount, line_items: clean.length },
    },
    performed_by: user.id,
  });
  revalidatePath(`/dashboard/purchase-orders/${poId}`);
  return { success: true };
}

export async function updatePOSiteDetails(poId: string, siteDetails: POSiteDetail[]) {
  const context = await assertOriginatorCanEdit(poId);
  if ('error' in context) return context;
  const { user, supabase } = context;

  if (!Array.isArray(siteDetails)) return { error: 'Invalid site details data.' };

  const clean = siteDetails
    .filter(
      (s) =>
        s.region || s.area_city || s.node_id || s.phase || Number(s.no_of_nodes) > 0 || Number(s.cable_length_km) > 0,
    )
    .map((s) => ({
      region: String(s.region || '').trim(),
      area_city: String(s.area_city || '').trim(),
      node_id: String(s.node_id || '').trim(),
      phase: String(s.phase || '').trim(),
      no_of_nodes: Number(s.no_of_nodes) || 0,
      cable_length_km: Number(s.cable_length_km) || 0,
    }));

  if (clean.some((s) => s.no_of_nodes < 0 || s.cable_length_km < 0)) return { error: 'Node count and cable length must be nonnegative numbers.' };

  const { data: existing } = await supabase.from('po_site_details').select('id').eq('po_id', poId);
  const beforeCount = existing?.length ?? 0;

  const { error: deleteError } = await supabase.from('po_site_details').delete().eq('po_id', poId);
  if (deleteError) return { error: deleteError.message };

  if (clean.length > 0) {
    const { error: insertError } = await supabase.from('po_site_details').insert(
      clean.map((s, i) => ({
        po_id: poId,
        sn: i + 1,
        region: s.region,
        area_city: s.area_city,
        node_id: s.node_id,
        phase: s.phase,
        no_of_nodes: s.no_of_nodes,
        cable_length_km: s.cable_length_km,
      })),
    );
    if (insertError) return { error: insertError.message };
  }

  await recordAuditLog({
    entity_type: 'purchase_order',
    entity_id: poId,
    action: 'UPDATE',
    changes: { before: { site_details: beforeCount }, after: { site_details: clean.length } },
    performed_by: user.id,
  });
  revalidatePath(`/dashboard/purchase-orders/${poId}`);
  return { success: true };
}

export async function addDownPayment(poId: string, amount: number) {
  const context = await assertOriginatorCanEdit(poId);
  if ('error' in context) return context;
  const { user, po, supabase } = context;

  if (Number(po.dp_amount || 0) !== 0) return { error: 'This PO already has a downpayment set.' };
  if (!Number.isFinite(amount) || amount <= 0) return { error: 'Downpayment must be greater than zero.' };
  const dp_amount = Math.round(amount * 100) / 100;
  if (dp_amount > Number(po.amount)) return { error: 'Downpayment cannot exceed the PO total.' };

  const { error } = await supabase
    .from('purchase_orders')
    .update({ dp_amount, updated_at: new Date().toISOString() })
    .eq('id', poId);
  if (error) return { error: error.message };

  await recordAuditLog({
    entity_type: 'purchase_order',
    entity_id: poId,
    action: 'UPDATE',
    changes: { before: { dp_amount: 0 }, after: { dp_amount } },
    performed_by: user.id,
  });
  revalidatePath(`/dashboard/purchase-orders/${poId}`);
  return { success: true };
}

export async function overridePurchaseOrderPenalty(poId: string, formData: FormData) {
  const supabase = await createClient();
  const { user, role, error: authError } = await getCurrentProfile(supabase);
  if (authError || !user || !['finance', 'admin', 'superadmin'].includes(role || '')) return { error: authError || 'Unauthorized' };

  const rawAmount = formData.get('override_amount');
  const override_amount = rawAmount === '' ? null : Number(rawAmount);
  const override_reason = String(formData.get('override_reason') || '').trim();
  if (override_amount !== null && !override_reason) return { error: 'Provide a reason for the penalty override.' };
  if (override_amount !== null && (!Number.isFinite(override_amount) || override_amount < 0)) return { error: 'Penalty override amount must be a nonnegative number.' };

  const overridden_at = new Date().toISOString();
  const { error } = await supabase.from('po_penalties').upsert({ po_id: poId, override_amount, override_reason: override_amount === null ? null : override_reason, overridden_by: user.id, overridden_at }, { onConflict: 'po_id' });
  if (error) return { error: error.message };

  await recordAuditLog({ entity_type: 'purchase_order', entity_id: poId, action: 'UPDATE', changes: { after: { override_amount, override_reason } }, performed_by: user.id });
  revalidatePath(`/dashboard/purchase-orders/${poId}`);
  return { success: true };
}

export async function submitPOForApproval(poId: string, approverIds: string[] = [], financeApproverIds: string[] = []) {
  const supabase = await createClient();
  const { user, role, error: authError } = await requireCapability('po.status', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const { data: po } = await supabase
    .from('purchase_orders')
    .select('status, amount')
    .eq('id', poId)
    .single();

  if (po?.status !== 'draft') {
    return { error: 'Only draft POs can be submitted for approval.' };
  }

  // Validate the chosen approvers: at least one, all admins/superadmins, and
  // never the submitter (the 4-eyes rule blocks self-approval). Notify-only —
  // this drives who is emailed, not who is allowed to approve.
  const uniqueApproverIds = [...new Set(approverIds)].filter(Boolean);
  if (uniqueApproverIds.length === 0) {
    return { error: 'Select at least one admin or superadmin to approve this PO.' };
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
    return { error: 'Select at least one finance or superadmin to approve this PO.' };
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

  // Exec tier: compute from live amount and cache exec approver pool (cto/ceo)
  const execRequired = getExecRequiredCount((po as any).amount);
  let execRequestedFrom: string[] = [];
  try {
    const { data: execProfiles } = await supabase.from('profiles').select('id').in('role', ['cto', 'ceo', 'superadmin']);
    execRequestedFrom = (execProfiles || []).map((p: any) => p.id);
  } catch {}

  const { error } = await supabase
    .from('purchase_orders')
    .update({
      status: 'pending_approval',
      submitted_for_approval_by: user.id,
      submitted_for_approval_at: new Date().toISOString(),
      approval_requested_from: uniqueApproverIds,
      finance_approval_requested_from: uniqueFinanceApproverIds,
      exec_required_count: execRequired,
      exec_approved_by: [],
      exec_approved_at: [],
      exec_approval_requested_from: execRequestedFrom,
      rejection_reason: null,
      updated_at: new Date().toISOString(),
    } as any)
    .eq('id', poId);

  if (error) return { error: error.message };

  await recordAuditLog({
    entity_type: 'purchase_order',
    entity_id: poId,
    action: 'UPDATE',
    changes: { after: { status: 'pending_approval', submitted_by: user.id, approval_requested_from: uniqueApproverIds, finance_approval_requested_from: uniqueFinanceApproverIds, exec_required_count: execRequired, exec_approval_requested_from: execRequestedFrom } },
    performed_by: user.id,
  });

  await createNotification({
    type: 'po',
    title: '📋 PO Awaiting Approval',
    message: 'A purchase order has been submitted and requires executive approval before issuing.',
    link: `/dashboard/purchase-orders/${poId}`,
    created_by: user.id,
    recipientIds: uniqueApproverIds,
  });

  revalidatePath(`/dashboard/purchase-orders/${poId}`);
  revalidatePath('/dashboard/purchase-orders');

  // ponytail: email deferred via after() so submit returns before SMTP/PDF work
  defer(async () => {
    const emailResult = await sendPoPendingApprovalEmail(poId, { actorId: user.id });
    if (emailResult.status === 'failed') {
      await createNotification({
        type: 'po',
        title: '⚠️ Approval email not sent',
        message: `A PO was submitted for approval but the notification email to the selected approvers could not be sent. ${emailResult.error ?? ''}`.trim(),
        link: `/dashboard/purchase-orders/${poId}`,
        created_by: user.id,
        recipientIds: [user.id],
      });
    }
  });

  return { success: true };
}

export async function approvePO(poId: string) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('po.approve', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const { data: po } = await supabase
    .from('purchase_orders')
    .select('status, amount, requirements_waived, waiver_approved, submitted_for_approval_by, exec_required_count, exec_approved_by')
    .eq('id', poId)
    .single();

  if (po?.status !== 'pending_approval') {
    return { error: 'This PO is not pending the admin approval.' };
  }

  if (po.submitted_for_approval_by === user.id) {
    return { error: 'You cannot approve a PO you submitted for approval. Another admin or superadmin must approve it.' };
  }

  if (po.requirements_waived && !po.waiver_approved) {
    return { error: 'Cannot approve: this PO has waived requirements pending executive approval.' };
  }

  const now = new Date().toISOString();
  // Live amount determines tier; recompute in case line items changed while pending_approval.
  const liveExecRequired = getExecRequiredCount((po as any).amount);
  // Keep stored exec_required_count in sync with live amount (amount may have been edited)
  const nextExecRequired = liveExecRequired;
  const needsExec = nextExecRequired > 0;
  const nextStatus = needsExec ? 'pending_exec_approval' : 'pending_finance';

  const { error, count } = await supabase
    .from('purchase_orders')
    .update({ status: nextStatus, approved_by_user_id: user.id, approved_at: now, exec_required_count: nextExecRequired, exec_approved_by: [], exec_approved_at: [], updated_at: now } as any, { count: 'exact' })
    .eq('id', poId)
    .eq('status', 'pending_approval');

  if (error) return { error: error.message };
  if (count === 0) return { error: 'This PO is not pending the admin approval.' };

  await recordAuditLog({
    entity_type: 'purchase_order',
    entity_id: poId,
    action: 'UPDATE',
    changes: { after: { status: nextStatus, admin_approved_by: user.id, exec_required_count: nextExecRequired } },
    performed_by: user.id,
  });

  if (needsExec) {
    await createNotificationForRoles({
      type: 'po',
      title: '👔 PO Awaiting Executive Approval',
      message: `A PO was admin-approved (₱${Number((po as any).amount).toLocaleString()}) and now requires executive approval (${nextExecRequired === 1 ? 'CTO or CEO' : 'CTO and CEO'}).`,
      link: `/dashboard/purchase-orders/${poId}`,
      created_by: user.id,
      roles: ['admin'],
    });
  } else {
    await createNotificationForRoles({
      type: 'po',
      title: '👤 PO Admin Approved',
      message: 'A purchase order was approved by the admin and is pending the finance budget check before issuing.',
      link: `/dashboard/purchase-orders/${poId}`,
      created_by: user.id,
      roles: ['finance'],
    });
  }

  revalidatePath(`/dashboard/purchase-orders/${poId}`);
  revalidatePath('/dashboard/purchase-orders');
  if (typeof refresh === 'function') (refresh as any)();

  if (needsExec) {
    defer(async () => {
      const execResult = await sendPoPendingExecEmail(poId, { actorId: user.id });
      if (execResult.status === 'failed') {
        await createNotification({
          type: 'po',
          title: '⚠️ Executive email not sent',
          message: `A PO passed admin but the executive notification could not be sent. ${execResult.error ?? ''}`.trim(),
          link: `/dashboard/purchase-orders/${poId}`,
          created_by: user.id,
          recipientIds: [user.id],
        });
      }
    });
  } else {
    // ponytail: finance email deferred via after(); failure surfaced as in-app notification only (no emailWarning)
    defer(async () => {
      const financeEmailResult = await sendPoPendingFinanceEmail(poId, { actorId: user.id });
      if (financeEmailResult.status === 'failed') {
        await createNotification({
          type: 'po',
          title: '⚠️ Finance email not sent',
          message: `A PO passed the admin stage but the finance notification email could not be sent. ${financeEmailResult.error ?? ''}`.trim(),
          link: `/dashboard/purchase-orders/${poId}`,
          created_by: user.id,
          recipientIds: [user.id],
        });
      }
    });
  }

  return { success: true };
}

export async function approvePOExec(poId: string) {
  const supabase = await createClient();
  const { user, role, error: authError } = await requireCapability('po.approve_exec', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const { data: po } = await supabase
    .from('purchase_orders')
    .select('status, amount, requirements_waived, waiver_approved, exec_required_count, exec_approved_by, exec_approved_at, approved_by_user_id')
    .eq('id', poId)
    .single();

  if (po?.status !== 'pending_exec_approval') {
    return { error: 'This PO is not pending executive approval.' };
  }

  if ((po as any).requirements_waived && !(po as any).waiver_approved) {
    return { error: 'Cannot approve: this PO has waived requirements pending executive approval.' };
  }

  const execRequired = getExecRequiredCount((po as any).amount);
  // Keep stored count in sync with live amount
  const required = execRequired;
  const approvedBy: string[] = ((po as any).exec_approved_by as string[] | null) || [];
  const approvedAt: string[] = ((po as any).exec_approved_at as string[] | null) || [];

  if (approvedBy.includes(user.id)) {
    return { error: 'You have already approved this PO at the executive stage.' };
  }

  // For T3, enforce distinct CTO vs CEO (superadmin can fill either slot but not both alone)
  if (required === 2 && role !== 'superadmin') {
    // Fetch roles of already-approved execs to enforce distinctness
    const { data: existingApprovers } = await supabase.from('profiles').select('id, role').in('id', approvedBy);
    const existingRoles = new Set((existingApprovers || []).map((p: any) => p.role));
    if (role === 'cto' && existingRoles.has('cto')) {
      return { error: 'A CTO has already approved. The CEO must be the second approver.' };
    }
    if (role === 'ceo' && existingRoles.has('ceo')) {
      return { error: 'A CEO has already approved. The CTO must be the second approver.' };
    }
    // Also block same role duplicate via current user role check above covers same user, but this covers different users same role
    if (existingRoles.has(role as string)) {
      return { error: 'An approver with this executive role has already approved.' };
    }
  }

  const now = new Date().toISOString();
  const newApprovedBy = [...approvedBy, user.id];
  const newApprovedAt = [...approvedAt, now];
  const isComplete = newApprovedBy.length >= required;

  // For T3 superadmin edge: if superadmin approved first, next must be cto or ceo (already enforced via required check), but superadmin second approval should be blocked if they already approved
  // Superadmin second approval for T3 would be allowed only if we consider superadmin as distinct? Block same-user already, allow second superadmin as second slot.
  if (required === 2 && isComplete) {
    // Final exec approval → move to pending_finance
    const { error, count } = await supabase
      .from('purchase_orders')
      .update({ status: 'pending_finance', exec_approved_by: newApprovedBy, exec_approved_at: newApprovedAt, exec_required_count: required, updated_at: now } as any, { count: 'exact' })
      .eq('id', poId)
      .eq('status', 'pending_exec_approval');
    if (error) return { error: error.message };
    if (count === 0) return { error: 'This PO is not pending executive approval.' };

    await recordAuditLog({
      entity_type: 'purchase_order',
      entity_id: poId,
      action: 'UPDATE',
      changes: { after: { status: 'pending_finance', exec_approved_by: newApprovedBy, exec_completed_by: user.id } },
      performed_by: user.id,
    });

    await createNotification({
      type: 'po',
      title: '✅ Executive Approved — Pending Finance',
      message: 'Executive approval complete (CTO and CEO). PO is now pending finance review.',
      link: `/dashboard/purchase-orders/${poId}`,
      created_by: user.id,
    });

    revalidatePath(`/dashboard/purchase-orders/${poId}`);
    revalidatePath('/dashboard/purchase-orders');
    if (typeof refresh === 'function') (refresh as any)();

    defer(async () => {
      const financeResult = await sendPoPendingFinanceEmail(poId, { actorId: user.id });
      if (financeResult.status === 'failed') {
        await createNotification({
          type: 'po',
          title: '⚠️ Finance email not sent',
          message: `Executive approval passed but finance email failed. ${financeResult.error ?? ''}`.trim(),
          link: `/dashboard/purchase-orders/${poId}`,
          created_by: user.id,
        });
      }
    });

    return { success: true };
  } else if ((required as number) === 1 && isComplete) {
    // T2 single approval → pending_finance
    const { error, count } = await supabase
      .from('purchase_orders')
      .update({ status: 'pending_finance', exec_approved_by: newApprovedBy, exec_approved_at: newApprovedAt, exec_required_count: required, updated_at: now } as any, { count: 'exact' })
      .eq('id', poId)
      .eq('status', 'pending_exec_approval');
    if (error) return { error: error.message };
    if (count === 0) return { error: 'This PO is not pending executive approval.' };

    await recordAuditLog({
      entity_type: 'purchase_order',
      entity_id: poId,
      action: 'UPDATE',
      changes: { after: { status: 'pending_finance', exec_approved_by: newApprovedBy } },
      performed_by: user.id,
    });

    await createNotification({
      type: 'po',
      title: '✅ Executive Approved — Pending Finance',
      message: 'Executive approval (CTO/CEO) complete. PO is now pending finance review.',
      link: `/dashboard/purchase-orders/${poId}`,
      created_by: user.id,
    });

    revalidatePath(`/dashboard/purchase-orders/${poId}`);
    revalidatePath('/dashboard/purchase-orders');
    if (typeof refresh === 'function') (refresh as any)();

    defer(async () => {
      const financeResult = await sendPoPendingFinanceEmail(poId, { actorId: user.id });
      if (financeResult.status === 'failed') {
        await createNotification({
          type: 'po',
          title: '⚠️ Finance email not sent',
          message: `Executive approval passed but finance email failed. ${financeResult.error ?? ''}`.trim(),
          link: `/dashboard/purchase-orders/${poId}`,
          created_by: user.id,
        });
      }
    });

    return { success: true };
  } else {
    // T3 first of 2 → stay pending_exec_approval, record and email remaining
    const { error, count } = await supabase
      .from('purchase_orders')
      .update({ exec_approved_by: newApprovedBy, exec_approved_at: newApprovedAt, exec_required_count: required, updated_at: now } as any, { count: 'exact' })
      .eq('id', poId)
      .eq('status', 'pending_exec_approval');
    if (error) return { error: error.message };
    if (count === 0) return { error: 'This PO is not pending executive approval.' };

    await recordAuditLog({
      entity_type: 'purchase_order',
      entity_id: poId,
      action: 'UPDATE',
      changes: { after: { exec_approved_by: newApprovedBy, exec_partial: true } },
      performed_by: user.id,
    });

    await createNotification({
      type: 'po',
      title: '👔 Executive Partial Approval',
      message: `${role === 'cto' ? 'CTO' : role === 'ceo' ? 'CEO' : 'Executive'} approved. Awaiting ${role === 'cto' ? 'CEO' : role === 'ceo' ? 'CTO' : 'remaining executive'} for PO ${poId}.`,
      link: `/dashboard/purchase-orders/${poId}`,
      created_by: user.id,
    });

    revalidatePath(`/dashboard/purchase-orders/${poId}`);
    revalidatePath('/dashboard/purchase-orders');
    if (typeof refresh === 'function') (refresh as any)();

    // Email remaining exec only
    const remainingRole = role === 'cto' ? 'ceo' : role === 'ceo' ? 'cto' : null;
    defer(async () => {
      const execResult = await sendPoPendingExecEmail(poId, { actorId: user.id, remainingRole: remainingRole as any });
      if (execResult.status === 'failed') {
        await createNotification({
          type: 'po',
          title: '⚠️ Executive email not sent',
          message: `Partial exec approval recorded but remaining executive email failed. ${execResult.error ?? ''}`.trim(),
          link: `/dashboard/purchase-orders/${poId}`,
          created_by: user.id,
        });
      }
    });

    return { success: true, partial: true };
  }
}

export async function approvePOFinance(poId: string) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('po.approve_finance', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const { data: po } = await supabase
    .from('purchase_orders')
    .select('status, amount, requirements_waived, waiver_approved, approved_by_user_id, exec_required_count, exec_approved_by')
    .eq('id', poId)
    .single();

  if (po?.status !== 'pending_finance') {
    return { error: 'This PO is not pending the finance approval.' };
  }

  if (po.approved_by_user_id === user.id) {
    return { error: 'You cannot approve a PO you approved at the admin stage. Another finance or superadmin user must do the budget check.' };
  }

  if (po.requirements_waived && !po.waiver_approved) {
    return { error: 'Cannot issue: this PO has waived requirements pending executive approval.' };
  }

  // Exec stage must be complete before finance (live amount tier)
  const execNeeded = getExecRequiredCount((po as any).amount);
  const execDone = ((po as any).exec_approved_by as string[] | null)?.length ?? 0;
  if (execNeeded > 0 && execDone < execNeeded) {
    return { error: 'This PO is pending executive approval. CTO/CEO must approve before finance.' };
  }
  // Also respect stored exec_required_count for in-flight POs where amount may have been edited
  const storedRequired = Number((po as any).exec_required_count ?? 0);
  if (storedRequired > 0 && execDone < storedRequired) {
    return { error: 'Executive approval is not yet complete.' };
  }

  const now = new Date().toISOString();
  const { error, count } = await supabase
    .from('purchase_orders')
    .update({ status: 'pending_signature', sent_at: now, finance_approved_by_user_id: user.id, finance_approved_at: now, updated_at: now }, { count: 'exact' })
    .eq('id', poId)
    .eq('status', 'pending_finance');

  if (error) return { error: error.message };
  if (count === 0) return { error: 'This PO is not pending the finance approval.' };

  // Mint the e-sign link first so the email always has a working upload URL.
  const linkResult = await createPortalLink('po', poId, 7, 'po');

  await recordAuditLog({
    entity_type: 'purchase_order',
    entity_id: poId,
    action: 'UPDATE',
    changes: {
      after: {
        status: 'pending_signature',
        finance_approved_by: user.id,
        sent_at: now,
      },
    },
    performed_by: user.id,
  });

  revalidatePath(`/dashboard/purchase-orders/${poId}`);
  revalidatePath('/dashboard/purchase-orders');
  if (typeof refresh === 'function') (refresh as any)();

  if ('error' in linkResult) {
    // Link creation failed — surface immediately (no email to send)
    await createNotification({
      type: 'po',
      title: '⚠️ Signature link not created',
      message: `${linkResult.error} Open the PO to resend the signature request.`,
      link: `/dashboard/purchase-orders/${poId}`,
      created_by: user.id,
      recipientIds: [user.id],
    });
    return { success: true, emailWarning: linkResult.error };
  }

  // ponytail: PDF render + SMTP deferred via after() — finance approval returns before the heavy work
  defer(async () => {
    const emailResult = await sendPoForSignatureEmail(poId, {
      signUrl: linkResult.portalUrl,
      actorId: user.id,
    });
    if (emailResult.status === 'failed') {
      await createNotification({
        type: 'po',
        title: '⚠️ PO email not sent',
        message: `${emailResult.error || 'The PO was issued but the email could not be sent.'} Open the PO to resend it to the vendor.`,
        link: `/dashboard/purchase-orders/${poId}`,
        created_by: user.id,
        recipientIds: [user.id],
      });
    }
  });

  return { success: true };
}

export async function rejectPO(poId: string, reason: string) {
  const supabase = await createClient();
  const { user, role, error: authError } = await getCurrentProfile(supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  if (!reason?.trim()) return { error: 'A rejection reason is required.' };

  const { data: po } = await supabase
    .from('purchase_orders')
    .select('status, submitted_for_approval_by')
    .eq('id', poId)
    .single();

  // Rejection is allowed at any approval stage; the capability follows the stage the
  // PO is currently in. The update below guards the transition so a stale
  // status can never be rejected.
  const stageCapability =
    po?.status === 'pending_finance'
      ? 'po.approve_finance'
      : po?.status === 'pending_exec_approval'
        ? 'po.approve_exec'
        : po?.status === 'pending_approval'
          ? 'po.approve'
          : null;
  if (!stageCapability || !hasCapability(role, stageCapability)) {
    return { error: 'This PO is not pending approval.' };
  }

  const { error, count } = await supabase
    .from('purchase_orders')
    .update({
      status: 'draft',
      rejection_reason: reason.trim(),
      exec_approved_by: [],
      exec_approved_at: [],
      updated_at: new Date().toISOString(),
    } as any, { count: 'exact' })
    .eq('id', poId)
    .in('status', ['pending_approval', 'pending_exec_approval', 'pending_finance']);

  if (error) return { error: error.message };
  if (count === 0) return { error: 'This PO is not pending approval.' };

  await recordAuditLog({
    entity_type: 'purchase_order',
    entity_id: poId,
    action: 'UPDATE',
    changes: { after: { status: 'draft', rejected_by: user.id, rejection_reason: reason.trim() } },
    performed_by: user.id,
  });

  if (po?.submitted_for_approval_by) {
    await createNotification({
      type: 'po',
      title: '❌ PO Approval Rejected',
      message: `The purchase order was sent back to draft. Reason: ${reason.trim()}`,
      link: `/dashboard/purchase-orders/${poId}`,
      created_by: user.id,
      recipientIds: [po.submitted_for_approval_by],
    });
  } else {
    await createNotificationForRoles({
      type: 'po',
      title: '❌ PO Approval Rejected',
      message: `The purchase order was sent back to draft. Reason: ${reason.trim()}`,
      link: `/dashboard/purchase-orders/${poId}`,
      created_by: user.id,
      roles: ['operations'],
    });
  }

  revalidatePath(`/dashboard/purchase-orders/${poId}`);
  revalidatePath('/dashboard/purchase-orders');
  if (typeof refresh === 'function') (refresh as any)();
  return { success: true };
}

export async function updatePOStatus(poId: string, status: string) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('po.status', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  // Issuance and the finance budget check are only allowed through the
  // approval flow (submitPOForApproval -> approvePO -> approvePOExec -> approvePOFinance).
  // This generic status updater must NOT be able to move a PO to 'issued',
  // 'pending_finance', 'pending_exec_approval' or 'pending_signature' directly,
  // otherwise a po.status holder could bypass approval. 'pending_signature' likewise only via approvePOFinance.
  if (status === 'issued' || status === 'pending_finance' || status === 'pending_exec_approval' || status === 'pending_signature') {
    const { data: po } = await supabase
      .from('purchase_orders')
      .select('status')
      .eq('id', poId)
      .single();

    // Idempotent: already issued (e.g. double-click) — succeed without re-issuing.
    if (po?.status === 'issued') return { success: true };

    return {
      error: 'POs can only be issued through the two-stage approval flow. Submit the PO for approval, then have an admin approve it and finance run the budget check.',
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

  await createNotificationForRoles({
    type: 'po',
    title: `📋 PO Status Updated`,
    message: `Purchase order status changed to ${status}.`,
    link: `/dashboard/purchase-orders/${poId}`,
    created_by: user.id,
    roles: ['operations'],
  });

  revalidatePath(`/dashboard/purchase-orders/${poId}`);
  return { success: true };
}

export async function resendPurchaseOrderEmail(poId: string) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('email.send', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const { data: po } = await supabase
    .from('purchase_orders')
    .select('status')
    .eq('id', poId)
    .single();

  let result;
  if (po?.status === 'pending_signature') {
    const linkResult = await createPortalLink('po', poId, 7, 'po');
    if ('error' in linkResult) {
      return { error: linkResult.error };
    }
    result = await sendPoForSignatureEmail(poId, {
      signUrl: linkResult.portalUrl,
      actorId: user.id,
    });
  } else {
    result = await sendPoIssuedEmail(poId, { actorId: user.id });
  }

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

/**
 * Requisitioner approves or rejects a vendor-signed PO: moves it to 'signed'
 * (signed_doc_status 'approved') or back to 'pending_signature' with a reason
 * (signed_doc_status 'rejected') so the vendor can re-sign. Reviewable from
 * 'signed_received' (new flow) or legacy 'pending_signature'.
 */
export async function reviewSignedPo(
  poId: string,
  decision: 'approve' | 'reject',
  reason?: string,
) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('po.write', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const { data: po } = await supabase
    .from('purchase_orders')
    .select('id, po_number, status, signed_doc_status, vendors ( name )')
    .eq('id', poId)
    .single();

  if (!po) return { error: 'Purchase order not found.' };
  if (!['pending_signature', 'signed_received'].includes(po.status) || po.signed_doc_status !== 'pending_approval') {
    return { error: 'This purchase order has no signed document awaiting review.' };
  }

  const now = new Date().toISOString();

  if (decision === 'approve') {
    const { error } = await supabase
      .from('purchase_orders')
      .update({
        status: 'signed',
        signed_doc_status: 'approved',
        signed_doc_approved_by: user.id,
        signed_doc_approved_at: now,
        signed_doc_rejection_reason: null,
        updated_at: now,
      })
      .eq('id', poId);
    if (error) return { error: error.message };

    await recordAuditLog({
      entity_type: 'purchase_order',
      entity_id: poId,
      action: 'UPDATE',
      changes: { after: { status: 'signed', signed_doc_status: 'approved', signed_doc_approved_by: user.id } },
      performed_by: user.id,
    });
  } else {
    const rejectionReason = (reason ?? '').trim();
    const { error } = await supabase
      .from('purchase_orders')
      .update({
        status: 'pending_signature',
        signed_doc_status: 'rejected',
        signed_doc_rejection_reason: rejectionReason || 'No reason provided',
        signed_doc_approved_by: null,
        signed_doc_approved_at: null,
        updated_at: now,
      })
      .eq('id', poId);
    if (error) return { error: error.message };

    await recordAuditLog({
      entity_type: 'purchase_order',
      entity_id: poId,
      action: 'UPDATE',
      changes: { after: { status: 'pending_signature', signed_doc_status: 'rejected', reason: rejectionReason } },
      performed_by: user.id,
    });
  }

  const vendor = (po.vendors ?? {}) as { name?: string };
  await createNotificationForRoles({
    type: 'po',
    title: decision === 'approve' ? '✅ Signed PO Approved' : '⚠️ Signed PO Rejected',
    message: `${vendor.name || 'Vendor'}${decision === 'approve' ? "'s signed copy was approved" : "'s signed copy was rejected"} for ${po.po_number || 'the PO'}${decision === 'reject' && reason ? ` — ${reason}` : ''}.`,
    link: `/dashboard/purchase-orders/${poId}`,
    created_by: user.id,
    roles: ['operations'],
  });

  revalidatePath(`/dashboard/purchase-orders/${poId}`);
  revalidatePath('/dashboard/purchase-orders');
  if (typeof refresh === 'function') (refresh as any)();

  if (decision === 'approve') {
    // ponytail: acknowledgment email deferred via after()
    defer(async () => {
      const emailResult = await sendPoSignedAcknowledgedEmail(poId, { actorId: user.id });
      if (emailResult.status === 'failed') {
        await createNotification({
          type: 'po',
          title: '⚠️ Acknowledgment email not sent',
          message: `The signed-PO acknowledgment email for ${po.po_number || 'the PO'} could not be sent.${emailResult.error ? ` ${emailResult.error}` : ''}`,
          link: `/dashboard/purchase-orders/${poId}`,
          created_by: user.id,
          recipientIds: [user.id],
        });
      }
    });
  }

  return { success: true };
}

export async function updatePOCcEmails(poId: string, ccEmails: string[]) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('po.write', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const { data: po } = await supabase
    .from('purchase_orders')
    .select('status')
    .eq('id', poId)
    .single();

  if (po?.status !== 'draft' && po?.status !== 'pending_approval') {
    return { error: 'CC recipients can only be edited before the PO is issued.' };
  }

  const uniqueEmails = [...new Set(ccEmails)].filter((e) => e && e.includes('@'));

  const { error } = await supabase
    .from('purchase_orders')
    .update({ cc_emails: uniqueEmails, updated_at: new Date().toISOString() })
    .eq('id', poId);

  if (error) return { error: error.message };

  await recordAuditLog({
    entity_type: 'purchase_order',
    entity_id: poId,
    action: 'UPDATE',
    changes: { after: { cc_emails: uniqueEmails } },
    performed_by: user.id,
  });

  revalidatePath(`/dashboard/purchase-orders/${poId}`);
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

/**
 * Delete the rows referencing this PO that are NOT covered by ON DELETE CASCADE:
 * service_invoices is the only FK to purchase_orders without cascade (its children
 * payments -> payment_documents must go first). The rest (line items, site details,
 * payment requests, reservations, certs, artifacts, penalties) cascade automatically.
 * Returns an error message or null.
 */
async function deletePurchaseOrderDependents(
  supabase: Awaited<ReturnType<typeof createClient>>,
  poId: string,
): Promise<string | null> {
  const { data: invoices } = await supabase
    .from('service_invoices')
    .select('id')
    .eq('po_id', poId);
  const invoiceIds = (invoices ?? []).map((i: { id: string }) => i.id);

  if (invoiceIds.length > 0) {
    const { data: payments } = await supabase
      .from('payments')
      .select('id')
      .in('invoice_id', invoiceIds);
    const paymentIds = (payments ?? []).map((p: { id: string }) => p.id);

    if (paymentIds.length > 0) {
      const { error } = await supabase
        .from('payment_documents')
        .delete()
        .in('payment_id', paymentIds);
      if (error) return error.message;
    }

    const { error } = await supabase.from('payments').delete().in('invoice_id', invoiceIds);
    if (error) return error.message;

    const { error: invoiceError } = await supabase
      .from('service_invoices')
      .delete()
      .eq('po_id', poId);
    if (invoiceError) return invoiceError.message;
  }

  return null;
}

export async function deletePurchaseOrder(poId: string) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('po.delete', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized.' };

  const error = await deletePurchaseOrderDependents(supabase, poId);
  if (error) return { error };

  const { error: deleteError } = await supabase
    .from('purchase_orders')
    .delete()
    .eq('id', poId);

  if (deleteError) return { error: deleteError.message };

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

  await createNotificationForRoles({
    type: 'po',
    title: '📋 Completion Certificate Submitted',
    message: `A certificate of completion at ${percent}% was submitted and awaits approval.`,
    link: `/dashboard/purchase-orders/${poId}`,
    created_by: user.id,
    roles: ['admin'],
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
  await createNotificationForRoles({
    type: 'payment',
    title: 'Payment Reservation Created',
    message: `${vendorName} may request payment for PO ${po.po_number}. ₱${reservedAmount.toLocaleString()} reserved.`,
    link: `/dashboard/purchase-orders/${poId}`,
    created_by: user.id,
    roles: ['finance'],
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
  await createNotificationForRoles({
    type: 'payment',
    title: 'Payment Reservation Acknowledged',
    message: `Finance acknowledged payment reservation for ${vendorName} (PO ${po?.po_number}). ₱${Number(res.reserved_amount).toLocaleString()} is being prepared.`,
    link: `/dashboard/purchase-orders/${res.po_id}`,
    created_by: user.id,
    roles: ['operations'],
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
  await createNotificationForRoles({
    type: 'payment',
    title: 'Payment Reservation Cancelled',
    message: `Payment reservation for ${vendorName} (PO ${po?.po_number}) was cancelled. Reason: ${reason}`,
    link: `/dashboard/purchase-orders/${res.po_id}`,
    created_by: user.id,
    roles: ['finance', 'operations'],
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
  isDownpayment: boolean = false,
) {
  // Invoice-driven workflow: Payment Requests are auto-created when an invoice is uploaded linked to a PO.
  // Manual creation is deprecated — redirect users to Record Invoice.
  return { error: 'Payment Requests are now created automatically when you upload an invoice linked to this PO. Go to Record Vendor Invoice, select this PO, and upload the invoice file.' };
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
  await createNotificationForRoles({
    type: 'payment_request',
    title: 'Payment Request Approved',
    message: `Payment request for ${vendorName} (PO ${po?.po_number}) — ₱${Number(pr.amount).toLocaleString()} approved. The subcontractor may now submit a progress-billing invoice.`,
    link: `/dashboard/purchase-orders/${pr.po_id}`,
    created_by: user.id,
    roles: ['operations'],
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
  await createNotificationForRoles({
    type: 'payment_request',
    title: 'Payment Request Rejected',
    message: `Payment request for ${vendorName} (PO ${po?.po_number}) — ₱${Number(pr.amount).toLocaleString()} rejected. Reason: ${reason}`,
    link: `/dashboard/purchase-orders/${pr.po_id}`,
    created_by: user.id,
    roles: ['operations'],
  });

  revalidatePath(`/dashboard/purchase-orders/${pr.po_id}`);
  revalidatePath('/dashboard/accounting');
  return { success: true };
}

// ── Legacy (pre-ERP) PO import ─────────────────────────────────────────────
// Uploads a PO PDF that predates the ERP. The PO is created already 'issued'
// (skipping the approval/signature/email flow) and the file is stored as its
// issued_pdf artifact, so the detail-page PDF download serves the real
// document instead of a regenerated skeleton. amount is the billing ceiling
// enforced by the invoice flow, so it must match the PDF.

export async function importLegacyPurchaseOrder(prevState: any, formData: FormData) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('po.create', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const vendor_id = String(formData.get('vendor_id') || '').trim();
  const po_number = String(formData.get('po_number') || '').trim();
  const issued_date_raw = String(formData.get('issued_date') || '').trim();
  const issued_date = issued_date_raw && !Number.isNaN(Date.parse(issued_date_raw)) ? issued_date_raw : new Date().toISOString().slice(0, 10);
  const currency = String(formData.get('currency') || 'PHP').trim();
  const legacy_project = String(formData.get('legacy_project') || '').trim() || null;
  const rawAmount = formData.get('amount');
  const parsedAmount = rawAmount != null && String(rawAmount).trim() !== '' ? Number(rawAmount) : 0;
  // ponytail: placeholder legacy PO — only po_number+vendor required, amount/file default to stub
  const amount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 0;
  const file = formData.get('file') as File | null;
  const hasFile = !!file && file.size > 0;

  if (!vendor_id) return { error: 'Vendor is required.' };
  if (!po_number) return { error: 'PO number is required.' };
  if (currency !== 'PHP' && currency !== 'USD') return { error: 'Currency must be PHP or USD.' };
  if (hasFile) {
    if (file!.type !== 'application/pdf' && !file!.name.toLowerCase().endsWith('.pdf')) {
      return { error: 'The document must be a PDF.' };
    }
    if (file!.size > 10 * 1024 * 1024) return { error: 'The PDF must be 10 MB or smaller.' };
  }

  const { data: existing } = await supabase
    .from('purchase_orders')
    .select('id')
    .eq('po_number', po_number)
    .is('deleted_at', null)
    .maybeSingle();
  if (existing) return { error: `A PO with number ${po_number} already exists.` };

  const { data: newPO, error: insertError } = await supabase
    .from('purchase_orders')
    .insert({
      vendor_id,
      legacy_project,
      po_number,
      amount,
      issued_date,
      currency,
      status: 'issued',
      source: 'legacy',
      created_by: user.id,
    })
    .select('id, po_number')
    .single();
  if (insertError) return { error: insertError.message };

  // Legacy numbers share the ERP's PO-YYYYNNNNNN scheme: advance the shared
  // sequence so a future ERP PO can never regenerate this number.
  const seq = parsePoSequenceNumber(po_number);
  if (seq !== null) {
    const { error: rpcError } = await supabase.rpc('ensure_po_sequence', { min_seq: seq });
    if (rpcError) console.error('ensure_po_sequence failed:', rpcError);
  }

  // ponytail: placeholder has no artifact — amounts self-heal on first invoice; file path only when uploaded
  if (hasFile) {
    const filePath = `legacy/${newPO.id}/${po_number}.pdf`;
    const checksum_sha256 = createHash('sha256').update(Buffer.from(await file!.arrayBuffer())).digest('hex');
    const { error: uploadError } = await supabase.storage
      .from('po-artifacts')
      .upload(filePath, file!, { contentType: 'application/pdf', upsert: false });
    if (uploadError) {
      await supabase.from('purchase_orders').delete().eq('id', newPO.id);
      return { error: uploadError.message };
    }
    const { data: { publicUrl } } = supabase.storage.from('po-artifacts').getPublicUrl(filePath);

    const { error: artifactError } = await supabase.from('purchase_order_artifacts').insert({
      po_id: newPO.id,
      artifact_type: 'issued_pdf',
      storage_bucket: 'po-artifacts',
      storage_path: filePath,
      file_url: publicUrl,
      content_type: 'application/pdf',
      file_size: file!.size,
      checksum_sha256,
      generated_by: user.id,
    });
    if (artifactError) {
      await supabase.storage.from('po-artifacts').remove([filePath]);
      await supabase.from('purchase_orders').delete().eq('id', newPO.id);
      return { error: artifactError.message };
    }
  }

  await recordAuditLog({
    entity_type: 'purchase_order',
    entity_id: newPO.id,
    action: 'CREATE',
    changes: { after: { vendor_id, po_number, amount, issued_date, status: 'issued', source: 'legacy', currency, legacy_project, has_artifact: hasFile } },
    performed_by: user.id,
  });

  revalidatePath('/dashboard/purchase-orders');
  return { id: newPO.id, success: true, message: hasFile ? `Legacy PO ${newPO.po_number} imported and marked issued.` : `Legacy PO ${newPO.po_number} created as placeholder (no scan) — you can edit it and link invoices now.` };
}

export async function extractLegacyPoDetails(prevState: any, formData: FormData) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('po.create', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) return { error: 'Choose the legacy PO PDF first.' };
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    return { error: 'The document must be a PDF.' };
  }
  if (file.size > 10 * 1024 * 1024) return { error: 'The PDF must be 10 MB or smaller.' };

  try {
    const extract = await extractLegacyPoFromPdf(await file.arrayBuffer());
    // ponytail: scanned PDFs have no text — surface as error so the UI shows a banner instead of silently filling nothing
    const hasAny =
      extract.poNumber || extract.poDate || extract.vendorName || extract.amount != null || extract.project;
    if (!hasAny) {
      return {
        error:
          'Could not read the PDF. It may be a scanned image or password-protected — fill the fields manually.',
      };
    }
    return { success: true, extract };
  } catch (e) {
    console.error('[extractLegacyPoDetails]', e);
    return {
      error:
        'Could not read the PDF. It may be a scanned image or password-protected — fill the fields manually.',
    };
  }
}
