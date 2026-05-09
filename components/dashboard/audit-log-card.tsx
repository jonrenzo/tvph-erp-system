"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { History, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import Link from "next/link";

const ROUTE_ENTITY_MAP: Record<string, string[]> = {
  vendors: ["vendor", "vendor_document"],
  "purchase-orders": ["purchase_order"],
  invoices: ["service_invoice"],
  hr: ["USER_INVITATION"],
  documents: ["tvph_document"],
  payments: ["payment"],
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-emerald-500",
  UPDATE: "bg-blue-500",
  DELETE: "bg-red-500",
};

const PAGE_SIZE = 5;

interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  changes: any;
  created_at: string;
  profiles: { full_name: string; email: string } | null;
}

function formatSummary(log: AuditLog) {
  if (log.action === "CREATE")
    return `Created ${log.entity_type.replace(/_/g, " ")}`;
  if (log.action === "DELETE")
    return `Deleted ${log.entity_type.replace(/_/g, " ")}`;
  const changes = log.changes?.after || {};
  const changedFields = Object.keys(changes).filter(
    (k) => k !== "updated_at" && k !== "id",
  );
  if (changedFields.length === 1)
    return `Updated ${changedFields[0].replace(/_/g, " ")}`;
  if (changedFields.length > 1) return `Updated ${changedFields.length} fields`;
  return `Modified ${log.entity_type.replace(/_/g, " ")}`;
}

function formatTimeAgo(dateString: string) {
  const diff = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(dateString).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

export function AuditLogCard() {
  const pathname = usePathname();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const segment = pathname.split("/")[2];
  const entityTypes = segment ? ROUTE_ENTITY_MAP[segment] : null;
  const isHidden = !segment || segment === "audit-logs" || !entityTypes;

  const buildUrl = useCallback(
    (currentOffset: number) =>
      `/api/audit-logs/recent?entityTypes=${entityTypes!.join(",")}&limit=${PAGE_SIZE}&offset=${currentOffset}`,
    [entityTypes],
  );

  // Initial load — reset everything when route changes
  useEffect(() => {
    if (isHidden) return;
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
  }, [pathname, isHidden]);

  // Scroll handler — load more when ~80% scrolled
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || isMinimized) return;

    const handleScroll = () => {
      if (loadingMore || !hasMore) return;
      const { scrollTop, scrollHeight, clientHeight } = el;
      const scrolledPercent = (scrollTop + clientHeight) / scrollHeight;
      if (scrolledPercent >= 0.8) {
        const nextOffset = offset + PAGE_SIZE;
        setLoadingMore(true);
        fetch(buildUrl(nextOffset))
          .then((r) => r.json())
          .then((data: AuditLog[]) => {
            if (Array.isArray(data) && data.length > 0) {
              setLogs((prev) => [...prev, ...data]);
              setOffset(nextOffset);
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
  }, [offset, loadingMore, hasMore, isMinimized, buildUrl]);

  if (isHidden) return null;

  const sectionLabel = segment.replace(/-/g, " ");

  return (
    <div className="w-[300px] bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-[#0a0a0a]/60">
        <div className="flex items-center gap-2 h-3">
          <History className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 capitalize">
            {sectionLabel} logs
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            {isMinimized ? (
              <ChevronUp className="h-5 w-5" />
            ) : (
              <ChevronDown className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded body — fixed height, scrollable */}
      {!isMinimized && (
        <div
          ref={scrollRef}
          className="h-52 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/50 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700"
        >
          {loading ? (
            <div className="flex items-center justify-center h-full gap-2 opacity-50">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-[10px] font-bold uppercase tracking-widest">
                Loading...
              </span>
            </div>
          ) : logs.length === 0 ? (
            <p className="text-[10px] text-slate-400 italic text-center py-6">
              No recent activity found.
            </p>
          ) : (
            <>
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors"
                >
                  <div
                    className={`h-1.5 w-1.5 rounded-full shrink-0 mt-1.5 ${ACTION_COLORS[log.action] ?? "bg-slate-400"}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 truncate capitalize">
                      {formatSummary(log)}
                    </p>
                    <p className="text-[9px] text-slate-400 mt-0.5">
                      {log.profiles?.full_name?.split(" ")[0] ?? "System"} ·{" "}
                      {formatTimeAgo(log.created_at)}
                    </p>
                  </div>
                </div>
              ))}

              {/* Loading more indicator */}
              {loadingMore && (
                <div className="flex items-center justify-center py-3 gap-1.5 opacity-50">
                  <Loader2 className="h-3 w-3 animate-spin text-primary" />
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                    Loading more...
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Minimized: show only last log */}
      {isMinimized && logs.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5">
          <div
            className={`h-1.5 w-1.5 rounded-full shrink-0 ${ACTION_COLORS[logs[0].action] ?? "bg-slate-400"}`}
          />
          <p className="text-[10px] text-slate-600 dark:text-slate-400 truncate capitalize flex-1">
            {formatSummary(logs[0])}
          </p>
          <span className="text-[9px] text-slate-400 whitespace-nowrap">
            {formatTimeAgo(logs[0].created_at)}
          </span>
        </div>
      )}
    </div>
  );
}
