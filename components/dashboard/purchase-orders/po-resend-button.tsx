"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, Loader2, Check } from "lucide-react";
import { resendPurchaseOrderEmail } from "@/app/dashboard/purchase-orders/actions";

export function PoResendButton({ poId }: { poId: string }) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const router = useRouter();

  function handleClick() {
    setFeedback(null);
    startTransition(async () => {
      const result = await resendPurchaseOrderEmail(poId);
      if (result?.error) {
        setFeedback({ ok: false, msg: result.error });
      } else {
        setFeedback({ ok: true, msg: "Email sent to vendor." });
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
        className="inline-flex items-center gap-2 bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm active:scale-95 disabled:opacity-60"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : feedback?.ok ? (
          <Check className="h-4 w-4 text-emerald-500" />
        ) : (
          <Mail className="h-4 w-4" />
        )}
        {isPending ? "Sending…" : "Resend to Vendor"}
      </button>
      {feedback && (
        <span
          className={`text-xs ${feedback.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
        >
          {feedback.msg}
        </span>
      )}
    </div>
  );
}
