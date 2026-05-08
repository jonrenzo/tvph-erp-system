"use client";

import { useEffect, useState } from 'react';
import { Activity, Clock, User, ChevronRight, Loader2 } from 'lucide-react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

interface RecentActivityProps {
  entityId?: string;
  title?: string;
  variant?: 'default' | 'compact';
}

export function RecentActivity({ entityId: propEntityId, title = "Recent Activity", variant = 'default' }: RecentActivityProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  // Automatically detect entity ID from URL if not provided
  // Matches UUID patterns like /vendors/UUID or /purchase-orders/UUID
  const detectedId = pathname.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0];
  const entityId = propEntityId || detectedId;

  useEffect(() => {
    async function fetchLogs() {
      try {
        const url = entityId 
          ? `/api/audit-logs/recent?entityId=${entityId}`
          : '/api/audit-logs/recent';
        const res = await fetch(url);
        const data = await res.json();
        if (Array.isArray(data)) {
          setLogs(data);
        }
      } catch (err) {
        console.error('Failed to fetch audit logs:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchLogs();
  }, [entityId]);

  const formatChangeSummary = (log: any) => {
    if (log.action === 'CREATE') return `Created ${log.entity_type.replace('_', ' ')}`;
    if (log.action === 'DELETE') return `Deleted ${log.entity_type.replace('_', ' ')}`;
    
    // For UPDATE, try to find which fields changed
    const changes = log.changes?.after || {};
    const changedFields = Object.keys(changes).filter(key => key !== 'updated_at' && key !== 'id');
    
    if (changedFields.length === 1) {
      return `Updated ${changedFields[0].replace('_', ' ')}`;
    }
    
    if (changedFields.length > 1) {
      return `Updated ${changedFields.length} fields`;
    }
    
    return `Modified ${log.entity_type.replace('_', ' ')}`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-8 opacity-40">
        <Loader2 className="h-5 w-5 animate-spin text-primary mb-2" />
        <span className="text-[10px] font-bold uppercase tracking-widest">Loading Activity...</span>
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className={`${variant === 'compact' ? '' : 'bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm opacity-60'} space-y-4`}>
        <h3 className={`${variant === 'compact' ? 'text-[10px]' : 'text-sm'} font-semibold text-slate-900 dark:text-white flex items-center gap-2`}>
          <Activity className="h-4 w-4 text-primary" /> {title}
        </h3>
        <p className="text-xs text-slate-500 italic text-center py-4">No recent activity found.</p>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Activity className="h-3 w-3 text-primary" /> System Activity
          </h3>
        </div>
        <div className="space-y-3 px-2">
          {logs.map((log) => (
            <div key={log.id} className="flex gap-2 min-w-0 group">
              <div className={`h-1.5 w-1.5 rounded-full shrink-0 mt-1.5 ${
                log.action === 'CREATE' ? 'bg-emerald-500' :
                log.action === 'UPDATE' ? 'bg-blue-500' :
                'bg-red-500'
              }`} />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-medium text-slate-700 dark:text-slate-300 truncate">
                  {formatChangeSummary(log)}
                </p>
                <p className="text-[9px] text-slate-400 group-hover:text-slate-500 transition-colors">
                  {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {log.profiles?.full_name?.split(' ')[0] || 'System'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" /> {title}
        </h3>
        <Link 
          href="/dashboard/audit-logs" 
          className="text-[10px] font-bold text-slate-400 hover:text-primary transition-colors flex items-center gap-0.5"
        >
          VIEW ALL <ChevronRight className="h-2.5 w-2.5" />
        </Link>
      </div>

      <div className="space-y-6">
        {logs.map((log, idx) => (
          <div key={log.id} className="flex gap-4 relative">
             {/* Timeline Connector */}
             {idx !== logs.length - 1 && (
               <div className="absolute left-[11px] top-7 bottom-[-24px] w-px bg-slate-100 dark:bg-slate-800" />
             )}
             
             {/* Status Dot */}
             <div className="relative z-10">
                <div className={`h-6 w-6 rounded-full flex items-center justify-center border-2 ${
                  log.action === 'CREATE' ? 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800' :
                  log.action === 'UPDATE' ? 'bg-blue-50 border-blue-100 dark:bg-blue-900/20 dark:border-blue-800' :
                  'bg-red-50 border-red-100 dark:bg-red-900/20 dark:border-red-800'
                }`}>
                  <div className={`h-1.5 w-1.5 rounded-full ${
                    log.action === 'CREATE' ? 'bg-emerald-500' :
                    log.action === 'UPDATE' ? 'bg-blue-500' :
                    'bg-red-500'
                  }`} />
                </div>
             </div>
             
             <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {formatChangeSummary(log)}
                  </p>
                  <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="h-3.5 w-3.5 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[8px] font-bold text-slate-500">
                    {log.profiles?.full_name?.charAt(0) || 'S'}
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {log.profiles?.full_name || 'System'}
                  </p>
                  <span className="text-[10px] text-slate-300 dark:text-slate-600">•</span>
                  <p className="text-[10px] text-slate-400">
                    {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}
