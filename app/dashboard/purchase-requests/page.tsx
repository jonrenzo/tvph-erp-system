import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { Plus, FileText } from 'lucide-react';
import { Suspense } from 'react';
import { SearchInput } from '@/components/ui/search-input';
import { StatusSelect } from '@/components/ui/status-select';
import { Pagination } from '@/components/ui/pagination';
import { LIST_PAGE_SIZE, parsePage, pageRange } from '@/components/ui/pagination-utils';
import { LiveListRefresh } from '@/components/dashboard/shared/live-list-refresh';
import { PrTableRow } from '@/components/dashboard/purchase-requests/pr-table-row';
import { PrDeleteRowButton } from '@/components/dashboard/purchase-requests/pr-cancel-button';
import { getCurrentProfile, hasCapability } from '@/lib/auth/permissions';

export const unstable_instant = {
  prefetch: 'static',
  samples: [{ searchParams: { q: null, status: null, page: null } }]
};

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400',
  pending_approval: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400',
  pending_finance: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-400',
  approved: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400',
  converted: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-500',
};

export default function PurchaseRequestsPage(props: {
  searchParams?: Promise<{ q?: string; status?: string; page?: string }>
}) {
  return (
    <Suspense fallback={<PurchaseRequestsSkeleton />}>
      <PurchaseRequestsContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function PurchaseRequestsContent({ searchParams: searchParamsPromise }: { searchParams?: Promise<any> }) {
  const searchParams = await searchParamsPromise;
  const supabase = await createClient();
  const q = searchParams?.q || '';
  const statusFilter = searchParams?.status || 'all';
  const page = parsePage(searchParams?.page);
  const [from, to] = pageRange(page, LIST_PAGE_SIZE);

  const { role: currentRole } = await getCurrentProfile(supabase);
  const canDelete = hasCapability(currentRole, 'pr.delete');

  let listQuery = supabase
    .from('purchase_requests')
    .select('id, pr_number, description, amount, dp_amount, currency, status, created_at, projects(name), vendors(name)', { count: 'exact' })
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (q) listQuery = listQuery.ilike('pr_number', `%${q}%`);
  if (statusFilter !== 'all') listQuery = listQuery.eq('status', statusFilter);

  const { data: prs, error, count } = await listQuery.range(from, to);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">Purchase Requests</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Request purchases and route them for approval before they become POs.</p>
        </div>
        <Link
          href="/dashboard/purchase-requests/new"
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl font-medium transition-all hover:shadow-lg hover:shadow-primary/20 active:scale-95"
        >
          <Plus className="h-5 w-5" />
          New Request
        </Link>
      </div>

      {/* Filters and List */}
      <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-4 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <SearchInput placeholder="Search PRs..." paramName="q" />
          </div>
          <StatusSelect
            paramName="status"
            options={[
              { value: 'all', label: 'All Statuses' },
              { value: 'draft', label: 'Draft' },
              { value: 'pending_approval', label: 'Pending Admin Approval' },
              { value: 'pending_finance', label: 'Pending Finance Approval' },
              { value: 'approved', label: 'Approved (Ready to Convert)' },
              { value: 'converted', label: 'Converted' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4 font-semibold">PR</th>
                <th className="px-6 py-4 font-semibold">Description</th>
                <th className="px-6 py-4 font-semibold">Project</th>
                <th className="px-6 py-4 font-semibold">Preferred Vendor</th>
                <th className="px-6 py-4 font-semibold">Est. Amount</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {error && (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-red-500">{error.message}</td></tr>
              )}
              {!error && (prs || []).length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    No purchase requests found.
                  </td>
                </tr>
              )}
              {(prs || []).map((pr: any) => (
                <PrTableRow key={pr.id} href={`/dashboard/purchase-requests/${pr.id}`}>
                  <td className="px-6 py-5">
                    <Link href={`/dashboard/purchase-requests/${pr.id}`} className="font-semibold text-primary hover:underline">
                      {pr.pr_number}
                    </Link>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {new Date(pr.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-slate-700 dark:text-slate-300 max-w-xs truncate">
                    {pr.description || '—'}
                  </td>
                  <td className="px-6 py-5 text-slate-600 dark:text-slate-400">
                    {pr.projects?.name || '—'}
                  </td>
                  <td className="px-6 py-5 text-slate-600 dark:text-slate-400">
                    {pr.vendors?.name || '—'}
                  </td>
                  <td className="px-6 py-5 font-medium text-slate-900 dark:text-white">
                    <span className="inline-flex items-center gap-2">
                      {pr.currency === 'USD' ? '$' : '₱'}{Number(pr.amount).toLocaleString()}
                      {Number(pr.dp_amount) > 0 && (
                        <span
                          title={`Downpayment: ${pr.currency === 'USD' ? '$' : '₱'}${Number(pr.dp_amount).toLocaleString()}`}
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700"
                        >
                          DP
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${STATUS_BADGE[pr.status] || STATUS_BADGE.draft}`}>
                      {pr.status.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <span className="inline-flex items-center justify-end gap-2">
                      {['draft', 'cancelled'].includes(pr.status) && canDelete && (
                        <PrDeleteRowButton prId={pr.id} />
                      )}
                      {pr.status === 'approved' && (
                        <Link
                          href={`/dashboard/purchase-orders/new?from_pr=${pr.id}`}
                          className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95"
                        >
                          Convert to PO
                        </Link>
                      )}
                    </span>
                  </td>
                </PrTableRow>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination page={page} totalCount={count ?? 0} pageSize={LIST_PAGE_SIZE} />
      </div>
      <LiveListRefresh />
    </div>
  );
}

function PurchaseRequestsSkeleton() {
  return (
    <div className="p-6 lg:p-8 space-y-8 animate-pulse">
      <div className="h-10 w-64 bg-slate-100 dark:bg-slate-800/50 rounded-lg" />
      <div className="h-96 rounded-2xl bg-slate-100 dark:bg-slate-800/50" />
    </div>
  );
}
