"use client";

import { useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  /** 1-based current page. */
  page: number;
  /** Total number of rows across all pages. */
  totalCount: number;
  pageSize: number;
  paramName?: string;
}

export function Pagination({
  page,
  totalCount,
  pageSize,
  paramName = "page",
}: PaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (totalCount <= pageSize) return null;

  const go = (next: number) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams);
      if (next <= 1) params.delete(paramName);
      else params.set(paramName, String(next));
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

  return (
    <div className="flex items-center justify-between gap-4 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Showing <span className="font-medium text-slate-700 dark:text-slate-300">{from}</span>–
        <span className="font-medium text-slate-700 dark:text-slate-300">{to}</span> of{" "}
        <span className="font-medium text-slate-700 dark:text-slate-300">{totalCount}</span>
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => go(page - 1)}
          disabled={page <= 1 || isPending}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Prev
        </button>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Page {page} of {totalPages}
        </span>
        <button
          onClick={() => go(page + 1)}
          disabled={page >= totalPages || isPending}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

