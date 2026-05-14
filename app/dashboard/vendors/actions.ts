'use server'

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { createNotification } from '@/utils/notifications';
import { recordAuditLog } from '@/utils/audit';

export async function approveVendorDocument(vendorId: string, docType: string, expiryDate: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  // Role check — admin only
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    return { error: 'Only admins can approve documents.' };
  }

  if (!expiryDate) {
    return { error: 'An expiry date is required when approving a document.' };
  }

  const { error } = await supabase
    .from('vendor_documents')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      expiry_date: expiryDate,
      uploaded_by: user.id,
      updated_at: new Date().toISOString()
    })
    .eq('vendor_id', vendorId)
    .eq('doc_type', docType)
    .is('archived_at', null);

  if (error) return { error: error.message };

  await recordAuditLog({
    entity_type: 'vendor_document',
    entity_id: vendorId,
    action: 'UPDATE',
    changes: { after: { doc_type: docType, status: 'approved', expiry_date: expiryDate } },
    performed_by: user.id
  });

  revalidatePath(`/dashboard/vendors/${vendorId}`);
  return { success: true };
}

export async function updateVendorStatus(vendorId: string, status: 'active' | 'inactive') {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { error } = await supabase
    .from('vendors')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', vendorId);

  if (error) return { error: error.message };

  await recordAuditLog({
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
    .upload(filePath, file, { contentType: file.type, upsert: false });

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

  await recordAuditLog({
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
  const contact_fax = formData.get('contact_fax') as string;
  const bank_name = formData.get('bank_name') as string;
  const bank_account_number = formData.get('bank_account_number') as string;
  const bank_account_name = formData.get('bank_account_name') as string;
  const payment_terms = formData.get('payment_terms') as string;
  const notes = formData.get('notes') as string;
  const currency = (formData.get('currency') as string) || 'PHP';

  let secondary_contacts = [];
  try {
    secondary_contacts = JSON.parse((formData.get('secondary_contacts') as string) || '[]');
  } catch (e) {
    console.error('Error parsing secondary contacts:', e);
  }

  let secondary_banking = [];
  try {
    secondary_banking = JSON.parse((formData.get('secondary_banking') as string) || '[]');
  } catch (e) {
    console.error('Error parsing secondary banking:', e);
  }

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
    contact_fax,
    bank_name,
    bank_account_number,
    bank_account_name,
    payment_terms,
    notes,
    currency,
    secondary_contacts,
    secondary_banking,
    created_by: user.id,
    status: 'pending'
  }).select('id').single();

  if (error) {
    console.error('Error creating vendor:', error);
    return { error: error.message || 'Failed to create vendor.' };
  }

  // Basic Audit log
  await recordAuditLog({
    entity_type: 'vendor',
    entity_id: newVendor.id,
    action: 'CREATE',
    changes: { after: { name, tin, contact_person, status: 'pending' } },
    performed_by: user.id
  });

  revalidatePath('/dashboard/vendors');
  redirect(`/dashboard/vendors/${newVendor.id}`);
}

export async function updateVendorProfile(prevState: any, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const id = formData.get('id') as string;
  if (!id) return { error: 'Vendor ID is required.' };

  const address = formData.get('address') as string;
  const contact_person = formData.get('contact_person') as string;
  const contact_email = formData.get('contact_email') as string;
  const contact_phone = formData.get('contact_phone') as string;
  const contact_fax = formData.get('contact_fax') as string;
  const bank_name = formData.get('bank_name') as string;
  const bank_account_number = formData.get('bank_account_number') as string;
  const bank_account_name = formData.get('bank_account_name') as string;
  const payment_terms = formData.get('payment_terms') as string;
  const notes = formData.get('notes') as string;
  const currency = (formData.get('currency') as string) || 'PHP';

  let secondary_contacts = [];
  try {
    secondary_contacts = JSON.parse((formData.get('secondary_contacts') as string) || '[]');
  } catch (e) {
    console.error('Error parsing secondary contacts:', e);
  }

  let secondary_banking = [];
  try {
    secondary_banking = JSON.parse((formData.get('secondary_banking') as string) || '[]');
  } catch (e) {
    console.error('Error parsing secondary banking:', e);
  }

  const { error } = await supabase
    .from('vendors')
    .update({
      address,
      contact_person,
      contact_email,
      contact_phone,
      contact_fax,
      bank_name,
      bank_account_number,
      bank_account_name,
      payment_terms,
      notes,
      currency,
      secondary_contacts,
      secondary_banking,
      updated_at: new Date().toISOString()
    })
    .eq('id', id);

  if (error) {
    console.error('Error updating vendor:', error);
    return { error: error.message || 'Failed to update vendor.' };
  }

  await recordAuditLog({
    entity_type: 'vendor',
    entity_id: id,
    action: 'UPDATE',
    changes: { after: { contact_person, secondary_contacts, secondary_banking } },
    performed_by: user.id
  });

  revalidatePath(`/dashboard/vendors/${id}`);
  return { success: true };
}

// Project actions have been moved to app/dashboard/projects/actions.ts
