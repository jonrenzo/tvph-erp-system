"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
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
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (totalCount <= pageSize) return null;

  const buildUrl = (next: number) => {
    const params = new URLSearchParams(searchParams);
    if (next <= 1) params.delete(paramName);
    else params.set(paramName, String(next));
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

  const btnBase =
    "inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium transition-colors";

  return (
    <div className="flex items-center justify-between gap-4 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Showing <span className="font-medium text-slate-700 dark:text-slate-300">{from}</span>–
        <span className="font-medium text-slate-700 dark:text-slate-300">{to}</span> of{" "}
        <span className="font-medium text-slate-700 dark:text-slate-300">{totalCount}</span>
      </p>
      <div className="flex items-center gap-2">
        {page <= 1 ? (
          <span className={`${btnBase} text-slate-600 dark:text-slate-300 opacity-40 cursor-not-allowed`}>
            <ChevronLeft className="h-4 w-4" /> Prev
          </span>
        ) : (
          <Link
            href={buildUrl(page - 1)}
            scroll={false}
            className={`${btnBase} text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800`}
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </Link>
        )}
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Page {page} of {totalPages}
        </span>
        {page >= totalPages ? (
          <span className={`${btnBase} text-slate-600 dark:text-slate-300 opacity-40 cursor-not-allowed`}>
            Next <ChevronRight className="h-4 w-4" />
          </span>
        ) : (
          <Link
            href={buildUrl(page + 1)}
            scroll={false}
            className={`${btnBase} text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800`}
          >
            Next <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </div>
  );
}
