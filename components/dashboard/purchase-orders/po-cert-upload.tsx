"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2 } from "lucide-react";
import { submitCompletionCertificate } from "@/app/dashboard/purchase-orders/actions";

export function PoCertUpload({ poId, vendorId }: { poId: string; vendorId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const data = new FormData(e.currentTarget);
    data.set("po_id", poId);
    data.set("vendor_id", vendorId);
    startTransition(async () => {
      const result = await submitCompletionCertificate(data);
      if (result?.error) {
        setError(result.error);
      } else {
        formRef.current?.reset();
        router.refresh();
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800/50">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Submit New Certificate</p>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex flex-col gap-1 w-32 shrink-0">
          <label className="text-xs text-slate-500">% Complete</label>
          <input
            name="percent_complete"
            type="number"
            min="1"
            max="100"
            step="0.01"
            required
            placeholder="e.g. 50"
            className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-[#0a0a0a] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <div className="flex flex-col gap-1 flex-1">
          <label className="text-xs text-slate-500">Certificate File (optional)</label>
          <input
            name="file"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="text-sm text-slate-600 dark:text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-slate-100 file:text-slate-700 dark:file:bg-slate-800 dark:file:text-slate-300"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500">Notes (optional)</label>
        <input
          name="notes"
          type="text"
          placeholder="e.g. Phase 1 completed per inspection report #R-042"
          className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-[#0a0a0a] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm active:scale-95 disabled:opacity-60"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {isPending ? "Submitting…" : "Submit Certificate"}
        </button>
        {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
      </div>
    </form>
  );
}
