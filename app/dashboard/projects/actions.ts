'use server'

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { createServiceRoleClient } from '@/utils/supabase/service';
import { redirect } from 'next/navigation';
import { recordAuditLog } from '@/utils/audit';
import { requireCapability } from '@/lib/auth/permissions';
import { parseFile, buildColumnMap } from '@/utils/import-export';

export async function createProject(prevState: any, formData: FormData) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('project.write', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const name = formData.get('name') as string;
  const description = formData.get('description') as string;
  const account_id = (formData.get('account_id') as string) || null;
  const status = formData.get('status') as string || 'active';
  const contractFile = formData.get('contract_file') as File | null;

  if (!name || name.trim() === '') {
    return { error: 'Project name is required.' };
  }

  const { data: newProject, error } = await supabase.from('projects').insert({
    name,
    description,
    account_id: account_id || null,
    status,
    created_by: user.id,
  }).select('id').single();

  if (error) return { error: error.message };

  if (contractFile && contractFile.size > 0) {
    const ext = contractFile.name.split('.').pop();
    const path = `projects/${newProject.id}/contract.${ext}`;
    const bytes = await contractFile.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from('crm-documents')
      .upload(path, bytes, { contentType: contractFile.type, upsert: true });
    if (!uploadError) {
      const { data: urlData } = supabase.storage.from('crm-documents').getPublicUrl(path);
      await supabase.from('projects').update({
        contract_file_url: urlData.publicUrl,
        contract_file_name: contractFile.name,
      }).eq('id', newProject.id);
    }
  }

  await recordAuditLog({
    entity_type: 'project',
    entity_id: newProject.id,
    action: 'CREATE',
    changes: { after: { name, status, account_id } },
    performed_by: user.id,
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
  const account_id = (formData.get('account_id') as string) || null;
  const status = formData.get('status') as string;

  if (!id || !name) return { error: 'Project ID and Name are required.' };

  const { error } = await supabase
    .from('projects')
    .update({ name, description, account_id: account_id || null, status, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return { error: error.message };

  await recordAuditLog({
    entity_type: 'project',
    entity_id: id,
    action: 'UPDATE',
    changes: { after: { name, status, account_id } },
    performed_by: user.id,
  });

  revalidatePath(`/dashboard/projects/${id}`);
  revalidatePath('/dashboard/projects');
  return { success: true };
}

export async function uploadContractDocument(projectId: string, formData: FormData) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('project.write', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) return { error: 'No file provided.' };

  const ext = file.name.split('.').pop();
  const path = `projects/${projectId}/contract.${ext}`;
  const bytes = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from('crm-documents')
    .upload(path, bytes, { contentType: file.type, upsert: true });

  if (uploadError) return { error: uploadError.message };

  const { data: urlData } = supabase.storage.from('crm-documents').getPublicUrl(path);

  const { error: dbError } = await supabase.from('projects').update({
    contract_file_url: urlData.publicUrl,
    contract_file_name: file.name,
    updated_at: new Date().toISOString(),
  }).eq('id', projectId);

  if (dbError) return { error: dbError.message };

  await recordAuditLog({
    entity_type: 'project',
    entity_id: projectId,
    action: 'UPDATE',
    changes: { after: { contract_file_name: file.name } },
    performed_by: user.id,
  });

  revalidatePath(`/dashboard/projects/${projectId}`);
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

export async function saveCompletionPct(projectId: string, pct: number | null) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('project.write', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const clamped = pct !== null ? Math.min(100, Math.max(0, pct)) : null;

  const { error } = await supabase
    .from('projects')
    .update({ completion_pct: clamped, updated_at: new Date().toISOString() })
    .eq('id', projectId);

  if (error) return { error: error.message };

  await recordAuditLog({
    entity_type: 'project',
    entity_id: projectId,
    action: 'UPDATE',
    changes: { after: { completion_pct: clamped } },
    performed_by: user.id,
  });

  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath('/dashboard/projects');
  revalidatePath('/dashboard');
  return { success: true };
}

const VALID_PROJECT_FIELDS = new Set([
  "name", "description", "status", "account_id",
]);

export async function importProjects(formData: FormData) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('project.write', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const serviceClient = createServiceRoleClient();

  const file = formData.get('file') as File;
  if (!file) return { error: 'No file provided' };

  const buffer = await file.arrayBuffer();
  let rows: Record<string, string>[];
  try {
    rows = parseFile(buffer);
  } catch {
    return { error: 'Failed to parse file. Please ensure it is a valid CSV or Excel file.' };
  }

  if (rows.length === 0) {
    return { error: 'The file appears to be empty.' };
  }

  const fileHeaders = Object.keys(rows[0]);
  const customMappingStr = formData.get('columnMapping') as string | null;
  const columnMap = customMappingStr ? JSON.parse(customMappingStr) as Record<string, string> : buildColumnMap(fileHeaders);
  const unmappedColumns = fileHeaders.filter((h) => !columnMap[h]);

  const validStatuses = ['active', 'completed', 'on_hold', 'cancelled'];

  let created = 0;
  let updated = 0;
  const errors: { row: number; reason: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    try {
      const projectData: Record<string, any> = {};
      for (const [fileCol, dbField] of Object.entries(columnMap)) {
        if (VALID_PROJECT_FIELDS.has(dbField)) {
          const val = row[fileCol];
          projectData[dbField] = val !== undefined && val !== null ? String(val).trim() : null;
        }
      }

      const projectName = projectData.name;
      if (!projectName) {
        errors.push({ row: i + 2, reason: 'Missing project name.' });
        continue;
      }

      if (projectData.status && !validStatuses.includes(projectData.status.toLowerCase())) {
        projectData.status = 'active';
      }

      const { data: existingProject } = await serviceClient
        .from('projects')
        .select('id')
        .ilike('name', projectName)
        .is('deleted_at', null)
        .maybeSingle();

      if (existingProject) {
        const updateFields: Record<string, any> = { updated_at: new Date().toISOString() };
        for (const [k, v] of Object.entries(projectData)) {
          if (k !== 'name') updateFields[k] = v;
        }
        const { error: updateErr } = await serviceClient
          .from('projects')
          .update(updateFields)
          .eq('id', existingProject.id);
        if (updateErr) {
          errors.push({ row: i + 2, reason: updateErr.message });
          continue;
        }
        updated++;
      } else {
        const { error: insertErr } = await serviceClient
          .from('projects')
          .insert({ ...projectData, status: projectData.status || 'active', created_by: user.id });
        if (insertErr) {
          errors.push({ row: i + 2, reason: insertErr.message });
          continue;
        }
        created++;
      }
    } catch (err: any) {
      errors.push({ row: i + 2, reason: err.message || 'Unexpected error' });
    }
  }

  await recordAuditLog({
    entity_type: 'project',
    entity_id: 'bulk',
    action: 'CREATE',
    changes: { after: { import_summary: { created, updated, errors: errors.length } } },
    performed_by: user.id,
  });

  revalidatePath('/dashboard/projects');
  return { created, updated, errors, columnMapping: columnMap, unmappedColumns, totalRows: rows.length };
}
