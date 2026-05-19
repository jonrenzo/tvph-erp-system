import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { Plus, Search, Building2 } from 'lucide-react';
import { Suspense } from 'react';
import { SearchInput } from '@/components/ui/search-input';
import { StatusSelect } from '@/components/ui/status-select';
import { VendorsTableBody } from '@/components/dashboard/vendors/vendors-table-body';

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
          <VendorsTableBody vendors={vendors} error={error} />
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
