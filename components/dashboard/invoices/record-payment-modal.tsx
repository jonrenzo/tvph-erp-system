"use client";

import { useState, useActionState, useEffect, useRef } from "react";
import { Plus, CreditCard, X, Paperclip, AlertTriangle } from "lucide-react";
import { recordPayment } from "@/app/dashboard/invoices/actions";
import { useRouter } from "next/navigation";

const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const EXT_TO_MIME: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

function resolveFileMime(file: File): string {
  if (file.type && ALLOWED_MIME.includes(file.type)) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_MIME[ext] ?? "";
}

export function RecordPaymentModal({ invoiceId, remainingBalance }: { invoiceId: string, remainingBalance: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(recordPayment, null);
  const [clientError, setClientError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      setIsOpen(false);
      router.refresh();
    }
  }, [state, router]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    setClientError(null);
    const form = e.currentTarget;
    const voucher = (form.elements.namedItem("payment_voucher_file") as HTMLInputElement)?.files?.[0];
    const proof = (form.elements.namedItem("proof_of_payment_file") as HTMLInputElement)?.files?.[0];

    for (const [label, f] of [["Payment Voucher", voucher], ["Proof of Payment", proof]] as [string, File | undefined][]) {
      if (!f || f.size === 0) {
        e.preventDefault();
        setClientError(`${label} attachment is required.`);
        return;
      }
      if (f.size > MAX_FILE_SIZE) {
        e.preventDefault();
        setClientError(`${label} exceeds the 10MB limit.`);
        return;
      }
      if (!ALLOWED_MIME.includes(resolveFileMime(f))) {
        e.preventDefault();
        setClientError(`${label} must be a PDF or image file.`);
        return;
      }
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm active:scale-95"
      >
        <Plus className="h-4 w-4" />
        Record Payment
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-[#0a0a0a]/50">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" /> Record Payment
              </h3>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form ref={formRef} action={formAction} onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <input type="hidden" name="invoice_id" value={invoiceId} />

              {(state?.error || clientError) && (
                <div className="flex items-start gap-2 p-3 text-xs font-medium text-red-600 bg-red-50 rounded-lg border border-red-100">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  {clientError || state?.error}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Amount Paid (PHP)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">₱</span>
                  <input
                    name="amount_paid"
                    type="number"
                    step="0.01"
                    required
                    defaultValue={remainingBalance}
                    className="w-full pl-8 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-primary transition-all"
                  />
                </div>
                <p className="text-[10px] text-slate-400 italic">Remaining Balance: ₱{remainingBalance.toLocaleString()}</p>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Payment Date</label>
                <input
                  name="payment_date"
                  type="date"
                  required
                  defaultValue={new Date().toISOString().split("T")[0]}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Nature of Payment</label>
                  <select
                    name="payment_type"
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-primary"
                  >
                    <option value="full">Full Payment</option>
                    <option value="installment">Installment</option>
                    <option value="down_payment">Down Payment</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Payment Method</label>
                  <select
                    name="payment_method"
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-primary"
                  >
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cheque">Cheque</option>
                    <option value="cash">Cash</option>
                    <option value="others">Other</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Reference Number</label>
                <input
                  name="reference_number"
                  type="text"
                  placeholder="Check # or Transaction ID"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Notes</label>
                <textarea
                  name="notes"
                  rows={2}
                  placeholder="Internal note..."
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-primary resize-none"
                ></textarea>
              </div>

              {/* Required payment documents */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-primary" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Required Documents</span>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Check / Payment Voucher <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="payment_voucher_file"
                    type="file"
                    required
                    accept=".pdf,image/jpeg,image/png,image/webp"
                    className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Proof of Payment <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="proof_of_payment_file"
                    type="file"
                    required
                    accept=".pdf,image/jpeg,image/png,image/webp"
                    className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                  />
                </div>

                <p className="text-[10px] text-slate-400 italic">
                  The vendor's Official Receipt (OR) can be attached after the payment is recorded.
                </p>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                >
                  {isPending ? <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Save Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
