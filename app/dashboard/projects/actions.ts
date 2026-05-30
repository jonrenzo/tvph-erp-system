'use server'

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { recordAuditLog } from '@/utils/audit';
import { requireCapability } from '@/lib/auth/permissions';

export async function createProject(prevState: any, formData: FormData) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('project.write', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const name = formData.get('name') as string;
  const description = formData.get('description') as string;
  const contract_url = formData.get('contract_url') as string;
  const status = formData.get('status') as string || 'active';

  if (!name || name.trim() === '') {
    return { error: 'Project name is required.' };
  }

  const { data: newProject, error } = await supabase.from('projects').insert({
    name,
    description,
    contract_url,
    status,
    created_by: user.id
  }).select('id').single();

  if (error) {
    return { error: error.message };
  }

  await recordAuditLog({
    entity_type: 'project',
    entity_id: newProject.id,
    action: 'CREATE',
    changes: { after: { name, status } },
    performed_by: user.id
  });

  revalidatePath('/dashboard/projects');
  redirect(`/dashboard/projects/${newProject.id}`);
}

export async function updateProject(prevState: any, formData: FormData) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('project.write', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const id = formData.get('id') as string;
  const name = formData.get('name') as string;
  const description = formData.get('description') as string;
  const contract_url = formData.get('contract_url') as string;
  const status = formData.get('status') as string;

  if (!id || !name) {
    return { error: 'Project ID and Name are required.' };
  }

  const { error } = await supabase
    .from('projects')
    .update({
      name,
      description,
      contract_url,
      status,
      updated_at: new Date().toISOString()
    })
    .eq('id', id);

  if (error) {
    return { error: error.message };
  }

  await recordAuditLog({
    entity_type: 'project',
    entity_id: id,
    action: 'UPDATE',
    changes: { after: { name, status, contract_url } },
    performed_by: user.id
  });

  revalidatePath(`/dashboard/projects/${id}`);
  revalidatePath('/dashboard/projects');
  return { success: true };
}

export async function linkVendorToProject(projectId: string, vendorId: string) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('project.write', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const { error } = await supabase.from('project_vendors').insert({
    project_id: projectId,
    vendor_id: vendorId
  });

  if (error) {
    if (error.code === '23505') {
      return { error: 'This vendor is already linked to this project.' };
    }
    return { error: error.message };
  }

  await recordAuditLog({
    entity_type: 'project',
    entity_id: projectId,
    action: 'UPDATE',
    changes: { after: { linked_vendor: vendorId } },
    performed_by: user.id
  });

  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true };
}

export async function removeVendorFromProject(projectId: string, vendorId: string) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('project.write', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  // Safety check 1: Open POs for this vendor on this project
  const { data: openPOs } = await supabase
    .from('purchase_orders')
    .select('id')
    .eq('vendor_id', vendorId)
    .eq('project_id', projectId)
    .not('status', 'in', '("paid","cancelled")')
    .is('deleted_at', null);

  if (openPOs && openPOs.length > 0) {
    return { error: `Cannot remove: this vendor has ${openPOs.length} open PO(s) on this project. Close or cancel them first.` };
  }

  // Safety check 2: Unpaid invoices linked to POs in this project for this vendor
  const { data: projectPOs } = await supabase
    .from('purchase_orders')
    .select('id')
    .eq('vendor_id', vendorId)
    .eq('project_id', projectId)
    .is('deleted_at', null);

  if (projectPOs && projectPOs.length > 0) {
    const poIds = projectPOs.map(po => po.id);
    const { data: unpaidInvoices } = await supabase
      .from('service_invoices')
      .select('id')
      .in('po_id', poIds)
      .not('status', 'in', '("paid","cancelled")')
      .is('deleted_at', null);

    if (unpaidInvoices && unpaidInvoices.length > 0) {
      return { error: `Cannot remove: this vendor has ${unpaidInvoices.length} unpaid invoice(s) linked to this project.` };
    }
  }

  // All clear — remove the link
  const { error } = await supabase
    .from('project_vendors')
    .delete()
    .eq('project_id', projectId)
    .eq('vendor_id', vendorId);

  if (error) return { error: error.message };

  await recordAuditLog({
    entity_type: 'project',
    entity_id: projectId,
    action: 'UPDATE',
    changes: { after: { removed_vendor: vendorId } },
    performed_by: user.id
  });

  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true };
}
