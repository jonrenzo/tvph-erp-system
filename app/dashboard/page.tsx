import { createClient } from "@/utils/supabase/server";
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
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

export const unstable_instant = { prefetch: "static" };

export default function DashboardPage() {
  return (
    <div className="p-6 lg:p-8 space-y-8 animate-in fade-in duration-700">
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
          <Link
            href="/dashboard/purchase-orders/new"
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-lg shadow-primary/20"
          >
            <Plus className="h-4 w-4" />
            New PO
          </Link>
          <Link
            href="/dashboard/invoices/new"
            className="inline-flex items-center gap-2 bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm"
          >
            <FileText className="h-4 w-4" />
            Record Invoice
          </Link>
        </div>
      </div>

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}

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
  if (days <= 2)
    return "border-l-4 border-l-red-500 bg-red-50/30 dark:bg-red-950/10";
  if (days <= 5)
    return "border-l-4 border-l-amber-500 bg-amber-50/30 dark:bg-amber-950/10";
  return "border-l-4 border-l-yellow-400 bg-yellow-50/20 dark:bg-yellow-950/10";
}

function StatChip({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "emerald" | "amber" | "red";
}) {
  const styles = {
    emerald:
      "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    amber:
      "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    red: "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800",
  };
  return (
    <div
      className={`rounded-xl border px-3 py-2.5 ${styles[color]} flex flex-col gap-0.5`}
    >
      <span className="text-[10px] font-medium opacity-70 leading-tight">
        {label}
      </span>
      <span className="text-sm font-bold tabular-nums leading-tight">
        ₱{value.toLocaleString()}
      </span>
    </div>
  );
}

