import "server-only";
import { createClient } from "@/utils/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface ProjectProgress {
  id: string;
  name: string;
  paidAmount: number;
  committedAmount: number;
  pct: number;
  totalInvoiced: number;
  totalDpAmount: number;
  billingPct: number;
  completionPct: number;
  variance: number;
}

export interface MonthlyTrendPoint {
  month: string;
  apPaid: number;
  arCollected: number;
}

export interface DashboardFinancials {
  totalPOCommitment: number;
  totalPaid: number;
  totalInvoiced: number;
  apPaidThisMonth: number;
  apOverdue: number;
  arCollectedThisMonth: number;
  arOutstanding: number;
  arOverdue: number;
  clientTotalPaid: number;
  monthlyTrends: MonthlyTrendPoint[];
}

export const EMPTY_DASHBOARD_FINANCIALS: DashboardFinancials = {
  totalPOCommitment: 0,
  totalPaid: 0,
  totalInvoiced: 0,
  apPaidThisMonth: 0,
  apOverdue: 0,
  arCollectedThisMonth: 0,
  arOutstanding: 0,
  arOverdue: 0,
  clientTotalPaid: 0,
  monthlyTrends: [],
};

const number = (value: unknown) => Number(value || 0);

/** Aggregated in Postgres so the dashboard does not fetch every finance row. */
export async function getDashboardFinancials(
  supabase: SupabaseClient,
  today: string,
): Promise<DashboardFinancials> {
  const { data, error } = await supabase.rpc("get_dashboard_financials", { p_today: today });
  if (error || !data) {
    if (error) console.error("Dashboard financial RPC failed:", error.message);
    return EMPTY_DASHBOARD_FINANCIALS;
  }

  const result = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;
  const trends = Array.isArray(result.monthly_trends) ? result.monthly_trends : [];
  return {
    totalPOCommitment: number(result.total_po_commitment),
    totalPaid: number(result.total_paid),
    totalInvoiced: number(result.total_invoiced),
    apPaidThisMonth: number(result.ap_paid_this_month),
    apOverdue: number(result.ap_overdue),
    arCollectedThisMonth: number(result.ar_collected_this_month),
    arOutstanding: number(result.ar_outstanding),
    arOverdue: number(result.ar_overdue),
    clientTotalPaid: number(result.client_total_paid),
    monthlyTrends: trends.map((trend: any) => ({
      month: String(trend.month || ""),
      apPaid: number(trend.ap_paid),
      arCollected: number(trend.ar_collected),
    })),
  };
}

/** Billing-proxy project progress, aggregated by the database. */
export async function getProjectProgress(supabase: SupabaseClient): Promise<ProjectProgress[]> {
  const { data, error } = await supabase.rpc("get_dashboard_project_progress");
  if (error) {
    console.error("Project progress RPC failed:", error.message);
    return [];
  }

  return (data ?? []).map((project: any) => ({
    id: project.id,
    name: project.name,
    paidAmount: number(project.paid_amount),
    committedAmount: number(project.committed_amount),
    pct: number(project.pct),
    totalInvoiced: number(project.total_invoiced),
    totalDpAmount: number(project.total_dp_amount),
    billingPct: number(project.billing_pct),
    completionPct: number(project.completion_pct),
    variance: number(project.variance),
  }));
}
