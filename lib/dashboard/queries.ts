import "server-only";
import { createClient } from "@/utils/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface ProjectProgress {
  id: string;
  name: string;
  paidAmount: number;
  committedAmount: number;
  pct: number; // payment progress: totalPaid / totalCommitted * 100
  totalInvoiced: number;
  totalDpAmount: number;
  billingPct: number; // (totalInvoiced + dp) / committed * 100
  completionPct: number; // weighted average from approved PO completion certs
  variance: number; // completionPct - billingPct
}

export interface MonthlyTrendPoint {
  month: string; // "Jan", "Feb", …
  apPaid: number;
  arCollected: number;
}

/** Billing-proxy project progress — no schema change required. Swaps to milestone-based once #5 lands. */
export async function getProjectProgress(supabase: SupabaseClient): Promise<ProjectProgress[]> {
  const [{ data: projects }, { data: pos }, { data: payments }, { data: invoices }, { data: certs }] = await Promise.all([
    supabase.from("projects").select("id, name").is("deleted_at", null),
    supabase
      .from("purchase_orders")
      .select("id, project_id, amount, dp_amount")
      .not("project_id", "is", null)
      .in("status", ["issued", "partially_paid", "paid"])
      .is("deleted_at", null),
    supabase
      .from("payments")
      .select("amount_paid, invoice_id, service_invoices(po_id)")
      .is("deleted_at", null),
    supabase
      .from("service_invoices")
      .select("id, amount, po_id")
      .is("deleted_at", null),
    supabase
      .from("po_completion_certificates")
      .select("po_id, percent_complete")
      .eq("status", "approved"),
  ]);

  if (!projects?.length) return [];

  const poIds = new Set((pos ?? []).map(po => po.id));

  // Map po_id → project_id
  const poProject = new Map<string, string>();
  // Also store dp_amount per PO
  const poDp = new Map<string, number>();
  for (const po of pos ?? []) {
    if (po.project_id) poProject.set(po.id, po.project_id);
    poDp.set(po.id, Number((po as any).dp_amount || 0));
  }

  // Accumulate metrics per project
  const committed = new Map<string, number>();
  const paid = new Map<string, number>();
  const invoicedTotal = new Map<string, number>();
  const dpTotal = new Map<string, number>();

  for (const po of pos ?? []) {
    if (!po.project_id) continue;
    const pid = po.project_id;
    committed.set(pid, (committed.get(pid) ?? 0) + Number(po.amount));
    dpTotal.set(pid, (dpTotal.get(pid) ?? 0) + Number((po as any).dp_amount || 0));
  }

  // Map invoice → po_id
  const invoicePO = new Map<string, string>();
  for (const inv of invoices ?? []) {
    if (inv.po_id && poIds.has(inv.po_id)) {
      invoicePO.set(inv.id, inv.po_id);
    }
  }

  for (const pmt of payments ?? []) {
    const inv = pmt.service_invoices as any;
    const poId = inv?.po_id as string | null;
    if (!poId) continue;
    const projId = poProject.get(poId);
    if (!projId) continue;
    paid.set(projId, (paid.get(projId) ?? 0) + Number(pmt.amount_paid));
  }

  // Accumulate invoiced amounts per project
  for (const inv of invoices ?? []) {
    const poId = invoicePO.get(inv.id);
    if (!poId) continue;
    const projId = poProject.get(poId);
    if (!projId) continue;
    invoicedTotal.set(projId, (invoicedTotal.get(projId) ?? 0) + Number(inv.amount));
  }

  // Completion certs: max approved % per PO, straight sum across POs, capped at 100
  const certPO = new Map<string, number>();
  for (const cert of certs ?? []) {
    const curr = certPO.get(cert.po_id) ?? 0;
    certPO.set(cert.po_id, Math.max(curr, Number(cert.percent_complete)));
  }

  const completionSum = new Map<string, number>();
  for (const po of pos ?? []) {
    if (!po.project_id) continue;
    const comp = certPO.get(po.id) ?? 0;
    completionSum.set(po.project_id, (completionSum.get(po.project_id) ?? 0) + comp);
  }

  return projects
    .filter((p) => committed.has(p.id))
    .map((p) => {
      const c = committed.get(p.id) ?? 0;
      const dp = dpTotal.get(p.id) ?? 0;
      const pd = Math.min((paid.get(p.id) ?? 0) + dp, c);
      const inv = invoicedTotal.get(p.id) ?? 0;
      const effectiveBilled = inv + dp;
      const billingPct = c > 0 ? Math.round((effectiveBilled / c) * 100) : 0;
      const completionPct = Math.min(100, Math.round(completionSum.get(p.id) ?? 0));
      const variance = completionPct - billingPct;
      return {
        id: p.id,
        name: p.name,
        paidAmount: pd,
        committedAmount: c,
        pct: c > 0 ? Math.round((pd / c) * 100) : 0,
        totalInvoiced: inv,
        totalDpAmount: dp,
        billingPct,
        completionPct,
        variance,
      };
    })
    .sort((a, b) => a.pct - b.pct); // least progress first (needs attention)
}

/** Last 6 months of AP paid and AR collected — for Recharts trend chart. */
export async function getMonthlyTrends(supabase: SupabaseClient): Promise<MonthlyTrendPoint[]> {
  const months: MonthlyTrendPoint[] = [];
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = d.toISOString().split("T")[0];
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split("T")[0];
    const label = d.toLocaleString("default", { month: "short" });

    const [{ data: ap }, { data: ar }] = await Promise.all([
      supabase.from("payments").select("amount_paid").gte("payment_date", start).lte("payment_date", end).is("deleted_at", null),
      supabase.from("client_payments").select("amount_paid").gte("payment_date", start).lte("payment_date", end).is("deleted_at", null),
    ]);

    months.push({
      month: label,
      apPaid: ap?.reduce((s, r) => s + Number(r.amount_paid), 0) ?? 0,
      arCollected: ar?.reduce((s, r) => s + Number(r.amount_paid), 0) ?? 0,
    });
  }

  return months;
}
