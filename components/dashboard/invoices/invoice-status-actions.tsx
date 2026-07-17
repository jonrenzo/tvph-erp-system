"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { updateInvoiceStatus, deleteInvoice } from "@/app/dashboard/invoices/actions";

interface Props {
  invoiceId: string;
  currentStatus: string;
  canOverride: boolean;
}

export function InvoiceStatusActions({ invoiceId, currentStatus, canOverride }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const canApprove = currentStatus === "received" || currentStatus === "under_review";
  const canDispute = currentStatus !== "disputed" && currentStatus !== "paid";
  const canDelete = currentStatus !== "paid" && currentStatus !== "deleted";

  // Step 1: try approve without override
  function tryApprove() {
    setError(null);
    startTransition(async () => {
      const res = await updateInvoiceStatus(invoiceId, "approved");
      if (res.error) {
        // If overage error and user can override, show the dialog
        if (canOverride && res.error.toLowerCase().includes("override")) {
          setShowApproveDialog(true);
          setError(null);
          return;
        }
        setError(res.error);
      } else {
        router.refresh();
      }
    });
  }

  // Step 2: retry with override reason
  function approveWithOverride() {
    if (!overrideReason.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await updateInvoiceStatus(invoiceId, "approved", overrideReason.trim());
      if (res.error) setError(res.error);
      else {
        setShowApproveDialog(false);
        setOverrideReason("");
        router.refresh();
      }
    });
  }

  function dispute() {
    setError(null);
    startTransition(async () => {
      const res = await updateInvoiceStatus(invoiceId, "disputed");
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const res = await deleteInvoice(invoiceId);
      if (res.error) setError(res.error);
      else router.push("/dashboard/invoices");
    });
  }

  return (
    <div className="flex items-center gap-2">
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 max-w-[200px]">{error}</p>
      )}

      {canApprove && !showApproveDialog && (
        <button
          onClick={tryApprove}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95 disabled:opacity-60"
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          Approve
        </button>
      )}

      {showApproveDialog && (
        <div className="flex items-center gap-2 bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-700 rounded-xl p-3 shadow-lg">
          <div className="flex flex-col gap-2">
            <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>This invoice exceeds the payment request balance. An override reason is required.</span>
            </div>
            <input
              autoFocus
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="Reason for override..."
              className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={approveWithOverride}
                disabled={isPending || !overrideReason.trim()}
                className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg text-xs font-medium transition-all disabled:opacity-60"
              >
                {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                Confirm Approve
              </button>
              <button
                onClick={() => { setShowApproveDialog(false); setOverrideReason(""); }}
                className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {canDispute && !showApproveDialog && !showDeleteConfirm && (
        <button
          onClick={dispute}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95 disabled:opacity-60"
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
          Dispute
        </button>
      )}

      {canDelete && !showApproveDialog && !showDeleteConfirm && (
        <button
          onClick={() => setShowDeleteConfirm(true)}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/10 hover:text-red-600 dark:hover:text-red-400 px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95 disabled:opacity-60"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </button>
      )}

      {showDeleteConfirm && (
        <div className="flex items-center gap-2 bg-white dark:bg-[#0a0a0a] border border-red-200 dark:border-red-800/50 rounded-xl p-3 shadow-lg">
          <div className="flex flex-col gap-2">
            <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Delete this invoice? This releases any PR balance.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={remove}
                disabled={isPending}
                className="inline-flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 rounded-lg text-xs font-medium transition-all disabled:opacity-60"
              >
                {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                Confirm Delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
