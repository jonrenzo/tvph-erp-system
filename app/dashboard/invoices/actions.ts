'use server'

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { createNotification, createNotificationForRoles } from '@/utils/notifications';
import { recordAuditLog } from '@/utils/audit';
import { requireCapability } from '@/lib/auth/permissions';
import { extractDocumentMetadata } from '@/app/actions/ocr';
import { calculatePaymentDueDate } from '@/lib/payment-terms';
import { docTypeLabel, getMissingPaymentRequiredDocTypes, PAYMENT_REQUIRED_DOC_TYPES } from '@/lib/vendors/document-types';

// ponytail: defer via next/server after() without breaking jest
function defer(fn: () => Promise<void>) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { after } = require('next/server') as { after: (f: () => void) => void };
    after(fn);
  } catch {
    void fn();
  }
}

const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_TOTAL_SIZE = 20 * 1024 * 1024; // 20MB combined

const EXT_TO_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

function resolveFileMime(file: File): string {
  if (file.type && ALLOWED_MIME.includes(file.type)) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return EXT_TO_MIME[ext] ?? '';
}

// --- Vendor fuzzy matching helpers ---

const LEGAL_TOKENS = /\b(inc|incorporated|corp|corporation|co|company|ltd|limited|opc|enterprises|enterprise|trading|services|construction|supply)\b/gi;

function normalizeVendorName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(LEGAL_TOKENS, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function diceSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bigrams = (s: string) => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
    return set;
  };
  const aB = bigrams(a);
  const bB = bigrams(b);
  let intersection = 0;
  for (const bg of aB) { if (bB.has(bg)) intersection++; }
  return (2 * intersection) / (aB.size + bB.size);
}

// --- OCR upload action ---

export async function extractInvoiceFromFile(formData: FormData) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('invoice.write', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) return { error: 'No file provided.' };
  if (file.size > MAX_FILE_SIZE) return { error: 'File exceeds the 10MB limit.' };

  const mime = resolveFileMime(file);
  if (!ALLOWED_MIME.includes(mime)) return { error: 'Only PDF, JPEG, PNG, or WebP files are accepted.' };

  // Stage the file (vendor unknown at this point)
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'pdf';
  const stagingPath = `staging/invoices/${crypto.randomUUID()}.${ext}`;
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from('vendor-documents')
    .upload(stagingPath, fileBuffer, { contentType: mime, upsert: false });

  if (uploadError) return { error: `File upload failed: ${uploadError.message}` };

  const stagedFileName = file.name;

  // OCR — non-fatal
  let extracted: Record<string, any> | null = null;
  let ocrWarning: string | undefined;
  try {
    const b64 = fileBuffer.toString('base64');
    const ocrResult = await extractDocumentMetadata(b64, mime, 'vendor_invoice');
    if (ocrResult.success) {
      extracted = ocrResult.metadata ?? null;
    } else {
      ocrWarning = ocrResult.error || 'Could not read this document — fill in the details manually.';
    }
  } catch {
    ocrWarning = 'Could not read this document — fill in the details manually.';
  }

  // Vendor matching
  let vendorMatch: { id: string; name: string; matchedBy: 'tin' | 'name'; score?: number } | null = null;
  if (extracted) {
    const { data: vendors } = await supabase
      .from('vendors')
      .select('id, name, tin')
      .eq('status', 'active')
      .is('deleted_at', null);

    if (vendors?.length) {
      // TIN exact match
      const extractedTin = (extracted.vendor_tin as string | null)?.replace(/\D/g, '') ?? '';
      if (extractedTin) {
        const tinMatch = vendors.find(v => (v.tin ?? '').replace(/\D/g, '') === extractedTin);
        if (tinMatch) vendorMatch = { id: tinMatch.id, name: tinMatch.name, matchedBy: 'tin' };
      }
      // Fuzzy name fallback
      if (!vendorMatch && extracted.vendor_name) {
        const normalizedExtracted = normalizeVendorName(extracted.vendor_name as string);
        let best = { score: 0, vendor: null as typeof vendors[0] | null };
        for (const v of vendors) {
          const score = diceSimilarity(normalizedExtracted, normalizeVendorName(v.name));
          if (score > best.score) best = { score, vendor: v };
        }
        if (best.score >= 0.8 && best.vendor) {
          vendorMatch = { id: best.vendor.id, name: best.vendor.name, matchedBy: 'name', score: best.score };
        }
      }
    }
  }

  // PO matching
  let poMatch: { id: string; vendor_id: string } | null = null;
  if (extracted?.po_number) {
    const { data: po } = await supabase
      .from('purchase_orders')
      .select('id, vendor_id')
      .ilike('po_number', (extracted.po_number as string).trim())
      .is('deleted_at', null)
      .in('status', ['issued', 'pending_signature', 'signed_received', 'signed', 'partially_paid'])
      .limit(1)
      .maybeSingle();
    if (po) poMatch = { id: po.id, vendor_id: po.vendor_id };
  }

  return { success: true, stagedPath: stagingPath, stagedFileName, extracted, vendorMatch, poMatch, ocrWarning };
}

