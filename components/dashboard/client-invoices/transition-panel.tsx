"use client";

import { useTransition, useState } from "react";
import { transitionBillingStatus } from "@/app/dashboard/client-invoices/actions";
import { Loader2 } from "lucide-react";

const NEXT: Record<string, { label: string; to: string; variant: string }[]> = {
  for_billing: [{ label: "Send to Sky Technical", to: "pending_sky_technical", variant: "bg-amber-500 hover:bg-amber-600" }],
  pending_sky_technical: [
    { label: "Back to For Billing (Rejected)", to: "for_billing", variant: "bg-slate-600 hover:bg-slate-700" },
    { label: "Approve → For Payment", to: "for_payment", variant: "bg-blue-600 hover:bg-blue-700" },
  ],
  pending_payment: [{ label: "Mark Collected", to: "collected", variant: "bg-emerald-600 hover:bg-emerald-700" }],
};

export function TransitionPanel({ billingId, status }: { billingId: string; status: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const actions = NEXT[status] || [];

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
    <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Next Actions</p>
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <button
            key={a.to}
            disabled={isPending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const res = await transitionBillingStatus(billingId, a.to);
                if ((res as any)?.error) setError((res as any).error);
              });
            }}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50 ${a.variant}`}
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {a.label}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-xl">{error}</p>}
      {status === "pending_payment" && <p className="text-xs text-slate-400">Collected requires finance permission.</p>}
    </div>
  );
}
