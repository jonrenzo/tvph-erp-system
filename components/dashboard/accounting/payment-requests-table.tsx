"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import {
  approvePaymentRequest,
  rejectPaymentRequest,
} from "@/app/dashboard/purchase-orders/actions";

interface PaymentRequest {
  id: string;
  request_number: string;
  po_id: string;
  amount: number;
  due_in_days: number;
  status: string;
  percent_complete: number | null;
  created_at: string;
  rejection_reason: string | null;
  purchase_orders: { po_number: string; vendors: { name: string } | null } | null;
  projects: { name: string } | null;
}

interface Props {
  requests: PaymentRequest[];
  canApprove: boolean;
}

export function PaymentRequestsTable({ requests, canApprove }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
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

  if (requests.length === 0) {
    return (
      <p className="text-sm text-slate-400 italic py-4">No payment requests found.</p>
    );
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-[10px] text-slate-500 uppercase border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="pb-2 pr-4 font-semibold">Request ID</th>
              <th className="pb-2 pr-4 font-semibold">Vendor / PO</th>
              <th className="pb-2 pr-4 font-semibold">Status</th>
              <th className="pb-2 pr-4 font-semibold text-right">Amount</th>
              <th className="pb-2 pr-4 font-semibold">% Complete</th>
              <th className="pb-2 pr-4 font-semibold">Due In</th>
              <th className="pb-2 font-semibold">Created</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {requests.map((r) => {
              const isActing = isPending && activeId === r.id;
              const isRejecting = rejectingId === r.id;
              return (
                <>
                  <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                    <td className="py-3 pr-4">
                      <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                        {r.request_number || "—"}
                      </span>
                    </td>
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
                    <td className="py-3 pr-4">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${
                        r.status === 'approved' || r.status === 'fully_invoiced'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400'
                          : r.status === 'rejected'
                          ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400'
                          : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400'
                      }`}>
                        {r.status.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right font-bold text-slate-900 dark:text-white">
                      ₱{Number(r.amount).toLocaleString()}
                    </td>
                    <td className="py-3 pr-4 text-xs text-slate-600 dark:text-slate-400">
                      {r.percent_complete ? `${r.percent_complete}%` : "—"}
                    </td>
                    <td className="py-3 pr-4 text-xs text-slate-600 dark:text-slate-400">
                      {r.due_in_days} days
                    </td>
                    <td className="py-3 pr-4 text-xs text-slate-500">
                      {new Date(r.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
                    </td>
                    <td className="py-3">
                      {r.status === 'pending' && canApprove && (
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => act(r.id, () => approvePaymentRequest(r.id))}
                            disabled={isActing}
                            className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg text-xs font-medium transition-all active:scale-95 disabled:opacity-60"
                          >
                            {isActing ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                            Approve
                          </button>
                          {!isRejecting && (
                            <button
                              onClick={() => setRejectingId(r.id)}
                              className="inline-flex items-center gap-1 border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                            >
                              <XCircle className="h-3 w-3" /> Reject
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                  {isRejecting && (
                    <tr key={`${r.id}-reject`}>
                      <td colSpan={8} className="pb-3 pt-1 px-2">
                        <div className="flex items-center gap-2">
                          <input
                            autoFocus
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Reason for rejection..."
                            className="flex-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                          <button
                            onClick={() => {
                              if (!rejectReason.trim()) return;
                              act(r.id, () => rejectPaymentRequest(r.id, rejectReason.trim()));
                              setRejectingId(null);
                              setRejectReason("");
                            }}
                            disabled={!rejectReason.trim() || isActing}
                            className="inline-flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 rounded-lg text-xs font-medium transition-all disabled:opacity-60"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => { setRejectingId(null); setRejectReason(""); }}
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
