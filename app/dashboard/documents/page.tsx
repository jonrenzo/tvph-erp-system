import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { DocumentsClient } from '@/components/dashboard/documents/documents-client';
import { Suspense } from 'react';
import { signDocUrls } from '@/utils/storage';

export const unstable_instant = { 
  prefetch: 'static',
  samples: [{ searchParams: { search: null } }]
};

export default function DocumentsPage(props: { 
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }> 
}) {
  return (
    <Suspense fallback={<DocumentsSkeleton />}>
      <DocumentsContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function DocumentsContent({ searchParams: searchParamsPromise }: { searchParams?: Promise<any> }) {
  const searchParams = await searchParamsPromise;
  const searchQuery = (searchParams?.search as string) || "";
  
  const supabase = await createClient();

  // getUser first so we have the ID for the role query in the next parallel batch.
  // Rely on middleware for auth redirect; during build user is null.
  const { data: { user } } = await supabase.auth.getUser();

  // All data queries + role fetch run in parallel
  const [
    { data: rawCompanyDocs },
    { data: vendorsData },
    { data: customersData },
    { data: profile },
  ] = await Promise.all([
    supabase.from('tvph_documents').select('*').is('archived_at', null),
    supabase.from('vendors').select(`
      id, name, status,
      vendor_documents (id, status, doc_type, file_url, file_name, expiry_date)
    `).is('deleted_at', null).order('name'),
    supabase.from('crm_accounts').select(`
      id, company_name, status,
      crm_documents (id, status, doc_type, label, file_url, file_name, expiry_date)
    `).is('deleted_at', null).order('company_name'),
    user
      ? supabase.from('profiles').select('role').eq('id', user.id).single()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const userRole = profile?.role || 'user';

  // Sign URLs in parallel for company, vendor, and customer documents (see utils/storage).
  const [companyDocs, vendors, customers] = await Promise.all([
    signDocUrls(supabase, 'tvph-documents', rawCompanyDocs),
    Promise.all(
      (vendorsData || []).map(async (vendor) => ({
        ...vendor,
        vendor_documents: await signDocUrls(
          supabase,
          'vendor-documents',
          vendor.vendor_documents,
        ),
      })),
    ),
    Promise.all(
      (customersData || []).map(async (customer) => ({
        ...customer,
        crm_documents: await signDocUrls(
          supabase,
          'crm-documents',
          customer.crm_documents,
        ),
      })),
    ),
  ]);

  return (
    <DocumentsClient
      companyDocs={companyDocs}
      vendors={vendors}
      customers={customers}
      userRole={userRole}
      searchQuery={searchQuery}
    />
  );
}

function DocumentsSkeleton() {
  return (
    <div className="p-6 lg:p-8 space-y-8 animate-pulse">
      <div className="h-10 w-64 bg-slate-100 dark:bg-slate-800/50 rounded-lg" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-48 rounded-2xl bg-slate-100 dark:bg-slate-800/50" />
        ))}
      </div>
    </div>
  );
}
