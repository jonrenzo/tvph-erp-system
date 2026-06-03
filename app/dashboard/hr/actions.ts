'use server'

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { recordAuditLog } from '@/utils/audit';
import { requireCapability } from '@/lib/auth/permissions';

export async function updateEmployeeProfile(employeeId: string, data: any) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('hr.write', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const { error } = await supabase
    .from('profiles')
    .update(data)
    .eq('id', employeeId);

  if (error) return { error: error.message };

  await recordAuditLog({
    entity_type: 'employee',
    entity_id: employeeId,
    action: 'UPDATE',
    changes: { updated_fields: Object.keys(data) },
    performed_by: user.id
  });

  revalidatePath(`/dashboard/hr/${employeeId}`);
  revalidatePath('/dashboard/hr');
  return { success: true };
}

export async function deleteEmployeeDocument(documentId: string, employeeId: string, fileUrl: string) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('hr.write', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  // Delete from storage
  if (fileUrl) {
    const url = new URL(fileUrl);
    const path = url.pathname.split('/').slice(5).join('/'); // Adjust based on bucket setup
    if (path) {
      await supabase.storage.from('employee-documents').remove([path]);
    }
  }

  const { error } = await supabase
    .from('employee_documents')
    .delete()
    .eq('id', documentId);

  if (error) return { error: error.message };

  await recordAuditLog({
    entity_type: 'employee_document',
    entity_id: documentId,
    action: 'DELETE',
    changes: { removed_from: employeeId },
    performed_by: user.id
  });

  revalidatePath(`/dashboard/hr/${employeeId}`);
  return { success: true };
}
