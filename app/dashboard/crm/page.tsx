import Link from 'next/link';
import { BriefcaseBusiness, CircleDollarSign, Plus, Target } from 'lucide-react';
import { Suspense } from 'react';
import { createClient } from '@/utils/supabase/server';
import { SearchInput } from '@/components/ui/search-input';
import { StatusSelect } from '@/components/ui/status-select';

export const unstable_instant = {
  prefetch: 'static',
  samples: [{ searchParams: { q: null, stage: null, status: null } }],
};

const stageLabelMap: Record<string, string> = {
  prospect: 'Prospect',
  site_visit: 'Site Visit',
  quoted: 'Quoted',
  approved: 'Approved',
  ongoing: 'Ongoing',
  completed: 'Completed',
  lost_cancelled: 'Lost / Cancelled',
};

function stageBadgeClass(stage: string) {
  switch (stage) {
    case 'approved':
    case 'ongoing':
    case 'completed':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400';
    case 'lost_cancelled':
      return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400';
    case 'quoted':
      return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400';
    case 'site_visit':
      return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400';
    default:
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400';
  }
}

export default function CrmPage(props: { searchParams?: Promise<{ q?: string; stage?: string; status?: string }> }) {
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">
            Customer Management
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track customers, contacts, and the copper recovery projects connected to them.
          </p>
        </div>

        <Link
          href="/dashboard/crm/new"
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl font-medium transition-all hover:shadow-lg hover:shadow-primary/20 active:scale-95"
        >
          <Plus className="h-5 w-5" />
          New Customer Project
        </Link>
      </div>

      <Suspense fallback={<CrmSkeleton />}>
        <CrmContent searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function CrmContent({ searchParams: searchParamsPromise }: { searchParams?: Promise<any> }) {
  const searchParams = await searchParamsPromise;
  const supabase = await createClient();
  const q = (searchParams?.q as string) || '';
  const stage = (searchParams?.stage as string) || 'all';
  const status = (searchParams?.status as string) || 'all';

  let opportunitiesQuery = supabase
    .from('crm_opportunities')
    .select(`
      id,
      title,
      job_type,
      stage,
      status,
      location,
      estimated_contract_value,
      next_follow_up_date,
      created_at,
      converted_project_id,
      crm_accounts(company_name),
      crm_contacts(full_name),
      profiles!crm_opportunities_owner_id_fkey(full_name)
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (q) {
    opportunitiesQuery = opportunitiesQuery.or(`title.ilike.%${q}%,location.ilike.%${q}%`);
  }
  if (stage !== 'all') {
    opportunitiesQuery = opportunitiesQuery.eq('stage', stage);
  }
  if (status !== 'all') {
    opportunitiesQuery = opportunitiesQuery.eq('status', status);
  }

  const [
    { data: opportunities, error: opportunitiesError },
    { count: openCount },
    { count: surveyCount },
    { data: pipelineValues },
  ] = await Promise.all([
    opportunitiesQuery,
    supabase
      .from('crm_opportunities')
      .select('*', { count: 'exact', head: true })
      .not('stage', 'in', '(completed,lost_cancelled)')
      .is('deleted_at', null),
    supabase
      .from('crm_opportunities')
      .select('*', { count: 'exact', head: true })
      .eq('stage', 'site_visit')
      .is('deleted_at', null),
    supabase
      .from('crm_opportunities')
      .select('estimated_contract_value')
      .not('stage', 'in', '(completed,lost_cancelled)')
      .is('deleted_at', null),
  ]);

  const pipelineValue =
    pipelineValues?.reduce((sum, row) => sum + Number(row.estimated_contract_value || 0), 0) || 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
            <BriefcaseBusiness className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500 font-semibold tracking-wide">Active Customer Projects</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{openCount || 0}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
            <Target className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500 font-semibold tracking-wide">Site Visits</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{surveyCount || 0}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
            <CircleDollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500 font-semibold tracking-wide">Estimated Active Value</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">₱{pipelineValue.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row gap-3 bg-slate-50/50 dark:bg-[#0a0a0a]/50">
          <SearchInput placeholder="Search customer project or location..." paramName="q" />
          <StatusSelect
            paramName="stage"
            options={[
              { value: 'all', label: 'All Project Statuses' },
              { value: 'prospect', label: 'Prospect' },
              { value: 'site_visit', label: 'Site Visit' },
              { value: 'quoted', label: 'Quoted' },
              { value: 'approved', label: 'Approved' },
              { value: 'ongoing', label: 'Ongoing' },
              { value: 'completed', label: 'Completed' },
              { value: 'lost_cancelled', label: 'Lost / Cancelled' },
            ]}
          />
          <StatusSelect
            paramName="status"
            options={[
              { value: 'all', label: 'All Records' },
              { value: 'open', label: 'Open' },
              { value: 'won', label: 'Project Started' },
              { value: 'lost', label: 'Not Proceeding' },
            ]}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4 font-semibold">Customer Project</th>
                <th className="px-6 py-4 font-semibold">Customer</th>
                <th className="px-6 py-4 font-semibold">Owner</th>
                <th className="px-6 py-4 font-semibold">Value</th>
                <th className="px-6 py-4 font-semibold">Project Status</th>
                <th className="px-6 py-4 font-semibold">Next Follow-up</th>
                <th className="px-6 py-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {opportunitiesError ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-red-600 dark:text-red-400">
                    Failed to load customer projects.
                  </td>
                </tr>
              ) : opportunities?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-500 dark:text-slate-400">
                    No customer projects found. Start by creating a new customer project.
                  </td>
                </tr>
              ) : (
                opportunities?.map((opportunity: any) => (
                  <tr key={opportunity.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/10 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-900 dark:text-white">{opportunity.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {(opportunity.job_type || '').replace(/_/g, ' ')} {opportunity.location ? `• ${opportunity.location}` : ''}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-900 dark:text-white">
                        {opportunity.crm_accounts?.company_name || '—'}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {opportunity.crm_contacts?.full_name || 'No contact'}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                      {opportunity.profiles?.full_name || 'Unassigned'}
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">
                      ₱{Number(opportunity.estimated_contract_value || 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[10px] font-bold ${stageBadgeClass(opportunity.stage)}`}>
                        {stageLabelMap[opportunity.stage] || opportunity.stage}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                      {opportunity.next_follow_up_date
                        ? new Date(opportunity.next_follow_up_date).toLocaleDateString()
                        : 'Not set'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/dashboard/crm/${opportunity.id}`} className="text-primary hover:underline font-medium">
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CrmSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="h-20 bg-slate-100 dark:bg-slate-800/50 rounded-2xl" />
        <div className="h-20 bg-slate-100 dark:bg-slate-800/50 rounded-2xl" />
        <div className="h-20 bg-slate-100 dark:bg-slate-800/50 rounded-2xl" />
      </div>
      <div className="h-96 bg-slate-100 dark:bg-slate-800/50 rounded-2xl" />
    </div>
  );
}
