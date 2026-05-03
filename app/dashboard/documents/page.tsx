import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { DocumentsClient } from '@/components/dashboard/documents/documents-client';
import { Suspense } from 'react';

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
  const { data: { user } } = await supabase.auth.getUser();
  
  // Rely on middleware for redirect. During build, user is null.
  let userRole = 'user';
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    userRole = profile?.role || 'user';
  }

  // 1. Fetch & Sign Company Documents
  const { data: rawCompanyDocs } = await supabase.from('tvph_documents').select('*').is('archived_at', null);
  const companyDocs = await Promise.all((rawCompanyDocs || []).map(async (doc) => {
    if (doc.file_url?.includes('/public/tvph-documents/')) {
      const path = doc.file_url.split('/public/tvph-documents/')[1];
      const { data } = await supabase.storage.from('tvph-documents').createSignedUrl(path, 3600);
      return { ...doc, file_url: data?.signedUrl || doc.file_url };
    }
    return doc;
  }));

  // 2. Fetch & Sign Vendor Documents
  const { data: vendorsData } = await supabase.from('vendors').select(`
    id, name, status,
    vendor_documents (id, status, doc_type, file_url, file_name, expiry_date)
  `).is('deleted_at', null).order('name');

  const vendors = await Promise.all((vendorsData || []).map(async (vendor) => {
    const docsWithUrls = await Promise.all((vendor.vendor_documents || []).map(async (doc) => {
      if (doc.file_url?.includes('/public/vendor-documents/')) {
        const path = doc.file_url.split('/public/vendor-documents/')[1];
        const { data } = await supabase.storage.from('vendor-documents').createSignedUrl(path, 3600);
        return { ...doc, file_url: data?.signedUrl || doc.file_url };
      }
      return doc;
    }));
    return { ...vendor, vendor_documents: docsWithUrls };
  }));

  return (
    <DocumentsClient 
      companyDocs={companyDocs} 
      vendors={vendors} 
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
