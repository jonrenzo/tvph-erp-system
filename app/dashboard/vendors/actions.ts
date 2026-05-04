'use server'

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { createNotification } from '@/utils/notifications';

export async function updateVendorStatus(vendorId: string, status: 'active' | 'inactive') {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { error } = await supabase
    .from('vendors')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', vendorId);

  if (error) return { error: error.message };

  await supabase.from('audit_logs').insert({
    entity_type: 'vendor',
    entity_id: vendorId,
    action: 'UPDATE',
    changes: { after: { status } },
    performed_by: user.id
  });

  revalidatePath(`/dashboard/vendors/${vendorId}`);
  return { success: true };
}

export async function uploadDocument(vendorId: string, docType: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const file = formData.get('file') as File;
  const expiryDate = formData.get('expiryDate') as string;
  const notes = formData.get('notes') as string;

  if (!file) return { error: 'No file provided' };

  const fileExt = file.name.split('.').pop();
  const fileName = `${docType}_${Date.now()}.${fileExt}`;
  const filePath = `vendors/${vendorId}/${docType}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('vendor-documents')
    .upload(filePath, file);

  if (uploadError) return { error: uploadError.message };

  const { data: { publicUrl } } = supabase.storage
    .from('vendor-documents')
    .getPublicUrl(filePath);

  const { error: dbError } = await supabase
    .from('vendor_documents')
    .upsert({
      vendor_id: vendorId,
      doc_type: docType,
      file_url: publicUrl,
      file_name: file.name,
      status: 'submitted',
      expiry_date: expiryDate || null,
      notes: notes || null,
      submitted_at: new Date().toISOString(),
      uploaded_by: user.id,
      updated_at: new Date().toISOString()
    }, { onConflict: 'vendor_id,doc_type' });

  if (dbError) return { error: dbError.message };

  await supabase.from('audit_logs').insert({
    entity_type: 'vendor_document',
    entity_id: vendorId,
    action: 'UPDATE',
    changes: { after: { doc_type: docType, status: 'submitted' } },
    performed_by: user.id
  });

  await createNotification({
    type: 'vendor',
    title: '📁 Vendor Document Added',
    message: `A document was uploaded for a vendor.`,
    link: `/dashboard/vendors/${vendorId}`,
    created_by: user.id
  });

  revalidatePath(`/dashboard/vendors/${vendorId}`);
  return { success: true };
}


export async function createVendor(prevState: any, formData: FormData) {
  const supabase = await createClient();
  
  // Get the current user
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { error: 'You must be logged in to create a vendor.' };
  }

  const name = formData.get('name') as string;
  const address = formData.get('address') as string;
  const tin = formData.get('tin') as string;
  const contact_person = formData.get('contact_person') as string;
  const contact_email = formData.get('contact_email') as string;
  const contact_phone = formData.get('contact_phone') as string;
  const bank_name = formData.get('bank_name') as string;
  const bank_account_number = formData.get('bank_account_number') as string;
  const bank_account_name = formData.get('bank_account_name') as string;
  const payment_terms = formData.get('payment_terms') as string;
  const notes = formData.get('notes') as string;

  if (!name || name.trim() === '') {
    return { error: 'Vendor name is required.' };
  }

  const { data: newVendor, error } = await supabase.from('vendors').insert({
    name,
    address,
    tin,
    contact_person,
    contact_email,
    contact_phone,
    bank_name,
    bank_account_number,
    bank_account_name,
    payment_terms,
    notes,
    created_by: user.id,
    status: 'pending' // Default status per spec
  }).select('id').single();

  if (error) {
    console.error('Error creating vendor:', error);
    return { error: error.message || 'Failed to create vendor.' };
  }

  // Basic Audit log
  await supabase.from('audit_logs').insert({
    entity_type: 'vendor',
    entity_id: newVendor.id,
    action: 'CREATE',
    changes: { after: { name, tin, contact_person, status: 'pending' } },
    performed_by: user.id
  });

  revalidatePath('/dashboard/vendors');
  redirect(`/dashboard/vendors/${newVendor.id}`);
}
