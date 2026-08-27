import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';
import { DocumentList } from '@/components/dashboard/vendors/document-list';
import { VendorProfileDetails } from '@/components/dashboard/vendors/vendor-profile-details';
import { VendorProjectsTab } from '@/components/dashboard/vendors/vendor-projects-tab';
import { VendorEmailHistory } from '@/components/dashboard/vendors/email-history';
import { Suspense } from 'react';
import TabbedNav from '@/components/dashboard/tabbed-nav';
import VendorDetailHeader from '@/components/dashboard/vendors/vendor-detail-header';
import { invoiceStatusLabel, invoiceStatusBadgeClasses } from '@/lib/invoices/status';
import { hasCapability } from '@/lib/auth/permissions';

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

  // All queries run in parallel — including allProjects for the vendor-link dropdown
  const [
    { data: vendor, error },
    { data: rawDocuments },
    { data: pos },
    { data: invoices },
    { data: projectLinks },
    { data: userProfile },
    { data: allProjects },
  ] = await Promise.all([
    supabase
      .from('vendors')
      .select('*')
      .eq('id', params.id)
      .single(),
supabase
      .from("vendor_documents")
      .select('*, vendor_document_files(*)')
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
    supabase
      .from('projects')
      .select('id, name')
      .is('deleted_at', null)
      .order('name'),
  ]);

  const projects = projectLinks?.map((link: any) => link.projects).filter((p: any) => p && !p.deleted_at) || [];
  const userRole = userProfile?.role || null;

  if (error || !vendor) {
    notFound();
  }

  // Generate signed URLs for each document and each uploaded file
  const signPath = async (url: string | null) => {
    if (!url) return url;
    const path = url.split('/public/vendor-documents/')[1];
    if (!path) return url;
    const { data } = await supabase.storage
      .from('vendor-documents')
      .createSignedUrl(path, 3600); // 1 hour
    return data?.signedUrl || url;
  };

  const documentsWithUrls = await Promise.all((rawDocuments || []).map(async (doc) => {
    const file_url = await signPath(doc.file_url);
    const files = await Promise.all((doc.vendor_document_files || []).map(async (f: any) => ({
      ...f,
      file_url: await signPath(f.file_url),
    })));
    return { ...doc, file_url, vendor_document_files: files };
  }));

  const tabs = [
    { id: 'profile', label: 'Profile Overview' },
    { id: 'projects', label: 'Projects' },
    { id: 'documents', label: 'Accreditation Docs' },
    { id: 'purchase-orders', label: 'Purchase Orders' },
    { id: 'invoices', label: 'Invoices' },
    { id: 'email-history', label: 'Email History' },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <VendorDetailHeader vendor={vendor} canDelete={hasCapability(userRole, "vendor.delete")} />

      <TabbedNav
        defaultTab={tab}
        basePath={`/dashboard/vendors/${vendor.id}`}
        tabs={tabs}
        sections={{
          profile: <VendorProfileDetails vendor={vendor} documents={documentsWithUrls} />,
          projects: <VendorProjectsTab vendorId={vendor.id} projects={projects || []} pos={pos || []} allProjects={allProjects || []} />,
          documents: <DocumentList vendorId={vendor.id} documents={documentsWithUrls || []} userRole={userRole} />,
          "email-history": <VendorEmailHistory vendorId={vendor.id} />,
          "purchase-orders": (
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
                        <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">{(vendor.currency || 'PHP') === 'USD' ? '$' : '₱'}{Number(po.amount).toLocaleString()}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            po.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400' :
                            po.status === 'issued' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400' :
                            po.status === 'signed_received' ? 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-400' :
                            'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            {po.status === 'signed_received' ? 'SIGNED PO RECEIVED' : po.status.toUpperCase()}
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
          ),
          invoices: (
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
                        <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">{(vendor.currency || 'PHP') === 'USD' ? '$' : '₱'}{Number(inv.amount).toLocaleString()}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${invoiceStatusBadgeClasses(inv.status)}`}>
                            {invoiceStatusLabel(inv.status)}
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
          ),
        }}
      />
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
