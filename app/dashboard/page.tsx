import { createClient } from "@/utils/supabase/server";
import { getCurrentProfile, hasCapability } from "@/lib/auth/permissions";
import { computeComplianceSummary } from "@/lib/reports/compliance";
import { EMPTY_DASHBOARD_FINANCIALS, getDashboardFinancials, getProjectProgress } from "@/lib/dashboard/queries";
import { TrendsChart } from "@/components/dashboard/trends-chart";
import { ProjectProgressList } from "@/components/dashboard/project-progress-list";
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
  AlertCircle,
  CalendarClock,
  Plus,
  FolderKanban,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

export const unstable_instant = { prefetch: "static" };

export default function DashboardPage() {
  return (
    <div className="p-6 lg:p-8 space-y-8 animate-in fade-in duration-700">
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────

function UrgencyBadge({ days }: { days: number }) {
  if (days <= 2) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">
        <AlertCircle className="h-2.5 w-2.5" />
        {days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days}d`}
      </span>
    );
  }
  if (days <= 5) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
        <Clock className="h-2.5 w-2.5" />
        {days}d
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-50 dark:bg-yellow-950/40 text-yellow-600 dark:text-yellow-500 border border-yellow-200 dark:border-yellow-800">
      <CalendarClock className="h-2.5 w-2.5" />
      {days}d
    </span>
  );
}

function urgencyRowClass(days: number) {
  if (days <= 2) return "border-l-4 border-l-red-500 bg-red-50/30 dark:bg-red-950/10";
  if (days <= 5) return "border-l-4 border-l-amber-500 bg-amber-50/30 dark:bg-amber-950/10";
  return "border-l-4 border-l-yellow-400 bg-yellow-50/20 dark:bg-yellow-950/10";
}

function StatChip({
  label, value, color,
}: {
  label: string; value: number; color: "emerald" | "amber" | "red";
}) {
  const styles = {
    emerald: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    amber: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    red: "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800",
  };
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${styles[color]} flex flex-col gap-0.5`}>
      <span className="text-[10px] font-medium opacity-70 leading-tight">{label}</span>
      <span className="text-sm font-bold tabular-nums leading-tight">₱{value.toLocaleString()}</span>
    </div>
  );
}

function KpiCard({
  label, value, description, icon, accent, link,
}: {
  label: string; value: string | number; description: string;
  icon: React.ReactNode; accent: string; link: string;
}) {
  return (
    <a
      href={link}
      className="group flex items-center gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#071F15] px-5 py-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
    >
      <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 group-hover:bg-primary/10 transition-colors shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">{label}</p>
        <p className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{value}</p>
        <p className={`text-[10px] font-medium ${accent} truncate`}>{description}</p>
      </div>
    </a>
  );
}

function SectionCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#071F15] overflow-hidden shadow-sm ${className}`}>
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
    <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">{icon}</div>
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h2>
          {subtitle && <p className="text-[10px] text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {badge}
    </div>
  );
}

// ── main data component ──────────────────────────────────────────────────────

