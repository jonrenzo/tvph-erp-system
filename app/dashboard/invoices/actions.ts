'use server'

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { createNotification } from '@/utils/notifications';
import { recordAuditLog } from '@/utils/audit';

export async function createInvoice(prevState: any, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const vendor_id = formData.get('vendor_id') as string;
  const po_id = formData.get('po_id') as string;
  const invoice_number = formData.get('invoice_number') as string;
  const amount = formData.get('amount') as string;
  const invoice_date = formData.get('invoice_date') as string;
  const due_date = formData.get('due_date') as string;
  const notes = formData.get('notes') as string;
  const file = formData.get('file') as File;

  if (!vendor_id || !invoice_number || !amount || !invoice_date) {
    return { error: 'Missing required fields.' };
  }

  // PO Amount Guard — combined invoice amounts cannot exceed the PO total
  if (po_id) {
    const [{ data: po }, { data: existingInvoices }] = await Promise.all([
      supabase.from('purchase_orders').select('amount').eq('id', po_id).single(),
      supabase.from('service_invoices')
        .select('amount')
        .eq('po_id', po_id)
        .is('deleted_at', null)
    ]);

    if (po) {
      const totalExisting = existingInvoices?.reduce((sum, inv) => sum + Number(inv.amount), 0) ?? 0;
      const newTotal = totalExisting + parseFloat(amount);

      if (newTotal > Number(po.amount)) {
        const remaining = Number(po.amount) - totalExisting;
        const currencySymbol = '₱'; // Dashboard uses PHP
        return {
          error: `Invoice amount exceeds PO limit. This PO has ${currencySymbol}${remaining.toLocaleString()} remaining capacity, but you entered ${currencySymbol}${parseFloat(amount).toLocaleString()}.`
        };
      }
    }
  }

  let file_url = null;
  let file_name = null;

  if (file && file.size > 0) {
    const fileExt = file.name.split('.').pop();
    const fileName = `INV_${invoice_number}_${Date.now()}.${fileExt}`;
    const filePath = `vendors/${vendor_id}/invoices/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('vendor-documents')
      .upload(filePath, file, { contentType: file.type, upsert: false });

    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage
        .from('vendor-documents')
        .getPublicUrl(filePath);
      file_url = publicUrl;
      file_name = file.name;
    }
  }

  const { data: newInvoice, error } = await supabase.from('service_invoices').insert({
    vendor_id,
    po_id: po_id || null,
    invoice_number,
    amount: parseFloat(amount),
    invoice_date,
    due_date: due_date || null,
    status: 'received',
    file_url,
    file_name,
    notes,
    created_by: user.id
  }).select('id').single();

  if (error) {
    console.error('Error creating invoice:', error);
    return { error: error.message };
  }

  // Audit log
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

export async function updateInvoiceStatus(invoiceId: string, status: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

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
    performed_by: user.id
  });

  await createNotification({
    type: 'invoice',
    title: `🧾 Invoice Status Updated`,
    message: `Invoice status changed to ${status}.`,
    link: `/dashboard/invoices/${invoiceId}`,
    created_by: user.id
  });

  revalidatePath(`/dashboard/invoices/${invoiceId}`);
  return { success: true };
}

export async function recordPayment(prevState: any, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

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

  // Audit log
  await recordAuditLog({
    entity_type: 'payment',
    entity_id: payment.id,
    action: 'CREATE',
    changes: { after: { amount_paid, payment_type, reference_number, invoice_id } },
    performed_by: user.id
  });

  // Fetch invoice and PO to update statuses
  const { data: invoice } = await supabase
    .from('service_invoices')
    .select('*, purchase_orders(*)')
    .eq('id', invoice_id)
    .single();

  if (invoice) {
    // 1. Calculate total paid for this invoice
    const { data: allPayments } = await supabase
      .from('payments')
      .select('amount_paid')
      .eq('invoice_id', invoice_id);
    
    const totalPaidOnInvoice = allPayments?.reduce((sum, p) => sum + Number(p.amount_paid), 0) || 0;
    
    // Update Invoice Status
    let invoiceStatus = 'received';
    if (totalPaidOnInvoice >= invoice.amount) {
      invoiceStatus = 'paid';
    } else if (totalPaidOnInvoice > 0) {
      invoiceStatus = 'partially_paid';
    }
    
    await supabase.from('service_invoices').update({ status: invoiceStatus }).eq('id', invoice_id);

    // 2. Update PO Status if linked
    if (invoice.po_id && invoice.purchase_orders) {
      const po_id = invoice.po_id;
      const po_amount = Number(invoice.purchase_orders.amount);
      
      // Get all payments linked to ANY invoice belonging to this PO
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
