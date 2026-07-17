import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export type NotificationType = 'po' | 'invoice' | 'payment' | 'document' | 'vendor' | 'hr' | 'crm' | 'payment_request';

export async function createNotification({
  type, title, message, link, created_by
}: {
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  created_by: string;
}) {
  try {
    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabaseAdmin.from('notifications').insert({ type, title, message, link, created_by });
    if (error) {
      console.error('Supabase insert error for notification:', error);
    }
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
}
