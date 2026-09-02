"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { requireCapability } from "@/lib/auth/permissions";
import { recordAuditLog } from "@/utils/audit";
import { canTransition, normalizeBillingStatus } from "@/lib/billing/status";
import { parseFile } from "@/utils/import-export";

const BILLING_STATUSES = new Set([
  "for_billing",
  "pending_sky_technical",
  "for_payment",
  "pending_payment",
  "collected",
]);

function todayISO(): string {
  return new Date().toISOString().split("T")[0]!;
}

function addDaysISO(dateStr: string, days: number): string {
  return new Date(new Date(dateStr).getTime() + days * 86400000).toISOString().split("T")[0]!;
}

function parseExcelDate(v: any): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && v > 20000 && v < 60000) {
    // Excel serial date
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return d.toISOString().split("T")[0]!;
  }
  const s = String(v).trim();
  if (!s) return null;
  // Try native parse; handles 6-Jul-26, 2026-07-06, 7/6/2026
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0]!;
  return null;
}

function parseNum(v: any): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/,/g, "").trim());
  return isNaN(n) ? null : n;
}

// ponytail: helper to enforce exact status transition and stamp dates
async function writeTransition(
  billingId: string,
  from: string,
  to: string,
  userId: string,
  supabase: any,
  note?: string | null,
) {
  const now = new Date().toISOString();
  const patch: Record<string, any> = { status: to, updated_at: now };
  if (to === "for_payment" || to === "pending_payment") {
    // auto-stamp date_endorsed on first entry into payment phase
    const { data: cur } = await supabase.from("client_billing").select("date_endorsed").eq("id", billingId).single();
    if (!cur?.date_endorsed) patch.date_endorsed = todayISO();
  }
  if (to === "collected") patch.collected_at = now;
  const { error } = await supabase.from("client_billing").update(patch).eq("id", billingId);
  if (error) return { error: error.message };
  await supabase.from("client_billing_timeline").insert({
    billing_id: billingId,
    from_status: from,
    to_status: to,
    changed_by: userId,
    note: note || null,
  });
  await recordAuditLog({
    entity_type: "client_billing",
    entity_id: billingId,
    action: "UPDATE",
    changes: { after: { status: to } },
    performed_by: userId,
  });
  return { success: true };
}

function parseNodeDetails(raw: string | null): { region: string; area_city: string; node_id: string; phase: string; no_of_nodes: number; cable_length_km: number; has_mrs: boolean }[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map((r: any) => ({
      region: String(r.region || "").trim() || null as any,
      area_city: String(r.area_city || "").trim() || null as any,
      node_id: String(r.node_id || "").trim() || null as any,
      phase: String(r.phase || "").trim() || null as any,
      no_of_nodes: Math.max(0, parseInt(String(r.no_of_nodes), 10) || 0) || 1,
      cable_length_km: Number(r.cable_length_km) || 0,
      has_mrs: Boolean(r.has_mrs),
    }));
  } catch { return []; }
}

