"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Loader2, Bell } from "lucide-react";
import Link from "next/link";
import {
  acknowledgePaymentReservation,
  cancelPaymentReservation,
  markReservationPaid,
} from "@/app/dashboard/purchase-orders/actions";

interface Reservation {
  id: string;
  po_id: string;
  reserved_amount: number;
  status: "pending" | "acknowledged" | "paid" | "cancelled";
  notified_at: string;
  acknowledged_at: string | null;
  cancelled_reason: string | null;
  purchase_orders: { po_number: string; vendors: { name: string } | null } | null;
  projects: { name: string } | null;
}

interface Props {
  reservations: Reservation[];
  canAcknowledge: boolean;
  canCancel: boolean;
}

export function PaymentReservationsTable({ reservations, canAcknowledge, canCancel }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function act(id: string, fn: () => Promise<{ error?: string; success?: boolean }>) {
    setActiveId(id);
    setError(null);
    startTransition(async () => {
      const res = await fn();
      setActiveId(null);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  if (reservations.length === 0) {
    return (
      <p className="text-sm text-slate-400 italic py-4">No active payment reservations.</p>
    );
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-[10px] text-slate-500 uppercase border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="pb-2 pr-4 font-semibold">Vendor / PO</th>
              <th className="pb-2 pr-4 font-semibold">Project</th>
              <th className="pb-2 pr-4 font-semibold text-right">Reserved</th>
              <th className="pb-2 pr-4 font-semibold">Status</th>
              <th className="pb-2 font-semibold">Notified</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {reservations.map((r) => {
              const isActing = isPending && activeId === r.id;
              const isCancelling = cancellingId === r.id;
              return (
                <>
                  <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                    <td className="py-3 pr-4">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {r.purchase_orders?.vendors?.name ?? "—"}
                      </div>
                      <Link
                        href={`/dashboard/purchase-orders/${r.po_id}`}
                        className="text-xs text-primary hover:underline"
                      >
                        {r.purchase_orders?.po_number ?? r.po_id}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-slate-600 dark:text-slate-400 text-xs">
                      {r.projects?.name ?? "—"}
                    </td>
                    <td className="py-3 pr-4 text-right font-bold text-slate-900 dark:text-white">
                      ₱{Number(r.reserved_amount).toLocaleString()}
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        r.status === "acknowledged"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400"
                          : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400"
                      }`}>
                        {r.status === "pending" ? "AWAITING" : r.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-xs text-slate-500">
                      {new Date(r.notified_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2 justify-end">
                        {canAcknowledge && r.status === "pending" && (
                          <button
                            onClick={() => act(r.id, () => acknowledgePaymentReservation(r.id))}
                            disabled={isActing}
                            className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg text-xs font-medium transition-all active:scale-95 disabled:opacity-60"
                          >
                            {isActing ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                            Acknowledge
                          </button>
                        )}
                        {canAcknowledge && r.status === "acknowledged" && (
                          <button
                            onClick={() => act(r.id, () => markReservationPaid(r.id))}
                            disabled={isActing}
                            className="inline-flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded-lg text-xs font-medium transition-all active:scale-95 disabled:opacity-60"
                          >
                            {isActing ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                            Mark Paid
                          </button>
                        )}
                        {canCancel && !isCancelling && (
                          <button
                            onClick={() => setCancellingId(r.id)}
                            className="inline-flex items-center gap-1 border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                          >
                            <XCircle className="h-3 w-3" /> Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {isCancelling && (
                    <tr key={`${r.id}-cancel`}>
                      <td colSpan={6} className="pb-3 pt-1 px-2">
                        <div className="flex items-center gap-2">
                          <input
                            autoFocus
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            placeholder="Reason for cancellation..."
                            className="flex-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                          <button
                            onClick={() => {
                              if (!cancelReason.trim()) return;
                              act(r.id, () => cancelPaymentReservation(r.id, cancelReason.trim()));
                              setCancellingId(null);
                              setCancelReason("");
                            }}
                            disabled={!cancelReason.trim() || isActing}
                            className="inline-flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 rounded-lg text-xs font-medium transition-all disabled:opacity-60"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => { setCancellingId(null); setCancelReason(""); }}
                            className="text-xs text-slate-500 hover:text-slate-700"
                          >
                            Dismiss
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
