"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { deleteInvoice } from "@/app/dashboard/invoices/actions";

interface Props {
  invoiceId: string;
  currentStatus: string;
}

export function InvoiceStatusActions({ invoiceId, currentStatus }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Paid invoices can't be deleted (money has already moved).
  const canDelete = currentStatus !== "paid";

  function remove() {
    setError(null);
    startTransition(async () => {
      const res = await deleteInvoice(invoiceId);
      if (res.error) setError(res.error);
      else router.push("/dashboard/invoices");
    });
  }

  if (!canDelete) {
    return error ? (
      <p className="text-xs text-red-600 dark:text-red-400 max-w-[200px]">{error}</p>
    ) : null;
  }

  return (
    <div className="flex items-center gap-2">
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 max-w-[200px]">{error}</p>
      )}

      {!showDeleteConfirm && (
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
