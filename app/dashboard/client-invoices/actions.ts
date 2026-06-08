"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { requireCapability } from "@/lib/auth/permissions";
import { recordAuditLog } from "@/utils/audit";

export async function createClientInvoice(formData: FormData) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability("client_invoice.write", supabase);
  if (authError || !user) return { error: authError || "Unauthorized" };

  const account_id = formData.get("account_id") as string;
  const client_po_id = formData.get("client_po_id") as string;
  const invoice_number = (formData.get("invoice_number") as string)?.trim();
  const amount = parseFloat(formData.get("amount") as string);
  const currency = (formData.get("currency") as string) || "PHP";
  const invoice_date = formData.get("invoice_date") as string;
  const due_date = (formData.get("due_date") as string) || null;
  const notes = (formData.get("notes") as string)?.trim() || null;
  const file = formData.get("file") as File | null;

  if (!account_id) return { error: "Client is required." };
  if (!client_po_id) return { error: "Client PO is required." };
  if (!invoice_number) return { error: "Invoice number is required." };
  if (!invoice_date) return { error: "Invoice date is required." };
  if (isNaN(amount) || amount <= 0) return { error: "A valid amount is required." };

  // Guard: sum of invoices must not exceed PO amount
  const { data: po } = await supabase
    .from("client_purchase_orders")
    .select("amount, currency")
    .eq("id", client_po_id)
    .single();

  if (!po) return { error: "Client PO not found." };

  const { data: existingInvoices } = await supabase
    .from("client_invoices")
    .select("amount")
    .eq("client_po_id", client_po_id)
    .is("deleted_at", null)
    .neq("status", "cancelled");

  const totalBilled = (existingInvoices || []).reduce((sum, inv) => sum + Number(inv.amount), 0);
  if (totalBilled + amount > Number(po.amount)) {
    return {
      error: `Invoice amount exceeds PO limit. PO amount: ${po.currency} ${Number(po.amount).toLocaleString()}. Already billed: ${po.currency} ${totalBilled.toLocaleString()}.`,
    };
  }

  let file_url: string | null = null;
  let file_name: string | null = null;

  if (file && file.size > 0) {
    const fileExt = file.name.split(".").pop();
    const filePath = `client-invoices/${account_id}/${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from("crm-documents")
      .upload(filePath, file, { contentType: file.type, upsert: false });
    if (uploadError) return { error: uploadError.message };
    const { data: { publicUrl } } = supabase.storage.from("crm-documents").getPublicUrl(filePath);
    file_url = publicUrl;
    file_name = file.name;
  }

  const { data: newInvoice, error } = await supabase
    .from("client_invoices")
    .insert({
      account_id,
      client_po_id,
      invoice_number,
      amount,
      currency,
      invoice_date,
      due_date,
      status: "draft",
      notes,
      file_url,
      file_name,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !newInvoice) return { error: error?.message || "Failed to create invoice." };

  await recordAuditLog({
    entity_type: "client_invoice",
    entity_id: newInvoice.id,
    action: "CREATE",
    changes: { after: { invoice_number, amount, currency, invoice_date, status: "draft" } },
    performed_by: user.id,
  });

  revalidatePath("/dashboard/client-invoices");
  revalidatePath(`/dashboard/crm/${account_id}`);
  return { success: true, id: newInvoice.id };
}

export async function updateClientInvoiceStatus(
  invoiceId: string,
  status: "draft" | "sent" | "partially_paid" | "paid" | "cancelled",
) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability("client_invoice.write", supabase);
  if (authError || !user) return { error: authError || "Unauthorized" };

  const { data: inv } = await supabase
    .from("client_invoices")
    .select("account_id, client_po_id")
    .eq("id", invoiceId)
    .single();

  const { error } = await supabase
    .from("client_invoices")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", invoiceId);

  if (error) return { error: error.message };

  await recordAuditLog({
    entity_type: "client_invoice",
    entity_id: invoiceId,
    action: "UPDATE",
    changes: { after: { status } },
    performed_by: user.id,
  });

  revalidatePath("/dashboard/client-invoices");
  if (inv?.account_id) revalidatePath(`/dashboard/crm/${inv.account_id}`);
  return { success: true };
}

export async function recordClientPayment(formData: FormData) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability("client_invoice.pay", supabase);
  if (authError || !user) return { error: authError || "Unauthorized" };

  const invoice_id = formData.get("invoice_id") as string;
  const amount_paid = parseFloat(formData.get("amount_paid") as string);
  const payment_date = formData.get("payment_date") as string;
  const payment_type = formData.get("payment_type") as string;
  const payment_method = formData.get("payment_method") as string;
  const reference_number = (formData.get("reference_number") as string)?.trim() || null;
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!invoice_id) return { error: "Invoice ID is required." };
  if (isNaN(amount_paid) || amount_paid <= 0) return { error: "A valid payment amount is required." };
  if (!payment_date) return { error: "Payment date is required." };

  const { data: invoice } = await supabase
    .from("client_invoices")
    .select("account_id, client_po_id, amount, status")
    .eq("id", invoice_id)
    .single();

  if (!invoice) return { error: "Invoice not found." };

  const { error: insertError } = await supabase
    .from("client_payments")
    .insert({
      invoice_id,
      amount_paid,
      payment_date,
      payment_type,
      payment_method,
      reference_number,
      notes,
      recorded_by: user.id,
    });

  if (insertError) return { error: insertError.message };

  // Recalculate invoice status from all payments
  const { data: allPayments } = await supabase
    .from("client_payments")
    .select("amount_paid")
    .eq("invoice_id", invoice_id)
    .is("deleted_at", null);

  const totalPaid = (allPayments || []).reduce((sum, p) => sum + Number(p.amount_paid), 0);
  const invoiceAmount = Number(invoice.amount);
  let newStatus: string;
  if (totalPaid >= invoiceAmount) {
    newStatus = "paid";
  } else if (totalPaid > 0) {
    newStatus = "partially_paid";
  } else {
    newStatus = invoice.status;
  }

  await supabase
    .from("client_invoices")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", invoice_id);

  // Update client PO status based on all invoices for it
  if (invoice.client_po_id) {
    const { data: poInvoices } = await supabase
      .from("client_invoices")
      .select("amount, status")
      .eq("client_po_id", invoice.client_po_id)
      .is("deleted_at", null)
      .neq("status", "cancelled");

    const { data: clientPO } = await supabase
      .from("client_purchase_orders")
      .select("amount")
      .eq("id", invoice.client_po_id)
      .single();

    if (poInvoices && clientPO) {
      const totalBilled = poInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
      const allPaid = poInvoices.every((inv) => inv.status === "paid");
      let poStatus = "received";
      if (allPaid && totalBilled >= Number(clientPO.amount)) {
        poStatus = "fully_billed";
      } else if (totalBilled > 0) {
        poStatus = "partially_billed";
      }
      await supabase
        .from("client_purchase_orders")
        .update({ status: poStatus, updated_at: new Date().toISOString() })
        .eq("id", invoice.client_po_id);
    }
  }

  await recordAuditLog({
    entity_type: "client_payment",
    entity_id: invoice_id,
    action: "CREATE",
    changes: { after: { amount_paid, payment_date, payment_type, payment_method } },
    performed_by: user.id,
  });

  revalidatePath("/dashboard/client-invoices");
  revalidatePath(`/dashboard/client-invoices/${invoice_id}`);
  if (invoice.account_id) revalidatePath(`/dashboard/crm/${invoice.account_id}`);
  return { success: true };
}
