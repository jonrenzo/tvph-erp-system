import { createClient } from "@/utils/supabase/server";
import { getCurrentProfile, hasCapability } from "@/lib/auth/permissions";
import { computeComplianceSummary } from "@/lib/reports/compliance";
import { EMPTY_DASHBOARD_FINANCIALS, getDashboardFinancials, getProjectProgress } from "@/lib/dashboard/queries";
import { ProjectProgressList } from "@/components/dashboard/project-progress-list";
import { TrendsChartLazy } from "@/components/dashboard/trends-chart-lazy";
import { AttentionLane, type LaneItem } from "@/components/dashboard/command-center/attention-lane";
import { KpiBento, KpiBentoItem } from "@/components/dashboard/command-center/kpi-bento";
import { CountUp } from "@/components/dashboard/command-center/count-up";
import {
  Building2,
  FileText,
  CreditCard,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  TrendingUp,
  Clock,
  History,
  ChevronDown,
  Plus,
  FolderKanban,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

export default function DashboardPage() {
  return (
    <div className="p-6 lg:p-8 space-y-8">
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────

function StatChip({
  label, value, color,
}: {
  label: string; value: number; color: "emerald" | "amber" | "red";
}) {
  const styles = {
    emerald: "bg-emerald-400 dark:bg-emerald-950/30 text-white dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    amber: "bg-amber-400 dark:bg-amber-950/30 text-white dark:text-amber-400 border-amber-200 dark:border-amber-800",
    red: "bg-red-400 dark:bg-red-950/30 text-white dark:text-red-400 border-red-200 dark:border-red-800",
  };
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${styles[color]} flex flex-col gap-0.5`}>
      <span className="text-[10px] font-black text-white opacity-70 leading-tight">{label}</span>
      <span className="text-sm font-black tabular-nums leading-tight">₱{value.toLocaleString()}</span>
    </div>
  );
}

function KpiCard({
  label, value, description, icon, accent, link, hero,
}: {
  label: string; value: React.ReactNode; description: string;
  icon: React.ReactNode; accent: string; link: string; hero?: boolean;
}) {
  return (
    <Link
      href={link}
      className={`group flex items-center gap-4 rounded-2xl px-5 py-4 glass-card transition-colors hover:border-slate-300/30 dark:hover:border-white/10 active:scale-[0.97] duration-100 ${hero ? "lg:py-6" : ""}`}
    >
      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 group-hover:bg-primary/10 transition-colors shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium tracking-wide text-slate-500 dark:text-slate-400 truncate">{label}</p>
        <p className={`font-bold tracking-tight text-slate-900 dark:text-white leading-tight tabular-nums truncate ${hero ? "text-[22px]" : "text-lg"}`}>{value}</p>
        <p className={`text-[10px] font-medium ${accent} truncate`}>{description}</p>
      </div>
    </Link>
  );
}

function SectionCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`glass-card rounded-2xl overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

function CardHeader({
  icon, title, subtitle, badge,
}: {
  icon: React.ReactNode; title: string; subtitle?: string; badge?: React.ReactNode;
}) {
  return (
    <div className="px-5 py-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-white/5">{icon}</div>
        <div>
          <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">{title}</h2>
          {subtitle && <p className="text-[10px] leading-none text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {badge}
    </div>
  );
}

// ── main data component ──────────────────────────────────────────────────────

export async function DashboardContent() {
  const supabase = await createClient();
  const { role } = await getCurrentProfile(supabase);

  const canFinance = hasCapability(role, "accounting.read");
  const canOps = hasCapability(role, "vendor.write");
  const canProjects = hasCapability(role, "project.write") || role === "viewer";
  const canAudit = hasCapability(role, "audit.read") || role === "admin";
  const isAdminUp = role === "superadmin" || role === "admin";

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const fourteenDayStr = new Date(today.getTime() + 14 * 86400000).toISOString().split("T")[0];
  const futureStr = new Date(today.getTime() + 30 * 86400000).toISOString().split("T")[0];
  const monthLabel = today.toLocaleString("default", { month: "long", year: "numeric" });

  function daysUntil(dateStr: string) {
    return Math.ceil((new Date(dateStr).getTime() - new Date(todayStr).getTime()) / 86400000);
  }

  // Run only queries the role actually needs
  const [
    { count: pendingVendors },
    activePOsResult,
    { count: expiringDocs },
    nearDueInvoicesResult,
    nearDuePOsResult,
    recentLogsResult,
    { count: activeProjectCount },
    vendorsForComplianceResult,
    projectProgressResult,
    financialsResult,
  ] = await Promise.all([
    canOps
      ? supabase.from("vendors").select("*", { count: "exact", head: true }).eq("status", "pending")
      : Promise.resolve({ count: 0 }),
    canOps || isAdminUp
      ? supabase.from("purchase_orders").select("amount", { count: "exact" }).in("status", ["issued", "pending_signature", "signed_received", "signed", "partially_paid"])
      : Promise.resolve({ count: 0, data: [] }),
    canOps || isAdminUp
      ? supabase.from("vendor_documents").select("*", { count: "exact", head: true }).lte("expiry_date", futureStr).gte("expiry_date", todayStr).is("archived_at", null)
      : Promise.resolve({ count: 0 }),
    canOps || isAdminUp
      ? supabase.from("service_invoices").select("id, amount, due_date, vendors(name)").neq("status", "paid").is("deleted_at", null).gte("due_date", todayStr).lte("due_date", fourteenDayStr).order("due_date", { ascending: true })
      : Promise.resolve({ data: [] }),
    canOps || isAdminUp
      ? supabase.from("purchase_orders").select("id, po_number, description, amount, due_date, vendors(name)").in("status", ["issued", "pending_signature", "signed_received", "signed", "partially_paid"]).is("deleted_at", null).gte("due_date", todayStr).lte("due_date", fourteenDayStr).order("due_date", { ascending: true })
      : Promise.resolve({ data: [] }),
    canAudit
      ? supabase.from("audit_logs").select("id, action, entity_type, created_at, profiles(full_name)").order("created_at", { ascending: false }).limit(5)
      : Promise.resolve({ data: [] }),
    canProjects
      ? supabase.from("projects").select("*", { count: "exact", head: true }).is("deleted_at", null)
      : Promise.resolve({ count: 0 }),
    canOps || role === "viewer"
      ? supabase.from("vendors").select("id, name, status, vendor_documents(doc_type, status, expiry_date)").eq("status", "active")
      : Promise.resolve({ data: [] }),
    canProjects
      ? getProjectProgress(supabase)
      : Promise.resolve([]),
    canFinance || isAdminUp ? getDashboardFinancials(supabase, todayStr) : Promise.resolve(null),
  ]);

  // Derived calculations
  const financials = financialsResult ?? EMPTY_DASHBOARD_FINANCIALS;
  const totalPOCommitment = financialsResult?.totalPOCommitment
    ?? activePOsResult.data?.reduce((sum, po) => sum + Number(po.amount), 0)
    ?? 0;
  const totalPaid = financials.totalPaid;
  const totalInvoiced = financials.totalInvoiced;
  const outstandingLiability = totalInvoiced;

  const { apPaidThisMonth, apOverdue, arCollectedThisMonth, arOutstanding, arOverdue, clientTotalPaid } = financials;
  const apSettledPct = (totalPaid + outstandingLiability) > 0 ? (totalPaid / (totalPaid + outstandingLiability)) * 100 : 0;
  const arSettledPct = (clientTotalPaid + arOutstanding) > 0 ? (clientTotalPaid / (clientTotalPaid + arOutstanding)) * 100 : 0;

  const compliance = computeComplianceSummary(vendorsForComplianceResult?.data as any);
  const nearDueInvoices = (nearDueInvoicesResult?.data ?? []) as any[];
  const nearDuePOs = (nearDuePOsResult?.data ?? []) as any[];
  const recentLogs = recentLogsResult?.data ?? [];
  const projectProgress = projectProgressResult ?? [];
  const monthlyTrends = financials.monthlyTrends;

  const showFinancePanel = canFinance;
  const showTrends = (canFinance || isAdminUp) && monthlyTrends.length > 0;

  // Fused lane items, sorted by urgency
  const laneItems: LaneItem[] = [
    ...nearDueInvoices.map((inv: any) => ({
      id: inv.id,
      href: `/dashboard/invoices/${inv.id}`,
      vendorName: inv.vendors?.name ?? "—",
      label: "Invoice",
      amount: Number(inv.amount),
      dueDate: inv.due_date,
      days: daysUntil(inv.due_date),
      type: "invoice" as const,
    })),
    ...nearDuePOs.map((po: any) => ({
      id: po.id,
      href: `/dashboard/purchase-orders/${po.id}`,
      vendorName: po.vendors?.name ?? "—",
      label: po.po_number + (po.description ? ` · ${po.description}` : ""),
      amount: Number(po.amount),
      dueDate: po.due_date,
      days: daysUntil(po.due_date),
      type: "po" as const,
    })),
  ];

  return (
    <>
      {/* ── HEADER + QUICK ACTIONS ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-plus-jakarta text-[32px] font-bold tracking-[-0.03em] leading-none text-slate-900 dark:text-white">
            Command Center
          </h1>
          <p className="text-[13px] leading-5 text-slate-500 dark:text-slate-400 mt-2">
            Welcome back. Here is the operational pulse of TelcoVantage.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {canOps && (
            <Link
              href="/dashboard/purchase-orders/new"
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 active:scale-[0.97] text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" />
              New PO
            </Link>
          )}
          {canFinance && (
            <Link
              href="/dashboard/invoices/new"
              className="inline-flex items-center gap-2 glass-card hover:bg-white/80 dark:hover:bg-white/10 active:scale-[0.97] text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl text-sm font-medium transition-all"
            >
              <FileText className="h-4 w-4" />
              Record Invoice
            </Link>
          )}
        </div>
      </div>

      {/* ── FUSED ATTENTION LANE (collapses when empty) ── */}
      <AttentionLane items={laneItems} />

      {/* ── KPI BENTO: liability is hero (2 cols) ── */}
      <KpiBento>
        {canFinance && (
          <KpiBentoItem hero>
            <KpiCard
              hero
              label="Current Liability"
              value={<CountUp value={outstandingLiability} prefix="₱" />}
              description="Total unpaid invoices"
              icon={<CreditCard className="h-4 w-4 text-amber-500" />}
              accent="text-amber-600 dark:text-amber-400"
              link="/dashboard/invoices"
            />
          </KpiBentoItem>
        )}
        {(canOps || isAdminUp) && (
          <KpiBentoItem>
            <KpiCard
              label="Active POs"
              value={<CountUp value={activePOsResult.count ?? 0} />}
              description={`₱${totalPOCommitment.toLocaleString()} committed`}
              icon={<FileText className="h-4 w-4 text-blue-500" />}
              accent="text-blue-600 dark:text-blue-400"
              link="/dashboard/purchase-orders"
            />
          </KpiBentoItem>
        )}
        {(canOps || isAdminUp) && (
          <KpiBentoItem>
            <KpiCard
              label="Pending Vendors"
              value={<CountUp value={pendingVendors ?? 0} />}
              description="Awaiting accreditation"
              icon={<Building2 className="h-4 w-4 text-emerald-500" />}
              accent="text-emerald-600 dark:text-emerald-400"
              link="/dashboard/vendors"
            />
          </KpiBentoItem>
        )}
        {canProjects && (
          <KpiBentoItem>
            <KpiCard
              label="Active Projects"
              value={<CountUp value={activeProjectCount ?? 0} />}
              description="Across all clients"
              icon={<FolderKanban className="h-4 w-4 text-violet-500" />}
              accent="text-violet-600 dark:text-violet-400"
              link="/dashboard/projects"
            />
          </KpiBentoItem>
        )}
        {(canOps || isAdminUp) && (
          <KpiBentoItem>
            <KpiCard
              label="Expiring Docs"
              value={<CountUp value={expiringDocs ?? 0} />}
              description="Next 30 days"
              icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
              accent="text-red-600 dark:text-red-400"
              link="/dashboard/documents"
            />
          </KpiBentoItem>
        )}
        {canFinance && (
          <KpiBentoItem>
            <KpiCard
              label="AR Outstanding"
              value={<CountUp value={arOutstanding} prefix="₱" />}
              description="Uncollected client invoices"
              icon={<ArrowUpRight className="h-4 w-4 text-emerald-500" />}
              accent="text-emerald-600 dark:text-emerald-400"
              link="/dashboard/client-invoices"
            />
          </KpiBentoItem>
        )}
      </KpiBento>

      {/* ── TRENDS ── */}
      {showTrends && (
        <SectionCard>
          <CardHeader
            icon={<TrendingUp className="h-4 w-4 text-primary" />}
            title="Cash-Flow Trends"
            subtitle="Last 6 months — AP paid vs AR collected"
          />
          <div className="p-5">
            <TrendsChartLazy data={monthlyTrends} />
          </div>
        </SectionCard>
      )}

      {/* ── PAYMENT OVERVIEW (finance) ── */}
      {showFinancePanel && (
        <SectionCard>
          <CardHeader
            icon={<TrendingUp className="h-4 w-4 text-primary" />}
            title="Payment Overview"
            subtitle={monthLabel}
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 dark:divide-white/10">
            <div className="p-5 space-y-4">
              <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <ArrowDownLeft className="h-3.5 w-3.5 text-red-400" />
                Accounts Payable — Vendor Payments
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <StatChip label="Paid this month" value={apPaidThisMonth} color="emerald" />
                <StatChip label="Outstanding" value={outstandingLiability} color="amber" />
                <StatChip label="Overdue" value={apOverdue} color="red" />
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                  <span>Settlement rate (all-time)</span>
                  <span className="font-medium tabular-nums">{apSettledPct.toFixed(1)}%</span>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${apSettledPct}%` }} />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 mt-1.5 tabular-nums">
                  <span>₱{totalPaid.toLocaleString()} paid</span>
                  <span>₱{outstandingLiability.toLocaleString()} left</span>
                </div>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />
                Accounts Receivable — Client Collections
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <StatChip label="Collected" value={arCollectedThisMonth} color="emerald" />
                <StatChip label="Outstanding" value={arOutstanding} color="amber" />
                <StatChip label="Overdue" value={arOverdue} color="red" />
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                  <span>Collection rate (all-time)</span>
                  <span className="font-medium tabular-nums">{arSettledPct.toFixed(1)}%</span>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${arSettledPct}%` }} />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 mt-1.5 tabular-nums">
                  <span>₱{clientTotalPaid.toLocaleString()} collected</span>
                  <span>₱{arOutstanding.toLocaleString()} left</span>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-slate-100 dark:border-white/10 px-6 py-3 flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.02]">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Net Cash Flow — {monthLabel}</span>
            <span className={`text-sm font-bold tabular-nums ${arCollectedThisMonth - apPaidThisMonth >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
              {arCollectedThisMonth - apPaidThisMonth >= 0 ? "+" : ""}₱{Math.abs(arCollectedThisMonth - apPaidThisMonth).toLocaleString()}
            </span>
          </div>
        </SectionCard>
      )}

      {/* ── ROLE PANELS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {canProjects && (
          <SectionCard>
            <CardHeader
              icon={<FolderKanban className="h-4 w-4 text-violet-500" />}
              title="Project Progress"
              subtitle="Billing % vs Completion % — per project"
            />
            {projectProgress.length === 0 ? (
              <div className="px-5 py-10 text-center text-slate-400 text-sm">
                No projects with active POs yet.
              </div>
            ) : (
              <ProjectProgressList projects={projectProgress} />
            )}
            <div className="px-5 py-3 border-t border-slate-100 dark:border-white/10">
              <Link href="/dashboard/projects" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                View all projects <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </SectionCard>
        )}

        {(canOps || role === "viewer" || isAdminUp) && (
          <SectionCard>
            <CardHeader
              icon={<ShieldCheck className="h-4 w-4 text-emerald-500" />}
              title="Compliance Health"
              subtitle={`${compliance.totalVendors} active vendors`}
            />
            <div className="p-5 space-y-5">
              <div>
                <div className="flex items-end justify-between mb-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Overall compliance</span>
                  <span className={`text-2xl font-bold tabular-nums ${compliance.overallPercentage >= 80 ? "text-emerald-500" : compliance.overallPercentage >= 50 ? "text-amber-500" : "text-red-500"}`}>
                    {compliance.overallPercentage}%
                  </span>
                </div>
                <div className="h-3 w-full bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${compliance.overallPercentage >= 80 ? "bg-emerald-500" : compliance.overallPercentage >= 50 ? "bg-amber-400" : "bg-red-500"}`}
                    style={{ width: `${compliance.overallPercentage}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-400 dark:bg-red-950/20 px-3 py-2.5 flex flex-col gap-0.5">
                  <span className="text-[10px] font-medium text-white dark:text-red-400 opacity-80">Non-compliant</span>
                  <span className="text-lg font-bold text-white dark:text-red-400 tabular-nums">{compliance.nonCompliant}</span>
                </div>
                <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-400 dark:bg-amber-950/20 px-3 py-2.5 flex flex-col gap-0.5">
                  <span className="text-[10px] font-medium text-white dark:text-amber-400 opacity-80">Pending review</span>
                  <span className="text-lg font-bold text-white dark:text-amber-400 tabular-nums">{compliance.pendingReviews}</span>
                </div>
                <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-400 dark:bg-emerald-950/20 px-3 py-2.5 flex flex-col gap-0.5">
                  <span className="text-[10px] font-medium text-white dark:text-emerald-400 opacity-80">Fully compliant</span>
                  <span className="text-lg font-bold text-white dark:text-emerald-400 tabular-nums">
                    {compliance.totalVendors - compliance.nonCompliant}
                  </span>
                </div>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-slate-100 dark:border-white/10">
              <Link href="/dashboard/compliance" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                View compliance hub <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </SectionCard>
        )}
      </div>

      {/* ── ACTIVITY FEED ── */}
      {canAudit && (
        <details className="group glass-card rounded-2xl overflow-hidden">
          <summary className="px-6 py-4 flex items-center justify-between cursor-pointer select-none list-none">
            <h2 className="text-sm font-bold tracking-tight text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <History className="h-4 w-4 text-slate-400" />
              Recent System Activity
            </h2>
            <div className="flex items-center gap-3">
              <Link href="/dashboard/audit-logs" className="text-xs font-bold text-primary hover:underline">
                View All
              </Link>
              <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
            </div>
          </summary>
          <div className="border-t border-slate-100 dark:border-white/10 divide-y divide-slate-50 dark:divide-white/5">
            {recentLogs.length === 0 ? (
              <div className="p-10 text-center text-slate-400 italic text-sm">No activity recorded yet.</div>
            ) : (
              recentLogs.map((log: any) => (
                <div key={log.id} className="px-6 py-3 hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors flex items-start gap-4">
                  <div className={`mt-0.5 p-1.5 rounded-full shrink-0 ${log.action === "CREATE" ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400" : log.action === "UPDATE" ? "bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400" : "bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400"}`}>
                    <Clock className="h-3 w-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-900 dark:text-white">
                      <span className="font-bold">{log.profiles?.full_name}</span>{" "}
                      {log.action.toLowerCase()}d a{" "}
                      <span className="capitalize">{log.entity_type.replace("_", " ")}</span>
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-400 tabular-nums">{new Date(log.created_at).toLocaleString()}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </details>
      )}
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="flex justify-between">
        <div className="space-y-2">
          <div className="h-8 w-48 rounded-lg bg-slate-100 dark:bg-slate-800/50" />
          <div className="h-4 w-64 rounded bg-slate-100 dark:bg-slate-800/50" />
        </div>
        <div className="h-9 w-28 rounded-xl bg-slate-100 dark:bg-slate-800/50" />
      </div>
      <div className="h-44 rounded-2xl bg-slate-100 dark:bg-slate-800/50" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-slate-100 dark:bg-slate-800/50" />)}
      </div>
      <div className="h-56 rounded-2xl bg-slate-100 dark:bg-slate-800/50" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-64 rounded-2xl bg-slate-100 dark:bg-slate-800/50" />
        <div className="h-64 rounded-2xl bg-slate-100 dark:bg-slate-800/50" />
      </div>
    </div>
  );
}
