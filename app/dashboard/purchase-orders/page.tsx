import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { Plus, Search, FileText, TrendingUp } from 'lucide-react';
import { Suspense } from 'react';
import { SearchInput } from '@/components/ui/search-input';
import { StatusSelect } from '@/components/ui/status-select';
import { PurchaseOrdersTableBody } from '@/components/dashboard/purchase-orders/purchase-orders-table-body';
import { ExportDropdown } from '@/components/dashboard/export-dropdown';
import { Pagination } from '@/components/ui/pagination';
import { LIST_PAGE_SIZE, parsePage, pageRange } from '@/components/ui/pagination-utils';

export const unstable_instant = {
  prefetch: 'static',
  samples: [{ searchParams: { q: null, status: null, vendor: null, project: null, page: null } }]
};

export default function PurchaseOrdersPage(props: {
  searchParams?: Promise<{ q?: string; status?: string; vendor?: string; project?: string; page?: string }>
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
  const vendorFilter = searchParams?.vendor || 'all';
  const projectFilter = searchParams?.project || 'all';
  const page = parsePage(searchParams?.page);
  const [from, to] = pageRange(page, LIST_PAGE_SIZE);

  // Fetch projects and vendors for filters
  const [projectsResponse, vendorsResponse] = await Promise.all([
    supabase.from('projects').select('id, name').is('deleted_at', null).order('name'),
    supabase.from('vendors').select('id, name').is('deleted_at', null).order('name')
  ]);

  const projectsOptions = [
    { value: 'all', label: 'All Projects' },
    ...(projectsResponse.data?.map(p => ({ value: p.id, label: p.name })) || [])
  ];

  const vendorsOptions = [
    { value: 'all', label: 'All Vendors' },
    ...(vendorsResponse.data?.map(v => ({ value: v.id, label: v.name })) || [])
  ];

  // Apply the same filters to both the paginated list query and the open-amount
  // aggregate, so the summary stats reflect ALL matching POs, not just this page.
  const applyFilters = (builder: any) => {
    let b = builder;
    if (q) b = b.ilike('po_number', `%${q}%`);
    if (statusFilter !== 'all') b = b.eq('status', statusFilter);
    if (vendorFilter !== 'all') b = b.eq('vendor_id', vendorFilter);
    if (projectFilter !== 'all') b = b.eq('project_id', projectFilter);
    return b;
  };

  const listQuery = applyFilters(
    supabase
      .from('purchase_orders')
      .select(
        'id, po_number, issued_date, amount, status, vendors(name), projects(name)',
        { count: 'exact' },
      )
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
  );

  // Narrow aggregate (amount only, open POs only) for the "Open Amount" stat.
  // TODO: replace with a DB-side SUM (rpc/view) if PO volume grows large.
  const openAmountQuery = applyFilters(
    supabase
      .from('purchase_orders')
      .select('amount')
      .is('deleted_at', null)
      .not('status', 'in', '(paid,cancelled)'),
  );

  const [{ data: pos, error, count }, { data: openRows }] = await Promise.all([
    listQuery.range(from, to),
    openAmountQuery,
  ]);

  const openAmount = (openRows || []).reduce(
    (acc: number, curr: any) => acc + Number(curr.amount),
    0,
  );

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">Purchase Orders</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Track and manage vendor purchase orders and payments.</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportDropdown exportBaseUrl="/api/export/purchase-orders" />
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
              <div className="text-lg font-bold text-slate-900 dark:text-white">{count || 0}</div>
           </div>
        </div>
        <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm flex items-center gap-4">
           <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400" />
           </div>
           <div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase">Open Amount</div>
              <div className="text-lg font-bold text-slate-900 dark:text-white">
                 ₱{openAmount.toLocaleString()}
              </div>
           </div>
        </div>
      </div>

      {/* Filters and List */}
      <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-4 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <SearchInput placeholder="Search POs..." paramName="q" />
          </div>
          
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

          <StatusSelect
            paramName="vendor"
            options={vendorsOptions}
          />

          <StatusSelect
            paramName="project"
            options={projectsOptions}
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

        <Pagination page={page} totalCount={count ?? 0} pageSize={LIST_PAGE_SIZE} />
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
