import "server-only";
import { createClient } from "@/utils/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface ProjectProgress {
  id: string;
  name: string;
  paidAmount: number;
  committedAmount: number;
  pct: number; // billing proxy: totalPaid / totalCommitted * 100
}

export interface MonthlyTrendPoint {
  month: string; // "Jan", "Feb", …
  apPaid: number;
  arCollected: number;
}

/** Billing-proxy project progress — no schema change required. Swaps to milestone-based once #5 lands. */
export async function getProjectProgress(supabase: SupabaseClient): Promise<ProjectProgress[]> {
  const [{ data: projects }, { data: pos }, { data: payments }] = await Promise.all([
    supabase.from("projects").select("id, name").is("deleted_at", null),
    supabase
      .from("purchase_orders")
      .select("id, project_id, amount")
      .not("project_id", "is", null)
      .in("status", ["issued", "partially_paid", "paid"])
      .is("deleted_at", null),
    supabase
      .from("payments")
      .select("amount_paid, invoice_id, service_invoices(po_id)")
      .is("deleted_at", null),
  ]);

  if (!projects?.length) return [];

  // Map po_id → amount
  const poAmounts = new Map<string, number>();
  for (const po of pos ?? []) {
    poAmounts.set(po.id, Number(po.amount));
  }

  // Map po_id → project_id
  const poProject = new Map<string, string>();
  for (const po of pos ?? []) {
    if (po.project_id) poProject.set(po.id, po.project_id);
  }

  // Accumulate committed and paid per project
  const committed = new Map<string, number>();
  const paid = new Map<string, number>();

  for (const po of pos ?? []) {
    if (!po.project_id) continue;
    committed.set(po.project_id, (committed.get(po.project_id) ?? 0) + Number(po.amount));
  }

  for (const pmt of payments ?? []) {
    const inv = pmt.service_invoices as any;
    const poId = inv?.po_id as string | null;
    if (!poId) continue;
    const projId = poProject.get(poId);
    if (!projId) continue;
    paid.set(projId, (paid.get(projId) ?? 0) + Number(pmt.amount_paid));
  }

  return projects
    .filter((p) => committed.has(p.id))
    .map((p) => {
      const c = committed.get(p.id) ?? 0;
      const pd = Math.min(paid.get(p.id) ?? 0, c);
      return {
        id: p.id,
        name: p.name,
        paidAmount: pd,
        committedAmount: c,
        pct: c > 0 ? Math.round((pd / c) * 100) : 0,
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
