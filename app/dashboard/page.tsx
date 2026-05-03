import { createClient } from '@/utils/supabase/server';
import { 
  Building2, 
  FileText, 
  CreditCard, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight, 
  Clock,
  CheckCircle2,
  Plus,
  History
} from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';

export const unstable_instant = { prefetch: 'static' };

export default function DashboardPage() {
  return (
    <div className="p-6 lg:p-8 space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-plus-jakarta text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            Command Center
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Welcome back. Here is the operational pulse of TelcoVantage.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Link href="/dashboard/purchase-orders/new" className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-lg shadow-primary/20">
            <Plus className="h-4 w-4" />
            New PO
          </Link>
          <Link href="/dashboard/invoices/new" className="inline-flex items-center gap-2 bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm">
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

async function DashboardContent() {
  const supabase = await createClient();

  // 1. Fetch Metrics
  const { count: pendingVendors } = await supabase
    .from('vendors')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  const { data: activePOs } = await supabase
    .from('purchase_orders')
    .select('id, amount, status')
    .in('status', ['issued', 'partially_paid']);

  const { data: unpaidInvoices } = await supabase
    .from('service_invoices')
    .select('id, amount, status')
    .neq('status', 'paid');

  // Fetch expiring documents (next 30 days)
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  
  const { count: expiringDocs } = await supabase
    .from('vendor_documents')
    .select('*', { count: 'exact', head: true })
    .lte('expiry_date', thirtyDaysFromNow.toISOString().split('T')[0])
    .gte('expiry_date', new Date().toISOString().split('T')[0])
    .is('archived_at', null);

  // 2. Calculate Totals
  const totalPOCommitment = activePOs?.reduce((sum, po) => sum + Number(po.amount), 0) || 0;
  
  const { data: payments } = await supabase
    .from('payments')
    .select('amount_paid');
  
  const totalPaid = payments?.reduce((sum, p) => sum + Number(p.amount_paid), 0) || 0;
  const totalInvoiced = unpaidInvoices?.reduce((sum, inv) => sum + Number(inv.amount), 0) || 0;
  const outstandingLiability = Math.max(0, totalInvoiced - totalPaid);

  // 3. Fetch Recent Activity
  const { data: recentLogs } = await supabase
    .from('audit_logs')
    .select('*, profiles(full_name)')
    .order('created_at', { ascending: false })
    .limit(5);

  const stats = [
    { 
      label: "Current Liability", 
      value: `₱${outstandingLiability.toLocaleString()}`, 
      description: "Total unpaid invoices",
      icon: <CreditCard className="h-5 w-5 text-amber-500" />,
      trend: "Liability",
      trendColor: "text-amber-600"
    },
    { 
      label: "Active POs", 
      value: activePOs?.length || 0, 
      description: "Open commitments",
      icon: <FileText className="h-5 w-5 text-blue-500" />,
      trend: `₱${totalPOCommitment.toLocaleString()}`,
      trendColor: "text-blue-600"
    },
    { 
      label: "Pending Vendors", 
      value: pendingVendors || 0, 
      description: "Awaiting accreditation",
      icon: <Building2 className="h-5 w-5 text-emerald-500" />,
      trend: "New Signups",
      trendColor: "text-emerald-600"
    },
    { 
      label: "Expiring Docs", 
      value: expiringDocs || 0, 
      description: "Critical renewals needed",
      icon: <AlertTriangle className="h-5 w-5 text-red-500" />,
      trend: "Next 30 Days",
      trendColor: "text-red-600"
    },
  ];

  return (
    <>
      {/* Primary Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <div
            key={i}
            className="group relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#071F15] p-6 shadow-sm transition-all hover:shadow-md hover:-translate-y-1 overflow-hidden"
          >
            <div className="flex items-start justify-between">
               <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 group-hover:bg-primary/10 transition-colors">
                  {stat.icon}
               </div>
               <span className={`text-[10px] font-bold uppercase tracking-widest ${stat.trendColor}`}>
                  {stat.trend}
               </span>
            </div>
            <div className="mt-4">
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">
                {stat.label}
              </h3>
              <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                {stat.value}
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {stat.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activity Feed */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#071F15] overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <History className="h-5 w-5 text-primary" /> Recent System Activity
            </h2>
            <Link href="/dashboard/audit-logs" className="text-xs font-bold text-primary hover:underline">
              View All Logs
            </Link>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
            {recentLogs?.length === 0 ? (
              <div className="p-12 text-center text-slate-400 italic text-sm">No activity recorded yet.</div>
            ) : (
              recentLogs?.map((log: any) => (
                <div key={log.id} className="p-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors flex items-start gap-4">
                   <div className={`mt-1 p-1.5 rounded-full ${
                     log.action === 'CREATE' ? 'bg-emerald-100 text-emerald-600' : 
                     log.action === 'UPDATE' ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'
                   }`}>
                      <Clock className="h-3.5 w-3.5" />
                   </div>
                   <div className="flex-1">
                      <div className="text-xs font-medium text-slate-900 dark:text-white">
                        <span className="font-bold">{log.profiles?.full_name}</span> {log.action.toLowerCase()}d a <span className="capitalize">{log.entity_type.replace('_', ' ')}</span>
                      </div>
                      <div className="mt-1 text-[10px] text-slate-400 flex items-center gap-2">
                        {new Date(log.created_at).toLocaleString()}
                      </div>
                   </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Action Center / Quick Tips */}
        <div className="space-y-6">
           <div className="rounded-2xl bg-primary p-6 text-white shadow-lg shadow-primary/20 relative overflow-hidden">
              <div className="relative z-10">
                 <h3 className="font-bold text-lg">Daily Summary</h3>
                 <p className="text-xs text-white/80 mt-2 leading-relaxed">
                    You have <span className="font-bold underline">{pendingVendors} vendors</span> waiting for accreditation review and <span className="font-bold underline">{expiringDocs} documents</span> expiring soon.
                 </p>
                 <button className="mt-4 w-full py-2 bg-white text-primary rounded-xl text-xs font-bold hover:bg-white/90 transition-all">
                    Generate Operations Report
                 </button>
              </div>
              <div className="absolute -right-4 -bottom-4 opacity-10">
                 <Building2 className="h-32 w-32" />
              </div>
           </div>

           <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#071F15] p-6 shadow-sm">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-4">Quick Links</h3>
              <div className="space-y-2">
                 {[
                   { label: "Vendor Directory", href: "/dashboard/vendors" },
                   { label: "Financial Reports", href: "/dashboard/accounting" },
                   { label: "Contract Archive", href: "/dashboard/documents" },
                   { label: "Compliance Hub", href: "/dashboard/compliance" },
                 ].map((link, i) => (
                   <Link key={i} href={link.href} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 group transition-colors">
                      <span className="text-xs text-slate-600 dark:text-slate-400 group-hover:text-primary transition-colors">{link.label}</span>
                      <ArrowUpRight className="h-3 w-3 text-slate-300 group-hover:text-primary transition-colors" />
                   </Link>
                 ))}
              </div>
           </div>
        </div>
      </div>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 rounded-2xl bg-slate-100 dark:bg-slate-800/50" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 h-96 rounded-2xl bg-slate-100 dark:bg-slate-800/50" />
        <div className="space-y-6">
          <div className="h-40 rounded-2xl bg-slate-100 dark:bg-slate-800/50" />
          <div className="h-60 rounded-2xl bg-slate-100 dark:bg-slate-800/50" />
        </div>
      </div>
    </div>
  );
}
