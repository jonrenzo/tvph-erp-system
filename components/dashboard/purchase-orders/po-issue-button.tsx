"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Clock, Loader2 } from "lucide-react";
import { updatePOStatus, submitPOForApproval } from "@/app/dashboard/purchase-orders/actions";

export function PoIssueButton({ poId, isAdmin }: { poId: string; isAdmin: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = isAdmin
        ? await updatePOStatus(poId, "issued")
        : await submitPOForApproval(poId);
      if (result?.error) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm active:scale-95 disabled:opacity-60"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isAdmin ? (
          <Send className="h-4 w-4" />
        ) : (
          <Clock className="h-4 w-4" />
        )}
        {isPending
          ? isAdmin ? "Issuing…" : "Submitting…"
          : isAdmin ? "Issue PO" : "Submit for Approval"}
      </button>
      {error && (
        <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
      )}
    </div>
  );
}
