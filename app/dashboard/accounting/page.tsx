import { createClient } from "@/utils/supabase/server";
import { Suspense } from "react";
import { DollarSign, TrendingUp, AlertCircle, FileText, ArrowUpRight, ArrowDownRight } from "lucide-react";
import Link from "next/link";
import { ExpenseChart } from "@/components/dashboard/accounting/expense-chart";
import { APAgingTable } from "@/components/dashboard/accounting/ap-aging-table";

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

  const [
    { data: invoices },
    { data: payments },
    { data: purchaseOrders }
  ] = await Promise.all([
    supabase.from("service_invoices").select("*, vendors(name)"),
    supabase.from("payments").select("*"),
    supabase.from("purchase_orders").select("*")
  ]);

  // Aggregate Data
  let totalExpenses = 0;
  let totalUnpaid = 0;
  let totalVAT = 0;
  let totalEWT = 0;

  const expensesByCategory: Record<string, number> = {};
  const apAging: Record<string, { vendorName: string, current: number, days30: number, days60: number, days90: number, over90: number, total: number }> = {};

  const now = new Date();

  invoices?.forEach(inv => {
    const amount = Number(inv.amount);
    
    // Categorization
    if (inv.expense_category) {
      expensesByCategory[inv.expense_category] = (expensesByCategory[inv.expense_category] || 0) + amount;
    } else {
      expensesByCategory['uncategorized'] = (expensesByCategory['uncategorized'] || 0) + amount;
    }

    if (inv.status === 'paid') {
      totalExpenses += amount;
    } else {
      totalUnpaid += amount;
      
      // AP Aging
      const dueDate = new Date(inv.due_date || inv.invoice_date);
      const diffTime = Math.abs(now.getTime() - dueDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      const vendorId = inv.vendor_id;
      if (!apAging[vendorId]) {
        apAging[vendorId] = { vendorName: inv.vendors?.name || 'Unknown', current: 0, days30: 0, days60: 0, days90: 0, over90: 0, total: 0 };
      }
      
      if (dueDate >= now) {
        apAging[vendorId].current += amount;
      } else if (diffDays <= 30) {
        apAging[vendorId].days30 += amount;
      } else if (diffDays <= 60) {
        apAging[vendorId].days60 += amount;
      } else if (diffDays <= 90) {
        apAging[vendorId].days90 += amount;
      } else {
        apAging[vendorId].over90 += amount;
      }
      apAging[vendorId].total += amount;
    }

    // Taxes
    totalVAT += Number(inv.vat_amount || 0);
    totalEWT += Number(inv.ewt_amount || 0);
  });

  const totalPayments = payments?.reduce((acc, curr) => acc + Number(curr.amount_paid), 0) || 0;

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Paid Expenses" value={`₱${totalPayments.toLocaleString()}`} icon={<ArrowDownRight className="text-rose-500" />} />
        <StatCard title="Outstanding Payables" value={`₱${totalUnpaid.toLocaleString()}`} icon={<AlertCircle className="text-amber-500" />} />
        <StatCard title="Total Input VAT" value={`₱${totalVAT.toLocaleString()}`} icon={<FileText className="text-blue-500" />} />
        <StatCard title="Total EWT Withheld" value={`₱${totalEWT.toLocaleString()}`} icon={<FileText className="text-emerald-500" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Accounts Payable Aging</h2>
            <APAgingTable data={Object.values(apAging).filter(v => v.total > 0).sort((a,b) => b.total - a.total)} />
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
