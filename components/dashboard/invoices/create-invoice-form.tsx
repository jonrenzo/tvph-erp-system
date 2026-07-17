"use client";

import { useState, useActionState, useTransition, useEffect } from "react";
import { Save, FileText, Upload, Link as LinkIcon, Tag, AlertTriangle, Info, ArrowRight } from "lucide-react";
import { createInvoice, discardStagedInvoiceFile, getEligiblePaymentRequests, type EligiblePR } from "@/app/dashboard/invoices/actions";
import { InvoiceOcrUpload } from "@/components/dashboard/invoices/invoice-ocr-upload";
import { addCalendarDays, manilaDateString } from "@/lib/payment-terms";

interface Vendor {
  id: string;
  name: string;
}

interface PO {
  id: string;
  po_number: string;
  vendor_id: string;
  amount: number;
  expense_category?: string | null;
  net_days: number;
}

interface StagedExtraction {
  stagedPath: string;
  stagedFileName: string;
  vendorMatch: { id: string; name: string; matchedBy: "tin" | "name" } | null;
  ocrWarning?: string;
}

export function CreateInvoiceForm({ vendors, pos }: { vendors: Vendor[], pos: PO[] }) {
  const [state, formAction, isPending] = useActionState(createInvoice, null);
  const [, startDiscard] = useTransition();

  const [selectedVendor, setSelectedVendor] = useState("");
  const [selectedPo, setSelectedPo] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("");

  // Auto-compute Net-30 due date when invoice_date changes and no manual override
  useEffect(() => {
    if (invoiceDate) {
      const d = new Date(invoiceDate);
      d.setDate(d.getDate() + 30);
      setDueDate(d.toISOString().split("T")[0]);
    }
  }, [invoiceDate]);

  // Payment request state
  const [eligiblePRs, setEligiblePRs] = useState<EligiblePR[]>([]);
  const [selectedPR, setSelectedPR] = useState("");
  const [prLoading, setPrLoading] = useState(false);
  const [overageConfirmed, setOverageConfirmed] = useState(false);

  const [staged, setStaged] = useState<StagedExtraction | null>(null);
  const [vendorHint, setVendorHint] = useState<string | null>(null);

  const filteredPOs = pos.filter(po => po.vendor_id === selectedVendor);
  const currentPR = eligiblePRs.find(pr => pr.id === selectedPR);

  // Compute carry-forward / overage display
  const parsedAmount = parseFloat(amount) || 0;
  const balanceRemaining = currentPR ? currentPR.remaining : 0;
  const carryForward = currentPR ? balanceRemaining - parsedAmount : 0;
  const isOverage = currentPR ? parsedAmount > balanceRemaining : false;
  const overageAmount = Math.max(0, carryForward * -1);

  const selectedPurchaseOrder = pos.find(po => po.id === selectedPo);
  const linkedDueDate = selectedPurchaseOrder
    ? addCalendarDays(manilaDateString(), selectedPurchaseOrder.net_days)
    : "";

  // Fetch PRs when a PO is selected
  useEffect(() => {
    if (!selectedPo) {
      setEligiblePRs([]);
      setSelectedPR("");
      return;
    }
    setPrLoading(true);
    getEligiblePaymentRequests(selectedPo).then(result => {
      setPrLoading(false);
      if (result.data) {
        setEligiblePRs(result.data);
        const approved = result.data.filter(pr => pr.status === 'approved');
        if (approved.length === 1) {
          setSelectedPR(approved[0].id);
          setAmount(String(approved[0].remaining));
        } else {
          setSelectedPR("");
        }
      } else {
        setEligiblePRs([]);
        setSelectedPR("");
      }
    });
  }, [selectedPo]);

  // Reset overage confirmation when amount or PR changes
  useEffect(() => {
    setOverageConfirmed(false);
  }, [amount, selectedPR]);

  function handleExtracted(result: any) {
    const { stagedPath, stagedFileName, extracted, vendorMatch, poMatch, ocrWarning } = result;
    setStaged({ stagedPath, stagedFileName, vendorMatch, ocrWarning });

    if (extracted) {
      if (extracted.invoice_number) setInvoiceNumber(extracted.invoice_number);
      if (extracted.amount != null) {
        const cleaned = String(extracted.amount).replace(/[^\d.]/g, "");
        const parsed = parseFloat(cleaned);
        if (!isNaN(parsed)) setAmount(String(parsed));
      }
      if (extracted.invoice_date) setInvoiceDate(extracted.invoice_date);
      if (extracted.due_date) setDueDate(extracted.due_date);
    }

    if (vendorMatch) {
      setSelectedVendor(vendorMatch.id);
      setVendorHint(
        vendorMatch.matchedBy === "tin"
          ? `Suggested vendor (TIN match): ${vendorMatch.name}`
          : `Suggested vendor (name match): ${vendorMatch.name}`
      );
    } else {
      setVendorHint(null);
    }

    if (poMatch && vendorMatch && poMatch.vendor_id === vendorMatch.id) {
      const matchedPO = pos.find(p => p.id === poMatch.id);
      if (matchedPO) setSelectedPo(poMatch.id);
    }
  }

  function handleCleared() {
    if (!staged) return;
    const path = staged.stagedPath;
    setStaged(null);
    setVendorHint(null);
    startDiscard(async () => { await discardStagedInvoiceFile(path); });
  }

  return (
    <form action={formAction} className="space-y-6">
      {state?.error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-sm font-medium">
          {state.error}
        </div>
      )}

      {staged?.ocrWarning && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 text-amber-700 dark:text-amber-400 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {staged.ocrWarning}
        </div>
      )}

      {/* Hidden inputs for PR linking */}
      {selectedPR && (
        <>
          <input type="hidden" name="payment_request_id" value={selectedPR} />
          <input type="hidden" name="overage_confirmed" value={overageConfirmed ? "true" : "false"} />
        </>
      )}

      {/* Staged file hidden inputs */}
      {staged && (
        <>
          <input type="hidden" name="staged_file_path" value={staged.stagedPath} />
          <input type="hidden" name="staged_file_name" value={staged.stagedFileName} />
        </>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Basic Info */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center gap-3">
              <FileText className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-slate-900 dark:text-white">Billing Details</h2>
            </div>

            <div className="p-6 space-y-4">
              {/* OCR Upload */}
              <InvoiceOcrUpload
                onExtracted={handleExtracted}
                onCleared={handleCleared}
                stagedFileName={staged?.stagedFileName}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Vendor <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="vendor_id"
                    required
                    value={selectedVendor}
                    onChange={(e) => { setSelectedVendor(e.target.value); setVendorHint(null); setSelectedPo(""); }}
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary appearance-none"
                  >
                    <option value="">Select vendor</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                  {vendorHint && (
                    <p className="text-[10px] text-primary italic">{vendorHint}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Invoice Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="invoice_number"
                    type="text"
                    required
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    placeholder="INV-001"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Amount (PHP) <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="amount"
                    type="number"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Invoice Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="invoice_date"
                    type="date"
                    required
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Due Date {selectedPurchaseOrder && <span className="text-slate-400 font-normal">(from PO terms)</span>}
                  </label>
                  {selectedPurchaseOrder ? (
                    <input
                      type="date"
                      value={linkedDueDate}
                      readOnly
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm"
                    />
                  ) : (
                    <input
                      name="due_date"
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Mode of Payment
                  </label>
                  <select
                    name="payment_method"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary appearance-none"
                  >
                    <option value="">Select MOP</option>
                    <option value="cash">Cash</option>
                    <option value="cheque">Cheque</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="gcash">GCash</option>
                    <option value="card">Card</option>
                    <option value="others">Others</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Expense Category
                  </label>
                  <select
                    name="expense_category"
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary appearance-none"
                  >
                    <option value="">Select category</option>
                    <option value="labor">Labor</option>
                    <option value="materials">Materials</option>
                    <option value="equipment">Equipment</option>
                    <option value="subcontractor">Subcontractor</option>
                    <option value="transportation">Transportation</option>
                    <option value="utilities">Utilities</option>
                    <option value="professional_fees">Professional Fees</option>
                    <option value="government_fees">Government Fees</option>
                    <option value="office_admin">Office / Admin</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center gap-3">
              <Tag className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-slate-900 dark:text-white">What For</h2>
            </div>
            <div className="p-6 space-y-4">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Notes / Description</label>
              <textarea
                name="notes"
                rows={3}
                className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
                placeholder="Describe what this invoice is for — scope of work, items delivered, etc."
              ></textarea>
            </div>
          </div>
        </div>

        {/* Right Column: Linking, PR selection, Upload */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center gap-3">
              <LinkIcon className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-slate-900 dark:text-white">Link PO</h2>
            </div>
            <div className="p-6">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Related Purchase Order</label>
              <select
                name="po_id"
                disabled={!selectedVendor}
                value={selectedPo}
                onChange={(e) => setSelectedPo(e.target.value)}
                className="w-full mt-2 px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
              >
                <option value="">No PO Linked</option>
                {filteredPOs.map((po) => (
                  <option key={po.id} value={po.id}>{po.po_number} (₱{po.amount.toLocaleString()})</option>
                ))}
              </select>
              {!selectedVendor && (
                <p className="mt-2 text-[10px] text-slate-500 italic">Select a vendor first to see available POs.</p>
              )}
            </div>
          </div>

          {/* Payment Request selector — shown when a PO is selected */}
          {selectedPo && (
            <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center gap-2">
                <Info className="h-5 w-5 text-primary" />
                <h2 className="font-semibold text-slate-900 dark:text-white">Payment Request</h2>
              </div>
              <div className="p-6 space-y-4">
                {prLoading ? (
                  <p className="text-sm text-slate-400 italic">Loading payment requests...</p>
                ) : eligiblePRs.length === 0 ? (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50">
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      No Payment Requests found for this PO.
                    </p>
                  </div>
                ) : (
                  <>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Select Request <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedPR}
                      onChange={(e) => { setSelectedPR(e.target.value); }}
                      className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary appearance-none"
                    >
                      <option value="">Select a payment request</option>
                      {eligiblePRs.map((pr) => {
                        const isApproved = pr.status === 'approved';
                        return (
                          <option key={pr.id} value={pr.id} disabled={!isApproved}>
                            {pr.request_number} — {pr.status.toUpperCase()}
                            {isApproved ? ` — ₱${pr.remaining.toLocaleString()} available` : ''}
                          </option>
                        );
                      })}
                    </select>

                    {/* PR detail summary when selected */}
                    {currentPR && (
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Request</span>
                          <span className="font-semibold text-slate-900 dark:text-white">{currentPR.request_number}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Status</span>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${
                            currentPR.status === 'fully_invoiced'
                              ? 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
                              : currentPR.status === 'approved'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400'
                              : currentPR.status === 'rejected'
                              ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400'
                              : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400'
                          }`}>
                            {currentPR.status.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Approved Amount</span>
                          <span className="font-semibold text-slate-900 dark:text-white">₱{currentPR.amount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Already Invoiced</span>
                          <span className="font-semibold text-slate-900 dark:text-white">₱{currentPR.consumed.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-xs pt-1 border-t border-slate-200 dark:border-slate-700">
                          <span className="text-slate-500">Remaining Balance</span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">₱{balanceRemaining.toLocaleString()}</span>
                        </div>
                      </div>
                    )}

                    {/* Carry-forward / Overage display */}
                    {currentPR && parsedAmount > 0 && (
                      <div className={`p-3 rounded-xl border text-xs space-y-1 ${
                        isOverage
                          ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/50'
                          : carryForward > 0
                            ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/50'
                            : 'bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800'
                      }`}>
                        {isOverage ? (
                          <>
                            <div className="flex items-center gap-1.5 text-red-700 dark:text-red-400">
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                              <span className="font-semibold">Overage: ₱{overageAmount.toLocaleString()}</span>
                            </div>
                            <p className="text-red-600/80 dark:text-red-400/60">
                              This amount exceeds the remaining balance (₱{balanceRemaining.toLocaleString()}).
                              An admin/finance override will be required to approve this invoice.
                            </p>
                            <label className="flex items-start gap-2 mt-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={overageConfirmed}
                                onChange={(e) => setOverageConfirmed(e.target.checked)}
                                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                              />
                              <span className="text-red-700 dark:text-red-400">
                                I confirm I want to invoice ₱{parsedAmount.toLocaleString()} against {currentPR.request_number} (₱{overageAmount.toLocaleString()} overage)
                              </span>
                            </label>
                          </>
                        ) : carryForward > 0 ? (
                          <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                            <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                            <span className="font-semibold">{currentPR.request_number} carry-forward: ₱{carryForward.toLocaleString()}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                            <Info className="h-3.5 w-3.5 shrink-0" />
                            <span>Exact amount — no carry-forward</span>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {!staged && (
            <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center gap-3">
                <Upload className="h-5 w-5 text-primary" />
                <h2 className="font-semibold text-slate-900 dark:text-white">Attachment</h2>
              </div>
              <div className="p-6">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Invoice Scan (PDF/IMG)</label>
                <p className="text-[10px] text-slate-400 mt-1 mb-2">Or use &ldquo;Scan invoice&rdquo; above to also extract data.</p>
                <input
                  name="file"
                  type="file"
                  className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-4">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="px-6 py-2.5 rounded-xl font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending || (isOverage && !overageConfirmed)}
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl font-medium transition-all hover:shadow-lg hover:shadow-primary/20 active:scale-95"
        >
          {isPending ? (
            <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Save className="h-5 w-5" />
          )}
          Record Invoice
        </button>
      </div>
    </form>
  );
}