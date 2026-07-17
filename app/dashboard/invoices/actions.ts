'use server'

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { createNotification } from '@/utils/notifications';
import { recordAuditLog } from '@/utils/audit';
import { requireCapability } from '@/lib/auth/permissions';
import { extractDocumentMetadata } from '@/app/actions/ocr';
import { calculatePaymentDueDate } from '@/lib/payment-terms';

const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

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
      .in('status', ['issued', 'partially_paid'])
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

// --- Fetch eligible payment requests for a PO (client-side helper) ---

export interface EligiblePR {
  id: string;
  request_number: string;
  amount: number;
  consumed: number;
  remaining: number;
  status: string;
}

export async function getEligiblePaymentRequests(poId: string): Promise<{ data?: EligiblePR[]; error?: string }> {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('invoice.write', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  // Fetch all PRs for this PO (not just approved ones)
  const { data: prs, error } = await supabase
    .from('payment_requests')
    .select('id, request_number, amount, status')
    .eq('po_id', poId)
    .order('created_at', { ascending: false });

  if (error) return { error: error.message };
  if (!prs) return { data: [] };

  // Compute consumed + remaining for each PR
  const result: EligiblePR[] = await Promise.all(
    prs.map(async (pr) => {
      const { data: consuming } = await supabase
        .from('service_invoices')
        .select('amount')
        .eq('payment_request_id', pr.id)
        .in('status', ['approved', 'partially_paid', 'paid'])
        .is('deleted_at', null);

      const consumed = consuming?.reduce((sum, inv) => sum + Number(inv.amount), 0) ?? 0;
      return {
        id: pr.id,
        request_number: pr.request_number,
        amount: Number(pr.amount),
        consumed,
        remaining: Number(pr.amount) - consumed,
        status: pr.status,
      };
    })
  );

  return { data: result };
}

// --- Create invoice ---

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
  const payment_request_id = formData.get('payment_request_id') as string;
  const overage_confirmed = formData.get('overage_confirmed') === 'true';

  if (!vendor_id || !invoice_number || !amount || !invoice_date) {
    return { error: 'Missing required fields.' };
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

  let linkedPo: { net_days?: number | null } | null = null;

  // PO Amount Guard (includes completion-certificate ceiling when one is approved)
  let carryForwardAmount: number | null = null;
  if (po_id) {
    const [{ data: po, error: poError }, { data: existingInvoices }, { data: topCert }] = await Promise.all([
      supabase.from('purchase_orders').select('amount, expense_category, net_days').eq('id', po_id).single(),
      supabase.from('service_invoices')
        .select('amount')
        .eq('po_id', po_id)
        .is('deleted_at', null),
      supabase.from('po_completion_certificates')
        .select('percent_complete')
        .eq('po_id', po_id)
        .eq('status', 'approved')
        .order('percent_complete', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (poError || !po) return { error: 'Linked purchase order could not be loaded.' };

    if (po) {
      linkedPo = po;
      const poAmount = Number(po.amount);
      // If there is an approved cert, cap at that percentage of the PO; otherwise no cap beyond po.amount
      const ceiling = topCert ? (topCert.percent_complete / 100) * poAmount : poAmount;
      const totalExisting = existingInvoices?.reduce((sum, inv) => sum + Number(inv.amount), 0) ?? 0;
      const newTotal = totalExisting + parseFloat(amount);

      if (newTotal > ceiling) {
        const remaining = Math.max(0, ceiling - totalExisting);
        const ceilingLabel = topCert
          ? `${topCert.percent_complete}% approved completion (₱${ceiling.toLocaleString()})`
          : `PO limit (₱${poAmount.toLocaleString()})`;
        return {
          error: `Invoice amount exceeds ${ceilingLabel}. Available to bill: ₱${remaining.toLocaleString()}.`
        };
      }

      // PR validation: if a payment_request_id is provided, validate it
      if (payment_request_id) {
        const { data: selectedPR } = await supabase
          .from('payment_requests')
          .select('id, request_number, amount, vendor_id, status, po_id')
          .eq('id', payment_request_id)
          .single();

        if (!selectedPR) {
          return { error: 'Selected Payment Request not found.' };
        }

        if (selectedPR.po_id !== po_id) {
          return { error: 'The selected Payment Request does not belong to the linked PO.' };
        }

        if (selectedPR.status !== 'approved') {
          return { error: 'The selected Payment Request must be approved before an invoice can reference it.' };
        }

        if (selectedPR.vendor_id !== vendor_id) {
          return { error: 'The selected Payment Request vendor does not match the invoice vendor.' };
        }

        // Compute consumed balance from existing consuming invoices
        const { data: consumingInvoices } = await supabase
          .from('service_invoices')
          .select('amount')
          .eq('payment_request_id', payment_request_id)
          .in('status', ['approved', 'partially_paid', 'paid'])
          .is('deleted_at', null);

        const consumed = consumingInvoices?.reduce((sum, inv) => sum + Number(inv.amount), 0) ?? 0;
        const remaining = Number(selectedPR.amount) - consumed;
        const invoiceAmount = parseFloat(amount);
        const overage = Math.max(0, invoiceAmount - remaining);

        // Compute carry-forward (remaining after this invoice); negative means overage
        carryForwardAmount = remaining - invoiceAmount;

        // Validate amount vs remaining balance
        if (invoiceAmount > remaining) {
          if (!overage_confirmed) {
            return {
              error: `Invoice amount (₱${invoiceAmount.toLocaleString()}) exceeds available Payment Request balance (₱${remaining.toLocaleString()}). Overage: ₱${overage.toLocaleString()}. Please check the confirmation box to proceed, or lower the amount.`,
              overage: true,
              remaining,
              overageAmount: overage,
            };
          }
        }
      }
    }
  }

  let file_url = null;
  let file_name = null;

  if (staged_file_path?.startsWith('staging/invoices/')) {
    // Move staged file to its final location
    const ext = staged_file_name?.split('.').pop() ?? 'pdf';
    const finalFileName = `INV_${invoice_number}_${Date.now()}.${ext}`;
    const finalPath = `vendors/${vendor_id}/invoices/${finalFileName}`;

    const { error: moveError } = await supabase.storage
      .from('vendor-documents')
      .move(staged_file_path, finalPath);

    if (!moveError) {
      const { data: { publicUrl } } = supabase.storage.from('vendor-documents').getPublicUrl(finalPath);
      file_url = publicUrl;
      file_name = staged_file_name;
    }
  } else if (file && file.size > 0) {
    const fileExt = file.name.split('.').pop();
    const fileName = `INV_${invoice_number}_${Date.now()}.${fileExt}`;
    const filePath = `vendors/${vendor_id}/invoices/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('vendor-documents')
      .upload(filePath, file, { contentType: file.type, upsert: false });

    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage.from('vendor-documents').getPublicUrl(filePath);
      file_url = publicUrl;
      file_name = file.name;
    }
  }

  const finalDueDate = po_id
    ? calculatePaymentDueDate(submittedAt, Number(linkedPo?.net_days ?? 30))
    : due_date || calculatePaymentDueDate(submittedAt, 30);

  const { data: newInvoice, error } = await supabase.from('service_invoices').insert({
    vendor_id,
    po_id: po_id || null,
    invoice_number,
    amount: parseFloat(amount),
    invoice_date,
    due_date: finalDueDate,
    status: 'received',
    file_url,
    file_name,
    notes,
    payment_method: payment_method || null,
    expense_category: expense_category || null,
    payment_request_id: payment_request_id || null,
    carry_forward_amount: carryForwardAmount,
    submitted_at: submittedAt.toISOString(),
    created_by: user.id
  }).select('id').single();

  if (error) {
    if (error.code === '23505') return { error: `An invoice with number ${invoice_number} already exists.` };
    console.error('Error creating invoice:', error);
    return { error: error.message };
  }

  await recordAuditLog({
    entity_type: 'service_invoice',
    entity_id: newInvoice.id,
    action: 'CREATE',
    changes: { after: { invoice_number, amount, po_id } },
    performed_by: user.id
  });

  await createNotification({
    type: 'invoice',
    title: '🧾 Invoice Received',
    message: `Invoice #${invoice_number} was logged.`,
    link: `/dashboard/invoices/${newInvoice.id}`,
    created_by: user.id
  });

  revalidatePath('/dashboard/invoices');
  redirect(`/dashboard/invoices/${newInvoice.id}`);
}

// --- Update invoice status (with PR balance consumption / release) ---

export async function updateInvoiceStatus(
  invoiceId: string,
  status: string,
  overrideReason?: string,
) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('invoice.write', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  // Consuming-status transitions use the atomic RPC to prevent double-consumption
  if (status === 'approved') {
    const canOverride = overrideReason
      ? (await requireCapability('invoice.override', supabase)).user !== null
      : false;

    const { data: rpcResult, error: rpcError } = await supabase
      .rpc('approve_invoice_consume_balance', {
        p_invoice_id: invoiceId,
        p_override_by: canOverride ? user.id : null,
        p_override_reason: canOverride ? overrideReason : null,
      });

    if (rpcError) return { error: rpcError.message };

    const result = rpcResult as Record<string, any>;
    if (result?.error) return { error: result.error };

    await recordAuditLog({
      entity_type: 'service_invoice',
      entity_id: invoiceId,
      action: 'UPDATE',
      changes: { after: { status: 'approved', carry_forward_amount: result.carry_forward_amount, pr_status: result.pr_status } },
      performed_by: user.id,
    });

    await createNotification({
      type: 'invoice',
      title: '🧾 Invoice Approved',
      message: `Invoice approved. ₱${Number(result.carry_forward_amount).toLocaleString()} carry-forward remaining.`,
      link: `/dashboard/invoices/${invoiceId}`,
      created_by: user.id,
    });

    revalidatePath(`/dashboard/invoices/${invoiceId}`);
    return { success: true, carry_forward_amount: result.carry_forward_amount };
  }

  if (status === 'disputed') {
    const { data: rpcResult, error: rpcError } = await supabase
      .rpc('dispute_or_delete_invoice_release_balance', {
        p_invoice_id: invoiceId,
        p_new_status: 'disputed',
      });

    if (rpcError) return { error: rpcError.message };

    const result = rpcResult as Record<string, any>;
    if (result?.error) return { error: result.error };

    await recordAuditLog({
      entity_type: 'service_invoice',
      entity_id: invoiceId,
      action: 'UPDATE',
      changes: { after: { status: 'disputed', pr_reopened: result.pr_reopened, pr_new_status: result.pr_new_status } },
      performed_by: user.id,
    });

    await createNotification({
      type: 'invoice',
      title: '🧾 Invoice Disputed',
      message: result.pr_reopened
        ? `Invoice disputed. The linked payment request has been reopened with ₱${Number(result.remaining_balance).toLocaleString()} remaining.`
        : 'Invoice marked as disputed.',
      link: `/dashboard/invoices/${invoiceId}`,
      created_by: user.id,
    });

    revalidatePath(`/dashboard/invoices/${invoiceId}`);
    return { success: true, pr_reopened: result.pr_reopened, remaining_balance: result.remaining_balance };
  }

  // Non-consuming transitions: simple status update
  const { error } = await supabase
    .from('service_invoices')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', invoiceId);

  if (error) return { error: error.message };

  await recordAuditLog({
    entity_type: 'service_invoice',
    entity_id: invoiceId,
    action: 'UPDATE',
    changes: { after: { status } },
    performed_by: user.id,
  });

  await createNotification({
    type: 'invoice',
    title: '🧾 Invoice Status Updated',
    message: `Invoice status changed to ${status}.`,
    link: `/dashboard/invoices/${invoiceId}`,
    created_by: user.id,
  });

  revalidatePath(`/dashboard/invoices/${invoiceId}`);
  return { success: true };
}

export async function deleteInvoice(invoiceId: string) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('invoice.write', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const { data: invoice } = await supabase
    .from('service_invoices')
    .select('invoice_number, payment_request_id')
    .eq('id', invoiceId)
    .single();

  const { data: rpcResult, error: rpcError } = await supabase
    .rpc('dispute_or_delete_invoice_release_balance', {
      p_invoice_id: invoiceId,
      p_new_status: 'deleted',
    });

  if (rpcError) return { error: rpcError.message };
  const result = rpcResult as Record<string, any>;
  if (result?.error) return { error: result.error };

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

  // Fetch invoice for vendor_id (needed for storage path)
  const { data: invoice } = await supabase
    .from('service_invoices')
    .select('*, purchase_orders(*)')
    .eq('id', invoice_id)
    .single();

  if (!invoice) return { error: 'Invoice not found.' };

  // Insert payment
  const { data: payment, error } = await supabase.from('payments').insert({
    invoice_id,
    amount_paid: parseFloat(amount_paid),
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

  let invoiceStatus = 'received';
  if (totalPaidOnInvoice >= invoice.amount) {
    invoiceStatus = 'paid';
  } else if (totalPaidOnInvoice > 0) {
    invoiceStatus = 'partially_paid';
  }

  // If transitioning to a consuming state without having gone through approve,
  // consume the PR balance now (e.g. direct payment on a received invoice)
  const consumingStates = ['approved', 'partially_paid', 'paid'];
  const isNowConsuming = consumingStates.includes(invoiceStatus);
  const wasConsuming = consumingStates.includes(invoice.status);
  if (isNowConsuming && !wasConsuming && invoice.payment_request_id) {
    const { data: rpcResult, error: rpcError } = await supabase
      .rpc('approve_invoice_consume_balance', {
        p_invoice_id: invoice_id,
        p_override_by: null,
        p_override_reason: null,
      });
    if (rpcError) {
      // Non-blocking: log but don't fail the payment
      console.error('Failed to consume PR balance on payment record:', rpcError);
    } else {
      const result = rpcResult as Record<string, any>;
      if (result?.error) {
        console.error('Failed to consume PR balance on payment record:', result.error);
      }
    }
  }

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

    let poStatus = 'issued';
    if (totalPaidOnPO >= po_amount) {
      poStatus = totalPaidOnPO > po_amount ? 'overpaid' : 'paid';
    } else if (totalPaidOnPO > 0) {
      poStatus = 'partially_paid';
    }

    await supabase.from('purchase_orders').update({ status: poStatus }).eq('id', po_id);
  }

  await createNotification({
    type: 'payment',
    title: `💳 Payment Recorded`,
    message: `Payment of ${amount_paid} recorded for an invoice.`,
    link: `/dashboard/invoices/${invoice_id}`,
    created_by: user.id
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

  await createNotification({
    type: 'payment',
    title: doc_type === 'official_receipt' ? '🧾 Official Receipt Attached' : '📎 Payment Document Attached',
    message: `A ${doc_type.replace(/_/g, ' ')} was attached to a payment.`,
    link: `/dashboard/invoices/${invoiceId}`,
    created_by: user.id
  });

  revalidatePath(`/dashboard/invoices/${invoiceId}`);
  return { success: true };
}
