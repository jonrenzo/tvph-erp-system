"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff, CheckCircle2, XCircle, Loader2, AlertCircle } from "lucide-react";
import {
  notifyFinanceForPayment,
  acknowledgePaymentReservation,
  cancelPaymentReservation,
  markReservationPaid,
} from "@/app/dashboard/purchase-orders/actions";

interface Props {
  poId: string;
  reservationId: string | null;
  reservationStatus: "pending" | "acknowledged" | "paid" | "cancelled" | null;
  reservedAmount: number;
  canNotify: boolean;
  canAcknowledge: boolean;
  projectCompletionPct: number | null;
}

export function NotifyFinanceButton({
  poId,
  reservationId,
  reservationStatus,
  reservedAmount,
  canNotify,
  canAcknowledge,
  projectCompletionPct,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const pctReady = (projectCompletionPct ?? 0) >= 80;
  const hasActive = reservationStatus === "pending" || reservationStatus === "acknowledged";

  function act(fn: () => Promise<{ error?: string; success?: boolean }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  // No project linked or below threshold — show nothing if no active reservation
  if (!hasActive && !pctReady) return null;

  // No permission to see this section at all
  if (!canNotify && !canAcknowledge) return null;

  return (
    <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center gap-2">
        <Bell className="h-5 w-5 text-primary" />
        <h2 className="font-semibold text-slate-900 dark:text-white">Payment Notification</h2>
        {reservationStatus && (
          <span className={`ml-auto inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${
            reservationStatus === "acknowledged"
              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400"
              : reservationStatus === "paid"
              ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400"
              : reservationStatus === "cancelled"
              ? "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400"
              : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400"
          }`}>
            {reservationStatus === "pending" ? "AWAITING FINANCE" : reservationStatus.toUpperCase()}
          </span>
        )}
      </div>

      <div className="p-6 space-y-4">
        {/* Not yet triggered */}
        {!hasActive && pctReady && canNotify && (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Project is at {projectCompletionPct}% completion. Notify finance to reserve{" "}
              <span className="font-semibold text-slate-900 dark:text-white">
                ₱{reservedAmount.toLocaleString()}
              </span>{" "}
              for this vendor's upcoming payment.
            </p>
            <button
              onClick={() => act(() => notifyFinanceForPayment(poId))}
              disabled={isPending}
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 disabled:opacity-60"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
              Notify Finance
            </button>
          </>
        )}

        {/* Pending acknowledgment */}
        {reservationStatus === "pending" && reservationId && (
          <>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Awaiting Finance Acknowledgment</p>
                <p className="text-xs text-amber-600/80 dark:text-amber-400/60 mt-1">
                  Finance has been notified to reserve{" "}
                  <span className="font-semibold">₱{reservedAmount.toLocaleString()}</span> for this payment.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {canAcknowledge && (
                <button
                  onClick={() => act(() => acknowledgePaymentReservation(reservationId))}
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95 disabled:opacity-60"
                >
                  {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  Acknowledge
                </button>
              )}
              {(canNotify || canAcknowledge) && !showCancelForm && (
                <button
                  onClick={() => setShowCancelForm(true)}
                  className="inline-flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                >
                  <XCircle className="h-3.5 w-3.5" /> Cancel Reservation
                </button>
              )}
            </div>
          </>
        )}

        {/* Acknowledged */}
        {reservationStatus === "acknowledged" && reservationId && (
          <>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/50">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Finance Acknowledged</p>
                <p className="text-xs text-emerald-600/80 dark:text-emerald-400/60 mt-1">
                  ₱{reservedAmount.toLocaleString()} has been reserved for this payment.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {canAcknowledge && (
                <button
                  onClick={() => act(() => markReservationPaid(reservationId))}
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95 disabled:opacity-60"
                >
                  {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  Mark as Paid
                </button>
              )}
              {(canNotify || canAcknowledge) && !showCancelForm && (
                <button
                  onClick={() => setShowCancelForm(true)}
                  className="inline-flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                >
                  <BellOff className="h-3.5 w-3.5" /> Cancel Reservation
                </button>
              )}
            </div>
          </>
        )}

        {/* Cancel form */}
        {showCancelForm && reservationId && (
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Reason for Cancellation</label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Explain why the reservation is being cancelled..."
              className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              rows={3}
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (!cancelReason.trim()) return;
                  act(() => cancelPaymentReservation(reservationId, cancelReason.trim()));
                  setShowCancelForm(false);
                  setCancelReason("");
                }}
                disabled={isPending || !cancelReason.trim()}
                className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95 disabled:opacity-60"
              >
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                Confirm Cancel
              </button>
              <button
                onClick={() => { setShowCancelForm(false); setCancelReason(""); }}
                className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    </div>
  );
}
