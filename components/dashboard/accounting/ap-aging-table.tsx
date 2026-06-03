"use client";

import { useMemo } from "react";

interface APAgingData {
  vendorName: string;
  current: number;
  days30: number;
  days60: number;
  days90: number;
  over90: number;
  total: number;
}

export function APAgingTable({ data }: { data: APAgingData[] }) {
  
  const totals = useMemo(() => {
    return data.reduce((acc, curr) => ({
      current: acc.current + curr.current,
      days30: acc.days30 + curr.days30,
      days60: acc.days60 + curr.days60,
      days90: acc.days90 + curr.days90,
      over90: acc.over90 + curr.over90,
      total: acc.total + curr.total,
    }), { current: 0, days30: 0, days60: 0, days90: 0, over90: 0, total: 0 });
  }, [data]);

  const formatCurrency = (val: number) => {
    if (val === 0) return "-";
    return `₱${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (data.length === 0) {
    return (
      <div className="py-12 text-center text-slate-500 dark:text-slate-400">
        No outstanding payables to display.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-800">
          <tr>
            <th className="px-4 py-3 font-semibold">Vendor</th>
            <th className="px-4 py-3 font-semibold text-right text-emerald-600 dark:text-emerald-500">Current</th>
            <th className="px-4 py-3 font-semibold text-right text-blue-600 dark:text-blue-500">1-30 Days</th>
            <th className="px-4 py-3 font-semibold text-right text-amber-600 dark:text-amber-500">31-60 Days</th>
            <th className="px-4 py-3 font-semibold text-right text-orange-600 dark:text-orange-500">61-90 Days</th>
            <th className="px-4 py-3 font-semibold text-right text-rose-600 dark:text-rose-500">&gt; 90 Days</th>
            <th className="px-4 py-3 font-semibold text-right bg-slate-100 dark:bg-slate-800/50">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
          {data.map((row, i) => (
            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
              <td className="px-4 py-3 font-medium text-slate-900 dark:text-white truncate max-w-[150px]" title={row.vendorName}>
                {row.vendorName}
              </td>
              <td className="px-4 py-3 text-right">{formatCurrency(row.current)}</td>
              <td className="px-4 py-3 text-right">{formatCurrency(row.days30)}</td>
              <td className="px-4 py-3 text-right">{formatCurrency(row.days60)}</td>
              <td className="px-4 py-3 text-right">{formatCurrency(row.days90)}</td>
              <td className="px-4 py-3 text-right">{formatCurrency(row.over90)}</td>
              <td className="px-4 py-3 text-right font-bold bg-slate-50/50 dark:bg-slate-800/20">{formatCurrency(row.total)}</td>
            </tr>
          ))}
          {/* Totals Row */}
          <tr className="bg-slate-50 dark:bg-slate-800/40 font-bold border-t-2 border-slate-300 dark:border-slate-700">
            <td className="px-4 py-4 text-slate-900 dark:text-white">TOTALS</td>
            <td className="px-4 py-4 text-right text-emerald-600 dark:text-emerald-500">{formatCurrency(totals.current)}</td>
            <td className="px-4 py-4 text-right text-blue-600 dark:text-blue-500">{formatCurrency(totals.days30)}</td>
            <td className="px-4 py-4 text-right text-amber-600 dark:text-amber-500">{formatCurrency(totals.days60)}</td>
            <td className="px-4 py-4 text-right text-orange-600 dark:text-orange-500">{formatCurrency(totals.days90)}</td>
            <td className="px-4 py-4 text-right text-rose-600 dark:text-rose-500">{formatCurrency(totals.over90)}</td>
            <td className="px-4 py-4 text-right text-slate-900 dark:text-white">{formatCurrency(totals.total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
