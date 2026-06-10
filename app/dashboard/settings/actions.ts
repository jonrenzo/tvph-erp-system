'use server'

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { recordAuditLog } from '@/utils/audit';
import { requireCapability } from '@/lib/auth/permissions';

export async function updateOrganizationSettings(formData: FormData) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('settings.manage', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const company_name = formData.get('company_name') as string;
  const company_address = formData.get('company_address') as string;
  const company_tin = formData.get('company_tin') as string;

  const { error } = await supabase
    .from('system_settings')
    .update({
      company_name,
      company_address,
      company_tin,
      updated_at: new Date().toISOString(),
      updated_by: user.id
    })
    .eq('id', 1);

  if (error) return { error: error.message };

  // Audit log
  await recordAuditLog({
    entity_type: 'system_settings',
    entity_id: '1',
    action: 'UPDATE',
    changes: { after: { company_name, company_address, company_tin } },
    performed_by: user.id
  });

  revalidatePath('/dashboard/settings');
  return { success: true };
}

export async function updateFinancialSettings(formData: FormData) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('settings.manage', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const default_vat_rate = formData.get('default_vat_rate') as string;
  const default_payment_terms = formData.get('default_payment_terms') as string;
  const currency = formData.get('currency') as string;

  const { error } = await supabase
    .from('system_settings')
    .update({
      default_vat_rate: parseFloat(default_vat_rate),
      default_payment_terms,
      currency,
      updated_at: new Date().toISOString(),
      updated_by: user.id
    })
    .eq('id', 1);

  if (error) return { error: error.message };

  // Audit log
  await recordAuditLog({
    entity_type: 'system_settings',
    entity_id: '1',
    action: 'UPDATE',
    changes: { after: { default_vat_rate, currency } },
    performed_by: user.id
  });

  revalidatePath('/dashboard/settings');
  return { success: true };
}

export async function updateReminderSettings(formData: FormData) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('settings.manage', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  // Parse a comma-separated list of positive day offsets, e.g. "30, 14, 7, 1".
  const raw = (formData.get('reminder_days') as string) || '';
  const reminder_days = Array.from(
    new Set(
      raw
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => Number.isInteger(n) && n > 0),
    ),
  ).sort((a, b) => b - a);

  if (reminder_days.length === 0) {
    return { error: 'Enter at least one positive number of days (e.g. 30, 14, 7, 1).' };
  }

  const { error } = await supabase
    .from('email_settings')
    .upsert({
      id: 1,
      reminder_days,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    });

  if (error) return { error: error.message };

  await recordAuditLog({
    entity_type: 'system_settings',
    entity_id: '1',
    action: 'UPDATE',
    changes: { after: { reminder_days } },
    performed_by: user.id,
  });

  revalidatePath('/dashboard/settings');
  return { success: true, reminder_days };
}

export async function updateUserRole(userId: string, role: string) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('user.manage', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId);

  if (error) return { error: error.message };

  // Audit log
  await recordAuditLog({
    entity_type: 'profile',
    entity_id: userId,
    action: 'UPDATE',
    changes: { after: { role } },
    performed_by: user.id
  });

  revalidatePath('/dashboard/settings');
  return { success: true };
}

export async function forcePasswordReset(userId: string) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('user.manage', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: authUser, error: fetchError } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (fetchError || !authUser?.user) return { error: fetchError?.message || 'User not found' };

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
    userId,
    { user_metadata: { ...authUser.user.user_metadata, must_change_password: true } }
  );

  if (updateError) return { error: updateError.message };

  await recordAuditLog({
    entity_type: 'user',
    entity_id: userId,
    action: 'UPDATE',
    changes: { force_password_reset: true },
    performed_by: user.id,
  });

  revalidatePath('/dashboard/settings');
  return { success: true };
}

export async function clearMustChangePassword(userId: string) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('user.manage', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: authUser, error: fetchError } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (fetchError || !authUser?.user) return { error: fetchError?.message || 'User not found' };

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
    userId,
    { user_metadata: { ...authUser.user.user_metadata, must_change_password: false } }
  );

  if (updateError) return { error: updateError.message };

  await recordAuditLog({
    entity_type: 'user',
    entity_id: userId,
    action: 'UPDATE',
    changes: { clear_password_reset: true },
    performed_by: user.id,
  });

  revalidatePath('/dashboard/settings');
  return { success: true };
}

export async function removeTeamMember(userId: string) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('user.manage', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: targetProfile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (!targetProfile) return { error: 'User not found' };

  // Last admin guard
  const { count: adminCount } = await supabaseAdmin
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'admin');

  if (targetProfile.role === 'admin' && adminCount !== null && adminCount <= 1) {
    return { error: 'Cannot remove the last admin. Promote another user to admin first.' };
  }

  // Nullify all FK references pointing to this user
  await Promise.all([
    supabaseAdmin.from('vendors').update({ created_by: null }).eq('created_by', userId),
    supabaseAdmin.from('vendor_documents').update({ uploaded_by: null }).eq('uploaded_by', userId),
    supabaseAdmin.from('tvph_documents').update({ uploaded_by: null }).eq('uploaded_by', userId),
    supabaseAdmin.from('purchase_orders').update({ created_by: null }).eq('created_by', userId),
    supabaseAdmin.from('service_invoices').update({ created_by: null }).eq('created_by', userId),
    supabaseAdmin.from('payments').update({ overridden_by: null }).eq('overridden_by', userId),
    supabaseAdmin.from('payments').update({ recorded_by: null }).eq('recorded_by', userId),
    supabaseAdmin.from('audit_logs').update({ performed_by: null }).eq('performed_by', userId),
    supabaseAdmin.from('projects').update({ created_by: null }).eq('created_by', userId),
    supabaseAdmin.from('vendor_contracts').update({ created_by: null }).eq('created_by', userId),
    supabaseAdmin.from('notifications').update({ created_by: null }).eq('created_by', userId),
  ]);

  // Delete the user from Supabase Auth (cascades to profiles via FK)
  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

  if (deleteError) return { error: deleteError.message };

  await recordAuditLog({
    entity_type: 'user',
    entity_id: userId,
    action: 'DELETE',
    changes: { removed: true },
    performed_by: user.id,
  });

  revalidatePath('/dashboard/settings');
  return { success: true };
}
