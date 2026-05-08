import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { Plus, Search, Building2, ChevronRight } from 'lucide-react';
import { Suspense } from 'react';
import { SearchInput } from '@/components/ui/search-input';
import { StatusSelect } from '@/components/ui/status-select';

export const unstable_instant = { 
  prefetch: 'static',
  samples: [{ searchParams: { q: null, status: null } }]
};

export default function VendorsPage(props: { searchParams?: Promise<{ q?: string; status?: string }> }) {
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">Vendors</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage your suppliers and accreditation documents.</p>
        </div>
        <Link 
          href="/dashboard/vendors/new"
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl font-medium transition-all hover:shadow-lg hover:shadow-primary/20 active:scale-95"
        >
          <Plus className="h-5 w-5" />
          Add Vendor
        </Link>
      </div>

      <Suspense fallback={<VendorsSkeleton />}>
        <VendorsContent searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function VendorsContent({ searchParams: searchParamsPromise }: { searchParams?: Promise<any> }) {
  const searchParams = await searchParamsPromise;
  const supabase = await createClient();
  const q = searchParams?.q || '';
  const statusFilter = searchParams?.status || 'all';

  let query = supabase
    .from('vendors')
    .select('id, name, address, tin, contact_person, contact_email, status, vendor_documents(doc_type, status)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (q) {
    query = query.ilike('name', `%${q}%`);
  }
  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  const { data: vendors, error } = await query;

  return (
    <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-4 bg-slate-50/50 dark:bg-[#0a0a0a]/50">
          <SearchInput placeholder="Search vendors..." paramName="q" />
          
          <StatusSelect 
            paramName="status"
            options={[
              { value: 'all', label: 'All Statuses' },
              { value: 'active', label: 'Active' },
              { value: 'pending', label: 'Pending' },
              { value: 'inactive', label: 'Inactive' }
            ]}
          />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="px-6 py-4 font-semibold">Vendor Details</th>
              <th className="px-6 py-4 font-semibold">TIN</th>
              <th className="px-6 py-4 font-semibold">Contact Person</th>
              <th className="px-6 py-4 font-semibold">Accreditation</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {error ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-red-500">
                  Failed to load vendors.
                </td>
              </tr>
            ) : vendors?.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
                    <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                      <Building2 className="h-6 w-6 text-slate-400" />
                    </div>
                    <p className="text-base font-medium text-slate-900 dark:text-white">No vendors found</p>
                    <p className="text-sm mt-1">Get started by creating your first vendor record.</p>
                  </div>
                </td>
              </tr>
            ) : (
              vendors?.map((vendor: any) => (
                <tr key={vendor.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-900 dark:text-white">{vendor.name}</div>
                    <div className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 truncate max-w-xs">{vendor.address || 'No address provided'}</div>
                  </td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-mono text-xs">
                    {vendor.tin || '-'}
                  </td>
                  <td className="px-6 py-4">
                    {vendor.contact_person ? (
                      <div>
                        <div className="font-medium text-slate-900 dark:text-white">{vendor.contact_person}</div>
                        <div className="text-slate-500 dark:text-slate-400 text-xs">{vendor.contact_email}</div>
                      </div>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {(() => {
                      const TOTAL = 14;
                      const docs: any[] = vendor.vendor_documents || [];
                      const submitted = docs.filter((d: any) => d.status === 'submitted' || d.status === 'approved').length;
                      const pct = Math.round((submitted / TOTAL) * 100);
                      const color = pct === 100
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50'
                        : pct >= 50
                        ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/50'
                        : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50';
                      return (
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${color}`}>
                            {submitted}/{TOTAL}
                          </span>
                          <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                pct === 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                      vendor.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50' :
                      vendor.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/50' :
                      'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                    }`}>
                      {vendor.status.charAt(0).toUpperCase() + vendor.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link 
                      href={`/dashboard/vendors/${vendor.id}`} 
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
    </div>
  );
}

function VendorsSkeleton() {
  return (
    <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm animate-pulse">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 h-16 bg-slate-50/50 dark:bg-[#0a0a0a]/50" />
      <div className="h-96" />
    </div>
  );
}
