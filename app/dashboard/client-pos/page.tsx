import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { Plus, Search, FileText, ChevronRight, Clock } from 'lucide-react';
import { Suspense } from 'react';
import { SearchInput } from '@/components/ui/search-input';
import { StatusSelect } from '@/components/ui/status-select';
import { Pagination } from '@/components/ui/pagination';
import { LIST_PAGE_SIZE, parsePage, pageRange } from '@/components/ui/pagination-utils';

export const unstable_instant = {
  prefetch: 'static',
  samples: [{ searchParams: { q: null, status: null, page: null } }],
};

export default function ClientPOsPage(props: {
  searchParams?: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  return (
    <Suspense fallback={<Skeleton />}>
      <Content searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams: searchParamsPromise }: { searchParams?: Promise<any> }) {
  const searchParams = await searchParamsPromise;
  const supabase = await createClient();
  const q = searchParams?.q || '';
  const statusFilter = searchParams?.status || 'all';
  const page = parsePage(searchParams?.page);
  const [from, to] = pageRange(page, LIST_PAGE_SIZE);

  let query = supabase
    .from('client_purchase_orders')
    .select('id, po_number, amount, currency, received_date, status, crm_accounts(company_name)', { count: 'exact' })
    .is('deleted_at', null)
    .order('received_date', { ascending: false });

  if (q) query = query.ilike('po_number', `%${q}%`);
  if (statusFilter !== 'all') query = query.eq('status', statusFilter);

  const { data: pos, error, count } = await query.range(from, to);

  const statusColor: Record<string, string> = {
    received: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400',
    partially_billed: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400',
    fully_billed: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400',
    cancelled: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400',
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">Client POs</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Purchase orders issued to TVPH by clients.</p>
        </div>
        <Link
          href="/dashboard/client-pos/new"
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl font-medium transition-all hover:shadow-lg hover:shadow-primary/20 active:scale-95"
        >
          <Plus className="h-5 w-5" />
          Record Client PO
        </Link>
      </div>

      <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-4 bg-slate-50/50 dark:bg-[#0a0a0a]/50">
          <SearchInput placeholder="Search PO number..." paramName="q" />
          <StatusSelect
            paramName="status"
            options={[
              { value: 'all', label: 'All Statuses' },
              { value: 'received', label: 'Received' },
              { value: 'partially_billed', label: 'Partially Billed' },
              { value: 'fully_billed', label: 'Fully Billed' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4 font-semibold">PO Number</th>
                <th className="px-6 py-4 font-semibold">Client</th>
                <th className="px-6 py-4 font-semibold">Amount</th>
                <th className="px-6 py-4 font-semibold">Received</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {error ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-red-500">Failed to load client POs.</td></tr>
              ) : pos?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
                      <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                        <FileText className="h-6 w-6 text-slate-400" />
                      </div>
                      <p className="text-base font-medium text-slate-900 dark:text-white">No client POs recorded</p>
                      <p className="text-sm mt-1">Record a client PO to start tracking billing.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                pos?.map((po: any) => (
                  <tr key={po.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 dark:text-white">{po.po_number}</div>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                      {po.crm_accounts?.company_name || '—'}
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">
                      {po.currency} {Number(po.amount).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(po.received_date).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border ${statusColor[po.status] || ''}`}>
                        {po.status.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/dashboard/client-pos/${po.id}`}
                        className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-slate-400 group-hover:text-primary group-hover:bg-primary/10 transition-colors"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination page={page} totalCount={count ?? 0} pageSize={LIST_PAGE_SIZE} />
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="p-6 lg:p-8 space-y-8 animate-pulse">
      <div className="h-10 w-64 bg-slate-100 dark:bg-slate-800/50 rounded-lg" />
      <div className="h-96 rounded-2xl bg-slate-100 dark:bg-slate-800/50" />
    </div>
  );
}
