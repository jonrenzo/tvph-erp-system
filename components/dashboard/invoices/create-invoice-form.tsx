"use client";

import { useState, useActionState } from "react";
import { Save, Building2, Calendar, FileText, Upload, Link as LinkIcon } from "lucide-react";
import { createInvoice } from "@/app/dashboard/invoices/actions";

interface Vendor {
  id: string;
  name: string;
}

interface PO {
  id: string;
  po_number: string;
  vendor_id: string;
  amount: number;
}

export function CreateInvoiceForm({ vendors, pos }: { vendors: Vendor[], pos: PO[] }) {
  const [state, formAction, isPending] = useActionState(createInvoice, null);
  const [selectedVendor, setSelectedVendor] = useState("");
  
  // Filter POs based on selected vendor
  const filteredPOs = pos.filter(po => po.vendor_id === selectedVendor);

  return (
    <form action={formAction} className="space-y-6">
      {state?.error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-sm font-medium">
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Basic Info */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center gap-3">
              <FileText className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-slate-900 dark:text-white">Billing Details</h2>
            </div>
            
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2 sm:col-span-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Vendor <span className="text-red-500">*</span>
                </label>
                <select
                  name="vendor_id"
                  required
                  value={selectedVendor}
                  onChange={(e) => setSelectedVendor(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary appearance-none"
                >
                  <option value="">Select vendor</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Invoice Number <span className="text-red-500">*</span>
                </label>
                <input
                  name="invoice_number"
                  type="text"
                  required
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="INV-001"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Amount (PHP) <span className="text-red-500">*</span>
                </label>
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  required
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Invoice Date <span className="text-red-500">*</span>
                </label>
                <input
                  name="invoice_date"
                  type="date"
                  required
                  defaultValue={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Due Date
                </label>
                <input
                  name="due_date"
                  type="date"
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Internal Notes</label>
            <textarea
              name="notes"
              rows={3}
              className="w-full mt-2 px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
              placeholder="Any additional payment instructions..."
            ></textarea>
          </div>
        </div>

        {/* Right Column: Linking & Upload */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center gap-3">
              <LinkIcon className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-slate-900 dark:text-white">Link PO</h2>
            </div>
            <div className="p-6">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Related Purchase Order</label>
              <select
                name="po_id"
                disabled={!selectedVendor}
                className="w-full mt-2 px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
              >
                <option value="">No PO Linked</option>
                {filteredPOs.map((po) => (
                  <option key={po.id} value={po.id}>{po.po_number} (₱{po.amount.toLocaleString()})</option>
                ))}
              </select>
              {!selectedVendor && (
                <p className="mt-2 text-[10px] text-slate-500 italic">Select a vendor first to see available POs.</p>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center gap-3">
              <Upload className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-slate-900 dark:text-white">Attachment</h2>
            </div>
            <div className="p-6">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Invoice Scan (PDF/IMG)</label>
              <input
                name="file"
                type="file"
                className="mt-2 text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
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
          Record Invoice
        </button>
      </div>
    </form>
  );
}
