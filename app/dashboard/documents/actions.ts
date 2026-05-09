'use server'

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { createNotification } from '@/utils/notifications';
import { recordAuditLog } from '@/utils/audit';

export async function uploadCompanyDocument(prevState: any, formData: FormData) {
  const supabase = await createClient();

  // 1. Auth & Role Check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized. Please log in.' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return { error: 'Forbidden. Only administrators can upload company documents.' };
  }

  // 2. Extract form data
  const file = formData.get('file') as File;
  const docType = formData.get('doc_type') as string;
  const label = formData.get('label') as string;
  const expiryDate = formData.get('expiry_date') as string;
  const notes = formData.get('notes') as string;

  if (!file || file.size === 0) return { error: 'No file selected. Please choose a file to upload.' };
  if (!docType) return { error: 'Document type is required.' };

  // 3. Build a safe, unique file path
  const fileExt = file.name.split('.').pop();
  const safeFileName = `${docType}_${Date.now()}.${fileExt}`;
  const filePath = `tvph/${docType}/${safeFileName}`;

  // Fallback for Windows machines that sometimes drop the MIME type
  const getMimeType = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return 'application/pdf';
      case 'png': return 'image/png';
      case 'jpg': case 'jpeg': return 'image/jpeg';
      case 'doc': return 'application/msword';
      case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case 'xls': return 'application/vnd.ms-excel';
      case 'xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      default: return 'application/octet-stream';
    }
  };

  const finalMimeType = file.type || getMimeType(file.name);

  // 4. Upload to dedicated tvph-documents bucket
  const { error: uploadError } = await supabase.storage
    .from('tvph-documents')
    .upload(filePath, file, { 
      upsert: false,
      contentType: finalMimeType 
    });

  if (uploadError) {
    console.error('Storage upload error:', uploadError);
    return { error: `Upload failed: ${uploadError.message}` };
  }

  // 5. Get the public URL for storing in DB
  const { data: { publicUrl } } = supabase.storage
    .from('tvph-documents')
    .getPublicUrl(filePath);

  // 6. Insert metadata into tvph_documents table
  const { error: dbError } = await supabase.from('tvph_documents').insert({
    doc_type: docType,
    label: label || null,
    file_url: publicUrl,
    file_name: file.name,
    expiry_date: expiryDate || null,
    notes: notes || null,
    uploaded_by: user.id,
  });

  if (dbError) {
    console.error('DB insert error:', dbError);
    // Best-effort: clean up orphaned file from storage on DB failure
    await supabase.storage.from('tvph-documents').remove([filePath]);
    return { error: `Database error: ${dbError.message}` };
  }

  // 7. Audit log
  await recordAuditLog({
    entity_type: 'tvph_document',
    entity_id: user.id, // No doc ID returned from insert, use user as anchor
    action: 'CREATE',
    changes: { after: { doc_type: docType, label, file_name: file.name } },
    performed_by: user.id,
  });

  await createNotification({
    type: 'document',
    title: '📄 New Document Uploaded',
    message: `${file.name} was added to the Company Library.`,
    link: `/dashboard/documents`,
    created_by: user.id
  });

  // 8. Revalidate the documents page cache
  revalidatePath('/dashboard/documents');
  return { success: true, fileName: file.name };
}

export async function deleteCompanyDocument(docId: string, filePath: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return { error: 'Forbidden. Only administrators can delete company documents.' };
  }

  // Soft-delete by setting archived_at
  const { error } = await supabase
    .from('tvph_documents')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', docId);

  if (error) return { error: error.message };

  // Audit log
  await recordAuditLog({
    entity_type: 'tvph_document',
    entity_id: docId,
    action: 'DELETE',
    changes: { after: { archived_at: new Date().toISOString() } },
    performed_by: user.id
  });

  revalidatePath('/dashboard/documents');
  return { success: true };
}
