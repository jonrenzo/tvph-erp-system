'use server'

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { recordAuditLog } from '@/utils/audit';
import { requireCapability } from '@/lib/auth/permissions';

export async function createContract(prevState: any, formData: FormData) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('contract.write', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const vendor_id = formData.get('vendor_id') as string;
  const contract_number = formData.get('contract_number') as string;
  const project_id = formData.get('project_id') as string;
  const start_date = formData.get('start_date') as string;
  const end_date = formData.get('end_date') as string;
  const total_value = formData.get('total_value') as string;
  const file = formData.get('file') as File;

  if (!vendor_id || !contract_number || !project_id || !start_date) {
    return { error: 'Missing required fields.' };
  }

  // Fetch project name to use as title
  const { data: project } = await supabase
    .from('projects')
    .select('name')
    .eq('id', project_id)
    .single();

  const title = project ? project.name : 'Project Contract';

  let file_url = null;
  let file_name = null;

  if (file && file.size > 0) {
    const fileExt = file.name.split('.').pop();
    const filePath = `${vendor_id}/${Math.random()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('vendor-documents')
      .upload(filePath, file, { contentType: file.type, upsert: false });

    if (uploadError) return { error: uploadError.message };

    const { data: { publicUrl } } = supabase.storage
      .from('vendor-documents')
      .getPublicUrl(filePath);

    file_url = publicUrl;
    file_name = file.name;
  }

  const { error } = await supabase.from('vendor_contracts').insert({
    vendor_id,
    project_id,
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

  // Audit log
  await recordAuditLog({
    entity_type: 'vendor_contract',
    entity_id: vendor_id,
    action: 'CREATE',
    changes: { after: { contract_number, title, total_value } },
    performed_by: user.id
  });

  revalidatePath('/dashboard/vendors/contracts');
  revalidatePath(`/dashboard/vendors/${vendor_id}`);
  return { success: true };
}

export async function updateContractStatus(id: string, status: string) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('contract.write', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const { error } = await supabase
    .from('vendor_contracts')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return { error: error.message };

  // Audit log
  await recordAuditLog({
    entity_type: 'vendor_contract',
    entity_id: id,
    action: 'UPDATE',
    changes: { after: { status } },
    performed_by: user.id
  });

  revalidatePath('/dashboard/vendors/contracts');
  return { success: true };
}
