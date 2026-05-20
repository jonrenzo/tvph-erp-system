import Link from 'next/link';
import { Building2, Plus, UserRound } from 'lucide-react';
import { Suspense } from 'react';
import { createClient } from '@/utils/supabase/server';
import { SearchInput } from '@/components/ui/search-input';
import { StatusSelect } from '@/components/ui/status-select';
import { CustomersTableBody } from '@/components/dashboard/crm/customers-table-body';

export const unstable_instant = {
  prefetch: 'static',
  samples: [{ searchParams: { q: null, status: null } }],
};

export default function CrmPage(props: { searchParams?: Promise<{ q?: string; status?: string }> }) {
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">
            Customers
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage customer profiles, registered address details, and contact records.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/crm/projects/new"
            className="inline-flex items-center gap-2 bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2.5 rounded-xl font-medium transition-all hover:bg-slate-50 dark:hover:bg-slate-900"
          >
            <UserRound className="h-5 w-5" />
            New Customer Project
          </Link>
          <Link
            href="/dashboard/crm/new"
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl font-medium transition-all hover:shadow-lg hover:shadow-primary/20 active:scale-95"
          >
            <Plus className="h-5 w-5" />
            Add Customer
          </Link>
        </div>
      </div>

      <Suspense fallback={<CustomersSkeleton />}>
        <CustomersContent searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function CustomersContent({ searchParams: searchParamsPromise }: { searchParams?: Promise<any> }) {
  const searchParams = await searchParamsPromise;
  const supabase = await createClient();
  const q = (searchParams?.q as string) || '';
  const statusFilter = (searchParams?.status as string) || 'all';

  let query = supabase
    .from('crm_accounts')
    .select('id, company_name, registered_address, tin, status, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (q) {
    query = query.or(`company_name.ilike.%${q}%,registered_address.ilike.%${q}%,tin.ilike.%${q}%`);
  }
  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  const [{ data: customers, error }, { data: contacts }, { count: activeCount }] = await Promise.all([
    query,
    supabase
      .from('crm_contacts')
      .select('id, account_id, full_name, email, phone, is_primary')
      .is('deleted_at', null)
      .eq('is_primary', true),
    supabase
      .from('crm_accounts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .is('deleted_at', null),
  ]);

  const contactsByAccount = new Map<string, any[]>();
  for (const contact of contacts || []) {
    const existing = contactsByAccount.get(contact.account_id) || [];
    existing.push(contact);
    contactsByAccount.set(contact.account_id, existing);
  }

  const customerRows = (customers || []).map((customer) => ({
    ...customer,
    crm_contacts: contactsByAccount.get(customer.id) || [],
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500 font-semibold tracking-wide">Total Customers</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{customerRows.length}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
            <UserRound className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500 font-semibold tracking-wide">Active Customers</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{activeCount || 0}</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-4 bg-slate-50/50 dark:bg-[#0a0a0a]/50">
          <SearchInput placeholder="Search customers..." paramName="q" />
          <StatusSelect
            paramName="status"
            options={[
              { value: 'all', label: 'All Statuses' },
              { value: 'pending', label: 'Pending' },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ]}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4 font-semibold">Customer Details</th>
                <th className="px-6 py-4 font-semibold">TIN</th>
                <th className="px-6 py-4 font-semibold">Primary Contact</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <CustomersTableBody customers={customerRows} error={error} />
          </table>
        </div>
      </div>
    </div>
  );
}

function CustomersSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="h-20 bg-slate-100 dark:bg-slate-800/50 rounded-2xl" />
        <div className="h-20 bg-slate-100 dark:bg-slate-800/50 rounded-2xl" />
      </div>
      <div className="h-96 bg-slate-100 dark:bg-slate-800/50 rounded-2xl" />
    </div>
  );
}
