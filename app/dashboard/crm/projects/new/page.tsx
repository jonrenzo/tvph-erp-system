import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Suspense } from 'react';
import { createClient } from '@/utils/supabase/server';
import { CreateOpportunityForm } from '@/components/dashboard/crm/create-opportunity-form';

export const unstable_instant = {
  prefetch: 'static',
  samples: [{ searchParams: { accountId: null } }],
};

export default function NewCrmOpportunityPage(props: { searchParams?: Promise<{ accountId?: string }> }) {
  return (
    <Suspense fallback={<NewCustomerProjectSkeleton />}>
      <NewCrmOpportunityContent searchParamsPromise={props.searchParams} />
    </Suspense>
  );
}

async function NewCrmOpportunityContent({ searchParamsPromise }: { searchParamsPromise?: Promise<{ accountId?: string }> }) {
  const searchParams = await searchParamsPromise;
  const preselectedAccountId = searchParams?.accountId || '';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: accounts }, { data: contacts }, { data: owners }] = await Promise.all([
    supabase
      .from('crm_accounts')
      .select('id, company_name, status')
      .is('deleted_at', null)
      .order('company_name'),
    supabase
      .from('crm_contacts')
      .select('id, account_id, full_name')
      .is('deleted_at', null)
      .order('full_name'),
    supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('role', ['admin', 'commercial_manager', 'project_manager'])
      .order('full_name'),
  ]);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/crm"
          className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">
            New Customer Project
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Add a customer job for mining or copper recovery work, then track it through delivery.
          </p>
        </div>
      </div>

      <CreateOpportunityForm
        accounts={accounts || []}
        contacts={contacts || []}
        owners={owners || []}
        currentUserId={user?.id || ''}
        initialAccountId={preselectedAccountId}
      />
    </div>
  );
}

function NewCustomerProjectSkeleton() {
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-pulse">
      <div className="h-10 w-80 bg-slate-100 dark:bg-slate-800/50 rounded-lg" />
      <div className="h-[580px] bg-slate-100 dark:bg-slate-800/50 rounded-2xl" />
    </div>
  );
}
