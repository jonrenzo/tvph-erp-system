"use client";

import { useState, useActionState, useEffect } from "react";
import { Paperclip, X, AlertTriangle } from "lucide-react";
import { attachPaymentDocument } from "@/app/dashboard/invoices/actions";
import { useRouter } from "next/navigation";

export function AttachPaymentDocModal({ paymentId }: { paymentId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(attachPaymentDocument, null);
  const [docType, setDocType] = useState("official_receipt");
  const router = useRouter();

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
        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        <Paperclip className="h-3 w-3" /> Attach OR
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-[#0a0a0a]/50">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-primary" /> Attach Document
              </h3>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form action={formAction} className="p-6 space-y-4">
              <input type="hidden" name="payment_id" value={paymentId} />

              {state?.error && (
                <div className="flex items-start gap-2 p-3 text-xs font-medium text-red-600 bg-red-50 rounded-lg border border-red-100">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  {state.error}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Document Type</label>
                <select
                  name="doc_type"
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-primary"
                >
                  <option value="official_receipt">Official Receipt</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {docType === "other" && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">
                    Label <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="label"
                    type="text"
                    required
                    placeholder="e.g. Delivery Receipt"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">
                  File <span className="text-red-500">*</span>
                </label>
                <input
                  name="file"
                  type="file"
                  required
                  accept=".pdf,image/jpeg,image/png,image/webp"
                  className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                />
              </div>

              <div className="pt-1 flex gap-3">
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
                  {isPending ? <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Attach"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