export async function discardStagedInvoiceFile(path: string) {
  if (!path.startsWith('staging/invoices/')) return { error: 'Invalid path.' };
  const supabase = await createClient();
  const { error: authError } = await requireCapability('invoice.write', supabase);
  if (authError) return { error: authError };
  await supabase.storage.from('vendor-documents').remove([path]);
  return { success: true };
}

// --- Fetch eligible payment requests for a PO (legacy, kept for backwards compat) ---

export interface EligiblePR {
  id: string;
  request_number: string;
  amount: number;
  consumed: number;
  remaining: number;
  status: string;
  is_downpayment: boolean;
}

export async function getEligiblePaymentRequests(poId: string): Promise<{ data?: EligiblePR[]; error?: string }> {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('invoice.write', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const { data: prs, error } = await supabase
    .from('payment_requests')
    .select('id, request_number, amount, status, is_downpayment')
    .eq('po_id', poId)
    .order('created_at', { ascending: false });

  if (error) return { error: error.message };
  if (!prs) return { data: [] };

  const result: EligiblePR[] = await Promise.all(
    prs.map(async (pr) => {
      const { data: consuming } = await supabase
        .from('service_invoices')
        .select('amount')
        .eq('payment_request_id', pr.id)
        .in('status', ['pending_payment', 'partially_paid', 'paid'])
        .is('deleted_at', null);
      const consumed = consuming?.reduce((sum, inv) => sum + Number(inv.amount), 0) ?? 0;
      return {
        id: pr.id,
        request_number: pr.request_number,
        amount: Number(pr.amount),
        consumed,
        remaining: Number(pr.amount) - consumed,
        status: pr.status,
        is_downpayment: pr.is_downpayment,
      };
    })
  );

  return { data: result };
}

// --- Create invoice (invoice-driven PR: auto-creates payment_request when po_id is set) ---

export async function createInvoice(prevState: any, formData: FormData) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('invoice.write', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };
  const submittedAt = new Date();

  const vendor_id = formData.get('vendor_id') as string;
  const po_id = formData.get('po_id') as string;
  const invoice_number = formData.get('invoice_number') as string;
  const amount = formData.get('amount') as string;
  const invoice_date = formData.get('invoice_date') as string;
  const due_date = formData.get('due_date') as string;
  const payment_method = formData.get('payment_method') as string;
  const expense_category = formData.get('expense_category') as string;
  const notes = formData.get('notes') as string;
  const file = formData.get('file') as File;
  const staged_file_path = formData.get('staged_file_path') as string;
  const staged_file_name = formData.get('staged_file_name') as string;

  if (!vendor_id || !invoice_number || !amount || !invoice_date) {
    return { error: 'Missing required fields.' };
  }

  if (!Number.isFinite(parseFloat(amount)) || parseFloat(amount) <= 0) {
    return { error: 'Amount must be greater than zero.' };
  }

  // Duplicate invoice number check
  const { data: existing } = await supabase
    .from('service_invoices')
    .select('id')
    .eq('invoice_number', invoice_number)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();
  if (existing) return { error: `An invoice with number ${invoice_number} already exists.` };

  let linkedPo: { id: string; amount: number; net_days?: number | null; project_id?: string | null; vendor_id: string } | null = null;
  let topCert: { percent_complete: number; id: string } | null = null;

  // PO guards (accreditation + ceiling) — moved from payment_request flow, now required for invoices linked to PO. Applies to all POs including legacy.
  if (po_id) {
    const [{ data: po, error: poError }, { data: existingInvoices }, { data: cert }, { data: vendorDocs }] = await Promise.all([
      supabase.from('purchase_orders').select('id, amount, net_days, project_id, vendor_id').eq('id', po_id).single(),
      supabase.from('service_invoices').select('amount').eq('po_id', po_id).is('deleted_at', null),
      supabase.from('po_completion_certificates').select('id, percent_complete').eq('po_id', po_id).eq('status', 'approved').order('percent_complete', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('vendor_documents').select('doc_type, status').eq('vendor_id', vendor_id).in('doc_type', PAYMENT_REQUIRED_DOC_TYPES).is('archived_at', null),
    ]);

    if (poError || !po) return { error: 'Linked purchase order could not be loaded.' };
    if (po.vendor_id !== vendor_id) return { error: 'Invoice vendor does not match the PO vendor.' };

    linkedPo = { id: po.id, amount: Number(po.amount), net_days: po.net_days, project_id: po.project_id, vendor_id: po.vendor_id };
    topCert = cert ? { percent_complete: Number(cert.percent_complete), id: cert.id } : null;

    // Accreditation gate (all POs, including legacy — per new workflow)
    const missingRequiredDocs = getMissingPaymentRequiredDocTypes(vendorDocs || []);
    if (missingRequiredDocs.length > 0) {
      return {
        error: `Blocked: required accreditation document${missingRequiredDocs.length > 1 ? 's' : ''} ${missingRequiredDocs.map((t) => docTypeLabel(t)).join(', ')} ${missingRequiredDocs.length > 1 ? 'are' : 'is'} missing or not submitted. Complete vendor accreditation before invoicing this PO.`,
      };
    }

    const poAmount = Number(po.amount);
    const ceiling = topCert ? (topCert.percent_complete / 100) * poAmount : poAmount;
    const totalExisting = existingInvoices?.reduce((sum, inv) => sum + Number(inv.amount), 0) ?? 0;
    const newTotal = totalExisting + parseFloat(amount);
    if (newTotal > ceiling) {
      const remaining = Math.max(0, ceiling - totalExisting);
      const ceilingLabel = topCert ? `${topCert.percent_complete}% approved completion (₱${ceiling.toLocaleString()})` : `PO limit (₱${poAmount.toLocaleString()})`;
      return { error: `Invoice amount exceeds ${ceilingLabel}. Available to bill: ₱${remaining.toLocaleString()}.` };
    }
  }

  let file_url = null;
  let file_name = null;

  if (staged_file_path?.startsWith('staging/invoices/')) {
    const ext = staged_file_name?.split('.').pop() ?? 'pdf';
    const finalFileName = `INV_${invoice_number}_${Date.now()}.${ext}`;
    const finalPath = `vendors/${vendor_id}/invoices/${finalFileName}`;
    const { error: moveError } = await supabase.storage.from('vendor-documents').move(staged_file_path, finalPath);
    if (!moveError) {
      const { data: { publicUrl } } = supabase.storage.from('vendor-documents').getPublicUrl(finalPath);
      file_url = publicUrl;
      file_name = staged_file_name;
    }
  } else if (file && file.size > 0) {
    const fileExt = file.name.split('.').pop();
    const fileName = `INV_${invoice_number}_${Date.now()}.${fileExt}`;
    const filePath = `vendors/${vendor_id}/invoices/${fileName}`;
    const { error: uploadError } = await supabase.storage.from('vendor-documents').upload(filePath, file, { contentType: file.type, upsert: false });
    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage.from('vendor-documents').getPublicUrl(filePath);
      file_url = publicUrl;
      file_name = file.name;
    }
  }

  const finalDueDate = po_id
    ? calculatePaymentDueDate(submittedAt, Number(linkedPo?.net_days ?? 30))
    : due_date || calculatePaymentDueDate(submittedAt, 30);

  const parsedAmount = parseFloat(amount);
  const { data: newInvoice, error } = await supabase.from('service_invoices').insert({
    vendor_id,
    po_id: po_id || null,
    invoice_number,
    amount: parsedAmount,
    invoice_date,
    due_date: finalDueDate,
    status: 'pending_payment',
    file_url,
    file_name,
    notes,
    payment_method: payment_method || null,
    expense_category: expense_category || null,
    payment_request_id: null,
    carry_forward_amount: null,
    submitted_at: submittedAt.toISOString(),
    created_by: user.id
  }).select('id').single();

  if (error) {
    if (error.code === '23505') return { error: `An invoice with number ${invoice_number} already exists.` };
    console.error('Error creating invoice:', error);
    return { error: error.message };
  }

  // Auto-create payment request when invoice is linked to a PO (1 invoice = 1 PR, status pending)
  let createdPrId: string | null = null;
  if (po_id && linkedPo) {
    const isDownpayment = expense_category === 'downpayment';
    const dueInDays = Number(linkedPo.net_days ?? 30);
    const requestNumber = `PR-${invoice_number}`.slice(0, 50);
    const { data: pr, error: prError } = await supabase.from('payment_requests').insert({
      po_id,
      vendor_id,
      project_id: linkedPo.project_id || null,
      amount: parsedAmount,
      due_in_days: dueInDays,
      notes: notes || null,
      completion_cert_id: topCert?.id || null,
      percent_complete: topCert?.percent_complete ?? null,
      invoice_id: newInvoice.id,
      is_downpayment: isDownpayment,
      request_number: requestNumber,
      status: 'pending',
      created_by: user.id,
    }).select('id').single();

    if (prError) {
      // Compensate: remove the invoice if PR creation fails (keep invariant 1:1)
      await supabase.from('service_invoices').update({ deleted_at: new Date().toISOString() } as any).eq('id', newInvoice.id);
      console.error('Failed to auto-create payment request:', prError);
      return { error: `Invoice created but Payment Request failed: ${prError.message}` };
    }
    createdPrId = pr.id;
    await supabase.from('service_invoices').update({ payment_request_id: pr.id } as any).eq('id', newInvoice.id);
    // Also set reverse link if column exists (do not fail if missing)
    await supabase.from('payment_requests').update({ invoice_id: newInvoice.id } as any).eq('id', pr.id);
  }

  await recordAuditLog({
    entity_type: 'service_invoice',
    entity_id: newInvoice.id,
    action: 'CREATE',
    changes: { after: { invoice_number, amount: parsedAmount, po_id, payment_request_id: createdPrId } },
    performed_by: user.id
  });

  await createNotificationForRoles({
    type: 'invoice',
    title: '🧾 Invoice Received',
    message: po_id && createdPrId ? `Invoice #${invoice_number} logged — Payment Request pending approval (₱${parsedAmount.toLocaleString()}).` : `Invoice #${invoice_number} was logged.`,
    link: `/dashboard/invoices/${newInvoice.id}`,
    created_by: user.id,
    roles: ['finance']
  });

  // Notify for payment request (deferred)
  if (po_id && createdPrId && linkedPo) {
    const prPoId = po_id;
    const prVendorId = vendor_id;
    const prAmount = parsedAmount;
    const prDueInDays = Number(linkedPo.net_days ?? 30);
    const prNotes = notes || null;
    const prCreatorId = user.id;
    // Need po_number + vendor name for email
    const { data: poMeta } = await supabase.from('purchase_orders').select('po_number, vendors(name)').eq('id', prPoId).single();
    const vendorName = (poMeta?.vendors as any)?.name || 'Vendor';
    const poNumber = (poMeta as any)?.po_number || prPoId.slice(0, 8);
    defer(async () => {
      const { sendPaymentRequestNotification } = await import('@/lib/email/payment-request');
      await sendPaymentRequestNotification(prPoId, prVendorId, prAmount, prDueInDays, prNotes, prCreatorId, poNumber, vendorName);
    });
  }

  revalidatePath('/dashboard/invoices');
  if (po_id) revalidatePath(`/dashboard/purchase-orders/${po_id}`);
  redirect(`/dashboard/invoices/${newInvoice.id}`);
}

