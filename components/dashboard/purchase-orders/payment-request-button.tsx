"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileText, CheckCircle2, XCircle, Loader2, AlertCircle, ThumbsUp, ThumbsDown } from "lucide-react";
import { approvePaymentRequest, rejectPaymentRequest } from "@/app/dashboard/purchase-orders/actions";

interface PaymentRequest {
  id: string;
  request_number: string;
  amount: number;
  due_in_days: number;
  notes: string | null;
  status: "pending" | "approved" | "rejected" | "fully_invoiced";
  completion_cert_id: string | null;
  percent_complete: number | null;
  created_at: string;
  rejection_reason: string | null;
  is_downpayment: boolean;
  invoice_id?: string | null;
}

interface Props {
  poId: string;
  poAmount: number;
  paymentRequest?: PaymentRequest | null;
  paymentRequests?: PaymentRequest[] | null;
  approvedCerts?: any[];
  canCreate: boolean;
  canApprove: boolean;
  consumed?: number;
  remaining?: number;
}

export function PaymentRequestButton({ poId, paymentRequest, paymentRequests, canCreate, canApprove }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectId, setRejectId] = useState<string | null>(null);

  // Normalize to array: prefer paymentRequests, fallback to single paymentRequest
  const list: PaymentRequest[] = paymentRequests ?? (paymentRequest ? [paymentRequest] : []);

  function act(fn: () => Promise<{ error?: string; success?: boolean }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  if (!canCreate && !canApprove) return null;

  return (
    <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center gap-2">
        <FileText className="h-5 w-5 text-primary" />
        <h2 className="font-semibold text-slate-900 dark:text-white">Payment Requests</h2>
        <span className="ml-auto text-xs text-slate-500">{list.length} total</span>
      </div>

      <div className="p-6 space-y-4">
        {list.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <FileText className="h-10 w-10 text-primary/40" />
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No payment requests yet</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Upload an invoice linked to this PO to auto-create a pending Payment Request.</p>
            </div>
            {canCreate && (
              <Link
                href={`/dashboard/invoices/new?poId=${poId}`}
                className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 shadow-sm"
              >
                Record Vendor Invoice
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {list.map((pr) => (
              <div key={pr.id} className={`p-4 rounded-xl border ${pr.status === 'approved' ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/50' : pr.status === 'pending' ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/50' : pr.status === 'rejected' ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/50 opacity-80' : 'bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      {pr.request_number} — ₱{Number(pr.amount).toLocaleString()}
                      {pr.is_downpayment && <span className="inline-flex items-center px-1 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300">DP</span>}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">{pr.status === 'pending' ? 'Awaiting Approval' : pr.status.toUpperCase()} {pr.percent_complete ? `(${pr.percent_complete}% )` : ''} {pr.notes ? `— ${pr.notes}` : ''}</p>
                    {pr.status === 'rejected' && pr.rejection_reason && <p className="text-xs text-red-600/80 mt-1">Reason: {pr.rejection_reason}</p>}
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${pr.status === 'approved' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : pr.status === 'pending' ? 'bg-amber-100 text-amber-700 border-amber-200' : pr.status === 'rejected' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>{pr.status.toUpperCase()}</span>
                </div>
                {pr.status === 'pending' && canApprove && (
                  <div className="flex items-center gap-2 mt-3">
                    <button onClick={() => act(() => approvePaymentRequest(pr.id))} disabled={isPending} className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-60">
                      {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ThumbsUp className="h-3.5 w-3.5" />} Approve
                    </button>
                    <button onClick={() => setRejectId(pr.id)} className="inline-flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 px-3 py-1.5 rounded-lg text-xs font-medium">
                      <XCircle className="h-3.5 w-3.5" /> Reject
                    </button>
                  </div>
                )}
                {rejectId === pr.id && (
                  <div className="mt-3 space-y-2">
                    <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason..." className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 resize-none" rows={2} />
                    <div className="flex gap-2">
                      <button onClick={() => { if (!rejectReason.trim()) return; act(() => rejectPaymentRequest(pr.id, rejectReason.trim())); setRejectId(null); setRejectReason(""); }} disabled={isPending || !rejectReason.trim()} className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-60">
                        <ThumbsDown className="h-3.5 w-3.5" /> Confirm Reject
                      </button>
                      <button onClick={() => { setRejectId(null); setRejectReason(""); }} className="text-xs text-slate-500">Dismiss</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {canCreate && (
              <Link href={`/dashboard/invoices/new?poId=${poId}`} className="inline-flex items-center gap-2 text-sm text-primary hover:underline mt-2">
                <AlertCircle className="h-4 w-4" /> Record another invoice for this PO
              </Link>
            )}
          </div>
        )}

        {list.some(pr => pr.status === 'pending') && (
          <p className="text-xs text-amber-600/80 dark:text-amber-400/60 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" /> Payments are blocked until pending requests are approved.</p>
        )}
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </div>
  );
}
