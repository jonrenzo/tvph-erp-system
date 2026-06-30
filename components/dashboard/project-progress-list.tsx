"use client";

import Link from "next/link";
import type { ProjectProgress } from "@/lib/dashboard/queries";

export function ProjectProgressList({ projects }: { projects: ProjectProgress[] }) {
  return (
    <div className="divide-y divide-slate-50 dark:divide-slate-800/40">
      {projects.slice(0, 8).map((p) => {
        const completionPct = p.completionPct;
        const variance = completionPct - p.billingPct;
        return (
          <Link key={p.id} href={`/dashboard/projects/${p.id}`} className="block px-5 py-3.5 hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[55%]">{p.name}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                variance > 0
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400'
                  : variance < 0
                    ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400'
                    : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
              }`}>
                {variance > 0 ? `+${variance}%` : variance < 0 ? `${variance}%` : 'On track'}
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
              <span>PO Total: ₱{p.committedAmount.toLocaleString()}</span>
              <span className="text-blue-600 dark:text-blue-400 font-bold">Billed {p.billingPct}%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-1">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, p.billingPct)}%` }}></div>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-500 mb-0.5">
              <span>
                ₱{p.paidAmount.toLocaleString()} paid
                {p.totalDpAmount > 0 && <span className="text-slate-400 ml-1">(₱{p.totalDpAmount.toLocaleString()} dp)</span>}
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">Complete {completionPct}%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, completionPct)}%` }}></div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
