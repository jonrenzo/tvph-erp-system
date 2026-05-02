"use client";

import { useState, useActionState, useEffect } from "react";
import { Plus, FileText, Calendar, CircleDollarSign, X, Building2, Upload } from "lucide-react";
import { createContract } from "@/app/dashboard/vendors/contracts/actions";
import { useRouter } from "next/navigation";

export function CreateContractModal({ vendors }: { vendors: any[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createContract, null);
  const router = useRouter();

  // Close modal on success
  useEffect(() => {
    if (state?.success) {
      setIsOpen(false);
      router.refresh();
    }
  }, [state, router]);

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-primary/20 active:scale-95"
      >
        <Plus className="h-4 w-4" />
        New Contract
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-[#0a0a0a]/50">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" /> New Legal Agreement
              </h3>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form action={formAction} className="p-6 space-y-4">
              {state?.error && (
                <div className="p-3 text-xs font-medium text-red-600 bg-red-50 rounded-lg border border-red-100">
                  {state.error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Select Vendor</label>
                  <select 
                    name="vendor_id"
                    required
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-primary"
                  >
                    <option value="">Choose a vendor...</option>
                    {vendors.map(vendor => (
                      <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Contract Number</label>
                  <input 
                    name="contract_number"
                    type="text"
                    required
                    placeholder="e.g. TVPH-2024-MSA-001"
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Agreement Title</label>
                <input 
                  name="title"
                  type="text"
                  required
                  placeholder="e.g. Master Service Agreement for Site Maintenance"
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Start Date</label>
                  <input 
                    name="start_date"
                    type="date"
                    required
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">End Date (Optional)</label>
                  <input 
                    name="end_date"
                    type="date"
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Value (PHP)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₱</span>
                  <input 
                    name="total_value"
                    type="number"
                    step="0.01"
                    className="w-full pl-8 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Upload Signed PDF</label>
                <div className="relative border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col items-center gap-2 hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                  <Upload className="h-6 w-6 text-slate-400" />
                  <span className="text-xs text-slate-500">Select the official signed agreement</span>
                  <input 
                    name="file"
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isPending}
                  className="flex-1 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                >
                  {isPending ? <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Store Agreement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
