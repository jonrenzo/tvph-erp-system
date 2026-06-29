"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { approvePO, rejectPO } from "@/app/dashboard/purchase-orders/actions";

export function PoApprovalActions({ poId }: { poId: string }) {
  const [isRejecting, setIsRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleApprove() {
    setError(null);
    startTransition(async () => {
      const result = await approvePO(poId);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  function handleReject() {
    if (!isRejecting) { setIsRejecting(true); return; }
    if (!reason.trim()) { setError("Rejection reason is required."); return; }
    setError(null);
    startTransition(async () => {
      const result = await rejectPO(poId, reason);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
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
          disabled={isPending || isRejecting}
          className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 disabled:opacity-60"
        >
          {isPending && !isRejecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Approve &amp; Issue
        </button>
        <button
          type="button"
          onClick={handleReject}
          disabled={isPending && isRejecting}
          className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 disabled:opacity-60"
        >
          {isPending && isRejecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
          {isRejecting ? "Confirm Rejection" : "Reject"}
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
