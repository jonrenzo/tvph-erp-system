'use server'

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { recordAuditLog } from '@/utils/audit';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function resetPassword(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const newPassword = formData.get('new_password') as string;
  const confirmPassword = formData.get('confirm_password') as string;

  if (!newPassword || newPassword.length < 6) {
    return { error: 'Password must be at least 6 characters' };
  }

  if (newPassword !== confirmPassword) {
    return { error: 'Passwords do not match' };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (updateError) return { error: updateError.message };

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(
    user.id,
    { user_metadata: { ...user.user_metadata, must_change_password: false } }
  );

  if (metadataError) {
    console.error('Failed to clear must_change_password flag:', metadataError);
  }

  await recordAuditLog({
    entity_type: 'user',
    entity_id: user.id,
    action: 'PASSWORD_CHANGE',
    changes: { forced_reset: true },
    performed_by: user.id,
  });

  revalidatePath('/', 'layout');
  return { success: true };
}
