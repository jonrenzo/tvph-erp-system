"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { X, History, Loader2 } from "lucide-react";

const ROUTE_ENTITY_MAP: Record<string, string[]> = {
  vendors: ["vendor", "vendor_document", "vendor_contract"],
  "purchase-orders": ["purchase_order"],
  invoices: ["service_invoice"],
  hr: ["employee", "employee_document", "USER_INVITATION"],
  documents: ["tvph_document"],
  payments: ["payment"],
  crm: ["crm_account", "crm_opportunity", "crm_activity", "crm_document"],
  projects: ["project"],
  assets: ["asset", "asset_maintenance_log"],
  accounting: ["service_invoice", "payment", "purchase_order"],
  compliance: ["vendor_document", "tvph_document"],
  settings: ["system_settings", "profile"],
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-emerald-500",
  UPDATE: "bg-blue-500",
  DELETE: "bg-red-500",
};

const PAGE_SIZE = 15;

interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  changes: any;
  created_at: string;
  profiles: { full_name: string; email: string } | null;
}

function formatSummary(log: AuditLog) {
  if (log.action === "CREATE") return `Created ${log.entity_type.replace(/_/g, " ")}`;
  if (log.action === "DELETE") return `Deleted ${log.entity_type.replace(/_/g, " ")}`;
  const changes = log.changes?.after || {};
  const changedFields = Object.keys(changes).filter((k) => k !== "updated_at" && k !== "id");
  if (changedFields.length === 1) return `Updated ${changedFields[0].replace(/_/g, " ")}`;
  if (changedFields.length > 1) return `Updated ${changedFields.length} fields`;
  return `Modified ${log.entity_type.replace(/_/g, " ")}`;
}

function formatTimeAgo(dateString: string) {
  const diff = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(dateString).toLocaleDateString([], { month: "short", day: "numeric" });
}

interface AuditLogDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuditLogDrawer({ isOpen, onClose }: AuditLogDrawerProps) {
  const pathname = usePathname();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const segment = pathname.split("/")[2];
  const entityTypes = segment ? ROUTE_ENTITY_MAP[segment] : null;
  const isContextual = Boolean(entityTypes);
  const label = segment ? segment.replace(/-/g, " ") + " logs" : "recent activity";

  const buildUrl = useCallback(
    (o: number) => {
      const base = `/api/audit-logs/recent?limit=${PAGE_SIZE}&offset=${o}`;
      return isContextual ? `${base}&entityTypes=${entityTypes!.join(",")}` : base;
    },
    [entityTypes, isContextual],
  );

  // Load on open or route change
  useEffect(() => {
    if (!isOpen) return;
    setLogs([]);
    setOffset(0);
    setHasMore(true);
    setLoading(true);
    fetch(buildUrl(0))
      .then((r) => r.json())
      .then((data: AuditLog[]) => {
        if (Array.isArray(data)) {
          setLogs(data);
          if (data.length < PAGE_SIZE) setHasMore(false);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isOpen, pathname, buildUrl]);

  // Infinite scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !isOpen) return;
    const handleScroll = () => {
      if (loadingMore || !hasMore) return;
      if ((el.scrollTop + el.clientHeight) / el.scrollHeight >= 0.8) {
        const next = offset + PAGE_SIZE;
        setLoadingMore(true);
        fetch(buildUrl(next))
          .then((r) => r.json())
          .then((data: AuditLog[]) => {
            if (Array.isArray(data) && data.length > 0) {
              setLogs((prev) => [...prev, ...data]);
              setOffset(next);
              if (data.length < PAGE_SIZE) setHasMore(false);
            } else {
              setHasMore(false);
            }
          })
          .catch(console.error)
          .finally(() => setLoadingMore(false));
      }
    };
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, [isOpen, offset, loadingMore, hasMore, buildUrl]);

  // Lock body scroll and handle Escape
  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "unset";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "unset";
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose]);

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-[110] bg-black/30 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 right-0 z-[120] w-full max-w-sm bg-white dark:bg-[#071F15] shadow-2xl border-l border-slate-200 dark:border-slate-800 transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white capitalize">{label}</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Log list */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/50">
            {loading ? (
              <div className="flex items-center justify-center h-32 gap-2 text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs">Loading…</span>
              </div>
            ) : logs.length === 0 ? (
              <p className="text-sm text-slate-400 italic text-center py-12">No recent activity.</p>
            ) : (
              <>
                {logs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-slate-50/60 dark:hover:bg-slate-800/20 transition-colors">
                    <div className={`h-2 w-2 rounded-full shrink-0 mt-1.5 ${ACTION_COLORS[log.action] ?? "bg-slate-400"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 capitalize leading-snug">
                        {formatSummary(log)}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {log.profiles?.full_name?.split(" ")[0] ?? "System"} · {formatTimeAgo(log.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
                {loadingMore && (
                  <div className="flex items-center justify-center py-4 gap-1.5 text-slate-400">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="text-[11px]">Loading more…</span>
                  </div>
                )}
                {!hasMore && logs.length > 0 && (
                  <p className="text-[11px] text-slate-400 text-center py-4">End of log</p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
