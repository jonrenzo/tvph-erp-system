"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Clock, CalendarClock, AlertCircle, FileText, ReceiptText } from "lucide-react";
import { SPRING_DEFAULT, STAGGER_CONTAINER, STAGGER_ITEM, usePrefersReducedMotion } from "./motion";

export type LaneItem = {
  id: string;
  href: string;
  vendorName: string;
  label: string; // PO number or invoice hint
  amount: number;
  dueDate: string;
  days: number;
  type: "invoice" | "po";
  description?: string;
};

function UrgencyBadge({ days }: { days: number }) {
  if (days <= 2) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">
        <AlertCircle className="h-2.5 w-2.5" />
        {days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days}d`}
      </span>
    );
  }
  if (days <= 5) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
        <Clock className="h-2.5 w-2.5" />
        {days}d
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-50 dark:bg-yellow-950/40 text-yellow-600 dark:text-yellow-500 border border-yellow-200 dark:border-yellow-800">
      <CalendarClock className="h-2.5 w-2.5" />
      {days}d
    </span>
  );
}

function urgencyRowClass(days: number) {
  if (days <= 2) return "border-l-4 border-l-red-500 bg-red-50/30 dark:bg-red-950/10";
  if (days <= 5) return "border-l-4 border-l-amber-500 bg-amber-50/30 dark:bg-amber-950/10";
  return "border-l-4 border-l-yellow-400 bg-yellow-50/20 dark:bg-yellow-950/10";
}

export function AttentionLane({ items }: { items: LaneItem[] }) {
  const reduced = usePrefersReducedMotion();
  if (items.length === 0) return null;

  const sorted = [...items].sort((a, b) => a.days - b.days).slice(0, 6);

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30">
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">Needs attention</h2>
            <p className="text-[11px] leading-none text-slate-500 dark:text-slate-400">Due within 14 days, most urgent first</p>
          </div>
        </div>
        <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 rounded-full text-[11px] font-bold bg-slate-900 text-white dark:bg-white dark:text-slate-900">
          {items.length}
        </span>
      </div>

      <div className="px-4 py-2 grid grid-cols-[1fr_auto_auto_auto] gap-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
        <span>Item</span>
        <span className="text-right">Amount</span>
        <span className="text-right">Due</span>
        <span className="text-right">Left</span>
      </div>

      <motion.div
        variants={reduced ? undefined : STAGGER_CONTAINER}
        initial={reduced ? undefined : "hidden"}
        animate={reduced ? undefined : "show"}
        className="divide-y divide-slate-50 dark:divide-white/5"
      >
        {sorted.map((item) => (
          <motion.div key={`${item.type}-${item.id}`} variants={reduced ? undefined : STAGGER_ITEM} transition={reduced ? undefined : SPRING_DEFAULT}>
            <Link
              href={item.href}
              className={`px-4 py-3 grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center text-sm transition-colors hover:bg-slate-50/60 dark:hover:bg-white/5 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-md ${urgencyRowClass(item.days)}`}
            >
              <span className="min-w-0 flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black tracking-widest shrink-0 ${item.type === "po" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                  {item.type === "po" ? <FileText className="h-2.5 w-2.5" /> : <ReceiptText className="h-2.5 w-2.5" />}
                  {item.type === "po" ? "PO" : "INV"}
                </span>
                <span className="truncate flex flex-col leading-tight">
                  <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{item.vendorName}</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{item.label}</span>
                </span>
              </span>
              <span className="text-right font-mono text-xs text-slate-700 dark:text-slate-300 tabular-nums">₱{Number(item.amount).toLocaleString()}</span>
              <span className="text-right text-xs text-slate-500 dark:text-slate-400 tabular-nums">{item.dueDate}</span>
              <UrgencyBadge days={item.days} />
            </Link>
          </motion.div>
        ))}
      </motion.div>

      <div className="px-5 py-3 border-t border-slate-100 dark:border-white/10 flex items-center gap-4">
        <Link href="/dashboard/invoices" className="text-xs font-bold text-primary hover:underline">
          Invoices
        </Link>
        <span className="text-slate-300">·</span>
        <Link href="/dashboard/purchase-orders" className="text-xs font-bold text-primary hover:underline">
          Purchase Orders
        </Link>
      </div>
    </div>
  );
}
