import { createClient } from "@/utils/supabase/server";
import { Suspense } from "react";
import { DollarSign, TrendingUp, AlertCircle, FileText, ArrowUpRight, ArrowDownRight, Bell } from "lucide-react";
import Link from "next/link";
import { ExpenseChart } from "@/components/dashboard/accounting/expense-chart";
import { APAgingTable } from "@/components/dashboard/accounting/ap-aging-table";
import { PaymentReservationsTable } from "@/components/dashboard/accounting/payment-reservations-table";
import { computeApAging } from "@/lib/reports/apAging";
import { getCurrentProfile, hasCapability } from "@/lib/auth/permissions";

export const unstable_instant = { prefetch: "static" };

export default function AccountingPage() {
  return (
    <div className="p-6 lg:p-8 space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-plus-jakarta text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Financial Dashboard
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            Overview of expenses, payables, and tax summaries.
          </p>
        </div>
      </div>

      <Suspense fallback={<AccountingSkeleton />}>
        <AccountingContent />
      </Suspense>
    </div>
  );
}

async function AccountingContent() {
  const supabase = await createClient();

  const [{ data: invoices }, { data: payments }, { data: reservations }, { role }] = await Promise.all([
    supabase
      .from("service_invoices")
      .select(
        "amount, status, due_date, invoice_date, vendor_id, vat_amount, ewt_amount, expense_category, vendors(name)",
      ),
    supabase.from("payments").select("amount_paid"),
    supabase
      .from("payment_reservations")
      .select("id, po_id, reserved_amount, status, notified_at, acknowledged_at, cancelled_reason, purchase_orders(po_number, vendors(name)), projects(name)")
      .in("status", ["pending", "acknowledged"])
      .order("notified_at", { ascending: false }),
    getCurrentProfile(supabase),
  ]);

  // Aggregate via the shared builder (single source of truth with the AP Aging report).
  const { rows: apAgingRows, totalUnpaid, totalVAT, totalEWT, expensesByCategory } =
    computeApAging(invoices as any);

  const totalPayments =
    payments?.reduce((acc, curr) => acc + Number(curr.amount_paid), 0) || 0;

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Paid Expenses" value={`₱${totalPayments.toLocaleString()}`} icon={<ArrowDownRight className="text-rose-500" />} />
        <StatCard title="Outstanding Payables" value={`₱${totalUnpaid.toLocaleString()}`} icon={<AlertCircle className="text-amber-500" />} />
        <StatCard title="Total Input VAT" value={`₱${totalVAT.toLocaleString()}`} icon={<FileText className="text-blue-500" />} />
        <StatCard title="Total EWT Withheld" value={`₱${totalEWT.toLocaleString()}`} icon={<FileText className="text-emerald-500" />} />
      </div>

      <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <Bell className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Payment Reservations</h2>
          {(reservations?.length ?? 0) > 0 && (
            <span className="ml-auto bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs font-bold px-2 py-0.5 rounded-full">
              {reservations!.length} active
            </span>
          )}
        </div>
        <PaymentReservationsTable
          reservations={(reservations ?? []) as any}
          canAcknowledge={hasCapability(role, "payment_reservation.acknowledge")}
          canCancel={hasCapability(role, "po.status")}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Accounts Payable Aging</h2>
            <APAgingTable data={apAgingRows} />
          </div>
        </div>

        <div className="lg:col-span-1 space-y-8">
          <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Expense Breakdown</h2>
            <ExpenseChart data={expensesByCategory} />
          </div>
          
          <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Tax Preparation</h2>
            <p className="text-sm text-slate-500 mb-4">Quick access for BIR compliance reporting.</p>
            <div className="space-y-3">
              <button className="w-full py-2.5 px-4 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-300 rounded-xl transition-colors border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <span>Generate BIR Form 2307 Data</span>
                <ArrowUpRight className="h-4 w-4 text-slate-400" />
              </button>
              <button className="w-full py-2.5 px-4 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-300 rounded-xl transition-colors border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <span>Export SLP (Input VAT Summary)</span>
                <ArrowUpRight className="h-4 w-4 text-slate-400" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function StatCard({ title, value, icon }: { title: string, value: string, icon: React.ReactNode }) {
  return (
    <div className="group relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#071F15] p-6 shadow-sm transition-all hover:shadow-md hover:-translate-y-1">
      <div className="flex items-start justify-between">
        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 group-hover:bg-primary/10 transition-colors">
          {icon}
        </div>
      </div>
      <div className="mt-4">
        <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</h3>
        <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{value}</div>
      </div>
    </div>
  );
}

function AccountingSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 rounded-2xl bg-slate-100 dark:bg-slate-800/50" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 h-96 rounded-2xl bg-slate-100 dark:bg-slate-800/50" />
        <div className="lg:col-span-1 h-96 rounded-2xl bg-slate-100 dark:bg-slate-800/50" />
      </div>
    </div>
  );
}
