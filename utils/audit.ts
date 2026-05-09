import { createClient } from '@/utils/supabase/server';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'PASSWORD_RESET';

export interface AuditLogOptions {
  entity_type: string;
  entity_id: string;
  action: AuditAction;
  changes?: Record<string, any>;
  performed_by?: string;
}

/**
 * Standardized function to record an audit log entry.
 * It automatically fetches the current user if performed_by is not provided.
 */
export async function recordAuditLog(options: AuditLogOptions) {
  const supabase = await createClient();
  
  let performerId = options.performed_by;
  
  if (!performerId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      performerId = user.id;
    }
  }

  if (!performerId) {
    console.error('Audit Log Error: No user identified for action', options.action, 'on', options.entity_type);
    return;
  }

  const { error } = await supabase.from('audit_logs').insert({
    entity_type: options.entity_type,
    entity_id: options.entity_id,
    action: options.action,
    changes: options.changes || {},
    performed_by: performerId
  });

  if (error) {
    console.error('Audit Log DB Error:', error);
  }
}