export async function createClientBilling(formData: FormData) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability("client_invoice.write", supabase);
  if (authError || !user) return { error: authError || "Unauthorized" };

  const account_id = (formData.get("account_id") as string)?.trim();
  const project_id = (formData.get("project_id") as string)?.trim() || null;
  const project_name_free = (formData.get("project_name_free") as string)?.trim() || null;
  const resolvedProjectId = project_id || null;
  const invoice_number = (formData.get("invoice_number") as string)?.trim() || null;
  const invoice_batch = (formData.get("invoice_batch") as string)?.trim() || null;
  const amount_vat_ex = parseNum(formData.get("amount_vat_ex") as string) ?? 0;
  const amount_vat_inc = parseNum(formData.get("amount_vat_inc") as string) ?? 0;
  const due_date_raw = (formData.get("due_date") as string) || null;
  const est_payment_date = (formData.get("est_payment_date") as string) || null;
  const notes = (formData.get("notes") as string)?.trim() || null;
  const rtd_url = (formData.get("rtd_url") as string)?.trim() || null;

  if (!account_id) return { error: "Client is required." };
  if (!amount_vat_inc && !amount_vat_ex) return { error: "Amount is required." };

  const nodeDetails = parseNodeDetails(formData.get("node_details") as string | null);
  // derive snapshot fields from nodes for backward compat / list view
  const totalNodes = nodeDetails.reduce((s, n) => s + (Number(n.no_of_nodes) || 0), 0) || null;
  const firstRegion = nodeDetails.find((n) => n.region)?.region || null;

  const date_issued = todayISO();
  const due_date = due_date_raw || addDaysISO(date_issued, 30);
  const { data: row, error } = await supabase
    .from("client_billing")
    .insert({
      account_id,
      project_id: resolvedProjectId,
      project_name_free: resolvedProjectId ? null : project_name_free,
      invoice_number,
      invoice_batch,
      num_nodes: totalNodes,
      region: firstRegion,
      amount_vat_ex,
      amount_vat_inc: amount_vat_inc || amount_vat_ex,
      date_issued,
      due_date,
      est_payment_date,
      status: "for_billing",
      notes,
      file_url: rtd_url,
      file_name: rtd_url ? "RTD" : null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !row) return { error: error?.message || "Failed to create billing record." };

  if (nodeDetails.length) {
    const svc = createServiceRoleClient();
    const toInsert = nodeDetails.map((n, i) => ({
      billing_id: row.id,
      sn: i + 1,
      region: n.region,
      area_city: n.area_city,
      node_id: n.node_id,
      phase: n.phase,
      no_of_nodes: n.no_of_nodes,
      cable_length_km: n.cable_length_km,
      has_mrs: n.has_mrs,
    }));
    const { error: ndErr } = await svc.from("client_billing_nodes").insert(toInsert);
    if (ndErr) return { error: ndErr.message };
  }

  await supabase.from("client_billing_timeline").insert({
    billing_id: row.id,
    from_status: null,
    to_status: "for_billing",
    changed_by: user.id,
  });
  await recordAuditLog({
    entity_type: "client_billing",
    entity_id: row.id,
    action: "CREATE",
    changes: { after: { invoice_number, status: "for_billing" } },
    performed_by: user.id,
  });

  // MRS summary email: to operations, cc finance+admins (fire-and-forget, never blocks creation)
  try {
    const { sendBillingMrsSummaryEmail } = await import("@/lib/email/client-billing-mrs-summary");
    // shallow copy nodes with display-needed fields
    sendBillingMrsSummaryEmail(row.id, nodeDetails, { actorId: user.id }).catch(() => {});
  } catch {}

  revalidatePath("/dashboard/client-invoices");
  return { success: true, id: row.id };
}

export async function transitionBillingStatus(
  billingId: string,
  toStatus: string,
  note?: string,
  opts?: { invoice_number?: string | null; invoice_batch?: string | null },
) {
  const supabase = await createClient();
  // Collected is finance-gated; everything else is plain write
  const cap = toStatus === "collected" ? "client_invoice.pay" : "client_invoice.write";
  const { user, error: authError } = await requireCapability(cap as any, supabase);
  if (authError || !user) return { error: authError || "Unauthorized" };
  if (!BILLING_STATUSES.has(toStatus)) return { error: "Invalid status." };

  const { data: cur } = await supabase.from("client_billing").select("status, invoice_number").eq("id", billingId).single();
  if (!cur) return { error: "Billing record not found." };
  const from = (cur as any).status as string;
  if (from === toStatus) return { success: true };

  // Approval requires invoice number (from existing row or from the approval modal payload)
  if (from === "pending_sky_technical" && toStatus === "for_payment") {
    const invNum = (opts?.invoice_number?.trim() || (cur as any).invoice_number || "").trim();
    if (!invNum) return { error: "Invoice number is required to approve." };
    // persist invoice fields if supplied via the approval modal
    const patch: Record<string, any> = { updated_at: new Date().toISOString() };
    if (opts?.invoice_number != null) patch.invoice_number = opts.invoice_number.trim() || null;
    if (opts?.invoice_batch != null) patch.invoice_batch = opts.invoice_batch.trim() || null;
    if (Object.keys(patch).length > 1) {
      const { error: patchErr } = await supabase.from("client_billing").update(patch).eq("id", billingId);
      if (patchErr) return { error: patchErr.message };
    }
  }

  // Direct guard; auto For Payment -> Pending Payment
  if (toStatus === "pending_payment" && from === "pending_sky_technical") {
    // Approve path: must go via for_payment first (auto). So route through it.
    const r1 = await writeTransition(billingId, from, "for_payment", user.id, supabase, note);
    if ((r1 as any).error) return r1;
    revalidatePath("/dashboard/client-invoices");
    revalidatePath(`/dashboard/client-invoices/${billingId}`);
    // auto second hop
    const r2 = await writeTransition(billingId, "for_payment", "pending_payment", user.id, supabase);
    if ((r2 as any).error) return r2;
    revalidatePath("/dashboard/client-invoices");
    revalidatePath(`/dashboard/client-invoices/${billingId}`);
    return { success: true };
  }
  if (!canTransition(from, toStatus)) {
    // allow auto hop for_payment->pending is fine; everything else must be explicit
    if (!(from === "for_payment" && toStatus === "pending_payment")) {
      return { error: `Cannot move from ${from} to ${toStatus}.` };
    }
  }

  // Normal single hop
  const res = await writeTransition(billingId, from, toStatus, user.id, supabase, note);
  if ((res as any).error) return res;

  // Auto: For Payment -> Pending Payment (so endorsed rows immediately enter aging)
  if (toStatus === "for_payment") {
    await writeTransition(billingId, "for_payment", "pending_payment", user.id, supabase);
  }

  revalidatePath("/dashboard/client-invoices");
  revalidatePath(`/dashboard/client-invoices/${billingId}`);
  return { success: true };
}

