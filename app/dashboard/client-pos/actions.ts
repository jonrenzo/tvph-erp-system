"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { requireCapability } from "@/lib/auth/permissions";
import { recordAuditLog } from "@/utils/audit";

export async function createClientPO(formData: FormData) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability("client_po.write", supabase);
  if (authError || !user) return { error: authError || "Unauthorized" };

  const account_id = formData.get("account_id") as string;
  const po_number = (formData.get("po_number") as string)?.trim();
  const amount = parseFloat(formData.get("amount") as string);
  const currency = (formData.get("currency") as string) || "PHP";
  const received_date = formData.get("received_date") as string;
  const notes = (formData.get("notes") as string)?.trim() || null;
  const file = formData.get("file") as File | null;

  if (!account_id) return { error: "Client is required." };
  if (!po_number) return { error: "PO number is required." };
  if (!received_date) return { error: "Received date is required." };
  if (isNaN(amount) || amount <= 0) return { error: "A valid amount is required." };

  let file_url: string | null = null;
  let file_name: string | null = null;

  if (file && file.size > 0) {
    const fileExt = file.name.split(".").pop();
    const filePath = `client-pos/${account_id}/${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from("crm-documents")
      .upload(filePath, file, { contentType: file.type, upsert: false });
    if (uploadError) return { error: uploadError.message };
    const { data: { publicUrl } } = supabase.storage.from("crm-documents").getPublicUrl(filePath);
    file_url = publicUrl;
    file_name = file.name;
  }

  const { data: newPO, error } = await supabase
    .from("client_purchase_orders")
    .insert({
      account_id,
      po_number,
      amount,
      currency,
      received_date,
      status: "received",
      file_url,
      file_name,
      notes,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !newPO) return { error: error?.message || "Failed to create client PO." };

  await recordAuditLog({
    entity_type: "client_purchase_order",
    entity_id: newPO.id,
    action: "CREATE",
    changes: { after: { po_number, amount, currency, received_date, status: "received" } },
    performed_by: user.id,
  });

  revalidatePath("/dashboard/client-pos");
  revalidatePath(`/dashboard/crm/${account_id}`);
  return { success: true, id: newPO.id };
}

export async function updateClientPOStatus(
  poId: string,
  status: "received" | "partially_billed" | "fully_billed" | "cancelled",
) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability("client_po.write", supabase);
  if (authError || !user) return { error: authError || "Unauthorized" };

  const { data: po } = await supabase
    .from("client_purchase_orders")
    .select("account_id")
    .eq("id", poId)
    .single();

  const { error } = await supabase
    .from("client_purchase_orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", poId);

  if (error) return { error: error.message };

  await recordAuditLog({
    entity_type: "client_purchase_order",
    entity_id: poId,
    action: "UPDATE",
    changes: { after: { status } },
    performed_by: user.id,
  });

  revalidatePath("/dashboard/client-pos");
  if (po?.account_id) revalidatePath(`/dashboard/crm/${po.account_id}`);
  return { success: true };
}

export async function deleteClientPO(poId: string) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability("client_po.write", supabase);
  if (authError || !user) return { error: authError || "Unauthorized" };

  const { data: po } = await supabase
    .from("client_purchase_orders")
    .select("account_id")
    .eq("id", poId)
    .single();

  const { error } = await supabase
    .from("client_purchase_orders")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", poId);

  if (error) return { error: error.message };

  await recordAuditLog({
    entity_type: "client_purchase_order",
    entity_id: poId,
    action: "DELETE",
    performed_by: user.id,
  });

  revalidatePath("/dashboard/client-pos");
  if (po?.account_id) revalidatePath(`/dashboard/crm/${po.account_id}`);
  return { success: true };
}
