// Operations summary used by the Command Center KPIs and the Operations report.
// Mirrors the parallel KPI queries in app/dashboard/page.tsx so the dashboard and
// the report can never drift apart.

import type { createClient } from "@/utils/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export interface OperationsActivity {
  action: string;
  entityType: string;
  actorName: string;
  createdAt: string;
}

export interface OperationsSummary {
  outstandingLiability: number;
  activePOCount: number;
  totalPOCommitment: number;
  pendingVendors: number;
  expiringDocs: number;
  totalPaid: number;
  totalInvoiced: number;
  recentActivity: OperationsActivity[];
  generatedAt: Date;
}

const num = (v: unknown): number => Number(v ?? 0) || 0;

export async function getOperationsSummary(
  supabase: SupabaseServerClient,
): Promise<OperationsSummary> {
  const now = new Date();
  const thirtyDaysFromNow = new Date(now);
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const todayStr = now.toISOString().split("T")[0];
  const futureStr = thirtyDaysFromNow.toISOString().split("T")[0];

  const [
    { count: pendingVendors },
    { data: activePOs },
    { data: unpaidInvoices },
    { count: expiringDocs },
    { data: payments },
    { data: recentLogs },
  ] = await Promise.all([
    supabase
      .from("vendors")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("purchase_orders")
      .select("id, amount, status")
      .in("status", ["issued", "partially_paid"]),
    supabase.from("service_invoices").select("id, amount").neq("status", "paid"),
    supabase
      .from("vendor_documents")
      .select("*", { count: "exact", head: true })
      .lte("expiry_date", futureStr)
      .gte("expiry_date", todayStr)
      .is("archived_at", null),
    supabase.from("payments").select("amount_paid"),
    supabase
      .from("audit_logs")
      .select("id, action, entity_type, created_at, profiles(full_name)")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const totalPOCommitment = (activePOs ?? []).reduce(
    (sum, po) => sum + num(po.amount),
    0,
  );
  const totalPaid = (payments ?? []).reduce(
    (sum, p) => sum + num(p.amount_paid),
    0,
  );
  const totalInvoiced = (unpaidInvoices ?? []).reduce(
    (sum, inv) => sum + num(inv.amount),
    0,
  );

  const recentActivity: OperationsActivity[] = (recentLogs ?? []).map(
    (log: any) => ({
      action: log.action,
      entityType: log.entity_type,
      actorName: log.profiles?.full_name || "System",
      createdAt: log.created_at,
    }),
  );

  return {
    outstandingLiability: Math.max(0, totalInvoiced - totalPaid),
    activePOCount: activePOs?.length ?? 0,
    totalPOCommitment,
    pendingVendors: pendingVendors ?? 0,
    expiringDocs: expiringDocs ?? 0,
    totalPaid,
    totalInvoiced,
    recentActivity,
    generatedAt: now,
  };
}