async function DashboardContent() {
  const supabase = await createClient();

  const today = new Date();
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(today.getDate() + 7);
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(today.getDate() + 30);

  const todayStr = today.toISOString().split("T")[0];
  const sevenDayStr = sevenDaysFromNow.toISOString().split("T")[0];
  const futureStr = thirtyDaysFromNow.toISOString().split("T")[0];

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString().split("T")[0];
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    .toISOString().split("T")[0];
  const monthLabel = today.toLocaleString("default", { month: "long", year: "numeric" });

  const [
    { count: pendingVendors },
    { data: activePOs },
    { data: unpaidInvoices },
    { count: expiringDocs },
    { data: payments },
    { data: recentLogs },
    { data: nearDueInvoices },
    { data: nearDuePOs },
    { data: vendorPaymentsThisMonth },
    { data: apOverdueData },
    { data: clientPaymentsThisMonth },
    { data: arOutstandingData },
    { data: clientTotalPayments },
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
    supabase
      .from("service_invoices")
      .select("id, amount, due_date, vendors(name)")
      .neq("status", "paid")
      .gte("due_date", todayStr)
      .lte("due_date", sevenDayStr)
      .order("due_date", { ascending: true }),
    supabase
      .from("purchase_orders")
      .select("id, po_number, amount, due_date, vendors(name)")
      .in("status", ["issued", "partially_paid"])
      .gte("due_date", todayStr)
      .lte("due_date", sevenDayStr)
      .order("due_date", { ascending: true }),
    // Payment Overview queries
    supabase
      .from("payments")
      .select("amount_paid")
      .gte("payment_date", monthStart)
      .lte("payment_date", monthEnd)
      .is("deleted_at", null),
    supabase
      .from("service_invoices")
      .select("amount")
      .neq("status", "paid")
      .lt("due_date", todayStr)
      .is("deleted_at", null),
    supabase
      .from("client_payments")
      .select("amount_paid")
      .gte("payment_date", monthStart)
      .lte("payment_date", monthEnd)
      .is("deleted_at", null),
    supabase
      .from("client_invoices")
      .select("amount, due_date")
      .not("status", "in", '("paid","cancelled")')
      .is("deleted_at", null),
    supabase
      .from("client_payments")
      .select("amount_paid")
      .is("deleted_at", null),
  ]);

  const totalPOCommitment =
    activePOs?.reduce((sum, po) => sum + Number(po.amount), 0) || 0;
  const totalPaid =
    payments?.reduce((sum, p) => sum + Number(p.amount_paid), 0) || 0;
  const totalInvoiced =
    unpaidInvoices?.reduce((sum, inv) => sum + Number(inv.amount), 0) || 0;
  const outstandingLiability = Math.max(0, totalInvoiced - totalPaid);

  // Payment Overview calculations
  const apPaidThisMonth =
    vendorPaymentsThisMonth?.reduce((sum, p) => sum + Number(p.amount_paid), 0) || 0;
  const apOverdue =
    apOverdueData?.reduce((sum, inv) => sum + Number(inv.amount), 0) || 0;
  const apTotal = totalPaid + outstandingLiability;
  const apSettledPct = apTotal > 0 ? (totalPaid / apTotal) * 100 : 0;

  const arCollectedThisMonth =
    clientPaymentsThisMonth?.reduce((sum, p) => sum + Number(p.amount_paid), 0) || 0;
  const arOutstanding =
    arOutstandingData?.reduce((sum, inv) => sum + Number(inv.amount), 0) || 0;
  const arOverdue =
    arOutstandingData
      ?.filter((inv) => inv.due_date < todayStr)
      .reduce((sum, inv) => sum + Number(inv.amount), 0) || 0;
  const clientTotalPaid =
    clientTotalPayments?.reduce((sum, p) => sum + Number(p.amount_paid), 0) || 0;
  const arTotal = clientTotalPaid + arOutstanding;
  const arSettledPct = arTotal > 0 ? (clientTotalPaid / arTotal) * 100 : 0;

  const netCashFlow = arCollectedThisMonth - apPaidThisMonth;

  function daysUntil(dateStr: string) {
    const diff = new Date(dateStr).getTime() - new Date(todayStr).getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  const kpis = [
    {
      label: "Current Liability",
      value: `₱${outstandingLiability.toLocaleString()}`,
      description: "Total unpaid invoices",
      icon: <CreditCard className="h-4 w-4 text-amber-500" />,
      accent: "text-amber-600 dark:text-amber-400",
      link: "/dashboard/invoices",
    },
    {
      label: "Active POs",
      value: activePOs?.length || 0,
      description: `₱${totalPOCommitment.toLocaleString()} committed`,
      icon: <FileText className="h-4 w-4 text-blue-500" />,
      accent: "text-blue-600 dark:text-blue-400",
      link: "/dashboard/purchase-orders",
    },
    {
      label: "Pending Vendors",
      value: pendingVendors || 0,
      description: "Awaiting accreditation",
      icon: <Building2 className="h-4 w-4 text-emerald-500" />,
      accent: "text-emerald-600 dark:text-emerald-400",
      link: "/dashboard/vendors",
    },
    {
      label: "Expiring Docs",
      value: expiringDocs || 0,
      description: "Next 30 days",
      icon: <AlertTriangle className="h-4 w-4 text-red-500" />,
      accent: "text-red-600 dark:text-red-400",
      link: "/dashboard/documents",
    },
  ];

  return (
    <>
      {/* ── URGENCY STRIP ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Near-Due Invoices */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#071F15] overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-red-50 dark:bg-red-950/40">
                <AlertCircle className="h-4 w-4 text-red-500" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Near-Due Invoices
                </h2>
                <p className="text-[10px] text-slate-400">Within 7 days</p>
              </div>
            </div>
            <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 rounded-full text-[11px] font-bold bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400">
              {nearDueInvoices?.length ?? 0}
            </span>
          </div>

          {!nearDueInvoices || nearDueInvoices.length === 0 ? (
            <div className="px-5 py-10 text-center text-slate-400 text-sm">
              No invoices due within 7 days.
            </div>
          ) : (
            <div className="divide-y divide-slate-50 dark:divide-slate-800/40">
              <div className="px-4 py-2 grid grid-cols-[1fr_auto_auto_auto] gap-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                <span>Vendor</span>
                <span className="text-right">Amount</span>
                <span className="text-right">Due Date</span>
                <span className="text-right">Left</span>
              </div>
              {nearDueInvoices.map((inv: any) => {
                const days = daysUntil(inv.due_date);
                return (
                  <div
                    key={inv.id}
                    className={`px-4 py-3 grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center text-sm transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/10 ${urgencyRowClass(days)}`}
                  >
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                      {inv.vendors?.name ?? "—"}
                    </span>
                    <span className="text-right font-mono text-xs text-slate-700 dark:text-slate-300 tabular-nums">
                      ₱{Number(inv.amount).toLocaleString()}
                    </span>
                    <span className="text-right text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {inv.due_date}
                    </span>
                    <span className="text-right">
                      <UrgencyBadge days={days} />
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800">
            <Link
              href="/dashboard/invoices"
              className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
            >
              View all invoices <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Near-Due POs */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#071F15] overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40">
                <CalendarClock className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Near-Due Purchase Orders
                </h2>
                <p className="text-[10px] text-slate-400">Within 7 days</p>
              </div>
            </div>
            <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              {nearDuePOs?.length ?? 0}
            </span>
          </div>

          {!nearDuePOs || nearDuePOs.length === 0 ? (
            <div className="px-5 py-10 text-center text-slate-400 text-sm">
              No purchase orders due within 7 days.
            </div>
          ) : (
            <div className="divide-y divide-slate-50 dark:divide-slate-800/40">
              <div className="px-4 py-2 grid grid-cols-[1fr_auto_auto_auto] gap-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                <span>Vendor</span>
                <span className="text-right">Amount</span>
                <span className="text-right">Due Date</span>
                <span className="text-right">Left</span>
              </div>
              {nearDuePOs.map((po: any) => {
                const days = daysUntil(po.due_date);
                return (
                  <div
                    key={po.id}
                    className={`px-4 py-3 grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center text-sm transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/10 ${urgencyRowClass(days)}`}
                  >
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                      {po.vendors?.name ?? "—"}
                    </span>
                    <span className="text-right font-mono text-xs text-slate-700 dark:text-slate-300 tabular-nums">
                      ₱{Number(po.amount).toLocaleString()}
                    </span>
                    <span className="text-right text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {po.due_date}
                    </span>
                    <span className="text-right">
                      <UrgencyBadge days={days} />
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800">
            <Link
              href="/dashboard/purchase-orders"
              className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
            >
              View all POs <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* ── KPI ROW ── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi, i) => (
          <a
            key={i}
            href={kpi.link}
            className="group flex items-center gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#071F15] px-5 py-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
          >
            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 group-hover:bg-primary/10 transition-colors shrink-0">
              {kpi.icon}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                {kpi.label}
              </p>
              <p className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                {kpi.value}
              </p>
              <p className={`text-[10px] font-medium ${kpi.accent} truncate`}>
                {kpi.description}
              </p>
            </div>
          </a>
        ))}
      </div>

      {/* ── PAYMENT OVERVIEW ── */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#071F15] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Payment Overview
            </h2>
            <p className="text-[10px] text-slate-400">{monthLabel}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 dark:divide-slate-800">
          {/* AP — money out */}
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
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                  style={{ width: `${apSettledPct}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 mt-1.5">
                <span>₱{totalPaid.toLocaleString()} paid</span>
                <span>₱{outstandingLiability.toLocaleString()} left</span>
              </div>
            </div>
          </div>

          {/* AR — money in */}
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
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                  style={{ width: `${arSettledPct}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 mt-1.5">
                <span>₱{clientTotalPaid.toLocaleString()} collected</span>
                <span>₱{arOutstanding.toLocaleString()} left</span>
              </div>
            </div>
          </div>
        </div>

        {/* Net cash flow strip */}
        <div className="border-t border-slate-100 dark:border-slate-800 px-6 py-3 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/20">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Net Cash Flow — {monthLabel}
          </span>
          <span
            className={`text-sm font-bold tabular-nums ${
              netCashFlow >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {netCashFlow >= 0 ? "+" : ""}₱
            {Math.abs(netCashFlow).toLocaleString()}
          </span>
        </div>
      </div>

      {/* ── ACTIVITY FEED (demoted, collapsible) ── */}
      <details className="group rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#071F15] overflow-hidden shadow-sm">
        <summary className="px-6 py-4 flex items-center justify-between cursor-pointer select-none list-none">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <History className="h-4 w-4 text-slate-400" />
            Recent System Activity
          </h2>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/audit-logs"
              className="text-xs font-bold text-primary hover:underline"
            >
              View All
            </Link>
            <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
          </div>
        </summary>

        <div className="border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-50 dark:divide-slate-800/50">
          {recentLogs?.length === 0 ? (
            <div className="p-10 text-center text-slate-400 italic text-sm">
              No activity recorded yet.
            </div>
          ) : (
            recentLogs?.map((log: any) => (
              <div
                key={log.id}
                className="px-6 py-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors flex items-start gap-4"
              >
                <div
                  className={`mt-0.5 p-1.5 rounded-full shrink-0 ${
                    log.action === "CREATE"
                      ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                      : log.action === "UPDATE"
                        ? "bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400"
                        : "bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400"
                  }`}
                >
                  <Clock className="h-3 w-3" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-900 dark:text-white">
                    <span className="font-bold">{log.profiles?.full_name}</span>{" "}
                    {log.action.toLowerCase()}d a{" "}
                    <span className="capitalize">
                      {log.entity_type.replace("_", " ")}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-400">
                    {new Date(log.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </details>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-64 rounded-2xl bg-slate-100 dark:bg-slate-800/50" />
        <div className="h-64 rounded-2xl bg-slate-100 dark:bg-slate-800/50" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-20 rounded-xl bg-slate-100 dark:bg-slate-800/50"
          />
        ))}
      </div>
      <div className="h-44 rounded-2xl bg-slate-100 dark:bg-slate-800/50" />
      <div className="h-16 rounded-2xl bg-slate-100 dark:bg-slate-800/50" />
    </div>
  );
}
