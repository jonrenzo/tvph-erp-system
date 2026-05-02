import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { DocumentsClient } from '@/components/dashboard/documents/documents-client';

export default async function DocumentsPage(props: { 
  searchParams: Promise<{ [key: string]: string | string[] | undefined }> 
}) {
  const searchParams = await props.searchParams;
  const searchQuery = (searchParams.search as string) || "";
  
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const userRole = profile?.role || 'user';

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