// --- Delete invoice (also rejects linked payment request in invoice-driven flow) ---

export async function deleteInvoice(invoiceId: string) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('invoice.write', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const { data: invoice } = await supabase
    .from('service_invoices')
    .select('invoice_number, status, payment_request_id')
    .eq('id', invoiceId)
    .single();

  if (invoice?.status === 'paid') {
    return { error: 'Paid invoices cannot be deleted.' };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('service_invoices')
    .update({ deleted_at: now, updated_at: now })
    .eq('id', invoiceId);

  if (error) return { error: error.message };

  // If linked PR is still pending/approved, mark it rejected (invoice is the requirement)
  if ((invoice as any)?.payment_request_id) {
    await supabase.from('payment_requests').update({
      status: 'rejected',
      rejected_by: user.id,
      rejected_at: now,
      rejection_reason: 'Linked invoice deleted',
    } as any).eq('id', (invoice as any).payment_request_id).in('status', ['pending', 'approved']);
  }

  await recordAuditLog({
    entity_type: 'service_invoice',
    entity_id: invoiceId,
    action: 'DELETE',
    changes: { before: { invoice_number: invoice?.invoice_number } },
    performed_by: user.id,
  });

  revalidatePath('/dashboard/invoices');
  return { success: true };
}

// --- Record payment (with required docs) ---

export async function recordPayment(prevState: any, formData: FormData) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('invoice.pay', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const invoice_id = formData.get('invoice_id') as string;
  const amount_paid = formData.get('amount_paid') as string;
  const payment_date = formData.get('payment_date') as string;
  const payment_type = formData.get('payment_type') as string;
  const payment_method = formData.get('payment_method') as string;
  const reference_number = formData.get('reference_number') as string;
  const notes = formData.get('notes') as string;

  if (!invoice_id || !amount_paid || !payment_date) {
    return { error: 'Missing required fields.' };
  }

  if (payment_method !== 'cash' && !reference_number?.trim()) {
    return { error: 'Reference number is required for the selected payment method.' };
  }

  // Require both blocking documents
  const voucherFile = formData.get('payment_voucher_file') as File | null;
  const proofFile = formData.get('proof_of_payment_file') as File | null;

  for (const [label, f] of [['Payment Voucher', voucherFile], ['Proof of Payment', proofFile]] as [string, File | null][]) {
    if (!f || f.size === 0) return { error: `${label} attachment is required to record a payment.` };
    const mime = resolveFileMime(f);
    if (!ALLOWED_MIME.includes(mime)) return { error: `${label} must be a PDF or image file.` };
    if (f.size > MAX_FILE_SIZE) return { error: `${label} exceeds the 10MB limit.` };
  }

  const totalSize = (voucherFile?.size ?? 0) + (proofFile?.size ?? 0);
  if (totalSize > MAX_TOTAL_SIZE) {
    return { error: 'Attachments exceed the 20MB combined limit. Please compress or split the files.' };
  }

  // Fetch invoice for vendor_id (needed for storage path)
  const { data: invoice } = await supabase
    .from('service_invoices')
    .select('*, purchase_orders(*)')
    .eq('id', invoice_id)
    .single();

  if (!invoice) return { error: 'Invoice not found.' };

  // Block payment if linked PR is not approved (invoice is the PR requirement, but PR must be approved before paying)
  if ((invoice as any).payment_request_id) {
    const { data: pr } = await supabase.from('payment_requests').select('status').eq('id', (invoice as any).payment_request_id).single();
    if (pr && pr.status === 'pending') return { error: 'Payment blocked: linked Payment Request is pending approval.' };
    if (pr && pr.status === 'rejected') return { error: 'Payment blocked: linked Payment Request was rejected. Delete or re-upload the invoice.' };
  }

  // Insert payment
  const { data: payment, error } = await supabase.from('payments').insert({
    invoice_id,
    amount_paid: Math.round(parseFloat(amount_paid) * 100) / 100,
    payment_date,
    payment_type,
    payment_method,
    reference_number,
    notes,
    recorded_by: user.id
  }).select('*').single();

  if (error) return { error: error.message };

  // Upload required documents — compensate on failure
  const docsToUpload: { file: File; docType: string }[] = [
    { file: voucherFile!, docType: 'payment_voucher' },
    { file: proofFile!, docType: 'proof_of_payment' },
  ];

  const uploadedPaths: string[] = [];
  try {
    for (const { file, docType } of docsToUpload) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'pdf';
      const mime = resolveFileMime(file);
      const filePath = `vendors/${invoice.vendor_id}/payments/${payment.id}/${docType}_${Date.now()}.${ext}`;
      const fileBuffer = Buffer.from(await file.arrayBuffer());

      const { error: uploadErr } = await supabase.storage
        .from('vendor-documents')
        .upload(filePath, fileBuffer, { contentType: mime, upsert: false });

      if (uploadErr) throw new Error(`Failed to upload ${docType}: ${uploadErr.message}`);
      uploadedPaths.push(filePath);

      const { data: { publicUrl } } = supabase.storage.from('vendor-documents').getPublicUrl(filePath);

      const { error: docErr } = await supabase.from('payment_documents').insert({
        payment_id: payment.id,
        doc_type: docType,
        file_url: publicUrl,
        file_name: file.name,
        uploaded_by: user.id,
      });

      if (docErr) throw new Error(`Failed to record ${docType}: ${docErr.message}`);
    }
  } catch (e: any) {
    // Compensating rollback: remove the payment + any uploaded files
    await supabase.from('payments').delete().eq('id', payment.id);
    if (uploadedPaths.length) {
      await supabase.storage.from('vendor-documents').remove(uploadedPaths);
    }
    return { error: e.message || 'Failed to save payment documents.' };
  }

  await recordAuditLog({
    entity_type: 'payment',
    entity_id: payment.id,
    action: 'CREATE',
    changes: { after: { amount_paid, payment_type, reference_number, invoice_id, documents: ['payment_voucher', 'proof_of_payment'] } },
    performed_by: user.id
  });

  // Update invoice status (consume PR balance if transitioning to a consuming state)
  const { data: allPayments } = await supabase
    .from('payments')
    .select('amount_paid')
    .eq('invoice_id', invoice_id);

  const totalPaidOnInvoice = allPayments?.reduce((sum, p) => sum + Number(p.amount_paid), 0) || 0;

  let invoiceStatus = 'pending_payment';
  if (totalPaidOnInvoice >= invoice.amount) {
    invoiceStatus = 'paid';
  } else if (totalPaidOnInvoice > 0) {
    invoiceStatus = 'partially_paid';
  }

  // The payment request balance is already reserved when the invoice is created
  // (a pending_payment invoice consumes it), and the service_invoice_sync_pr trigger
  // keeps the payment request status in sync — so no manual consumption step here.
  await supabase.from('service_invoices').update({ status: invoiceStatus }).eq('id', invoice_id);

  // Update PO status if linked
  if (invoice.po_id && invoice.purchase_orders) {
    const po_id = invoice.po_id;
    const po_amount = Number(invoice.purchase_orders.amount);

    const { data: poInvoices } = await supabase
      .from('service_invoices')
      .select('id')
      .eq('po_id', po_id);

    const invoiceIds = poInvoices?.map(i => i.id) || [];

    const { data: poPayments } = await supabase
      .from('payments')
      .select('amount_paid')
      .in('invoice_id', invoiceIds);

    const totalPaidOnPO = poPayments?.reduce((sum, p) => sum + Number(p.amount_paid), 0) || 0;

    let poStatus = 'signed';
    if (totalPaidOnPO >= po_amount) {
      poStatus = totalPaidOnPO > po_amount ? 'overpaid' : 'paid';
    } else if (totalPaidOnPO > 0) {
      poStatus = 'partially_paid';
    }

    await supabase.from('purchase_orders').update({ status: poStatus }).eq('id', po_id);
  }

  await createNotificationForRoles({
    type: 'payment',
    title: `💳 Payment Recorded`,
    message: `Payment of ${amount_paid} recorded for an invoice.`,
    link: `/dashboard/invoices/${invoice_id}`,
    created_by: user.id,
    roles: ['finance']
  });

  revalidatePath(`/dashboard/invoices/${invoice_id}`);
  return { success: true, error: null };
}

