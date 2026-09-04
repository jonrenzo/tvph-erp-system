"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, CheckCircle2, XCircle, Wallet } from "lucide-react";
import { addDownPayment } from "@/app/dashboard/purchase-orders/actions";

const DP_PRESETS = [30, 40, 50, 60, 70, 80, 90, 100];

export function AddDownpayment({
  poId,
  poAmount,
  currencySymbol,
  initialAmount = 0,
}: {
  poId: string;
  poAmount: number;
  currencySymbol: string;
  initialAmount?: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isEditing = initialAmount > 0;
  const initialPercent = isEditing && poAmount > 0 ? Math.round((initialAmount / poAmount) * 100 * 100) / 100 : 30;
  const [percent, setPercent] = useState(initialPercent);
  const [error, setError] = useState<string | null>(null);
  const [successAmount, setSuccessAmount] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const amount = Math.round(poAmount * percent) / 100;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result: { error?: string; success?: boolean } = await addDownPayment(poId, amount);
      if (result?.error) setError(result.error);
      else {
        setOpen(false);
        setSuccessAmount(amount);
        setPercent(30);
        router.refresh();
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setError(null);
          if (isEditing && poAmount > 0) setPercent(initialPercent);
        }}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 hover:text-amber-800 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 border border-amber-200 dark:border-amber-800/50 px-3 py-1.5 rounded-lg transition-all"
      >
        <Plus className="h-3.5 w-3.5" />
        {isEditing ? 'Edit Downpayment' : 'Add Downpayment'}
      </button>
      {isEditing && (
        <span className="text-xs text-slate-500">Current: {currencySymbol}{initialAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })} ({initialPercent}%)</span>
      )}

      {open && (
        <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <form
            onSubmit={submit}
            className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
          >
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-[#0a0a0a]/50">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Wallet className="h-5 w-5 text-amber-500" />
                {isEditing ? 'Edit Downpayment' : 'Add Downpayment'}
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {isEditing ? 'Update the downpayment for this legacy PO. The new amount replaces the current one.' : 'Record a downpayment against this PO. Enter a percent or pick a preset — the amount is computed automatically.'}
              </p>
              <div>
                <label htmlFor="dp-percent" className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Downpayment Percent (%)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_9rem] gap-3 mt-1">
                  <div className="relative">
                    <input
                      id="dp-percent"
                      type="number"
                      min="0.01"
                      max="100"
                      step="any"
                      value={percent || ""}
                      onChange={(e) => setPercent(parseFloat(e.target.value) || 0)}
                      placeholder="30"
                      required
                      className="w-full pl-8 pr-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">%</span>
                  </div>
                  <select
                    id="dp-preset"
                    value={DP_PRESETS.includes(percent) ? percent : ""}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!Number.isNaN(val)) setPercent(val);
                    }}
                    className="w-full px-3 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all appearance-none"
                  >
                    <option value="" disabled>
                      Custom…
                    </option>
                    {DP_PRESETS.map((p) => (
                      <option key={p} value={p}>
                        {p}%
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 px-3 py-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700">
                    DOWNPAYMENT {percent || 0}%
                  </span>
                  <span className="text-base font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                    {currencySymbol}
                    {amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                  </span>
                  <span className="text-xs text-slate-500">
                    PO total: {currencySymbol}
                    {poAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                  </span>
                </div>
              </div>
              {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50">
                  <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95"
                >
                  {isPending ? (
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {isEditing ? 'Update Downpayment' : 'Save Downpayment'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {successAmount !== null && (
        <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-8 flex flex-col items-center text-center space-y-4">
              <span className="h-14 w-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              </span>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{isEditing ? 'Downpayment Updated' : 'Downpayment Added'}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {isEditing ? 'The downpayment has been updated.' : 'The downpayment has been recorded against this PO.'}
                </p>
              </div>
              <div className="w-full p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 text-center">
                <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest block mb-1">
                  Downpayment Amount
                </p>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                  {currencySymbol}
                  {successAmount.toLocaleString()}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Balance after downpayment updates automatically.
                </p>
              </div>
              <button
                type="button"
                autoFocus
                onClick={() => {
                  setSuccessAmount(null);
                  setOpen(false);
                  setPercent(30);
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
