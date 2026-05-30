import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { ArrowLeft, Building2, MapPin, Phone, Mail, FileText, CreditCard, Clock, FileCheck, CheckCircle2, XCircle } from 'lucide-react';
import { notFound } from 'next/navigation';
import { DocumentList } from '@/components/dashboard/vendors/document-list';
import { VendorProfileDetails } from '@/components/dashboard/vendors/vendor-profile-details';
import { VendorProjectsTab } from '@/components/dashboard/vendors/vendor-projects-tab';
import { Suspense } from 'react';
import { RecentActivity } from '@/components/dashboard/shared/recent-activity';
import { isVendorProfileComplete, getVendorMissingFields } from '@/utils/completeness';
import { Tooltip } from '@/components/ui/tooltip';

export const unstable_instant = { 
  prefetch: 'static',
  samples: [{ 
    params: { id: 'sample-id' },
    searchParams: { tab: null }
  }]
};

export default function VendorDetailPage(props: { 
  params: Promise<{ id: string }>,
  searchParams: Promise<{ tab?: string }> 
}) {
  return (
    <Suspense fallback={<VendorDetailSkeleton />}>
      <VendorDetailContent paramsPromise={props.params} searchParamsPromise={props.searchParams} />
    </Suspense>
  );
}

async function VendorDetailContent({ 
  paramsPromise, 
  searchParamsPromise 
}: { 
  paramsPromise: Promise<{ id: string }>,
  searchParamsPromise: Promise<{ tab?: string }> 
}) {
  const params = await paramsPromise;
  const searchParams = await searchParamsPromise;
  const tab = searchParams.tab || 'profile';
  
  const supabase = await createClient();

  // All queries run in parallel
  const [
    { data: vendor, error },
    { data: rawDocuments },
    { data: pos },
    { data: invoices },
    { data: projectLinks },
    { data: userProfile },
  ] = await Promise.all([
    supabase
      .from('vendors')
      .select('*')
      .eq('id', params.id)
      .single(),
    supabase
      .from('vendor_documents')
      .select('*')
      .eq('vendor_id', params.id),
    supabase
      .from('purchase_orders')
      .select('id, po_number, issued_date, amount, status, project_id, currency, projects(name)')
      .eq('vendor_id', params.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('service_invoices')
      .select('id, invoice_number, amount, status, purchase_orders(po_number, projects(name))')
      .eq('vendor_id', params.id)
      .is('deleted_at', null)
      .order('invoice_date', { ascending: false }),
    supabase
      .from('project_vendors')
      .select('projects(*)')
      .eq('vendor_id', params.id),
    supabase.auth.getUser().then(async ({ data: { user: authUser } }) => {
      if (!authUser) return { data: null };
      return supabase.from('profiles').select('role').eq('id', authUser.id).single();
    }),
  ]);

  const projects = projectLinks?.map((link: any) => link.projects).filter(Boolean) || [];
  const userRole = userProfile?.role || null;

  // Fetch all projects for the "Link to Project" dropdown
  const { data: allProjects } = await supabase
    .from('projects')
    .select('id, name')
    .is('deleted_at', null)
    .order('name');

  if (error || !vendor) {
    notFound();
  }

  // Generate signed URLs for each document
  const documentsWithUrls = await Promise.all((rawDocuments || []).map(async (doc) => {
    if (doc.file_url) {
      const path = doc.file_url.split('/public/vendor-documents/')[1];
      if (path) {
        const { data } = await supabase.storage
          .from('vendor-documents')
          .createSignedUrl(path, 3600); // 1 hour
        return { ...doc, file_url: data?.signedUrl || doc.file_url };
      }
    }
    return doc;
  }));

  const tabs = [
    { id: 'profile', label: 'Profile Overview' },
    { id: 'projects', label: 'Projects' },
    { id: 'documents', label: 'Accreditation Docs' },
    { id: 'purchase-orders', label: 'Purchase Orders' },
    { id: 'invoices', label: 'Invoices' },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link
            href="/dashboard/vendors"
            className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors mt-1"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <Tooltip content={
                isVendorProfileComplete(vendor)
                  ? "Profile complete"
                  : <>Missing: <span className="font-normal">{getVendorMissingFields(vendor).join(", ")}</span></>
              }>
                <span className="flex items-center gap-2">
                  <span className={`inline-block h-3 w-3 rounded-full flex-shrink-0 ${isVendorProfileComplete(vendor) ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">
                    {vendor.name}
                  </h1>
                </span>
              </Tooltip>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                vendor.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50' :
                vendor.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/50' :
                'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
              }`}>
                {vendor.status.charAt(0).toUpperCase() + vendor.status.slice(1)}
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
              <FileText className="h-4 w-4" /> TIN: <span className="font-mono">{vendor.tin || 'Not provided'}</span>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 md:ml-auto">
          <form action={async () => {
            'use server';
            const { updateVendorStatus } = await import('../actions');
            await updateVendorStatus(vendor.id, vendor.status === 'active' ? 'inactive' : 'active');
          }}>
            {vendor.status !== 'active' ? (
              <button type="submit" className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm active:scale-95">
                <CheckCircle2 className="h-4 w-4" />
                Activate Vendor
              </button>
            ) : (
              <button type="submit" className="inline-flex items-center gap-2 bg-white dark:bg-[#0a0a0a] border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95">
                <XCircle className="h-4 w-4" />
                Deactivate
              </button>
            )}
          </form>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
          {tabs.map((t) => (
            <Link
              key={t.id}
              href={`/dashboard/vendors/${vendor.id}?tab=${t.id}`}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${tab === t.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-300 dark:hover:border-slate-700'
                }
              `}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="py-4">
        {tab === 'profile' && (
          <VendorProfileDetails vendor={vendor} documents={documentsWithUrls} />
        )}

        {tab === 'projects' && (
          <VendorProjectsTab vendorId={vendor.id} projects={projects || []} pos={pos || []} allProjects={allProjects || []} />
        )}

        {tab === 'documents' && (
          <DocumentList vendorId={vendor.id} documents={documentsWithUrls || []} userRole={userRole} />
        )}

        {tab === 'purchase-orders' && (
          <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm animate-in fade-in duration-300">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900 dark:text-white">Vendor Purchase Orders</h2>
              <Link 
                href="/dashboard/purchase-orders/new" 
                className="text-xs font-bold text-primary hover:underline"
              >
                + New PO
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-6 py-3 font-semibold">PO Number</th>
                    <th className="px-6 py-3 font-semibold">Date</th>
                    <th className="px-6 py-3 font-semibold">Amount</th>
                    <th className="px-6 py-3 font-semibold">Status</th>
                    <th className="px-6 py-3 font-semibold">Project</th>
                    <th className="px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {pos?.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                        No purchase orders found for this vendor.
                      </td>
                    </tr>
                  ) : (
                    pos?.map((po: any) => (
                      <tr key={po.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/10 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{po.po_number}</td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{new Date(po.issued_date).toLocaleDateString()}</td>
                        <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">{vendor.currency === 'USD' ? '$' : '₱'}{Number(po.amount).toLocaleString()}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            po.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400' :
                            po.status === 'issued' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400' :
                            'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            {po.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{po.projects?.name || '-'}</td>
                        <td className="px-6 py-4 text-right">
                          <Link href={`/dashboard/purchase-orders/${po.id}`} className="text-primary hover:underline font-medium">View</Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'invoices' && (
          <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm animate-in fade-in duration-300">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900 dark:text-white">Service Invoices</h2>
              <Link 
                href="/dashboard/invoices/new" 
                className="text-xs font-bold text-primary hover:underline"
              >
                + Record Invoice
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Invoice #</th>
                    <th className="px-6 py-3 font-semibold">Linked PO</th>
                    <th className="px-6 py-3 font-semibold">Project</th>
                    <th className="px-6 py-3 font-semibold">Amount</th>
                    <th className="px-6 py-3 font-semibold">Status</th>
                    <th className="px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {invoices?.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                        No invoices found for this vendor.
                      </td>
                    </tr>
                  ) : (
                    invoices?.map((inv: any) => (
                      <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/10 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{inv.invoice_number}</td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                          {inv.purchase_orders?.po_number || <span className="text-slate-400 italic text-xs">No PO</span>}
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                          {inv.purchase_orders?.projects?.name || '-'}
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">{vendor.currency === 'USD' ? '$' : '₱'}{Number(inv.amount).toLocaleString()}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            inv.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400' :
                            inv.status === 'disputed' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400' :
                            'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400'
                          }`}>
                            {inv.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link href={`/dashboard/invoices/${inv.id}`} className="text-primary hover:underline font-medium">View</Link>
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

function VendorDetailSkeleton() {
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-pulse">
      <div className="h-10 w-64 bg-slate-100 dark:bg-slate-800/50 rounded-lg" />
      <div className="h-10 w-full border-b border-slate-200 dark:border-slate-800" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-64 bg-slate-100 dark:bg-slate-800/50 rounded-2xl" />
        <div className="h-64 bg-slate-100 dark:bg-slate-800/50 rounded-2xl" />
      </div>
    </div>
  );
}