export async function updateClientBilling(billingId: string, formData: FormData) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability("client_invoice.write", supabase);
  if (authError || !user) return { error: authError || "Unauthorized" };

  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  const fields = ["invoice_number", "invoice_batch", "notes"] as const;
  for (const f of fields) {
    const v = formData.get(f);
    if (v !== null) patch[f] = String(v).trim() || null;
  }
  const vatEx = formData.get("amount_vat_ex");
  if (vatEx !== null) patch.amount_vat_ex = parseNum(vatEx as string) ?? 0;
  const vatInc = formData.get("amount_vat_inc");
  if (vatInc !== null) patch.amount_vat_inc = parseNum(vatInc as string) ?? 0;
  const due = formData.get("due_date");
  if (due !== null) patch.due_date = String(due).trim() || null;
  const est = formData.get("est_payment_date");
  if (est !== null) patch.est_payment_date = String(est).trim() || null;
  const proj = formData.get("project_id");
  if (proj !== null) {
    const pid = String(proj).trim() || null;
    patch.project_id = pid;
    // when a real project is linked, clear free text; otherwise keep whatever was sent
    if (pid) patch.project_name_free = null;
  }
  const pfree = formData.get("project_name_free");
  if (pfree !== null) {
    const v = String(pfree).trim() || null;
    // only store free text when no project_id is being set (or already null)
    if (!patch.project_id) patch.project_name_free = v;
  }
  const rtd = formData.get("rtd_url");
  if (rtd !== null) {
    const v = String(rtd).trim() || null;
    patch.file_url = v;
    patch.file_name = v ? "RTD" : null;
  }

  // handle node_details if present
  const rawNodes = formData.get("node_details");
  if (rawNodes !== null) {
    const nodes = parseNodeDetails(rawNodes as string);
    patch.num_nodes = nodes.reduce((s: number, n: any) => s + (Number(n.no_of_nodes) || 0), 0) || null;
    patch.region = nodes.find((n: any) => n.region)?.region || null;
    // replace nodes
    const svc = createServiceRoleClient();
    await svc.from("client_billing_nodes").delete().eq("billing_id", billingId);
    if (nodes.length) {
      const toInsert = nodes.map((n: any, i: number) => ({
        billing_id: billingId,
        sn: i + 1,
        region: n.region,
        area_city: n.area_city,
        node_id: n.node_id,
        phase: n.phase,
        no_of_nodes: n.no_of_nodes,
        cable_length_km: n.cable_length_km,
        has_mrs: n.has_mrs,
      }));
      const { error: ndErr } = await svc.from("client_billing_nodes").insert(toInsert);
      if (ndErr) return { error: ndErr.message };
    }
  }

  const { error } = await supabase.from("client_billing").update(patch).eq("id", billingId);
  if (error) return { error: error.message };
  await recordAuditLog({ entity_type: "client_billing", entity_id: billingId, action: "UPDATE", changes: { after: patch }, performed_by: user.id });
  revalidatePath("/dashboard/client-invoices");
  revalidatePath(`/dashboard/client-invoices/${billingId}`);
  return { success: true };
}

