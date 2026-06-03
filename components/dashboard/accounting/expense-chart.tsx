"use client";

import { useMemo } from "react";

export function ExpenseChart({ data }: { data: Record<string, number> }) {
  const sortedData = useMemo(() => {
    return Object.entries(data)
      .sort((a, b) => b[1] - a[1])
      .map(([category, amount]) => ({
        category: category.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
        amount,
      }));
  }, [data]);

  const total = useMemo(() => sortedData.reduce((acc, curr) => acc + curr.amount, 0), [sortedData]);

  const colors = [
    "bg-indigo-500",
    "bg-rose-500",
    "bg-amber-500",
    "bg-emerald-500",
    "bg-cyan-500",
    "bg-purple-500",
    "bg-slate-500",
  ];

  if (sortedData.length === 0) {
    return (
      <div className="py-12 text-center text-slate-500 dark:text-slate-400">
        No expense data available.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between mb-2">
        <span className="text-sm text-slate-500">Total Expenses</span>
        <span className="text-xl font-bold text-slate-900 dark:text-white">
          ₱{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>
      
      {/* Horizontal Bar Chart */}
      <div className="space-y-3">
        {sortedData.map((item, index) => {
          const percentage = total > 0 ? (item.amount / total) * 100 : 0;
          const colorClass = colors[index % colors.length];
          
          return (
            <div key={item.category} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-300">{item.category}</span>
                <span className="text-slate-500">
                  ₱{item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({percentage.toFixed(1)}%)
                </span>
              </div>
              <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${colorClass} rounded-full transition-all duration-1000 ease-out`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
