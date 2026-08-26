import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { Plus, FileText, ChevronRight, Clock, Upload } from 'lucide-react';
import { Suspense } from 'react';
import { SearchInput } from '@/components/ui/search-input';
import { StatusSelect } from '@/components/ui/status-select';
import { Pagination } from '@/components/ui/pagination';
import { LIST_PAGE_SIZE, parsePage, pageRange } from '@/components/ui/pagination-utils';
import { billingStatusBadgeClasses, agingBand, agingBadgeClasses, agingLabel } from '@/lib/billing/status';

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
    .from('client_billing')
    .select('id, invoice_number, invoice_batch, region, num_nodes, date_issued, date_endorsed, due_date, est_payment_date, amount_vat_ex, amount_vat_inc, status, crm_accounts(company_name), projects(name)', { count: 'exact' })
    .is('deleted_at', null)
    .order('date_issued', { ascending: false });

  if (q) query = query.or(`invoice_number.ilike.%${q}%,invoice_batch.ilike.%${q}%`);
  if (statusFilter !== 'all') query = query.eq('status', statusFilter);

  const { data: rows, error, count } = await query.range(from, to);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">Client Billing</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Excel billing tracker — For Billing → For Approval → Pending Payment → Collected.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/client-invoices/import" className="inline-flex items-center gap-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            <Upload className="h-4 w-4" /> Import
          </Link>
          <Link href="/dashboard/client-invoices/new" className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl font-medium transition-all hover:shadow-lg hover:shadow-primary/20 active:scale-95">
            <Plus className="h-5 w-5" /> New Invoice
          </Link>
        </div>
      </div>

      <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-4 bg-slate-50/50 dark:bg-[#0a0a0a]/50">
          <SearchInput placeholder="Search invoice no. or batch..." paramName="q" />
          <StatusSelect
            paramName="status"
            options={[
              { value: 'all', label: 'All Statuses' },
              { value: 'for_billing', label: 'For Billing' },
              { value: 'for_approval', label: 'For Approval' },
              { value: 'for_payment', label: 'For Payment' },
              { value: 'pending_payment', label: 'Pending Payment' },
              { value: 'collected', label: 'Collected' },
            ]}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4 font-semibold">Invoice</th>
                <th className="px-6 py-4 font-semibold">Client / Project</th>
                <th className="px-6 py-4 font-semibold">Batch · Region</th>
                <th className="px-6 py-4 font-semibold">Amount (VAT-inc)</th>
                <th className="px-6 py-4 font-semibold">Due · Aging</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {error ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-red-500">Failed to load.</td></tr>
              ) : rows?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center text-slate-500 dark:text-slate-400">
                      <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3"><FileText className="h-6 w-6 text-slate-400" /></div>
                      <p className="font-medium text-slate-900 dark:text-white">No billing records</p>
                      <p className="text-sm mt-1">Create the first invoice or import the spreadsheet.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                rows?.map((r: any) => {
                  const ag = agingBand(r);
                  return (
                    <tr key={r.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900 dark:text-white">{r.invoice_number}</div>
                        <div className="text-xs text-slate-400 flex items-center gap-1"><Clock className="h-3 w-3" /> {r.date_issued ? new Date(r.date_issued).toLocaleDateString() : '—'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900 dark:text-white">{r.crm_accounts?.company_name || '—'}</div>
                        <div className="text-xs text-slate-400">{r.projects?.name || 'No project'}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                        <div className="text-xs">{r.invoice_batch || '—'} {r.region ? `· ${r.region}` : ''} {r.num_nodes ? `· ${r.num_nodes} nodes` : ''}</div>
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">₱ {Number(r.amount_vat_inc || 0).toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <div className="text-xs text-slate-600 dark:text-slate-400">{r.due_date ? new Date(r.due_date).toLocaleDateString() : '—'}</div>
                        {ag.band && (
                          <span className={`mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${agingBadgeClasses(ag.band)}`}>{agingLabel(ag.band, ag.daysDelayed)}</span>
                        )}
                      </td>
                      <td className="px-6 py-4"><span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border ${billingStatusBadgeClasses(r.status)}`}>{r.status.replace(/_/g,' ').toUpperCase()}</span></td>
                      <td className="px-6 py-4 text-right">
                        <Link href={`/dashboard/client-invoices/${r.id}`} className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-slate-400 group-hover:text-primary group-hover:bg-primary/10 transition-colors"><ChevronRight className="h-5 w-5" /></Link>
                      </td>
                    </tr>
                  );
                })
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
  return <div className="p-6 lg:p-8 space-y-8 animate-pulse"><div className="h-10 w-64 bg-slate-100 dark:bg-slate-800/50 rounded-lg" /><div className="h-96 rounded-2xl bg-slate-100 dark:bg-slate-800/50" /></div>;
}