export async function updateClientBillingNodes(billingId: string, formData: FormData) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability("client_invoice.write", supabase);
  if (authError || !user) return { error: authError || "Unauthorized" };
  const nodes = parseNodeDetails(formData.get("node_details") as string | null);
  const svc = createServiceRoleClient();
  await svc.from("client_billing_nodes").delete().eq("billing_id", billingId);
  if (nodes.length) {
    const toInsert = nodes.map((n: any, i: number) => ({
      billing_id: billingId,
      sn: i + 1,
      region: n.region,
      area_city: n.area_city,
      node_id: n.node_id,
      phase: n.phase,
      no_of_nodes: n.no_of_nodes,
      cable_length_km: n.cable_length_km,
      has_mrs: n.has_mrs,
    }));
    const { error } = await svc.from("client_billing_nodes").insert(toInsert);
    if (error) return { error: error.message };
  }
  const patch: Record<string, any> = {
    num_nodes: nodes.reduce((s, n: any) => s + (Number(n.no_of_nodes) || 0), 0) || null,
    region: nodes.find((n: any) => n.region)?.region || null,
    updated_at: new Date().toISOString(),
  };
  await supabase.from("client_billing").update(patch).eq("id", billingId);
  revalidatePath("/dashboard/client-invoices");
  revalidatePath(`/dashboard/client-invoices/${billingId}`);
  return { success: true };
}

export async function deleteClientBilling(billingId: string) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability("client_invoice.write", supabase);
  if (authError || !user) return { error: authError || "Unauthorized" };
  const { error } = await supabase.from("client_billing").update({ deleted_at: new Date().toISOString() }).eq("id", billingId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/client-invoices");
  return { success: true };
}

