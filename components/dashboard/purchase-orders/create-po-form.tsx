"use client";

import { useActionState, useState } from "react";
import { Save, Building2, Calendar, CircleDollarSign, FileText, FolderGit2 } from "lucide-react";
import { createPurchaseOrder } from "@/app/dashboard/purchase-orders/actions";

export function CreatePOForm({ 
  vendors, 
  projects 
}: { 
  vendors: { id: string, name: string }[],
  projects: { id: string, name: string, vendor_id: string }[]
}) {
  const [state, formAction, isPending] = useActionState(createPurchaseOrder, null);
  const [selectedVendor, setSelectedVendor] = useState("");

  const filteredProjects = projects.filter(p => p.vendor_id === selectedVendor);

  return (
    <form action={formAction} className="space-y-6">
      {state?.error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-sm font-medium">
          {state.error}
        </div>
      )}

      <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center gap-3">
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-slate-900 dark:text-white">PO Details</h2>
        </div>
        
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2 md:col-span-2">
            <label htmlFor="vendor_id" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Vendor <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <select
                id="vendor_id"
                name="vendor_id"
                required
                value={selectedVendor}
                onChange={(e) => setSelectedVendor(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all appearance-none"
              >
                <option value="">Select a vendor</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2 md:col-span-2">
            <label htmlFor="project_id" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Project <span className="text-slate-400 font-normal ml-1">(Optional)</span>
            </label>
            <div className="relative">
              <FolderGit2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <select
                id="project_id"
                name="project_id"
                disabled={!selectedVendor}
                className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all appearance-none disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed dark:disabled:bg-[#111] dark:disabled:text-slate-600"
              >
                <option value="">
                  {selectedVendor 
                    ? (filteredProjects.length > 0 ? "Select a project" : "No projects for this vendor") 
                    : "Select a vendor first"}
                </option>
                {filteredProjects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2 md:col-span-2">
            <label htmlFor="description" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Description / Subject
            </label>
            <input
              id="description"
              name="description"
              type="text"
              className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              placeholder="e.g. Server Maintenance for Q3"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="amount" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Total Amount (PHP) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₱</span>
              <input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                required
                className="w-full pl-8 pr-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="issued_date" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Issued Date <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id="issued_date"
                name="issued_date"
                type="date"
                required
                defaultValue={new Date().toISOString().split('T')[0]}
                className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="due_date" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Due Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id="due_date"
                name="due_date"
                type="date"
                className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-4">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="px-6 py-2.5 rounded-xl font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl font-medium transition-all hover:shadow-lg hover:shadow-primary/20 active:scale-95"
        >
          {isPending ? (
            <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Save className="h-5 w-5" />
          )}
          Create PO
        </button>
      </div>
    </form>
  );
}
