import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ArrowLeft, CalendarDays, CircleDollarSign, FileText, FolderGit2, MapPin, Phone, ShieldAlert, UserRound } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { addOpportunityActivityFromForm, convertOpportunityToProject, markOpportunityAsLost, updateOpportunityStage } from '../../actions';

export const unstable_instant = {
  prefetch: 'static',
  samples: [{ params: { id: 'sample-crm-id' } }],
};

const stageOptions = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'site_visit', label: 'Site Visit' },
  { value: 'quoted', label: 'Quoted' },
  { value: 'approved', label: 'Approved' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'completed', label: 'Completed' },
  { value: 'lost_cancelled', label: 'Lost / Cancelled' },
];

export default function CrmOpportunityDetailPage(props: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<CrmOpportunityDetailSkeleton />}>
      <CrmOpportunityDetailLoader paramsPromise={props.params} />
    </Suspense>
  );
}

async function CrmOpportunityDetailLoader({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const supabase = await createClient();

  const [
    { data: opportunity },
    { data: activities },
    { data: userData },
  ] = await Promise.all([
    supabase
      .from('crm_opportunities')
      .select(`
        *,
        crm_accounts(id, company_name, company_type, primary_site_location),
        crm_contacts(id, full_name, email, phone, job_title),
        profiles!crm_opportunities_owner_id_fkey(full_name, role)
      `)
      .eq('id', params.id)
      .is('deleted_at', null)
      .single(),
    supabase
      .from('crm_activities')
      .select(`
        *,
        profiles!crm_activities_created_by_fkey(full_name)
      `)
      .eq('opportunity_id', params.id)
      .order('created_at', { ascending: false }),
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return { data: null };
      return supabase.from('profiles').select('role').eq('id', user.id).single();
    }),
  ]);

  if (!opportunity) notFound();

  const canManage = ['superadmin', 'admin', 'operations'].includes(userData?.role || '');
  const currentStatusLabel =
    stageOptions.find((stage) => stage.value === opportunity.stage)?.label || opportunity.stage.replace(/_/g, ' ');

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link
            href={opportunity.crm_accounts?.id ? `/dashboard/crm/${opportunity.crm_accounts.id}?tab=projects` : '/dashboard/crm'}
            className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors mt-1"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">
              {opportunity.title}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {opportunity.crm_accounts?.company_name || 'Unknown customer'} • {(opportunity.job_type || '').replace(/_/g, ' ')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {opportunity.converted_project_id ? (
            <Link
              href={`/dashboard/projects/${opportunity.converted_project_id}`}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all"
            >
              <FolderGit2 className="h-4 w-4" />
              Open Project
            </Link>
          ) : (
            canManage && opportunity.status !== 'lost' && (
              <form action={async () => {
                'use server';
                await convertOpportunityToProject(opportunity.id);
              }}>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all"
                >
                  <FolderGit2 className="h-4 w-4" />
                  Create Project Record
                </button>
              </form>
            )
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50">
              <h2 className="font-semibold text-slate-900 dark:text-white">Customer Project Snapshot</h2>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div className="space-y-1">
                <p className="text-xs text-slate-500 uppercase font-semibold tracking-wide">Customer Account</p>
                <p className="font-semibold text-slate-900 dark:text-white">{opportunity.crm_accounts?.company_name || '—'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500 uppercase font-semibold tracking-wide">Primary Contact</p>
                <p className="font-semibold text-slate-900 dark:text-white">{opportunity.crm_contacts?.full_name || '—'}</p>
                <p className="text-xs text-slate-500">{opportunity.crm_contacts?.job_title || ''}</p>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-slate-500 uppercase font-semibold tracking-wide flex items-center gap-1">
                  <UserRound className="h-3.5 w-3.5" /> Owner
                </p>
                <p className="font-semibold text-slate-900 dark:text-white">{opportunity.profiles?.full_name || 'Unassigned'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500 uppercase font-semibold tracking-wide flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> Location
                </p>
                <p className="font-semibold text-slate-900 dark:text-white">{opportunity.location || opportunity.crm_accounts?.primary_site_location || '—'}</p>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-slate-500 uppercase font-semibold tracking-wide flex items-center gap-1">
                  <CircleDollarSign className="h-3.5 w-3.5" /> Estimated Contract Value
                </p>
                <p className="font-semibold text-slate-900 dark:text-white">
                  ₱{Number(opportunity.estimated_contract_value || 0).toLocaleString()}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500 uppercase font-semibold tracking-wide">Estimated Copper Volume</p>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {opportunity.estimated_copper_volume ? Number(opportunity.estimated_copper_volume).toLocaleString() : '—'}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-slate-500 uppercase font-semibold tracking-wide flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" /> Expected Start
                </p>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {opportunity.expected_start_date ? new Date(opportunity.expected_start_date).toLocaleDateString() : '—'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500 uppercase font-semibold tracking-wide">Expected Close</p>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {opportunity.expected_close_date ? new Date(opportunity.expected_close_date).toLocaleDateString() : '—'}
                </p>
              </div>

              <div className="space-y-1 md:col-span-2">
                <p className="text-xs text-slate-500 uppercase font-semibold tracking-wide">Current Project Status</p>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {currentStatusLabel}
                </p>
              </div>

              {opportunity.lost_reason && (
                <div className="space-y-1 md:col-span-2">
                  <p className="text-xs text-slate-500 uppercase font-semibold tracking-wide">Reason Not Proceeding</p>
                  <p className="text-slate-700 dark:text-slate-300">{opportunity.lost_reason}</p>
                </div>
              )}

              {(opportunity.access_requirements || opportunity.safety_requirements || opportunity.permit_requirements) && (
                <div className="md:col-span-2 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30">
                  <p className="text-xs text-amber-700 dark:text-amber-400 uppercase font-semibold tracking-wide flex items-center gap-1">
                    <ShieldAlert className="h-3.5 w-3.5" /> Site Requirements
                  </p>
                  <div className="mt-2 space-y-2 text-xs text-amber-800/90 dark:text-amber-300/90">
                    {opportunity.access_requirements && <p><span className="font-semibold">Access:</span> {opportunity.access_requirements}</p>}
                    {opportunity.safety_requirements && <p><span className="font-semibold">Safety:</span> {opportunity.safety_requirements}</p>}
                    {opportunity.permit_requirements && <p><span className="font-semibold">Permits:</span> {opportunity.permit_requirements}</p>}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50">
              <h2 className="font-semibold text-slate-900 dark:text-white">Activity Timeline</h2>
            </div>

            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {activities?.length === 0 ? (
                <div className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400 text-center">
                  No activities logged yet.
                </div>
              ) : (
                activities?.map((activity: any) => (
                  <div key={activity.id} className="px-6 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-slate-900 dark:text-white text-sm">{activity.subject}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {new Date(activity.created_at).toLocaleString()}
                      </p>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {activity.activity_type.replace(/_/g, ' ')} • by {activity.profiles?.full_name || 'Unknown'}
                      {activity.due_date ? ` • due ${new Date(activity.due_date).toLocaleDateString()}` : ''}
                    </p>
                    {activity.details && (
                      <p className="text-sm text-slate-700 dark:text-slate-300 mt-2 whitespace-pre-wrap">{activity.details}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Project Status</h3>
            {canManage ? (
              <div className="space-y-4">
                <form
                  action={async (formData) => {
                    'use server';
                    const stage = formData.get('stage') as string;
                    await updateOpportunityStage(opportunity.id, stage);
                  }}
                  className="space-y-3"
                >
                  <select
                    name="stage"
                    defaultValue={opportunity.stage}
                    className="w-full px-3 py-2.5 text-sm bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-primary"
                  >
                    {stageOptions.map((stage) => (
                      <option key={stage.value} value={stage.value}>
                        {stage.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="w-full px-3 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-medium"
                  >
                    Update Status
                  </button>
                </form>

                <form
                  action={async (formData) => {
                    'use server';
                    const reason = (formData.get('lost_reason') as string) || '';
                    await markOpportunityAsLost(opportunity.id, reason);
                  }}
                  className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800"
                >
                  <textarea
                    name="lost_reason"
                    rows={3}
                    placeholder="Reason if not proceeding"
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-primary resize-none"
                  />
                  <button
                    type="submit"
                    className="w-full px-3 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium"
                  >
                    Mark Not Proceeding
                  </button>
                </form>
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Read-only view. Project status changes are restricted to Admin and Commercial Manager roles.
              </p>
            )}
          </div>

          <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Add Activity</h3>
            <form action={addOpportunityActivityFromForm} className="space-y-3">
              <input type="hidden" name="opportunity_id" value={opportunity.id} />
              <select
                name="activity_type"
                defaultValue="note"
                className="w-full px-3 py-2.5 text-sm bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-primary"
              >
                <option value="call">Call</option>
                <option value="email">Email</option>
                <option value="meeting">Meeting</option>
                <option value="site_visit">Site Visit</option>
                <option value="task">Task</option>
                <option value="note">Note</option>
              </select>
              <input
                name="subject"
                required
                placeholder="Activity subject"
                className="w-full px-3 py-2.5 text-sm bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-primary"
              />
              <textarea
                name="details"
                rows={3}
                placeholder="Details"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-primary resize-none"
              />
              <input
                name="due_date"
                type="date"
                className="w-full px-3 py-2.5 text-sm bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-primary"
              />
              <button
                type="submit"
                className="w-full px-3 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 rounded-xl text-sm font-medium"
              >
                Log Activity
              </button>
            </form>
          </div>

          <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
            <h3 className="font-semibold text-slate-900 dark:text-white">Contact Quick View</h3>
            {opportunity.crm_contacts ? (
              <>
                <p className="text-sm text-slate-900 dark:text-white font-medium">{opportunity.crm_contacts.full_name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{opportunity.crm_contacts.job_title || 'No job title'}</p>
                <p className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5" />
                  {opportunity.crm_contacts.email || 'No email'}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5" />
                  {opportunity.crm_contacts.phone || 'No phone'}
                </p>
              </>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">No contact linked yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CrmOpportunityDetailSkeleton() {
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-pulse">
      <div className="h-8 w-80 bg-slate-100 dark:bg-slate-800/50 rounded-lg" />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 h-[520px] bg-slate-100 dark:bg-slate-800/50 rounded-2xl" />
        <div className="h-[520px] bg-slate-100 dark:bg-slate-800/50 rounded-2xl" />
      </div>
    </div>
  );
}
