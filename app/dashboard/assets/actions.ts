'use server'

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { recordAuditLog } from '@/utils/audit';
import { requireCapability } from '@/lib/auth/permissions';

export async function createAsset(data: any) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('asset.write', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  // Generate Asset Tag based on category or default
  const { count } = await supabase.from('assets').select('*', { count: 'exact', head: true });
  const asset_tag = `TVPH-AST-${String((count || 0) + 1).padStart(4, '0')}`;

  const { data: newAsset, error } = await supabase
    .from('assets')
    .insert({
      ...data,
      asset_tag,
      created_by: user.id
    })
    .select()
    .single();

  if (error) return { error: error.message };

  await recordAuditLog({
    entity_type: 'asset',
    entity_id: newAsset.id,
    action: 'CREATE',
    changes: { name: newAsset.name, asset_tag: newAsset.asset_tag },
    performed_by: user.id
  });

  revalidatePath('/dashboard/assets');
  return { success: true, id: newAsset.id };
}

export async function updateAsset(assetId: string, data: any) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('asset.write', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const { error } = await supabase
    .from('assets')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', assetId);

  if (error) return { error: error.message };

  await recordAuditLog({
    entity_type: 'asset',
    entity_id: assetId,
    action: 'UPDATE',
    changes: { updated_fields: Object.keys(data) },
    performed_by: user.id
  });

  revalidatePath(`/dashboard/assets/${assetId}`);
  revalidatePath('/dashboard/assets');
  return { success: true };
}

export async function logMaintenance(assetId: string, data: any) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('asset.write', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const { error } = await supabase
    .from('asset_maintenance_logs')
    .insert({
      ...data,
      asset_id: assetId,
      created_by: user.id
    });

  if (error) return { error: error.message };

  // Optionally update asset status to in_repair if it was maintenance
  if (data.maintenance_type === 'repair') {
    await supabase.from('assets').update({ status: 'in_repair' }).eq('id', assetId);
  }

  await recordAuditLog({
    entity_type: 'asset_maintenance_log',
    entity_id: assetId,
    action: 'CREATE',
    changes: { type: data.maintenance_type, cost: data.cost },
    performed_by: user.id
  });

  revalidatePath(`/dashboard/assets/${assetId}`);
  return { success: true };
}
