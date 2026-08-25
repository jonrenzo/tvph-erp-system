import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export type NotificationType = 'po' | 'pr' | 'invoice' | 'payment' | 'document' | 'vendor' | 'hr' | 'crm' | 'payment_request';

export async function createNotification({
  type, title, message, link, created_by, recipientIds,
}: {
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  created_by?: string | null;
  recipientIds?: string[];
}) {
  const ids = [...new Set((recipientIds ?? []).filter(Boolean))];
  if (ids.length === 0) return;
  try {
    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const rows = ids.map((recipient_id) => ({ type, title, message, link: link ?? null, created_by: created_by ?? null, recipient_id }));
    const { error } = await supabaseAdmin.from('notifications').insert(rows);
    if (error) {
      console.error('Supabase insert error for notification:', error);
    }
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
}

export async function createNotificationForRoles({
  type, title, message, link, created_by, roles,
}: {
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  created_by?: string | null;
  roles: string[];
}) {
  const clean = [...new Set(roles.filter(Boolean))];
  if (clean.length === 0) return;
  try {
    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data, error } = await supabaseAdmin.from('profiles').select('id').in('role', clean);
    if (error) {
      console.error('Failed to resolve roles for notification:', error);
      return;
    }
    const ids = (data ?? []).map((p: { id: string }) => p.id);
    if (ids.length === 0) return;
    await createNotification({ type, title, message, link, created_by, recipientIds: ids });
  } catch (error) {
    console.error('Failed to create role notification:', error);
  }
}