// --- Attach a payment document after the fact (e.g. official receipt) ---

export async function attachPaymentDocument(prevState: any, formData: FormData) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('invoice.pay', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const payment_id = formData.get('payment_id') as string;
  const doc_type = formData.get('doc_type') as string;
  const label = formData.get('label') as string | null;
  const file = formData.get('file') as File | null;

  if (!payment_id || !doc_type) return { error: 'Missing required fields.' };

  const AFTER_THE_FACT_TYPES = ['official_receipt', 'other'];
  if (!AFTER_THE_FACT_TYPES.includes(doc_type)) return { error: 'Invalid document type.' };
  if (doc_type === 'other' && !label?.trim()) return { error: 'Label is required for custom document type.' };

  if (!file || file.size === 0) return { error: 'File is required.' };
  const mime = resolveFileMime(file);
  if (!ALLOWED_MIME.includes(mime)) return { error: 'Only PDF, JPEG, PNG, or WebP files are accepted.' };
  if (file.size > MAX_FILE_SIZE) return { error: 'File exceeds the 10MB limit.' };

  // Verify payment + get invoice/vendor context
  const { data: payment } = await supabase
    .from('payments')
    .select('id, invoice_id, service_invoices(vendor_id)')
    .eq('id', payment_id)
    .is('deleted_at', null)
    .single();

  if (!payment) return { error: 'Payment not found.' };

  const vendorId = (payment.service_invoices as any)?.vendor_id;
  const invoiceId = payment.invoice_id;

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'pdf';
  const filePath = `vendors/${vendorId}/payments/${payment_id}/${doc_type}_${Date.now()}.${ext}`;
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await supabase.storage
    .from('vendor-documents')
    .upload(filePath, fileBuffer, { contentType: mime, upsert: false });

  if (uploadErr) return { error: `File upload failed: ${uploadErr.message}` };

  const { data: { publicUrl } } = supabase.storage.from('vendor-documents').getPublicUrl(filePath);

  const { error: docErr } = await supabase.from('payment_documents').insert({
    payment_id,
    doc_type,
    label: label?.trim() || null,
    file_url: publicUrl,
    file_name: file.name,
    uploaded_by: user.id,
  });

  if (docErr) {
    await supabase.storage.from('vendor-documents').remove([filePath]);
    return { error: docErr.message };
  }

  await recordAuditLog({
    entity_type: 'payment',
    entity_id: payment_id,
    action: 'UPDATE',
    changes: { after: { document_attached: doc_type } },
    performed_by: user.id
  });

  await createNotificationForRoles({
    type: 'payment',
    title: doc_type === 'official_receipt' ? '🧾 Official Receipt Attached' : '📎 Payment Document Attached',
    message: `A ${doc_type.replace(/_/g, ' ')} was attached to a payment.`,
    link: `/dashboard/invoices/${invoiceId}`,
    created_by: user.id,
    roles: ['finance']
  });

  revalidatePath(`/dashboard/invoices/${invoiceId}`);
  return { success: true };
}
