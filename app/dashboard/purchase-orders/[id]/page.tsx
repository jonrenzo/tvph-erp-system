import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import {
  ArrowLeft,
  Building2,
  Calendar,
  FileText,
  CircleDollarSign,
  CheckCircle2,
  XCircle,
  Send,
  AlertCircle,
  CreditCard,
  Clock,
  User,
  Mail,
  FolderGit2,
  FileDown,
  MapPin,
  Pencil,
  ShieldAlert,
  ShieldCheck,
  ClipboardCheck,
  TrendingUp,
} from "lucide-react";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { POProjectAssigner } from "@/components/dashboard/purchase-orders/po-project-assigner";
import { RecentActivity } from "@/components/dashboard/shared/recent-activity";
import { PODownloadDropdown } from "@/components/dashboard/purchase-orders/po-download-dropdown";
import { PoResendButton } from "@/components/dashboard/purchase-orders/po-resend-button";
import { PoIssueButton } from "@/components/dashboard/purchase-orders/po-issue-button";
import { PoApprovalActions } from "@/components/dashboard/purchase-orders/po-approval-actions";
import { PoCertUpload } from "@/components/dashboard/purchase-orders/po-cert-upload";
import { getCurrentProfile, hasCapability } from "@/lib/auth/permissions";
import { isAdminOrAbove } from "@/lib/auth/roles";
import { signDocUrls } from "@/utils/storage";

export const unstable_instant = { 
  prefetch: 'static',
  samples: [{ params: { id: 'sample-id' } }]
};

export default function PurchaseOrderDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<PODetailSkeleton />}>
      <PODetailContent paramsPromise={props.params} />
    </Suspense>
  );
}

