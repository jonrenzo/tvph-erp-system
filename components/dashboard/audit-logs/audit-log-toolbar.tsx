"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Filter, Download, X } from "lucide-react";
import { useState } from "react";

export function AuditLogToolbar({ logs }: { logs: any[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/dashboard/audit-logs?${params.toString()}`);
  };

  const exportToCSV = () => {
    if (!logs || logs.length === 0) return;

    const headers = ["Date", "User", "Action", "Entity", "Details"];
    const rows = logs.map((log) => [
      new Date(log.created_at).toLocaleString(),
      log.profiles?.full_name || "System",
      log.action,
      log.entity_type,
      JSON.stringify(log.changes?.after || log.changes).replace(/"/g, '""'),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((val) => `"${val}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `audit_logs_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const currentAction = searchParams.get("action") || "";
  const currentEntity = searchParams.get("entity") || "";

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">
            System Audit Logs
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track every action, change, and update across the TelcoVantage ERP.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm border ${
              isFilterOpen || currentAction || currentEntity
                ? "bg-primary/10 border-primary/20 text-primary"
                : "bg-white dark:bg-[#0a0a0a] border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            <Filter className="h-4 w-4" />
            {currentAction || currentEntity ? "Filtered" : "Filter"}
          </button>
          <button
            onClick={exportToCSV}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-all shadow-sm"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {isFilterOpen && (
        <div className="p-4 bg-slate-50 dark:bg-slate-800/20 border border-slate-200 dark:border-slate-800 rounded-2xl animate-in slide-in-from-top-2 duration-200">
          <div className="flex flex-wrap items-center gap-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Action Type</label>
              <select
                value={currentAction}
                onChange={(e) => updateFilter("action", e.target.value)}
                className="block w-40 px-3 py-2 bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">All Actions</option>
                <option value="CREATE">Create</option>
                <option value="UPDATE">Update</option>
                <option value="DELETE">Delete</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Entity Type</label>
              <select
                value={currentEntity}
                onChange={(e) => updateFilter("entity", e.target.value)}
                className="block w-48 px-3 py-2 bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">All Entities</option>
                <option value="vendor">Vendors</option>
                <option value="purchase_order">Purchase Orders</option>
                <option value="service_invoice">Invoices</option>
                <option value="payment">Payments</option>
                <option value="vendor_document">Accreditation</option>
              </select>
            </div>

            {(currentAction || currentEntity) && (
              <button
                onClick={() => {
                  router.push("/dashboard/audit-logs");
                  setIsFilterOpen(false);
                }}
                className="mt-5 text-[10px] font-bold text-red-500 hover:text-red-600 flex items-center gap-1 uppercase tracking-widest"
              >
                <X className="h-3 w-3" /> Clear Filters
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