async function DashboardContent() {
  const supabase = await createClient();
  const { role } = await getCurrentProfile(supabase);

  const canFinance = hasCapability(role, "accounting.read");
  const canOps = hasCapability(role, "vendor.write");
  const canProjects = hasCapability(role, "project.write") || role === "viewer";
  const canAudit = hasCapability(role, "audit.read") || role === "admin";
  const isAdminUp = role === "superadmin" || role === "admin";

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const sevenDayStr = new Date(today.getTime() + 7 * 86400000).toISOString().split("T")[0];
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
      ? supabase.from("purchase_orders").select("amount", { count: "exact" }).in("status", ["issued", "partially_paid"])
      : Promise.resolve({ count: 0, data: [] }),
    canOps || isAdminUp
      ? supabase.from("vendor_documents").select("*", { count: "exact", head: true }).lte("expiry_date", futureStr).gte("expiry_date", todayStr).is("archived_at", null)
      : Promise.resolve({ count: 0 }),
    canOps || isAdminUp
      ? supabase.from("service_invoices").select("id, amount, due_date, vendors(name)").neq("status", "paid").gte("due_date", todayStr).lte("due_date", sevenDayStr).order("due_date", { ascending: true })
      : Promise.resolve({ data: [] }),
    canOps || isAdminUp
      ? supabase.from("purchase_orders").select("id, po_number, amount, due_date, vendors(name)").in("status", ["issued", "partially_paid"]).gte("due_date", todayStr).lte("due_date", sevenDayStr).order("due_date", { ascending: true })
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
  const nearDueInvoices = nearDueInvoicesResult?.data ?? [];
  const nearDuePOs = nearDuePOsResult?.data ?? [];
  const recentLogs = recentLogsResult?.data ?? [];
  const projectProgress = projectProgressResult ?? [];
  const monthlyTrends = financials.monthlyTrends;

  const showAttentionStrip = canOps || canFinance || isAdminUp;
  const showFinancePanel = canFinance;
  const showTrends = (canFinance || isAdminUp) && monthlyTrends.length > 0;

  return (
    <>
      {/* ── HEADER + QUICK ACTIONS ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-plus-jakarta text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            Command Center
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Welcome back. Here is the operational pulse of TelcoVantage.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {canOps && (
            <Link
              href="/dashboard/purchase-orders/new"
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-lg shadow-primary/20"
            >
              <Plus className="h-4 w-4" />
              New PO
            </Link>
          )}
          {canFinance && (
            <Link
              href="/dashboard/invoices/new"
              className="inline-flex items-center gap-2 bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm"
            >
              <FileText className="h-4 w-4" />
              Record Invoice
            </Link>
          )}
        </div>
      </div>

      {/* ── ZONE 1: ATTENTION STRIP ── */}
      {showAttentionStrip && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Near-Due Invoices */}
          {(canFinance || isAdminUp) && (
            <SectionCard>
              <CardHeader
                icon={<AlertCircle className="h-4 w-4 text-red-500" />}
                title="Near-Due Invoices"
                subtitle="Within 7 days"
                badge={
                  <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 rounded-full text-[11px] font-bold bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400">
                    {nearDueInvoices.length}
                  </span>
                }
              />
              {nearDueInvoices.length === 0 ? (
                <div className="px-5 py-10 text-center text-slate-400 text-sm">
                  No invoices due within 7 days.
                </div>
              ) : (
                <div className="divide-y divide-slate-50 dark:divide-slate-800/40">
                  <div className="px-4 py-2 grid grid-cols-[1fr_auto_auto_auto] gap-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    <span>Vendor</span><span className="text-right">Amount</span><span className="text-right">Due Date</span><span className="text-right">Left</span>
                  </div>
                  {nearDueInvoices.map((inv: any) => {
                    const days = daysUntil(inv.due_date);
                    return (
                      <div key={inv.id} className={`px-4 py-3 grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center text-sm transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/10 ${urgencyRowClass(days)}`}>
                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{inv.vendors?.name ?? "—"}</span>
                        <span className="text-right font-mono text-xs text-slate-700 dark:text-slate-300 tabular-nums">₱{Number(inv.amount).toLocaleString()}</span>
                        <span className="text-right text-xs text-slate-500 dark:text-slate-400 tabular-nums">{inv.due_date}</span>
                        <UrgencyBadge days={days} />
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800">
                <Link href="/dashboard/invoices" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                  View all invoices <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
            </SectionCard>
          )}

          {/* Near-Due POs */}
          {(canOps || isAdminUp) && (
            <SectionCard>
              <CardHeader
                icon={<CalendarClock className="h-4 w-4 text-amber-500" />}
                title="Near-Due Purchase Orders"
                subtitle="Within 7 days"
                badge={
                  <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                    {nearDuePOs.length}
                  </span>
                }
              />
              {nearDuePOs.length === 0 ? (
                <div className="px-5 py-10 text-center text-slate-400 text-sm">
                  No purchase orders due within 7 days.
                </div>
              ) : (
                <div className="divide-y divide-slate-50 dark:divide-slate-800/40">
                  <div className="px-4 py-2 grid grid-cols-[1fr_auto_auto_auto] gap-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    <span>Vendor</span><span className="text-right">Amount</span><span className="text-right">Due Date</span><span className="text-right">Left</span>
                  </div>
                  {nearDuePOs.map((po: any) => {
                    const days = daysUntil(po.due_date);
                    return (
                      <div key={po.id} className={`px-4 py-3 grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center text-sm transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/10 ${urgencyRowClass(days)}`}>
                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{po.vendors?.name ?? "—"}</span>
                        <span className="text-right font-mono text-xs text-slate-700 dark:text-slate-300 tabular-nums">₱{Number(po.amount).toLocaleString()}</span>
                        <span className="text-right text-xs text-slate-500 dark:text-slate-400 tabular-nums">{po.due_date}</span>
                        <UrgencyBadge days={days} />
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800">
                <Link href="/dashboard/purchase-orders" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                  View all POs <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
            </SectionCard>
          )}
        </div>
      )}

      {/* ── ZONE 2: KPI ROW ── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {canFinance && (
          <KpiCard
            label="Current Liability"
            value={`₱${outstandingLiability.toLocaleString()}`}
            description="Total unpaid invoices"
            icon={<CreditCard className="h-4 w-4 text-amber-500" />}
            accent="text-amber-600 dark:text-amber-400"
            link="/dashboard/invoices"
          />
        )}
        {(canOps || isAdminUp) && (
          <KpiCard
            label="Active POs"
            value={activePOsResult.count ?? 0}
            description={`₱${totalPOCommitment.toLocaleString()} committed`}
            icon={<FileText className="h-4 w-4 text-blue-500" />}
            accent="text-blue-600 dark:text-blue-400"
            link="/dashboard/purchase-orders"
          />
        )}
        {(canOps || isAdminUp) && (
          <KpiCard
            label="Pending Vendors"
            value={pendingVendors ?? 0}
            description="Awaiting accreditation"
            icon={<Building2 className="h-4 w-4 text-emerald-500" />}
            accent="text-emerald-600 dark:text-emerald-400"
            link="/dashboard/vendors"
          />
        )}
        {canProjects && (
          <KpiCard
            label="Active Projects"
            value={activeProjectCount ?? 0}
            description="Across all clients"
            icon={<FolderKanban className="h-4 w-4 text-violet-500" />}
            accent="text-violet-600 dark:text-violet-400"
            link="/dashboard/projects"
          />
        )}
        {(canOps || isAdminUp) && (
          <KpiCard
            label="Expiring Docs"
            value={expiringDocs ?? 0}
            description="Next 30 days"
            icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
            accent="text-red-600 dark:text-red-400"
            link="/dashboard/documents"
          />
        )}
        {canFinance && (
          <KpiCard
            label="AR Outstanding"
            value={`₱${arOutstanding.toLocaleString()}`}
            description="Uncollected client invoices"
            icon={<ArrowUpRight className="h-4 w-4 text-emerald-500" />}
            accent="text-emerald-600 dark:text-emerald-400"
            link="/dashboard/client-invoices"
          />
        )}
      </div>

      {/* ── ZONE 3: TRENDS ── */}
      {showTrends && (
        <SectionCard>
          <CardHeader
            icon={<TrendingUp className="h-4 w-4 text-primary" />}
            title="Cash-Flow Trends"
            subtitle="Last 6 months — AP paid vs AR collected"
          />
          <div className="p-5">
            <TrendsChart data={monthlyTrends} />
          </div>
        </SectionCard>
      )}

      {/* ── ZONE 4: PAYMENT OVERVIEW (finance / admin) ── */}
      {showFinancePanel && (
        <SectionCard>
          <CardHeader
            icon={<TrendingUp className="h-4 w-4 text-primary" />}
            title="Payment Overview"
            subtitle={monthLabel}
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 dark:divide-slate-800">
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
                  <span className="font-medium">{apSettledPct.toFixed(1)}%</span>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${apSettledPct}%` }} />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 mt-1.5">
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
                  <span className="font-medium">{arSettledPct.toFixed(1)}%</span>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${arSettledPct}%` }} />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 mt-1.5">
                  <span>₱{clientTotalPaid.toLocaleString()} collected</span>
                  <span>₱{arOutstanding.toLocaleString()} left</span>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-slate-100 dark:border-slate-800 px-6 py-3 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/20">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Net Cash Flow — {monthLabel}</span>
            <span className={`text-sm font-bold tabular-nums ${arCollectedThisMonth - apPaidThisMonth >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
              {arCollectedThisMonth - apPaidThisMonth >= 0 ? "+" : ""}₱{Math.abs(arCollectedThisMonth - apPaidThisMonth).toLocaleString()}
            </span>
          </div>
        </SectionCard>
      )}

      {/* ── ZONE 5: ROLE PANELS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Projects progress */}
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
            <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800">
              <Link href="/dashboard/projects" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                View all projects <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </SectionCard>
        )}

        {/* Compliance health */}
        {(canOps || role === "viewer" || isAdminUp) && (
          <SectionCard>
            <CardHeader
              icon={<ShieldCheck className="h-4 w-4 text-emerald-500" />}
              title="Compliance Health"
              subtitle={`${compliance.totalVendors} active vendors`}
            />
            <div className="p-5 space-y-5">
              {/* Overall gauge */}
              <div>
                <div className="flex items-end justify-between mb-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Overall compliance</span>
                  <span className={`text-2xl font-bold tabular-nums ${compliance.overallPercentage >= 80 ? "text-emerald-500" : compliance.overallPercentage >= 50 ? "text-amber-500" : "text-red-500"}`}>
                    {compliance.overallPercentage}%
                  </span>
                </div>
                <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${compliance.overallPercentage >= 80 ? "bg-emerald-500" : compliance.overallPercentage >= 50 ? "bg-amber-400" : "bg-red-500"}`}
                    style={{ width: `${compliance.overallPercentage}%` }}
                  />
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 px-3 py-2.5 flex flex-col gap-0.5">
                  <span className="text-[10px] font-medium text-red-600 dark:text-red-400 opacity-80">Non-compliant</span>
                  <span className="text-lg font-bold text-red-700 dark:text-red-400 tabular-nums">{compliance.nonCompliant}</span>
                </div>
                <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 px-3 py-2.5 flex flex-col gap-0.5">
                  <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 opacity-80">Pending review</span>
                  <span className="text-lg font-bold text-amber-700 dark:text-amber-400 tabular-nums">{compliance.pendingReviews}</span>
                </div>
                <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2.5 flex flex-col gap-0.5">
                  <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 opacity-80">Fully compliant</span>
                  <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {compliance.totalVendors - compliance.nonCompliant}
                  </span>
                </div>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800">
              <Link href="/dashboard/compliance" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                View compliance hub <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </SectionCard>
        )}
      </div>

      {/* ── ZONE 6: ACTIVITY FEED ── */}
      {canAudit && (
        <details className="group rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#071F15] overflow-hidden shadow-sm">
          <summary className="px-6 py-4 flex items-center justify-between cursor-pointer select-none list-none">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
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
          <div className="border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-50 dark:divide-slate-800/50">
            {recentLogs.length === 0 ? (
              <div className="p-10 text-center text-slate-400 italic text-sm">No activity recorded yet.</div>
            ) : (
              recentLogs.map((log: any) => (
                <div key={log.id} className="px-6 py-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors flex items-start gap-4">
                  <div className={`mt-0.5 p-1.5 rounded-full shrink-0 ${log.action === "CREATE" ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400" : log.action === "UPDATE" ? "bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400" : "bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400"}`}>
                    <Clock className="h-3 w-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-900 dark:text-white">
                      <span className="font-bold">{log.profiles?.full_name}</span>{" "}
                      {log.action.toLowerCase()}d a{" "}
                      <span className="capitalize">{log.entity_type.replace("_", " ")}</span>
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-400">{new Date(log.created_at).toLocaleString()}</p>
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-64 rounded-2xl bg-slate-100 dark:bg-slate-800/50" />
        <div className="h-64 rounded-2xl bg-slate-100 dark:bg-slate-800/50" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-slate-100 dark:bg-slate-800/50" />)}
      </div>
      <div className="h-56 rounded-2xl bg-slate-100 dark:bg-slate-800/50" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-64 rounded-2xl bg-slate-100 dark:bg-slate-800/50" />
        <div className="h-64 rounded-2xl bg-slate-100 dark:bg-slate-800/50" />
      </div>
    </div>
  );
}
