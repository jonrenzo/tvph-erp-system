"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { approvePO, approvePOExec, approvePOFinance, rejectPO } from "@/app/dashboard/purchase-orders/actions";
import { useOptimisticAction } from "@/components/dashboard/shared/use-optimistic-action";

export function PoApprovalActions({ poId, stage = "admin" }: { poId: string; stage?: "admin" | "exec" | "finance" }) {
  const [isRejecting, setIsRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const { error, setError, isPending, optimisticSuccess, run } = useOptimisticAction();

  function handleApprove() {
    run(() => (stage === "finance" ? approvePOFinance(poId) : stage === "exec" ? approvePOExec(poId) : approvePO(poId)));
  }

  function handleReject() {
    if (!isRejecting) { setIsRejecting(true); return; }
    if (!reason.trim()) { setError("Rejection reason is required."); return; }
    run(() => rejectPO(poId, reason));
  }

  return (
    <div className="flex flex-col items-end gap-2 shrink-0">
      {isRejecting && (
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Enter rejection reason…"
          rows={2}
          className="w-64 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
        />
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleApprove}
          disabled={isPending || optimisticSuccess || isRejecting}
          className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 disabled:opacity-60"
        >
          {optimisticSuccess ? <CheckCircle2 className="h-4 w-4" /> : isPending && !isRejecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {optimisticSuccess ? "Approved" : stage === "finance" ? "Approve & Issue" : stage === "exec" ? "Approve as Executive" : "Approve & Send to Finance"}
        </button>
        <button
          type="button"
          onClick={handleReject}
          disabled={isPending || optimisticSuccess}
          className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 disabled:opacity-60"
        >
          {optimisticSuccess && isRejecting ? <CheckCircle2 className="h-4 w-4" /> : isPending && isRejecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
          {optimisticSuccess && isRejecting ? "Rejected" : isRejecting ? "Confirm Rejection" : "Reject"}
        </button>
        {isRejecting && (
          <button
            type="button"
            onClick={() => { setIsRejecting(false); setReason(""); setError(null); }}
            className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-2"
          >
            Cancel
          </button>
        )}
      </div>
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
}
