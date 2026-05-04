'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';

export async function fetchNotifications() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }
  return data;
}

export async function markAllAsRead() {
  const supabase = await createClient();
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('is_read', false);

  if (error) {
    console.error('Error marking notifications as read:', error);
    return { success: false };
  }

  revalidatePath('/dashboard');
  return { success: true };
}

export async function deleteNotification(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting notification:', error);
    return { success: false, error: error.message };
  }

  // Realtime will broadcast the DELETE event so we don't necessarily need to revalidatePath,
  // but it's good practice for non-realtime clients.
  revalidatePath('/dashboard');
  return { success: true };
}
