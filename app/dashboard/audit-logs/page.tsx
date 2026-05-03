import { createClient } from '@/utils/supabase/server';
import { Activity } from 'lucide-react';
import { AuditLogToolbar } from '@/components/dashboard/audit-logs/audit-log-toolbar';
import { Suspense } from 'react';

export const unstable_instant = { 
  prefetch: 'static',
  samples: [{ searchParams: { action: null, entity: null } }]
};

export default function AuditLogsPage(props: { searchParams?: Promise<{ [key: string]: string | string[] | undefined }> }) {
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Suspense fallback={<AuditLogsSkeleton />}>
        <AuditLogsContent searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function AuditLogsContent({ searchParams: searchParamsPromise }: { searchParams?: Promise<any> }) {
  const searchParams = await searchParamsPromise;
  const supabase = await createClient();

  const actionFilter = searchParams?.action as string;
  const entityFilter = searchParams?.entity as string;

  // Simple query for logs
  let query = supabase
    .from('audit_logs')
    .select(`
      *,
      profiles:performed_by (full_name, email)
    `);

  if (actionFilter) query = query.eq('action', actionFilter);
  if (entityFilter) query = query.eq('entity_type', entityFilter);

  const { data: logs } = await query
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <>
      {/* Header & Filters */}
      <AuditLogToolbar logs={logs || []} />

      {/* Main Logs Table */}
      <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] text-slate-500 uppercase bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4 font-semibold">Event Time</th>
                <th className="px-6 py-4 font-semibold">Actor</th>
                <th className="px-6 py-4 font-semibold">Action</th>
                <th className="px-6 py-4 font-semibold">Entity</th>
                <th className="px-6 py-4 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {!logs || logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                    No audit logs found.
                  </td>
                </tr>
              ) : (
                logs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-800/10 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-slate-900 dark:text-white font-medium">
                        {new Date(log.created_at).toLocaleDateString()}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(log.created_at).toLocaleTimeString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold">
                           {log.profiles?.full_name?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <div className="text-slate-900 dark:text-white font-medium text-xs leading-none">
                            {log.profiles?.full_name || 'System'}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1">
                            {log.profiles?.email || 'N/A'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        log.action === 'CREATE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400' :
                        log.action === 'UPDATE' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400' :
                        'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        <Activity className="h-3.5 w-3.5 text-slate-400" />
                        <span className="capitalize text-xs font-medium">{log.entity_type.replace('_', ' ')}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                        ID: {log.entity_id.split('-')[0]}...
                      </div>
                    </td>
                    <td className="px-6 py-4 max-w-xs">
                      <div className="text-[10px] text-slate-500 line-clamp-2 italic">
                        {JSON.stringify(log.changes?.after || log.changes)}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function AuditLogsSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="h-10 w-64 bg-slate-100 dark:bg-slate-800/50 rounded-lg" />
      <div className="h-96 rounded-2xl bg-slate-100 dark:bg-slate-800/50" />
    </div>
  );
}