async function PODetailContent({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const supabase = await createClient();

  const [{ data: po, error }, { user: currentUser, role: currentRole }] = await Promise.all([
    supabase
      .from("purchase_orders")
      .select(
        `
        *,
        vendors (
          name,
          contact_person,
          contact_email
        )
      `,
      )
      .eq("id", params.id)
      .single(),
    getCurrentProfile(supabase),
  ]);

  if (error || !po) {
    notFound();
  }

  // Fetch all projects to allow assignment (many-to-many architecture)
  const { data: allProjects } = await supabase
    .from("projects")
    .select("id, name")
    .is("deleted_at", null)
    .order("name");

  // Fetch all invoices linked to this PO
  const { data: invoices } = await supabase
    .from("service_invoices")
    .select("id, amount, status, invoice_number")
    .eq("po_id", po.id);

  // Fetch line items
  const { data: lineItems } = await supabase
    .from("po_line_items")
    .select("*")
    .eq("po_id", po.id)
    .order("line_no");

  // Fetch site details
  const { data: siteDetails } = await supabase
    .from("po_site_details")
    .select("*")
    .eq("po_id", po.id)
    .order("sn");

  // Latest PO email attempt — drives the "email not sent" banner.
  const { data: lastPoEmail } = await supabase
    .from("email_log")
    .select("status, error, created_at")
    .eq("kind", "po_issued")
    .eq("ref_id", po.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const canSendEmail = hasCapability(currentRole, "email.send");
  const isAdmin = isAdminOrAbove(currentRole);
  const canApprovePO = hasCapability(currentRole, "po.approve");

  const invoiceIds = invoices?.map((i) => i.id) || [];

  // Fetch all payments for those invoices
  const { data: payments } = await supabase
    .from("payments")
    .select("amount_paid")
    .in("invoice_id", invoiceIds);

  // Fetch waiver profile names if needed
  const waiverProfileIds = [
    po.waived_by,
    po.waiver_approved_by,
  ].filter(Boolean) as string[];

  const waiverProfiles: Record<string, string> = {};
  if (waiverProfileIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", waiverProfileIds);
    for (const p of profiles || []) {
      waiverProfiles[p.id] = p.full_name;
    }
  }

  // Fetch completion certificates for this PO
  const { data: certs } = await supabase
    .from('po_completion_certificates')
    .select('id, percent_complete, status, file_url, file_name, notes, submitted_by, submitted_at, approved_by, approved_at')
    .eq('po_id', po.id)
    .order('submitted_at', { ascending: false });

  // Resolve profile names for cert submitters/approvers
  const certProfileIds = [...new Set([
    ...(certs || []).map(c => c.submitted_by),
    ...(certs || []).map(c => c.approved_by),
  ].filter(Boolean))] as string[];

  const certProfiles: Record<string, string> = {};
  if (certProfileIds.length > 0) {
    const { data: certProfileRows } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', certProfileIds);
    for (const p of certProfileRows || []) certProfiles[p.id] = p.full_name;
  }

  // Sign file URLs for certs
  const signedCerts = await signDocUrls(supabase, 'vendor-documents', certs || []);

  // Max approved completion % drives the billing ceiling
  const maxApprovedPercent = (certs || [])
    .filter(c => c.status === 'approved')
    .reduce((max, c) => Math.max(max, Number(c.percent_complete)), 0) || null;

  const totalPaid =
    payments?.reduce((sum, p) => sum + Number(p.amount_paid), 0) || 0;
  const totalInvoiced =
    invoices?.reduce((sum, i) => sum + Number(i.amount), 0) || 0;
  const poAmount = Number(po.amount);
  const dpAmount = Number(po.dp_amount || 0);
  const effectiveBilled = totalInvoiced + dpAmount;
  const billingPct = poAmount > 0 ? Math.round((effectiveBilled / poAmount) * 100) : 0;
  const compPct = maxApprovedPercent || 0;
  const billingVariance = compPct - billingPct;

  const remainingBalance = Math.max(0, poAmount - totalPaid);
  const overpaidAmount = Math.max(0, totalPaid - poAmount);
  const progress = Math.min(100, Math.round((totalPaid / poAmount) * 100)) || 0;
  const isOverpaid = totalPaid > poAmount;

  // Downpayment tranche split: PO is billed as DP + the balance after DP.
  const dpTarget = Number(po.dp_amount || 0);
  const balanceAfterDp = Math.max(0, poAmount - dpTarget);

  // Billing ceiling from approved cert (null = no cap beyond poAmount)
  const billingCeiling = maxApprovedPercent !== null ? (maxApprovedPercent / 100) * poAmount : null;
  const availableToBill = billingCeiling !== null ? Math.max(0, billingCeiling - totalInvoiced) : Math.max(0, poAmount - totalInvoiced);

  // Cert permissions
  const canSubmitCert = hasCapability(currentRole, 'po.write');
  const canApproveCert = hasCapability(currentRole, 'po.approve_completion');

  // Waiver state
  const isPendingApproval = po.requirements_waived && !po.waiver_approved;
  const isWaiverApproved = po.requirements_waived && po.waiver_approved;
  const canApproveWaiver = hasCapability(currentRole, "po.approve_waiver") && isPendingApproval && currentUser?.id !== po.waived_by;
  const waivedGateLabels = ((po.waived_requirements as string[] | null) || [])
    .map((g: string) => g === "nda" ? "Signed NDA" : g === "vendor_status" ? "Vendor Active Status" : g)
    .join(", ");

  return (
    <div className="p-6 lg:p-8 max-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link
            href="/dashboard/purchase-orders"
            className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors mt-1"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">
                {po.po_number}
              </h1>
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${
                  po.status === "paid"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400"
                    : po.status === "overpaid"
                      ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400"
                      : po.status === "issued"
                        ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400"
                        : po.status === "pending_approval"
                          ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400"
                          : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                {po.status.replace(/_/g, " ").toUpperCase()}
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Vendor:{" "}
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {po.vendors?.name}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 md:ml-auto">
          {po.status === "draft" && hasCapability(currentRole, "po.status") && (
            <PoIssueButton poId={po.id} isAdmin={isAdmin} />
          )}
          {["issued", "paid", "overpaid"].includes(po.status) && canSendEmail && (
            <PoResendButton poId={po.id} />
          )}
          <PODownloadDropdown poId={po.id} />
          <Link
            href={`/dashboard/purchase-orders/${po.id}/editor`}
            className="inline-flex items-center gap-2 bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm active:scale-95"
          >
            <Pencil className="h-4 w-4" />
            Edit DOCX
          </Link>
        </div>
      </div>

      {/* Email-failed banner — the PO was issued but the vendor email didn't send */}
      {lastPoEmail?.status === "failed" && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50">
          <Mail className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
              Vendor email was not sent
            </p>
            <p className="text-xs text-amber-600/80 dark:text-amber-400/60 mt-1">
              {lastPoEmail.error || "The last attempt to email this PO to the vendor failed."}
              {canSendEmail ? " Use “Resend to Vendor” above to try again." : ""}
            </p>
          </div>
        </div>
      )}

      {/* PO Approval Banners */}
      {po.status === "pending_approval" && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50">
          <div className="flex items-start gap-3 flex-1">
            <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                Awaiting Executive Approval
              </p>
              <p className="text-xs text-amber-600/80 dark:text-amber-400/60 mt-1">
                This PO has been submitted for approval and <span className="font-semibold">cannot be sent to the vendor</span> until an admin approves it.
              </p>
            </div>
          </div>
          {canApprovePO && <PoApprovalActions poId={po.id} />}
        </div>
      )}

      {po.status === "draft" && po.rejection_reason && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/50">
          <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">
              Approval Rejected — Returned to Draft
            </p>
            <p className="text-xs text-red-600/80 dark:text-red-400/60 mt-1">
              Reason: <span className="font-medium">{po.rejection_reason}</span>
            </p>
          </div>
        </div>
      )}

      {/* Waiver Banners */}
      {isPendingApproval && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-2xl bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800/50">
          <div className="flex items-start gap-3 flex-1">
            <ShieldAlert className="h-5 w-5 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-orange-700 dark:text-orange-400">
                Requirements Waived — Pending Executive Approval
              </p>
              <p className="text-xs text-orange-600/80 dark:text-orange-400/60 mt-1">
                Waived: <span className="font-medium">{waivedGateLabels}</span>.
                Waived by <span className="font-medium">{waiverProfiles[po.waived_by] || "Admin"}</span>.
                This PO <span className="font-semibold">cannot be issued</span> until an executive approves.
              </p>
            </div>
          </div>
          {canApproveWaiver && (
            <div className="flex items-center gap-2 shrink-0">
              <form
                action={async () => {
                  "use server";
                  const { approveWaiver } = await import("../actions");
                  await approveWaiver(params.id);
                }}
              >
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Approve
                </button>
              </form>
              <form
                action={async () => {
                  "use server";
                  const { rejectWaiver } = await import("../actions");
                  await rejectWaiver(params.id);
                }}
              >
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95"
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {isWaiverApproved && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/50">
          <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">
              Requirements Waived — Approved
            </p>
            <p className="text-xs text-blue-600/80 dark:text-blue-400/60 mt-1">
              Waived: <span className="font-medium">{waivedGateLabels}</span>.
              Approved by <span className="font-medium">{waiverProfiles[po.waiver_approved_by] || "Executive"}</span>
              {po.waiver_approved_at ? ` on ${new Date(po.waiver_approved_at).toLocaleDateString(undefined, { dateStyle: "long" })}` : ""}.
            </p>
          </div>
        </div>
      )}

      {/* Completion Certificates */}
      {(signedCerts.length > 0 || canSubmitCert) && (
        <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" /> Completion Certificates
            </h2>
            {maxApprovedPercent !== null && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50">
                <TrendingUp className="h-3 w-3" /> {maxApprovedPercent}% Approved
              </span>
            )}
          </div>
          <div className="p-6 space-y-4">
            {signedCerts.length > 0 ? (
              <div className="space-y-3">
                {signedCerts.map((cert) => {
                  const isPendingCert = cert.status === 'submitted';
                  const isApproved = cert.status === 'approved';
                  const isRejected = cert.status === 'rejected';
                  const canActOnCert = canApproveCert && isPendingCert && cert.submitted_by !== currentUser?.id;
                  return (
                    <div key={cert.id} className={`flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border ${
                      isApproved ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/50'
                      : isRejected ? 'bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 opacity-60'
                      : 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/50'
                    }`}>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-slate-900 dark:text-white">{Number(cert.percent_complete)}% Complete</span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            isApproved ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : isRejected ? 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
                            : 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400'
                          }`}>
                            {cert.status.toUpperCase()}
                          </span>
                          {cert.file_url && (
                            <a href={cert.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline font-medium">
                              {cert.file_name || 'View File'}
                            </a>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">
                          Submitted by {certProfiles[cert.submitted_by] || 'PM'} on {new Date(cert.submitted_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                          {isApproved && cert.approved_by && ` · Approved by ${certProfiles[cert.approved_by] || 'Admin'}`}
                        </p>
                        {cert.notes && <p className="text-xs text-slate-600 dark:text-slate-400 italic">{cert.notes}</p>}
                      </div>
                      {canActOnCert && (
                        <div className="flex items-center gap-2 shrink-0">
                          <form action={async () => {
                            'use server';
                            const { approveCompletionCertificate } = await import('../actions');
                            await approveCompletionCertificate(cert.id);
                          }}>
                            <button type="submit" className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                            </button>
                          </form>
                          <form action={async () => {
                            'use server';
                            const { rejectCompletionCertificate } = await import('../actions');
                            await rejectCompletionCertificate(cert.id);
                          }}>
                            <button type="submit" className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95">
                              <XCircle className="h-3.5 w-3.5" /> Reject
                            </button>
                          </form>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">No certificates submitted yet.</p>
            )}
            {canSubmitCert && (
              <PoCertUpload poId={po.id} vendorId={po.vendor_id} />
            )}
          </div>
        </div>
      )}

      {/* New Intuitive Financial Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Balance Ring/Card */}
        <div className="md:col-span-2 bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-sm flex flex-col md:flex-row items-center gap-8">
          <div className="relative h-40 w-40 shrink-0">
            <svg className="h-full w-full -rotate-90">
              <circle
                cx="80"
                cy="80"
                r="70"
                fill="none"
                stroke="currentColor"
                strokeWidth="12"
                className="text-slate-100 dark:text-slate-800"
              />
              <circle
                cx="80"
                cy="80"
                r="70"
                fill="none"
                stroke="currentColor"
                strokeWidth="12"
                strokeDasharray={440}
                strokeDashoffset={440 - (440 * progress) / 100}
                strokeLinecap="round"
                className={isOverpaid ? "text-red-500" : "text-primary"}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-bold text-slate-900 dark:text-white">
                {progress}%
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Paid
              </span>
            </div>
          </div>

          <div className="flex-1 space-y-6 w-full">
            <div className="grid grid-cols-2 gap-8">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                  Original Commitment
                </label>
                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                  ₱{poAmount.toLocaleString()}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                  Total Paid to Date
                </label>
                <div
                  className={`text-2xl font-bold ${isOverpaid ? "text-red-600" : "text-emerald-600 dark:text-emerald-400"}`}
                >
                  ₱{totalPaid.toLocaleString()}
                </div>
              </div>
            </div>

            {dpTarget > 0 && (
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                    Downpayment
                  </label>
                  <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    ₱{dpTarget.toLocaleString()}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                    Balance after Downpayment
                  </label>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white">
                    ₱{balanceAfterDp.toLocaleString()}
                  </div>
                </div>
              </div>
            )}

            <div className="pt-6 border-t border-slate-100 dark:border-slate-800/50">
              {isOverpaid ? (
                <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 rounded-2xl">
                  <AlertCircle className="h-6 w-6 text-red-500" />
                  <div>
                    <p className="text-xs font-bold text-red-800 dark:text-red-400 uppercase">
                      Overpaid Balance
                    </p>
                    <p className="text-lg font-bold text-red-600">
                      ₱{overpaidAmount.toLocaleString()}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 rounded-2xl">
                  <CreditCard className="h-6 w-6 text-slate-400" />
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase">
                      Remaining to Pay
                    </p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                      ₱{remainingBalance.toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Invoicing Progress Card */}
        <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Billing Health
          </h3>
          <div className="space-y-4">
            {/* Completion vs Billing */}
            <div>
              <div className="flex justify-between text-xs font-bold mb-2">
                <span className="text-slate-500 uppercase">Billing % (incl. DP)</span>
                <span className={effectiveBilled > poAmount ? "text-red-500" : "text-slate-900 dark:text-white"}>
                  {billingPct}%
                </span>
              </div>
              <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full ${effectiveBilled > poAmount ? "bg-red-500" : "bg-blue-500"}`}
                  style={{ width: `${Math.min(100, billingPct)}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold mb-2">
                <span className="text-slate-500 uppercase">Completion %</span>
                <span className="text-emerald-600 dark:text-emerald-400">{compPct}%</span>
              </div>
              <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${Math.min(100, compPct)}%` }}
                ></div>
              </div>
            </div>

            {/* Variance */}
            <div className={`p-3 rounded-xl text-center ${
              billingVariance > 0
                ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50'
                : billingVariance < 0
                  ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50'
                  : 'bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800'
            }`}>
              {billingVariance > 0 ? (
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  Need to pay {billingVariance}% more
                </p>
              ) : billingVariance < 0 ? (
                <p className="text-xs font-bold text-red-700 dark:text-red-400">
                  Overpaid by {Math.abs(billingVariance)}%
                </p>
              ) : (
                <p className="text-xs font-bold text-slate-500">On track</p>
              )}
            </div>

            <div className="pt-4 space-y-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Bills Received</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  ₱{totalInvoiced.toLocaleString()}
                </span>
              </div>
              {dpAmount > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Downpayment (DP)</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    ₱{dpAmount.toLocaleString()} ({Math.round((dpAmount / poAmount) * 100)}%)
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center text-sm font-semibold">
                <span className="text-slate-700 dark:text-slate-300">Effective Billed</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  ₱{effectiveBilled.toLocaleString()} ({billingPct}%)
                </span>
              </div>
              {billingCeiling !== null ? (
                <>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Approved Ceiling ({maxApprovedPercent}%)</span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">
                      ₱{billingCeiling.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Available to Bill</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      ₱{availableToBill.toLocaleString()}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Unbilled PO Amount</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    ₱{Math.max(0, poAmount - effectiveBilled).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Details */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" /> PO Details
              </h2>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Description
                </label>
                <p className="mt-1 text-slate-900 dark:text-slate-300 text-lg">
                  {po.description || "No description provided"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-8 pt-4 border-t border-slate-100 dark:border-slate-800/50">
                <div>
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" /> Issued Date
                  </label>
                  <p className="mt-1 text-slate-900 dark:text-slate-300 font-medium">
                    {new Date(po.issued_date).toLocaleDateString(undefined, {
                      dateStyle: "long",
                    })}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> Due Date
                  </label>
                  <p className="mt-1 text-slate-900 dark:text-slate-300 font-medium">
                    {po.due_date
                      ? new Date(po.due_date).toLocaleDateString(undefined, {
                          dateStyle: "long",
                        })
                      : "No due date set"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          {lineItems && lineItems.length > 0 && (
            <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center justify-between">
                <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <CircleDollarSign className="h-5 w-5 text-primary" /> Line Items
                </h2>
                <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs px-2 py-0.5 rounded-full font-bold">
                  {lineItems.length}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-[10px] text-slate-500 uppercase bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-4 py-3 font-semibold w-12">#</th>
                      <th className="px-4 py-3 font-semibold w-24">Item Code</th>
                      <th className="px-4 py-3 font-semibold">Description</th>
                      <th className="px-4 py-3 font-semibold w-16 text-right">Qty</th>
                      <th className="px-4 py-3 font-semibold w-16">UoM</th>
                      <th className="px-4 py-3 font-semibold w-28 text-right">Unit Price</th>
                      <th className="px-4 py-3 font-semibold w-28 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {lineItems.map((li: any) => (
                      <tr key={li.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                        <td className="px-4 py-3 text-slate-400 font-mono text-xs">{li.line_no}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{li.item_code || '—'}</td>
                        <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">{li.description}</td>
                        <td className="px-4 py-3 text-right text-slate-900 dark:text-white">{Number(li.qty).toLocaleString()}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{li.uom}</td>
                        <td className="px-4 py-3 text-right text-slate-900 dark:text-white">₱{Number(li.unit_price).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-white">₱{Number(li.amount).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/20">
                      <td colSpan={6} className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Total
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">
                        ₱{lineItems.reduce((sum: number, li: any) => sum + Number(li.amount), 0).toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Site Details Table */}
          {siteDetails && siteDetails.length > 0 && (
            <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                <h2 className="font-semibold text-slate-900 dark:text-white">Sites &amp; Details</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-[10px] text-slate-500 uppercase bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-4 py-3 font-semibold w-12">S/N</th>
                      <th className="px-4 py-3 font-semibold">Region</th>
                      <th className="px-4 py-3 font-semibold">Area / City</th>
                      <th className="px-4 py-3 font-semibold w-28 text-right">No. of Nodes</th>
                      <th className="px-4 py-3 font-semibold w-36 text-right">Cable Length (KM)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {siteDetails.map((site: any) => (
                      <tr key={site.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                        <td className="px-4 py-3 text-slate-400 font-mono text-xs">{site.sn}</td>
                        <td className="px-4 py-3 text-slate-900 dark:text-white">{site.region}</td>
                        <td className="px-4 py-3 text-slate-900 dark:text-white">{site.area_city}</td>
                        <td className="px-4 py-3 text-right text-slate-900 dark:text-white">{Number(site.no_of_nodes).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-slate-900 dark:text-white">{Number(site.cable_length_km).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/20">
                      <td colSpan={3} className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Total</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">
                        {siteDetails.reduce((sum: number, s: any) => sum + Number(s.no_of_nodes), 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">
                        {siteDetails.reduce((sum: number, s: any) => sum + Number(s.cable_length_km), 0).toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Linked Invoices Section Placeholder */}
          <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900 dark:text-white">
                Linked Invoices
              </h2>
              <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs px-2 py-0.5 rounded-full font-bold">
                {invoices?.length || 0}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[10px] text-slate-500 uppercase bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Invoice #</th>
                    <th className="px-6 py-3 font-semibold">Amount</th>
                    <th className="px-6 py-3 font-semibold">Status</th>
                    <th className="px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {invoices?.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-12 text-center text-slate-400 italic"
                      >
                        No invoices linked to this PO yet.
                      </td>
                    </tr>
                  ) : (
                    invoices?.map((inv: any) => (
                      <tr
                        key={inv.id}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors"
                      >
                        <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                          {inv.invoice_number}
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">
                          ₱{Number(inv.amount).toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              inv.status === "paid"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400"
                                : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400"
                            }`}
                          >
                            {inv.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link
                            href={`/dashboard/invoices/${inv.id}`}
                            className="text-primary hover:underline font-medium"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Vendor Info */}
        <div className="space-y-8">
          <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-4">
              Vendor Information
            </h3>
            <div className="space-y-4">
              <Link
                href={`/dashboard/vendors/${po.vendor_id}`}
                className="block group"
              >
                <div className="font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">
                  {po.vendors?.name}
                </div>
                <div className="text-sm text-slate-500 flex items-center gap-1.5 mt-1">
                  View Profile <ArrowLeft className="h-3 w-3 rotate-180" />
                </div>
              </Link>
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800/50 space-y-3">
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <User className="h-4 w-4" />{" "}
                  {po.vendors?.contact_person || "N/A"}
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <Mail className="h-4 w-4" />{" "}
                  {po.vendors?.contact_email || "N/A"}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <FolderGit2 className="h-4 w-4 text-primary" /> Associated Project
            </h3>
            <POProjectAssigner 
              poId={po.id} 
              currentProjectId={po.project_id} 
              projects={allProjects || []} 
            />
          </div>

          <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-2xl p-6">
            <h3 className="font-semibold text-primary dark:text-primary mb-2">
              Internal Note
            </h3>
            <p className="text-sm text-primary/80 leading-relaxed italic">
              &quot;Please ensure the service report is attached when submitting
              invoices against this PO.&quot;
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PODetailSkeleton() {
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-pulse">
      <div className="h-10 w-64 bg-slate-100 dark:bg-slate-800/50 rounded-lg" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="md:col-span-2 h-64 bg-slate-100 dark:bg-slate-800/50 rounded-3xl" />
         <div className="h-64 bg-slate-100 dark:bg-slate-800/50 rounded-3xl" />
      </div>
    </div>
  );
}
