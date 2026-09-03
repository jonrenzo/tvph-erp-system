"use client";

import { useTransition, useState } from "react";
import { transitionBillingStatus } from "@/app/dashboard/client-invoices/actions";
import { Loader2, X } from "lucide-react";

const NEXT: Record<string, { label: string; to: string; variant: string }[]> = {
  for_billing: [{ label: "Submit to Sky Technical", to: "pending_sky_technical", variant: "bg-amber-500 hover:bg-amber-600" }],
  pending_sky_technical: [
    { label: "Back to For Billing (Rejected)", to: "for_billing", variant: "bg-slate-600 hover:bg-slate-700" },
    { label: "Approve → For Payment", to: "for_payment", variant: "bg-blue-600 hover:bg-blue-700" },
  ],
  pending_payment: [{ label: "Mark Collected", to: "collected", variant: "bg-emerald-600 hover:bg-emerald-700" }],
};

export function TransitionPanel({ billingId, status, invoiceNumber, invoiceBatch }: { billingId: string; status: string; invoiceNumber?: string | null; invoiceBatch?: string | null }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ to: string; label: string } | null>(null);
  const [invNum, setInvNum] = useState("");
  const [invBatch, setInvBatch] = useState("");

  const actions = NEXT[status] || [];

  const needsInvoice = confirm?.to === "for_payment" && status === "pending_sky_technical";

  const doTransition = () => {
    if (!confirm) return;
    if (needsInvoice && !invNum.trim() && !invoiceNumber) {
      setError("Invoice number is required to approve.");
      return;
    }
    setError(null);
    const to = confirm.to;
    const opts = needsInvoice ? { invoice_number: invNum.trim() || undefined, invoice_batch: invBatch.trim() || undefined } : undefined;
    startTransition(async () => {
      const res = await transitionBillingStatus(billingId, to, undefined, opts as any);
      if ((res as any)?.error) setError((res as any).error);
      else setConfirm(null);
    });
  };

  if (actions.length === 0) {
    return (
      <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {status === "collected" ? "This invoice is collected. No further transitions." : status === "for_payment" ? "Endorsed — awaiting payment (auto-moved to Pending Payment)." : "No transitions available."}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Next Actions</p>
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <button
              key={a.to}
              disabled={isPending}
              onClick={() => {
                setError(null);
                setInvNum(invoiceNumber || "");
                setInvBatch(invoiceBatch || "");
                setConfirm({ to: a.to, label: a.label });
              }}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50 ${a.variant}`}
            >
              {a.label}
            </button>
          ))}
        </div>
        {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-xl">{error}</p>}
        {status === "pending_payment" && <p className="text-xs text-slate-400">Collected requires finance permission.</p>}
      </div>

      {confirm && (
        <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={() => setConfirm(null)} />
          <div className="relative bg-white dark:bg-[#0a0a0a] rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-semibold text-slate-900 dark:text-white">Confirm action</h3>
              <button onClick={() => setConfirm(null)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"><X className="h-4 w-4" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">Are you sure you want to <span className="font-semibold text-slate-900 dark:text-white">{confirm.label}</span>?</p>
              {needsInvoice && (
                <div className="space-y-3 p-4 rounded-xl bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Invoice details required to approve:</p>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Invoice Number <span className="text-rose-500">*</span></label>
                    <input value={invNum} onChange={e => setInvNum(e.target.value)} placeholder="e.g. 0092" className="w-full rounded-xl px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0a0a0a] text-slate-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Invoice Batch</label>
                    <input value={invBatch} onChange={e => setInvBatch(e.target.value)} placeholder="e.g. QC 22" className="w-full rounded-xl px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0a0a0a] text-slate-900 dark:text-white" />
                  </div>
                </div>
              )}
              {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-xl">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 bg-slate-50 dark:bg-white/[0.02] border-t border-slate-100 dark:border-slate-800">
              <button onClick={() => setConfirm(null)} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">Cancel</button>
              <button onClick={doTransition} disabled={isPending} className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold bg-primary hover:bg-primary/90 text-white disabled:opacity-50">
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />} Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
