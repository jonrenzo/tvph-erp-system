'use server'

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';

export async function createContract(prevState: any, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const vendor_id = formData.get('vendor_id') as string;
  const contract_number = formData.get('contract_number') as string;
  const title = formData.get('title') as string;
  const start_date = formData.get('start_date') as string;
  const end_date = formData.get('end_date') as string;
  const total_value = formData.get('total_value') as string;
  const file = formData.get('file') as File;

  if (!vendor_id || !contract_number || !title || !start_date) {
    return { error: 'Missing required fields.' };
  }

  let file_url = null;
  let file_name = null;

  if (file && file.size > 0) {
    const fileExt = file.name.split('.').pop();
    const filePath = `${vendor_id}/${Math.random()}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('vendor-documents') // Reuse existing bucket or create new
      .upload(filePath, file);

    if (uploadError) return { error: uploadError.message };

    const { data: { publicUrl } } = supabase.storage
      .from('vendor-documents')
      .getPublicUrl(filePath);
      
    file_url = publicUrl;
    file_name = file.name;
  }

  const { error } = await supabase.from('vendor_contracts').insert({
    vendor_id,
    contract_number,
    title,
    start_date,
    end_date: end_date || null,
    total_value: total_value ? parseFloat(total_value) : null,
    file_url,
    file_name,
    created_by: user.id
  });

  if (error) return { error: error.message };

  revalidatePath('/dashboard/vendors/contracts');
  revalidatePath(`/dashboard/vendors/${vendor_id}`);
  return { success: true };
}

export async function updateContractStatus(id: string, status: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('vendor_contracts')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return { error: error.message };

  revalidatePath('/dashboard/vendors/contracts');
  return { success: true };
}
