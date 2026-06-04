import { createClient } from '@/utils/supabase/server';
import { requireCapability } from '@/lib/auth/permissions';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const entityId = searchParams.get('entityId');
  const entityTypes = searchParams.get('entityTypes'); // comma-separated e.g. "vendor,vendor_document"
  const limit = parseInt(searchParams.get('limit') || '5');
  const offset = parseInt(searchParams.get('offset') || '0');

  const supabase = await createClient();

  const { error: authError } = await requireCapability('audit.read', supabase);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: authError === 'Unauthorized' ? 401 : 403 });
  }

  let query = supabase
    .from('audit_logs')
    .select(`
      id, 
      action, 
      entity_type, 
      changes, 
      created_at,
      profiles:performed_by (full_name, email)
    `)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (entityId) {
    query = query.eq('entity_id', entityId);
  }

  if (entityTypes) {
    const types = entityTypes.split(',').map(t => t.trim()).filter(Boolean);
    if (types.length > 0) {
      query = query.in('entity_type', types);
    }
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

