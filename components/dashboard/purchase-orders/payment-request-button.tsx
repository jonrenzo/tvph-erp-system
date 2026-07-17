"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, CheckCircle2, XCircle, Loader2, AlertCircle, ThumbsUp, ThumbsDown } from "lucide-react";
import {
  createPaymentRequest,
  approvePaymentRequest,
  rejectPaymentRequest,
} from "@/app/dashboard/purchase-orders/actions";

interface CompletionCert {
  id: string;
  percent_complete: number;
  status: string;
}

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
}

interface Props {
  poId: string;
  poAmount: number;
  paymentRequest: PaymentRequest | null;
  approvedCerts: CompletionCert[];
  canCreate: boolean;
  canApprove: boolean;
  consumed?: number;
  remaining?: number;
}

export function PaymentRequestButton({
  poId,
  poAmount,
  paymentRequest,
  approvedCerts,
  canCreate,
  canApprove,
  consumed = 0,
  remaining = 0,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [dueInDays, setDueInDays] = useState("30");
  const [notes, setNotes] = useState("");
  const [selectedCertId, setSelectedCertId] = useState(approvedCerts[0]?.id ?? "");
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  const hasActive = paymentRequest?.status === "pending" || paymentRequest?.status === "approved";

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
        <h2 className="font-semibold text-slate-900 dark:text-white">Payment Request</h2>
        {paymentRequest?.status && (
          <span className={`ml-auto inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${
            paymentRequest.status === "approved"
              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400"
              : paymentRequest.status === "rejected"
              ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400"
              : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400"
          }`}>
            {paymentRequest.status === "pending" ? "AWAITING APPROVAL" : paymentRequest.status.toUpperCase()}
          </span>
        )}
      </div>

      <div className="p-6 space-y-4">
        {/* No PR yet — show create form */}
        {!hasActive && canCreate && paymentRequest?.status !== "rejected" && (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Create a Payment Request to authorize the subcontractor to submit a progress-billing invoice.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Amount (₱)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={`Max: ₱${poAmount.toLocaleString()}`}
                  className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Due In (Days)</label>
                <input
                  type="number"
                  value={dueInDays}
                  onChange={(e) => setDueInDays(e.target.value)}
                  min={1}
                  className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {approvedCerts.length > 0 && (
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Completion Certificate</label>
                  <select
                    value={selectedCertId}
                    onChange={(e) => setSelectedCertId(e.target.value)}
                    className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">No certificate (use PO total)</option>
                    {approvedCerts.map((cert) => (
                      <option key={cert.id} value={cert.id}>
                        {cert.percent_complete}% Complete
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Notes (Optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Reason for this payment request..."
                  className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  rows={2}
                />
              </div>
            </div>

            <button
              onClick={() => act(() => createPaymentRequest(
                poId,
                parseFloat(amount),
                parseInt(dueInDays) || 30,
                notes || undefined,
                selectedCertId || undefined,
              ))}
              disabled={isPending || !amount}
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 disabled:opacity-60"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Create Payment Request
            </button>
          </>
        )}

        {/* Rejected — show reason and allow re-create */}
        {paymentRequest?.status === "rejected" && canCreate && (
          <>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/50">
              <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-700 dark:text-red-400">Payment Request Rejected</p>
                <p className="text-xs text-red-600/80 dark:text-red-400/60 mt-1">
                  {paymentRequest.rejection_reason || "No reason provided."}
                </p>
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              You may create a new Payment Request with adjusted details.
            </p>
            {/* We show the create form below by not having the !hasActive guard */}
          </>
        )}

        {/* Rejected + allow re-create form */}
        {paymentRequest?.status === "rejected" && canCreate && (
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Create a New Payment Request</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Amount (₱)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={`Max: ₱${poAmount.toLocaleString()}`}
                  className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Due In (Days)</label>
                <input
                  type="number"
                  value={dueInDays}
                  onChange={(e) => setDueInDays(e.target.value)}
                  min={1}
                  className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              {approvedCerts.length > 0 && (
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Completion Certificate</label>
                  <select
                    value={selectedCertId}
                    onChange={(e) => setSelectedCertId(e.target.value)}
                    className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">No certificate (use PO total)</option>
                    {approvedCerts.map((cert) => (
                      <option key={cert.id} value={cert.id}>
                        {cert.percent_complete}% Complete
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Notes (Optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Reason for this payment request..."
                  className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  rows={2}
                />
              </div>
            </div>
            <button
              onClick={() => act(() => createPaymentRequest(
                poId,
                parseFloat(amount),
                parseInt(dueInDays) || 30,
                notes || undefined,
                selectedCertId || undefined,
              ))}
              disabled={isPending || !amount}
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 disabled:opacity-60"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Create Payment Request
            </button>
          </div>
        )}

        {/* Pending — show awaiting approval */}
        {paymentRequest?.status === "pending" && (
          <>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Awaiting Approval</p>
                <p className="text-xs text-amber-600/80 dark:text-amber-400/60 mt-1">
                  Payment request for <span className="font-semibold">₱{Number(paymentRequest.amount).toLocaleString()}</span>
                  {paymentRequest.percent_complete ? ` (${paymentRequest.percent_complete}% completion)` : ""} is pending admin/finance approval.
                </p>
                {paymentRequest.notes && (
                  <p className="text-xs text-amber-600/80 dark:text-amber-400/60 mt-1 italic">{paymentRequest.notes}</p>
                )}
              </div>
            </div>
            {canApprove && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => act(() => approvePaymentRequest(paymentRequest.id))}
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95 disabled:opacity-60"
                >
                  {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ThumbsUp className="h-3.5 w-3.5" />}
                  Approve
                </button>
                {!showRejectForm && (
                  <button
                    onClick={() => setShowRejectForm(true)}
                    className="inline-flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  >
                    <XCircle className="h-3.5 w-3.5" /> Reject
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {/* Approved or Fully Invoiced */}
        {(paymentRequest?.status === "approved" || paymentRequest?.status === "fully_invoiced") && (
          <div className={`flex items-start gap-3 p-4 rounded-xl border ${
            paymentRequest.status === "fully_invoiced"
              ? 'bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 opacity-80'
              : 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/50'
          }`}>
            {paymentRequest.status === "fully_invoiced" ? (
              <CheckCircle2 className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div>
              <p className={`text-sm font-semibold ${
                paymentRequest.status === "fully_invoiced"
                  ? 'text-slate-500 dark:text-slate-400'
                  : 'text-emerald-700 dark:text-emerald-400'
              }`}>
                {paymentRequest.status === "fully_invoiced" ? 'Payment Request Fully Invoiced' : 'Payment Request Approved'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                <span className="font-semibold">{paymentRequest.request_number}</span> — ₱{Number(paymentRequest.amount).toLocaleString()}
                {paymentRequest.percent_complete ? ` (${paymentRequest.percent_complete}% completion)` : ""}.
                {paymentRequest.status === "fully_invoiced"
                  ? ' All available balance has been invoiced. A new payment request may be created.'
                  : ` The subcontractor is authorized to bill up to this amount.`}
              </p>
              {remaining != null && (
                <div className="mt-2 flex items-center gap-4 text-xs">
                  <span className="text-slate-500">Consumed: <strong className="text-slate-700 dark:text-slate-300">₱{Number(consumed || 0).toLocaleString()}</strong></span>
                  <span className={`font-semibold ${remaining > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                    {remaining > 0 ? `₱${remaining.toLocaleString()} remaining` : 'Fully consumed'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Reject form */}
        {showRejectForm && paymentRequest && (
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Reason for Rejection</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Explain why the payment request is being rejected..."
              className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              rows={3}
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (!rejectReason.trim()) return;
                  act(() => rejectPaymentRequest(paymentRequest.id, rejectReason.trim()));
                  setShowRejectForm(false);
                  setRejectReason("");
                }}
                disabled={isPending || !rejectReason.trim()}
                className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95 disabled:opacity-60"
              >
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ThumbsDown className="h-3.5 w-3.5" />}
                Confirm Reject
              </button>
              <button
                onClick={() => { setShowRejectForm(false); setRejectReason(""); }}
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
