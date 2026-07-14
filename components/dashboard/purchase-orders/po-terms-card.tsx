"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { overridePurchaseOrderPenalty, updatePurchaseOrderTerms } from "@/app/dashboard/purchase-orders/actions";

type Terms = {
  net_days?: number | null;
  dp_due_days?: number | null;
  penalty_rate?: number | null;
  penalty_type?: "monthly" | "fixed" | null;
};

type Penalty = {
  calculated_amount?: number | null;
  override_amount?: number | null;
  override_reason?: string | null;
} | null;

export function PoTermsCard({ poId, status, terms, penalty, canEdit, canOverride }: {
  poId: string;
  status: string;
  terms: Terms;
  penalty: Penalty;
  canEdit: boolean;
  canOverride: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const penaltyAmount = penalty?.override_amount ?? penalty?.calculated_amount;

  function submit(action: (data: FormData) => Promise<{ error?: string }>) {
    return (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);
      startTransition(async () => {
        const result = await action(new FormData(event.currentTarget));
        if (result?.error) setError(result.error);
        else router.refresh();
      });
    };
  }

  return (
    <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
      <div>
        <h2 className="font-semibold text-slate-900 dark:text-white">Payment Terms</h2>
        <p className="text-sm text-slate-500 mt-1">Net {terms.net_days ?? 30} days{terms.dp_due_days != null ? ` · DP due in ${terms.dp_due_days} days` : ""}</p>
        <p className="text-sm text-slate-500">{terms.penalty_rate == null ? "No penalty rate configured" : `${Number(terms.penalty_rate) * 100}% ${terms.penalty_type === "fixed" ? "fixed (once)" : "monthly (daily-prorated)"}`}</p>
        {penaltyAmount != null && <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mt-2">Current penalty: ₱{Number(penaltyAmount).toLocaleString()}</p>}
      </div>

      {canEdit && status === "draft" && (
        <form onSubmit={submit((data) => updatePurchaseOrderTerms(poId, data))} className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <input name="net_days" type="number" min="1" step="1" required defaultValue={terms.net_days ?? 30} className="border rounded-lg px-3 py-2 text-sm dark:bg-[#0a0a0a]" />
          <input name="dp_due_days" type="number" min="0" step="1" placeholder="DP due days" defaultValue={terms.dp_due_days ?? ""} className="border rounded-lg px-3 py-2 text-sm dark:bg-[#0a0a0a]" />
          <input name="penalty_rate" type="number" min="0" max="1" step="0.0001" placeholder="0.1" defaultValue={terms.penalty_rate ?? ""} className="border rounded-lg px-3 py-2 text-sm dark:bg-[#0a0a0a]" />
          <select name="penalty_type" defaultValue={terms.penalty_type ?? "monthly"} className="border rounded-lg px-3 py-2 text-sm dark:bg-[#0a0a0a]"><option value="monthly">Monthly (daily-prorated)</option><option value="fixed">Fixed (once)</option></select>
          <button disabled={isPending} className="justify-self-start bg-primary text-white rounded-lg px-4 py-2 text-sm disabled:opacity-60">Save terms</button>
        </form>
      )}

      {canOverride && (
        <form onSubmit={submit((data) => overridePurchaseOrderPenalty(poId, data))} className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <input name="override_amount" type="number" min="0" step="0.01" placeholder="Manual penalty amount" defaultValue={penalty?.override_amount ?? ""} className="border rounded-lg px-3 py-2 text-sm dark:bg-[#0a0a0a]" />
          <input name="override_reason" required placeholder="Reason for override" defaultValue={penalty?.override_reason ?? ""} className="border rounded-lg px-3 py-2 text-sm dark:bg-[#0a0a0a]" />
          <button disabled={isPending} className="justify-self-start border border-primary text-primary rounded-lg px-4 py-2 text-sm disabled:opacity-60">Override penalty</button>
        </form>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