export async function importClientBilling(formData: FormData) {
  const { user, error: roleError } = await requireCapability("client_invoice.write");
  if (roleError || !user) return { error: roleError || "Unauthorized" };
  const supabase = createServiceRoleClient();

  const file = formData.get("file") as File | null;
  const fallbackAccountId = (formData.get("account_id") as string)?.trim() || null;
  if (!file) return { error: "No file provided." };
  const buf = await file.arrayBuffer();
  let rows: Record<string, any>[];
  try {
    rows = parseFile(buf) as any;
  } catch {
    return { error: "Failed to parse file. Use a valid CSV or Excel file." };
  }
  if (!rows.length) return { error: "File is empty." };

  // header -> field mapping for this workflow
  const alias: Record<string, string> = {
    "s/n": "__ignore",
    "s/n.": "__ignore",
    "invoice batch": "invoice_batch",
    "batch": "invoice_batch",
    "invoice number": "invoice_number",
    "invoice no": "invoice_number",
    "invoice no.": "invoice_number",
    "# of nodes": "num_nodes",
    "no of nodes": "num_nodes",
    "nodes": "num_nodes",
    "region": "region",
    "date issued": "date_issued",
    "date issued ": "date_issued",
    "date endorsed to sky finance": "date_endorsed",
    "date endorsed": "date_endorsed",
    "amount due (in php) vat-ex": "amount_vat_ex",
    "amount due vat-ex": "amount_vat_ex",
    "vat-ex": "amount_vat_ex",
    "amount due (in php) vat-inc": "amount_vat_inc",
    "amount due vat-inc": "amount_vat_inc",
    "vat-inc": "amount_vat_inc",
    "due date": "due_date",
    "estimated payment date": "est_payment_date",
    "est payment date": "est_payment_date",
    "number of days of delay": "__ignore",
    "days of delay": "__ignore",
    "status": "status",
    "client": "account_name",
    "company name": "account_name",
  };

  let created = 0;
  let updated = 0;
  const errors: { row: number; reason: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i] as Record<string, any>;
    // normalize keys lower
    const norm: Record<string, any> = {};
    for (const [k, v] of Object.entries(raw)) {
      const key = k.trim().toLowerCase().replace(/\s+/g, " ");
      norm[key] = v;
    }
    const pick = (field: string) => {
      for (const [k, v] of Object.entries(norm)) {
        if ((alias[k] || "") === field) return v;
      }
      return undefined;
    };

    try {
      const invoice_number = String(pick("invoice_number") ?? "").trim();
      if (!invoice_number) {
        errors.push({ row: i + 2, reason: "Missing invoice number." });
        continue;
      }
      // resolve account: by name if present, else fallback
      let account_id: string | null = null;
      const accountName = pick("account_name") != null ? String(pick("account_name")).trim() : "";
      if (accountName) {
        const { data: acct } = await supabase.from("crm_accounts").select("id").ilike("company_name", accountName).is("deleted_at", null).maybeSingle();
        account_id = (acct as any)?.id || null;
        if (!account_id) {
          errors.push({ row: i + 2, reason: `Client not found: ${accountName}` });
          continue;
        }
      } else {
        account_id = fallbackAccountId;
      }
      if (!account_id) {
        errors.push({ row: i + 2, reason: "Client is required (add a Client column or choose a target client)." });
        continue;
      }

      const amount_vat_ex = parseNum(pick("amount_vat_ex")) ?? 0;
      const amount_vat_inc = parseNum(pick("amount_vat_inc")) ?? amount_vat_ex;
      const region = pick("region") != null ? String(pick("region")).trim() || null : null;
      const num_nodes = pick("num_nodes") != null ? parseInt(String(pick("num_nodes")), 10) : null;
      const invoice_batch = pick("invoice_batch") != null ? String(pick("invoice_batch")).trim() || null : null;
      const date_issued = parseExcelDate(pick("date_issued"));
      const date_endorsed = parseExcelDate(pick("date_endorsed"));
      const due_date = parseExcelDate(pick("due_date"));
      const est_payment_date = parseExcelDate(pick("est_payment_date"));
      const statusRaw = String(pick("status") ?? "for_billing").trim();
      let status = normalizeBillingStatus(statusRaw) || "for_billing";
      // For Payment rows with a date_endorsed should land in pending_payment (auto)
      if (status === "for_payment" && date_endorsed) status = "pending_payment" as any;

      const { data: existing } = await supabase
        .from("client_billing")
        .select("id")
        .eq("invoice_number", invoice_number)
        .eq("account_id", account_id)
        .is("deleted_at", null)
        .maybeSingle();

      const payload: Record<string, any> = {
        account_id,
        invoice_number,
        invoice_batch,
        num_nodes: isNaN(num_nodes as number) ? null : num_nodes,
        region,
        amount_vat_ex,
        amount_vat_inc,
        date_issued: date_issued || todayISO(),
        date_endorsed,
        due_date,
        est_payment_date,
        status,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        const { error: upErr } = await supabase.from("client_billing").update(payload).eq("id", (existing as any).id);
        if (upErr) errors.push({ row: i + 2, reason: upErr.message });
        else updated++;
      } else {
        const { data: ins, error: insErr } = await supabase.from("client_billing").insert({ ...payload, created_by: user.id }).select("id").single();
        if (insErr || !ins) errors.push({ row: i + 2, reason: insErr?.message || "Insert failed." });
        else {
          created++;
          await supabase.from("client_billing_timeline").insert({
            billing_id: (ins as any).id,
            from_status: null,
            to_status: status,
            changed_by: user.id,
            note: "Imported from spreadsheet",
          });
        }
      }
    } catch (e: any) {
      errors.push({ row: i + 2, reason: e?.message || "Unexpected error" });
    }
  }

  await recordAuditLog({
    entity_type: "client_billing",
    entity_id: "bulk",
    action: "CREATE",
    changes: { after: { import_summary: { created, updated, errors: errors.length } } },
    performed_by: user.id,
  });
  revalidatePath("/dashboard/client-invoices");
  return { created, updated, errors, totalRows: rows.length };
}
