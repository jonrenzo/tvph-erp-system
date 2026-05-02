'use server'

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';

export async function updateOrganizationSettings(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

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

  revalidatePath('/dashboard/settings');
  return { success: true };
}

export async function updateFinancialSettings(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

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

  revalidatePath('/dashboard/settings');
  return { success: true };
}

export async function updateUserRole(userId: string, role: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  // Only admins can change roles
  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (adminProfile?.role !== 'admin') {
    return { error: 'Only administrators can manage team roles.' };
  }

  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId);

  if (error) return { error: error.message };

  revalidatePath('/dashboard/settings');
  return { success: true };
}
