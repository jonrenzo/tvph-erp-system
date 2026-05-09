'use server'

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { recordAuditLog } from '@/utils/audit';

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const full_name = formData.get('full_name') as string;

  const { error } = await supabase
    .from('profiles')
    .update({ full_name })
    .eq('id', user.id);

  if (error) return { error: error.message };

  // Audit log
  await recordAuditLog({
    entity_type: 'profile',
    entity_id: user.id,
    action: 'UPDATE',
    changes: { after: { full_name } },
    performed_by: user.id
  });

  revalidatePath('/dashboard/profile');
  return { success: true };
}

export async function updateAvatar(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const file = formData.get('file') as File;
  if (!file) return { error: 'No file provided' };

  const fileExt = file.name.split('.').pop();
  const fileName = `${user.id}-${Math.random()}.${fileExt}`;
  const filePath = `${fileName}`;

  // 1. Upload to Storage
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, { contentType: file.type, upsert: true });

  if (uploadError) return { error: uploadError.message };

  // 2. Get Public URL
  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath);

  // 3. Update Profile
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', user.id);

  if (updateError) return { error: updateError.message };

  // Audit log
  await recordAuditLog({
    entity_type: 'profile',
    entity_id: user.id,
    action: 'UPDATE',
    changes: { after: { avatar_url: publicUrl } },
    performed_by: user.id
  });

  revalidatePath('/dashboard/profile');
  return { success: true, url: publicUrl };
}

export async function requestPasswordReset() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) return { error: 'Unauthorized' };

  const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback?next=/dashboard/profile`,
  });

  if (error) return { error: error.message };

  // Audit log
  await recordAuditLog({
    entity_type: 'user',
    entity_id: user.id,
    action: 'PASSWORD_RESET',
    changes: { email: user.email },
    performed_by: user.id
  });

  return { success: true };
}
