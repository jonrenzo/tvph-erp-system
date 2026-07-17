"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Send,
  Loader2,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { createPaymentRequest } from "@/app/dashboard/purchase-orders/actions";
import { DocumentList } from "@/components/dashboard/vendors/document-list";

const COMPLIANCE_DOC_TYPES = [
  "signed_nda",
  "statement_of_commitment",
  "company_profile",
  "products_services_list",
  "vendor_information_summary",
  "general_information_sheet",
  "audited_financial_statements",
  "sec_registration",
  "secretary_certificate",
  "safety_drug_policy",
  "iso_certification",
  "pcab_license",
  "dole_174",
  "other_licenses",
];

interface VendorDoc {
  id: string;
  doc_type: string;
  status: string;
  file_url?: string;
  file_name?: string;
  expiry_date?: string;
  version_number?: number;
  label?: string;
}

interface ApprovedCert {
  id: string;
  percent_complete: number;
}

interface Props {
  poId: string;
  poNumber: string;
  poAmount: number;
  vendorId: string;
  vendorName: string;
  vendorDocuments: VendorDoc[];
  approvedCerts: ApprovedCert[];
  userRole: string;
}

export function SendPaymentRequestPanel({
  poId,
  poNumber,
  poAmount,
  vendorId,
  vendorName,
  vendorDocuments,
  approvedCerts,
  userRole,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [dueInDays, setDueInDays] = useState("30");
  const [notes, setNotes] = useState("");
  const [selectedCertId, setSelectedCertId] = useState(
    approvedCerts[0]?.id ?? "",
  );

  const docStatusMap: Record<string, VendorDoc> = {};
  for (const doc of vendorDocuments) {
    docStatusMap[doc.doc_type] = doc;
  }

  const approvedDocs = COMPLIANCE_DOC_TYPES.filter(
    (t) => docStatusMap[t]?.status === "approved",
  ).length;
  const submittedDocs = COMPLIANCE_DOC_TYPES.filter(
    (t) =>
      docStatusMap[t]?.status === "submitted" ||
      docStatusMap[t]?.status === "approved",
  ).length;
  const totalDocs = COMPLIANCE_DOC_TYPES.length;
  const progressPercent = Math.round((submittedDocs / totalDocs) * 100);
  const missingOrPending = COMPLIANCE_DOC_TYPES.filter(
    (t) =>
      !docStatusMap[t] || docStatusMap[t]?.status === "submitted",
  );
  const hasComplianceGaps = missingOrPending.length > 0;

  function handleSubmit() {
    setError(null);
    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount.");
      return;
    }
    startTransition(async () => {
      const res = await createPaymentRequest(
        poId,
        parseFloat(amount),
        parseInt(dueInDays) || 30,
        notes || undefined,
        selectedCertId || undefined,
      );
      if (res.error) {
        setError(res.error);
      } else {
        router.push(`/dashboard/purchase-orders/${poId}`);
      }
    });
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0a0a0a]">
      <div className="max-w-5xl mx-auto p-6 lg:p-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link
            href={`/dashboard/purchase-orders/${poId}`}
            className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">
              Send Payment Request
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {poNumber} &mdash; {vendorName}
            </p>
          </div>
        </div>

        {/* Compliance Banner */}
        {hasComplianceGaps ? (
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                Accreditation Compliance &mdash; {approvedDocs} of {totalDocs} approved
              </p>
              <p className="text-xs text-amber-600/80 dark:text-amber-400/60 mt-1">
                Some accreditation documents are not yet approved. You can still proceed, but ensure
                compliance is resolved before final payment.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/50">
            <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                All Accreditation Documents Approved
              </p>
              <p className="text-xs text-emerald-600/80 dark:text-emerald-400/60 mt-1">
                All {totalDocs} required documents have been submitted and approved.
              </p>
            </div>
          </div>
        )}

        {/* Accreditation Documents */}
        <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-slate-900 dark:text-white">
              Vendor Accreditation Documents
            </h2>
            <span className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border bg-primary/10 text-primary border-primary/20">
              {progressPercent}% Complete
            </span>
          </div>
          <div className="p-6">
            <DocumentList
              vendorId={vendorId}
              documents={vendorDocuments}
              userRole={userRole}
            />
          </div>
        </div>

        {/* Payment Request Form */}
        <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-slate-900 dark:text-white">
              Payment Request Details
            </h2>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Enter the amount and due date for this payment request. All
              admins, operations, and finance will be notified.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Amount (₱)
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={`Max: ₱${poAmount.toLocaleString()}`}
                  className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Due In (Days)
                </label>
                <input
                  type="number"
                  value={dueInDays}
                  onChange={(e) => setDueInDays(e.target.value)}
                  min={1}
                  className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>

            {approvedCerts.length > 0 && (
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Completion Certificate
                </label>
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
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Reason for this payment request..."
                className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                rows={2}
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </p>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleSubmit}
                disabled={isPending || !amount}
                className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95 disabled:opacity-60 shadow-sm"
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {isPending ? "Sending..." : "Send Payment Request"}
              </button>
              <Link
                href={`/dashboard/purchase-orders/${poId}`}
                className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              >
                Cancel
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
