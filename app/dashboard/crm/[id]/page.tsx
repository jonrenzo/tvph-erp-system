import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';
import { ArrowLeft, CheckCircle2, FileText, Plus, XCircle } from 'lucide-react';
import { Suspense } from 'react';
import { CustomerProfileDetails } from '@/components/dashboard/crm/customer-profile-details';
import { CustomerDocuments } from '@/components/dashboard/crm/customer-documents';
import { updateCustomerStatus } from '../actions';

export const unstable_instant = {
  prefetch: 'static',
  samples: [{ params: { id: 'sample-customer-id' }, searchParams: { tab: null } }],
};

export default function CustomerDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  return (
    <Suspense fallback={<CustomerDetailSkeleton />}>
      <CustomerDetailContent paramsPromise={props.params} searchParamsPromise={props.searchParams} />
    </Suspense>
  );
}

async function CustomerDetailContent({
  paramsPromise,
  searchParamsPromise,
}: {
  paramsPromise: Promise<{ id: string }>;
  searchParamsPromise: Promise<{ tab?: string }>;
}) {
  const params = await paramsPromise;
  const searchParams = await searchParamsPromise;
  const tab = searchParams.tab || 'profile';
  const supabase = await createClient();

  const [{ data: customer, error }, { data: contacts }, { data: opportunities }, { data: documents }, { data: userProfile }] = await Promise.all([
    supabase.from('crm_accounts').select('*').eq('id', params.id).is('deleted_at', null).single(),
    supabase
      .from('crm_contacts')
      .select('id, full_name, job_title, email, phone, fax, notes, is_primary')
      .eq('account_id', params.id)
      .is('deleted_at', null)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true }),
    supabase
      .from('crm_opportunities')
      .select('id, title, stage, status, estimated_contract_value, next_follow_up_date, created_at')
      .eq('account_id', params.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('crm_documents')
      .select('*')
      .eq('account_id', params.id)
      .is('archived_at', null),
    supabase.auth.getUser().then(async ({ data: { user: authUser } }) => {
      if (!authUser) return { data: null };
      return supabase.from('profiles').select('role').eq('id', authUser.id).single();
    }),
  ]);

  if (error || !customer) notFound();

  const userRole = userProfile?.role || '';
  const canManage = ['admin', 'commercial_manager'].includes(userRole);

  const documentsWithUrls = await Promise.all((documents || []).map(async (doc: any) => {
    if (doc.file_url) {
      const path = doc.file_url.split('/public/crm-documents/')[1];
      if (path) {
        const { data } = await supabase.storage
          .from('crm-documents')
          .createSignedUrl(path, 3600);
        return { ...doc, file_url: data?.signedUrl || doc.file_url };
      }
    }
    return doc;
  }));

  const tabs = [
    { id: 'profile', label: 'Profile' },
    { id: 'projects', label: 'Customer Projects' },
    { id: 'documents', label: 'Documents' },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link
            href="/dashboard/crm"
            className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors mt-1"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">
                {customer.company_name}
              </h1>
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                  customer.status === 'active'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50'
                    : customer.status === 'inactive'
                      ? 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                      : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/50'
                }`}
              >
                {customer.status?.charAt(0).toUpperCase() + customer.status?.slice(1)}
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
              <FileText className="h-4 w-4" /> TIN: <span className="font-mono">{customer.tin || 'Not provided'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 md:ml-auto">
          <Link
            href={`/dashboard/crm/projects/new?accountId=${customer.id}`}
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm active:scale-95"
          >
            <Plus className="h-4 w-4" />
            New Customer Project
          </Link>

          {canManage && (
            <form
              action={async () => {
                'use server';
                const nextStatus = customer.status === 'active' ? 'inactive' : 'active';
                await updateCustomerStatus(customer.id, nextStatus);
              }}
            >
              {customer.status !== 'active' ? (
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm active:scale-95"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Activate Customer
                </button>
              ) : (
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 bg-white dark:bg-[#0a0a0a] border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95"
                >
                  <XCircle className="h-4 w-4" />
                  Deactivate
                </button>
              )}
            </form>
          )}
        </div>
      </div>

      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
          {tabs.map((t) => (
            <Link
              key={t.id}
              href={`/dashboard/crm/${customer.id}?tab=${t.id}`}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                tab === t.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-300 dark:hover:border-slate-700'
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="py-4">
        {tab === 'profile' && <CustomerProfileDetails customer={customer} contacts={contacts || []} />}

        {tab === 'documents' && (
          <CustomerDocuments customerId={customer.id} documents={documentsWithUrls || []} userRole={userRole} />
        )}

        {tab === 'projects' && (
          <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm animate-in fade-in duration-300">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900 dark:text-white">Customer Projects</h2>
              <Link href={`/dashboard/crm/projects/new?accountId=${customer.id}`} className="text-xs font-bold text-primary hover:underline">
                + New Customer Project
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Project</th>
                    <th className="px-6 py-3 font-semibold">Stage</th>
                    <th className="px-6 py-3 font-semibold">Status</th>
                    <th className="px-6 py-3 font-semibold">Estimated Value</th>
                    <th className="px-6 py-3 font-semibold">Next Follow-up</th>
                    <th className="px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {opportunities?.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                        No customer projects yet.
                      </td>
                    </tr>
                  ) : (
                    opportunities?.map((opportunity: any) => (
                      <tr key={opportunity.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/10 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-semibold text-slate-900 dark:text-white">{opportunity.title}</p>
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                          {(opportunity.stage || '').replace(/_/g, ' ')}
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                          {(opportunity.status || '').replace(/_/g, ' ')}
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">
                          ₱{Number(opportunity.estimated_contract_value || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                          {opportunity.next_follow_up_date
                            ? new Date(opportunity.next_follow_up_date).toLocaleDateString()
                            : 'Not set'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link href={`/dashboard/crm/projects/${opportunity.id}`} className="text-primary hover:underline font-medium">
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
        )}
      </div>
    </div>
  );
}

function CustomerDetailSkeleton() {
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-pulse">
      <div className="h-8 w-80 bg-slate-100 dark:bg-slate-800/50 rounded-lg" />
      <div className="h-10 w-full border-b border-slate-200 dark:border-slate-800" />
      <div className="h-[520px] bg-slate-100 dark:bg-slate-800/50 rounded-2xl" />
    </div>
  );
}
