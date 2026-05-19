import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { Plus, Search, FileText, TrendingUp } from 'lucide-react';
import { Suspense } from 'react';
import { SearchInput } from '@/components/ui/search-input';
import { StatusSelect } from '@/components/ui/status-select';
import { PurchaseOrdersTableBody } from '@/components/dashboard/purchase-orders/purchase-orders-table-body';

export const unstable_instant = { 
  prefetch: 'static',
  samples: [{ searchParams: { q: null, status: null } }]
};

export default function PurchaseOrdersPage(props: { 
  searchParams?: Promise<{ q?: string; status?: string }> 
}) {
  return (
    <Suspense fallback={<PurchaseOrdersSkeleton />}>
      <PurchaseOrdersContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function PurchaseOrdersContent({ searchParams: searchParamsPromise }: { searchParams?: Promise<any> }) {
  const searchParams = await searchParamsPromise;
  const supabase = await createClient();
  const q = searchParams?.q || '';
  const statusFilter = searchParams?.status || 'all';

  // Join with vendors to get vendor name
  let query = supabase
    .from('purchase_orders')
    .select(`
      *,
      vendors (
        name
      ),
      projects (
        name
      )
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (q) {
    query = query.ilike('po_number', `%${q}%`);
  }
  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  const { data: pos, error } = await query;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">Purchase Orders</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Track and manage vendor purchase orders and payments.</p>
        </div>
        <div className="flex items-center gap-2">

          <Link 
            href="/dashboard/purchase-orders/new"
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl font-medium transition-all hover:shadow-lg hover:shadow-primary/20 active:scale-95"
          >
            <Plus className="h-5 w-5" />
            Create PO
          </Link>
        </div>
      </div>

      {/* Stats Summary (Mini) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm flex items-center gap-4">
           <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
              <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
           </div>
           <div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase">Total POs</div>
              <div className="text-lg font-bold text-slate-900 dark:text-white">{pos?.length || 0}</div>
           </div>
        </div>
        <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm flex items-center gap-4">
           <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400" />
           </div>
           <div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase">Open Amount</div>
              <div className="text-lg font-bold text-slate-900 dark:text-white">
                 ₱{pos?.filter((p: any) => p.status !== 'paid' && p.status !== 'cancelled').reduce((acc: number, curr: any) => acc + Number(curr.amount), 0).toLocaleString()}
              </div>
           </div>
        </div>
      </div>

      {/* Filters and List */}
      <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-4 bg-slate-50/50 dark:bg-[#0a0a0a]/50">
          <SearchInput placeholder="Search POs..." paramName="q" />
          
          <StatusSelect 
            paramName="status"
            options={[
              { value: 'all', label: 'All Statuses' },
              { value: 'draft', label: 'Draft' },
              { value: 'issued', label: 'Issued' },
              { value: 'partially_paid', label: 'Partially Paid' },
              { value: 'paid', label: 'Paid' },
              { value: 'overpaid', label: 'Overpaid' },
              { value: 'cancelled', label: 'Cancelled' }
            ]}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4 font-semibold">PO Details</th>
                <th className="px-6 py-4 font-semibold">Vendor</th>
                <th className="px-6 py-4 font-semibold">Project</th>
                <th className="px-6 py-4 font-semibold">Amount</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
          <PurchaseOrdersTableBody pos={pos} error={error} />
          </table>
        </div>
      </div>
    </div>
  );
}

function PurchaseOrdersSkeleton() {
  return (
    <div className="p-6 lg:p-8 space-y-8 animate-pulse">
       <div className="h-10 w-64 bg-slate-100 dark:bg-slate-800/50 rounded-lg" />
       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         {[...Array(3)].map((_, i) => (
           <div key={i} className="h-20 rounded-2xl bg-slate-100 dark:bg-slate-800/50" />
         ))}
       </div>
       <div className="h-96 rounded-2xl bg-slate-100 dark:bg-slate-800/50" />
    </div>
  );
}
