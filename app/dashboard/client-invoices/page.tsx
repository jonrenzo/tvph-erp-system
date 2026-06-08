import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { Plus, FileText, ChevronRight, Clock } from 'lucide-react';
import { Suspense } from 'react';
import { SearchInput } from '@/components/ui/search-input';
import { StatusSelect } from '@/components/ui/status-select';
import { Pagination } from '@/components/ui/pagination';
import { LIST_PAGE_SIZE, parsePage, pageRange } from '@/components/ui/pagination-utils';

export const unstable_instant = {
  prefetch: 'static',
  samples: [{ searchParams: { q: null, status: null, page: null } }],
};

export default function ClientInvoicesPage(props: {
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
    .from('client_invoices')
    .select(`
      id, invoice_number, invoice_date, amount, currency, due_date, status,
      crm_accounts(company_name),
      client_purchase_orders(po_number)
    `, { count: 'exact' })
    .is('deleted_at', null)
    .order('invoice_date', { ascending: false });

  if (q) query = query.ilike('invoice_number', `%${q}%`);
  if (statusFilter !== 'all') query = query.eq('status', statusFilter);

  const { data: invoices, error, count } = await query.range(from, to);

  const statusColor: Record<string, string> = {
    draft: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400',
    sent: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400',
    partially_paid: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400',
    paid: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400',
    cancelled: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400',
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">Client Invoices</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Invoices issued by TVPH to clients and payment tracking.</p>
        </div>
        <Link
          href="/dashboard/client-invoices/new"
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl font-medium transition-all hover:shadow-lg hover:shadow-primary/20 active:scale-95"
        >
          <Plus className="h-5 w-5" />
          Record Invoice
        </Link>
      </div>

      <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-4 bg-slate-50/50 dark:bg-[#0a0a0a]/50">
          <SearchInput placeholder="Search invoice number..." paramName="q" />
          <StatusSelect
            paramName="status"
            options={[
              { value: 'all', label: 'All Statuses' },
              { value: 'draft', label: 'Draft' },
              { value: 'sent', label: 'Sent' },
              { value: 'partially_paid', label: 'Partially Paid' },
              { value: 'paid', label: 'Paid' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4 font-semibold">Invoice No.</th>
                <th className="px-6 py-4 font-semibold">Client & PO</th>
                <th className="px-6 py-4 font-semibold">Amount</th>
                <th className="px-6 py-4 font-semibold">Due Date</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {error ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-red-500">Failed to load client invoices.</td></tr>
              ) : invoices?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
                      <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                        <FileText className="h-6 w-6 text-slate-400" />
                      </div>
                      <p className="text-base font-medium text-slate-900 dark:text-white">No client invoices recorded</p>
                      <p className="text-sm mt-1">Record your first client invoice to track payments.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                invoices?.map((inv: any) => (
                  <tr key={inv.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 dark:text-white">{inv.invoice_number}</div>
                      <div className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">{new Date(inv.invoice_date).toLocaleDateString()}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900 dark:text-white">{inv.crm_accounts?.company_name}</div>
                      <div className="text-slate-400 text-xs mt-0.5 flex items-center gap-1">
                        <FileText className="h-3 w-3" /> {inv.client_purchase_orders?.po_number || '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">
                      {inv.currency} {Number(inv.amount).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border ${statusColor[inv.status] || ''}`}>
                        {inv.status.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/dashboard/client-invoices/${inv.id}`}
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
