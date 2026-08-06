import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { invoiceStatusLabel, invoiceStatusBadgeClasses } from "@/lib/invoices/status";
import {
  ArrowLeft,
  Building2,
  FileText,
  CheckCircle2,
  XCircle,
  Send,
  CreditCard,
  Clock,
  User,
  Mail,
  MapPin,
  FolderGit2,
  History,
  ShieldAlert,
  ShieldCheck,
  ClipboardCheck,
  ClipboardList,
  TrendingUp,
  Pencil,
  Eye,
  Wallet,
} from "lucide-react";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { POProjectAssigner } from "@/components/dashboard/purchase-orders/po-project-assigner";
import { PODownloadDropdown } from "@/components/dashboard/purchase-orders/po-download-dropdown";
import { PoResendButton } from "@/components/dashboard/purchase-orders/po-resend-button";
import { PoIssueButton } from "@/components/dashboard/purchase-orders/po-issue-button";
import { PoMoreDropdown } from "@/components/dashboard/purchase-orders/po-more-dropdown";
import { PoApprovalActions } from "@/components/dashboard/purchase-orders/po-approval-actions";
import { PoCertUpload } from "@/components/dashboard/purchase-orders/po-cert-upload";
import { NotifyFinanceButton } from "@/components/dashboard/purchase-orders/notify-finance-button";
import { PaymentRequestButton } from "@/components/dashboard/purchase-orders/payment-request-button";
import { PoCollapsibleCard } from "@/components/dashboard/purchase-orders/po-collapsible-card";
import { PoTermsCard } from "@/components/dashboard/purchase-orders/po-terms-card";
import { PODetailsEditor } from "@/components/dashboard/purchase-orders/po-details-editor";
import { POLineItemsEditor } from "@/components/dashboard/purchase-orders/po-line-items-editor";
import { POSiteDetailsEditor } from "@/components/dashboard/purchase-orders/po-site-details-editor";
import { POEditHistory } from "@/components/dashboard/purchase-orders/po-edit-history";
import { getCurrentProfile, hasCapability } from "@/lib/auth/permissions";
import { signDocUrls } from "@/utils/storage";

const menuItemClass = "flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors";
const DRAFT_OR_PENDING = ["draft", "pending_approval", "pending_finance"];
const ISSUED_OR_LATER = ["issued", "paid", "overpaid"];

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

  // Fetch all invoices linked to this PO (include PR and carry-forward data)
  const { data: invoices } = await supabase
    .from("service_invoices")
    .select("id, amount, status, invoice_number, payment_request_id, carry_forward_amount")
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

  const { data: penalty } = await supabase
    .from("po_penalties")
    .select("calculated_amount, override_amount, override_reason")
    .eq("po_id", po.id)
    .maybeSingle();

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
  const canApprovePO = hasCapability(currentRole, "po.approve");
  const canApprovePOFinance = hasCapability(currentRole, "po.approve_finance");
  const canEditTerms = hasCapability(currentRole, "po.write");
  const canOverridePenalty = ["finance", "admin", "superadmin"].includes(currentRole || "");

  // Originator-only draft editing: only the user who drafted the PO can fix it
  // while it is still a draft or pending approval. Editing happens on the
  // dedicated /editor page — this page is read-only.
  const isOriginator = !!currentUser && currentUser.id === po.created_by;
  const canEditDraft = isOriginator && ["draft", "pending_approval"].includes(po.status);
  const canEditAny = canEditDraft || (canEditTerms && po.status === "draft");
  const currencySymbol = po.currency === "USD" ? "$" : "₱";

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

  // Resolve PO creator and approver names
  const poProfileIds = [po.created_by, po.approved_by_user_id, po.finance_approved_by_user_id].filter(Boolean) as string[];
  const poProfiles: Record<string, { full_name: string; role: string }> = {};
  if (poProfileIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .in("id", poProfileIds);
    for (const p of profiles || []) {
      poProfiles[p.id] = { full_name: p.full_name, role: p.role };
    }
  }

  const draftedByLabel = poProfiles[po.created_by]
    ? `${poProfiles[po.created_by].full_name} (${poProfiles[po.created_by].role})${
        po.created_at
          ? ` on ${new Date(po.created_at).toLocaleDateString(undefined, { dateStyle: "long" })}`
          : ""
      }`
    : "Unknown";
  const approvedByLabel = po.approved_by_user_id
    ? `${poProfiles[po.approved_by_user_id] ? `${poProfiles[po.approved_by_user_id].full_name} (${poProfiles[po.approved_by_user_id].role})` : "Unknown"} on ${new Date(po.approved_at).toLocaleDateString(undefined, { dateStyle: "long" })}`
    : "Not yet approved";
  const financeApprovedByLabel = po.finance_approved_by_user_id
    ? `${poProfiles[po.finance_approved_by_user_id] ? `${poProfiles[po.finance_approved_by_user_id].full_name} (${poProfiles[po.finance_approved_by_user_id].role})` : "Unknown"} on ${new Date(po.finance_approved_at).toLocaleDateString(undefined, { dateStyle: "long" })}`
    : po.status === "pending_finance"
      ? "Pending finance budget check"
      : "Not yet approved";

  // Eligible approvers for the submit-for-approval picker: admins/superadmins
  // other than the current user (the 4-eyes rule blocks self-approval). Only
  // needed while the PO is a draft.
  let eligibleApprovers: { id: string; full_name: string; email: string }[] = [];
  if (po.status === "draft" && currentUser) {
    const { data: admins } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("role", ["superadmin", "admin"])
      .neq("id", currentUser.id)
      .order("full_name");
    eligibleApprovers = admins || [];
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
  const dpPct = poAmount > 0 ? Math.min(100, (dpAmount / poAmount) * 100) : 0;
  const invPct = poAmount > 0 ? Math.min(100, (totalInvoiced / poAmount) * 100) : 0;
  const compPct = maxApprovedPercent || 0;
  const billingVariance = compPct - billingPct;

  const remainingBalance = Math.max(0, poAmount - dpAmount - totalPaid);
  const overpaidAmount = Math.max(0, totalPaid - poAmount);
  const isOverpaid = totalPaid > poAmount;

  // Downpayment tranche split: PO is billed as DP + the balance after DP.
  const dpTarget = Number(po.dp_amount || 0);
  const balanceAfterDp = Math.max(0, poAmount - dpTarget);

  // Billing ceiling from approved cert (null = no cap beyond poAmount)
  const billingCeiling = maxApprovedPercent !== null ? (maxApprovedPercent / 100) * poAmount : null;
  const availableToBill = billingCeiling !== null ? Math.max(0, billingCeiling - totalInvoiced) : Math.max(0, poAmount - totalInvoiced);

  // Fetch project completion_pct and active payment reservation in parallel
  const [{ data: project }, { data: activeReservation }] = await Promise.all([
    po.project_id
      ? supabase.from('projects').select('completion_pct').eq('id', po.project_id).single()
      : Promise.resolve({ data: null }),
    supabase
      .from('payment_reservations')
      .select('id, status, reserved_amount')
      .eq('po_id', po.id)
      .in('status', ['pending', 'acknowledged'])
      .maybeSingle(),
  ]);

  // Cert permissions
  const canSubmitCert = hasCapability(currentRole, 'po.write');
  const canApproveCert = hasCapability(currentRole, 'po.approve_completion');

  // Payment reservation
  const canNotify = hasCapability(currentRole, 'payment_reservation.notify');
  const canAcknowledge = hasCapability(currentRole, 'payment_reservation.acknowledge');

  // Fetch latest payment request for this PO
  const { data: paymentRequest } = await supabase
    .from('payment_requests')
    .select('id, request_number, amount, due_in_days, notes, status, completion_cert_id, percent_complete, created_at, rejection_reason, is_downpayment')
    .eq('po_id', po.id)
    .in('status', ['pending', 'approved', 'rejected', 'fully_invoiced'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Compute PR consumption
  const prInvoices = (invoices || []).filter(
    (inv: any) => inv.payment_request_id === paymentRequest?.id
  );
  const prConsumed = prInvoices
    .filter((inv: any) => ['approved', 'partially_paid', 'paid'].includes(inv.status))
    .reduce((sum: number, inv: any) => sum + Number(inv.amount), 0);
  const prRemaining = paymentRequest ? Math.max(0, Number(paymentRequest.amount) - prConsumed) : 0;

  // Approved completion certs available to reference in a PR
  const approvedCerts = (certs || []).filter(c => c.status === 'approved').map(c => ({
    id: c.id,
    percent_complete: Number(c.percent_complete),
    status: c.status,
  }));

  // Payment request capabilities
  const canCreatePR = hasCapability(currentRole, 'payment_request.create');
  const canApprovePR = hasCapability(currentRole, 'payment_request.approve');

  // Waiver state
  const isPendingApproval = po.requirements_waived && !po.waiver_approved;
  const isWaiverApproved = po.requirements_waived && po.waiver_approved;
  const canApproveWaiver = hasCapability(currentRole, "po.approve_waiver") && isPendingApproval && currentUser?.id !== po.waived_by;
  const waivedGateLabels = ((po.waived_requirements as string[] | null) || [])
    .map((g: string) => g === "nda" ? "Signed NDA" : g === "vendor_status" ? "Vendor Active Status" : g)
    .join(", ");

  return (
    <div className="p-6 lg:p-8 max-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-full flex flex-col">
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
                          : po.status === "pending_finance"
                            ? "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-400"
                            : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                {po.status.replace(/_/g, " ").toUpperCase()}
              </span>
              {dpAmount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/50 text-sm font-bold">
                  DP — ₱{dpAmount.toLocaleString()}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Vendor:{" "}
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {po.vendors?.name}
              </span>
              {po.purchase_request_id && (
                <>
                  <span className="text-slate-300 dark:text-slate-600">·</span>
                  <FileText className="h-4 w-4" /> From:{" "}
                  <Link
                    href={`/dashboard/purchase-requests/${po.purchase_request_id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {po.pr_number || "Purchase Request"}
                  </Link>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:ml-auto">
          {po.status === "draft" && hasCapability(currentRole, "po.status") && (
            <PoIssueButton poId={po.id} eligibleApprovers={eligibleApprovers} />
          )}
          {!DRAFT_OR_PENDING.includes(po.status) && (
            <a
              href={`/api/purchase-orders/${po.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white px-3 py-2 rounded-xl text-sm font-medium transition-all shadow-sm active:scale-95 shrink-0 whitespace-nowrap"
            >
              <Eye className="h-4 w-4" />
              View PDF
            </a>
          )}
          <PODownloadDropdown poId={po.id} />
          {(canEditAny ||
            (ISSUED_OR_LATER.includes(po.status) && canSendEmail) ||
            (canCreatePR &&
              (!paymentRequest ||
                paymentRequest.status === "rejected" ||
                paymentRequest.status === "fully_invoiced")) ||
            DRAFT_OR_PENDING.includes(po.status)) && (
            <PoMoreDropdown>
              {DRAFT_OR_PENDING.includes(po.status) && (
                <a
                  href={`/api/purchase-orders/${po.id}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={menuItemClass}
                >
                  <Eye className="h-4 w-4" />
                  View PDF
                </a>
              )}
              {canEditAny && (
                <Link
                  href={`/dashboard/purchase-orders/${po.id}/editor`}
                  className={menuItemClass}
                >
                  <Pencil className="h-4 w-4" />
                  Edit PO
                </Link>
              )}
              {ISSUED_OR_LATER.includes(po.status) && canSendEmail && (
                <PoResendButton poId={po.id} menu />
              )}
              {canCreatePR &&
                (!paymentRequest ||
                  paymentRequest.status === "rejected" ||
                  paymentRequest.status === "fully_invoiced") && (
                  <Link
                    href={`/dashboard/purchase-orders/${po.id}/payment-request`}
                    className={menuItemClass}
                  >
                    <Send className="h-4 w-4" />
                    Send Payment Request
                  </Link>
                )}
            </PoMoreDropdown>
          )}
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
          {canApprovePO && po.submitted_for_approval_by !== currentUser?.id ? (
            <PoApprovalActions poId={po.id} />
          ) : canApprovePO ? (
            <p className="text-xs text-amber-600/80 dark:text-amber-400/60">
              You submitted this PO for approval. Another admin or superadmin must approve it.
            </p>
          ) : null}
        </div>
      )}

      {po.status === "pending_finance" && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-2xl bg-violet-50 dark:bg-violet-900/10 border border-violet-200 dark:border-violet-800/50">
          <div className="flex items-start gap-3 flex-1">
            <Wallet className="h-5 w-5 text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-violet-700 dark:text-violet-400">
                Awaiting Finance Approval
              </p>
              <p className="text-xs text-violet-600/80 dark:text-violet-400/60 mt-1">
                This PO has been approved by admin and <span className="font-semibold">cannot be sent to the vendor</span> until finance completes the budget check.
              </p>
            </div>
          </div>
          {canApprovePOFinance && po.approved_by_user_id !== currentUser?.id ? (
            <PoApprovalActions poId={po.id} stage="finance" />
          ) : canApprovePOFinance ? (
            <p className="text-xs text-violet-600/80 dark:text-violet-400/60">
              You approved this PO as admin. Another finance or superadmin must do the budget check.
            </p>
          ) : null}
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

      {/* Section nav */}
      <nav className="sticky top-0 z-30 flex items-center gap-1 overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-[#071F15]/90 backdrop-blur px-3 py-2 shadow-sm">
        {[
          { href: "#overview", label: "Overview" },
          { href: "#certificates", label: "Certificates" },
          { href: "#invoices", label: "Invoices" },
          { href: "#details", label: "Details" },
          { href: "#history", label: "History" },
          { href: "#vendor", label: "Vendor" },
        ].map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="px-3 py-1.5 rounded-full text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap"
          >
            {item.label}
          </a>
        ))}
      </nav>

      {/* Financial Summary */}
      <section id="overview" className="scroll-mt-28">
        <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" /> Financial Summary
            </h2>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${
              isOverpaid
                ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50"
                : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50"
            }`}>
              {isOverpaid ? `Overpaid ₱${overpaidAmount.toLocaleString()}` : "On Track"}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Hero */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                {isOverpaid ? "Overpaid Balance" : "Remaining to Pay"}
              </label>
              <div className={`text-3xl font-bold ${isOverpaid ? "text-red-600" : "text-slate-900 dark:text-white"}`}>
                ₱{(isOverpaid ? overpaidAmount : remainingBalance).toLocaleString()}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {isOverpaid
                  ? "Total payments exceeded the PO amount."
                  : "Outstanding balance after downpayment and all payments."}
              </p>
            </div>

            {/* Progress bars + variance */}
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs font-bold mb-1.5">
                  <span className="text-slate-500 uppercase">Billing % (incl. DP)</span>
                  <span className={effectiveBilled > poAmount ? "text-red-500" : "text-slate-900 dark:text-white"}>
                    {billingPct}%
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                  {effectiveBilled > poAmount ? (
                    <div className="h-full bg-red-500 flex-1" />
                  ) : (
                    <>
                      {dpPct > 0 && (
                        <div className="h-full bg-amber-500" style={{ width: `${Math.min(100, dpPct)}%` }} />
                      )}
                      {invPct > 0 && (
                        <div className="h-full bg-blue-500" style={{ width: `${Math.min(100 - dpPct, invPct)}%` }} />
                      )}
                    </>
                  )}
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs font-bold mb-1.5">
                  <span className="text-slate-500 uppercase">Completion %</span>
                  <span className="text-emerald-600 dark:text-emerald-400">{compPct}%</span>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${Math.min(100, compPct)}%` }}
                  />
                </div>
              </div>
              <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${
                isOverpaid
                  ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-400"
                  : billingVariance > 0
                    ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-400"
                    : billingVariance < 0
                      ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 text-amber-700 dark:text-amber-400"
                      : "bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 text-slate-500"
              }`}>
                {billingVariance > 0
                  ? `Need to pay ${billingVariance}% more`
                  : isOverpaid
                    ? `Overpaid by ${Math.abs(billingVariance)}%`
                    : billingVariance < 0
                      ? `Billed ahead by ${Math.abs(billingVariance)}%`
                      : "On track"}
              </div>
            </div>
          </div>

          {/* Secondary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4 pt-5 border-t border-slate-100 dark:border-slate-800">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Original Commitment</label>
              <div className="text-sm font-bold text-slate-900 dark:text-white">₱{poAmount.toLocaleString()}</div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Total Paid to Date</label>
              <div className={`text-sm font-bold ${isOverpaid ? "text-red-600" : "text-emerald-600 dark:text-emerald-400"}`}>
                ₱{totalPaid.toLocaleString()}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Downpayment</label>
              <div className="text-sm font-bold text-amber-600 dark:text-amber-400">
                {dpTarget > 0 ? `₱${dpTarget.toLocaleString()}` : "—"}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Balance after DP</label>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                {dpTarget > 0 ? `₱${balanceAfterDp.toLocaleString()}` : "—"}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Bills Received</label>
              <div className="text-sm font-bold text-slate-900 dark:text-white">₱{totalInvoiced.toLocaleString()}</div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Effective Billed</label>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                ₱{effectiveBilled.toLocaleString()} ({billingPct}%)
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                {billingCeiling !== null ? "Approved Ceiling" : "Unbilled PO Amount"}
              </label>
              <div className={`text-sm font-bold ${billingCeiling !== null ? "text-emerald-700 dark:text-emerald-400" : "text-slate-900 dark:text-white"}`}>
                ₱{(billingCeiling !== null ? billingCeiling : Math.max(0, poAmount - effectiveBilled)).toLocaleString()}
                {billingCeiling !== null && ` (${maxApprovedPercent}%)`}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                {billingCeiling !== null ? "Available to Bill" : "Ceiling"}
              </label>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                {billingCeiling !== null
                  ? `₱${availableToBill.toLocaleString()} (${Math.max(0, compPct - billingPct)}%)`
                  : "Full PO amount"}
              </div>
            </div>
          </div>

          {canEditDraft && dpTarget === 0 && (
            <p className="text-xs text-slate-500">No downpayment set. Add one on the Edit PO page while this PO is a draft.</p>
          )}

          {/* Payment Request Consumption */}
          {paymentRequest && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-3">
                Payment Request: {paymentRequest.request_number}
                {paymentRequest.is_downpayment && (
                  <span className="ml-1.5 inline-flex items-center px-1 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700">
                    DP
                  </span>
                )}
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Approved Amount</span>
                  <span className="font-bold text-slate-900 dark:text-white">₱{Number(paymentRequest.amount).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Invoiced</span>
                  <span className="font-bold text-slate-900 dark:text-white">₱{prConsumed.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Remaining / Carry-Forward</span>
                  <span className={`font-bold ${prRemaining > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`}>
                    {paymentRequest.status === "fully_invoiced" ? "Fully Invoiced" : `₱${prRemaining.toLocaleString()}`}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Status</span>
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${
                    paymentRequest.status === "fully_invoiced"
                      ? "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400"
                      : paymentRequest.status === "approved"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400"
                        : paymentRequest.status === "rejected"
                          ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400"
                          : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400"
                  }`}>
                    {paymentRequest.status.replace(/_/g, " ").toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Payment Request */}
      <PaymentRequestButton
        poId={po.id}
        poAmount={poAmount}
        paymentRequest={paymentRequest as any}
        approvedCerts={approvedCerts}
        canCreate={canCreatePR}
        canApprove={canApprovePR}
        consumed={prConsumed}
        remaining={prRemaining}
      />

      {/* Payment Notification */}
      <NotifyFinanceButton
        poId={po.id}
        reservationId={activeReservation?.id ?? null}
        reservationStatus={(activeReservation?.status as any) ?? null}
        reservedAmount={activeReservation ? Number(activeReservation.reserved_amount) : remainingBalance}
        canNotify={canNotify}
        canAcknowledge={canAcknowledge}
        projectCompletionPct={project ? Number((project as any).completion_pct ?? 0) : null}
      />

      {/* Completion Certificates */}
      {(signedCerts.length > 0 || canSubmitCert) && (
        <section id="certificates" className="scroll-mt-28 bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
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
        </section>
      )}

      {/* Linked Invoices */}
      <section id="invoices" className="scroll-mt-28 bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
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
                <th className="px-6 py-3 font-semibold">Payment Request</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold text-right">Carry-Forward</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {invoices?.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
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
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {inv.payment_request_id
                        ? (invoices as any[])?.find((i: any) => i.id === inv.id)?.carry_forward_amount != null
                          ? 'PR linked'
                          : 'PR linked'
                        : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${invoiceStatusBadgeClasses(inv.status)}`}
                      >
                        {invoiceStatusLabel(inv.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {inv.carry_forward_amount != null && (
                        <span className={`text-xs font-semibold ${
                          Number(inv.carry_forward_amount) > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : Number(inv.carry_forward_amount) < 0
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-slate-400'
                        }`}>
                          {Number(inv.carry_forward_amount) > 0
                            ? `₱${Number(inv.carry_forward_amount).toLocaleString()}`
                            : Number(inv.carry_forward_amount) < 0
                            ? `(₱${Math.abs(Number(inv.carry_forward_amount)).toLocaleString()})`
                            : '—'}
                        </span>
                      )}
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
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 lg:auto-rows-fr">
        {/* Left Column: Details */}
        <div id="details" className="lg:col-span-2 space-y-8 scroll-mt-28 flex flex-col">
          <PoCollapsibleCard title="Terms & Conditions" icon={<FileText className="h-5 w-5 text-primary" />} defaultOpen>
            <PoTermsCard
              poId={po.id}
              status={po.status}
              terms={po}
              penalty={penalty}
              canEdit={false}
              canOverride={canOverridePenalty}
              embedded
            />
          </PoCollapsibleCard>
          <PoCollapsibleCard title="PO Details" icon={<Pencil className="h-5 w-5 text-primary" />}>
            <PODetailsEditor
              poId={po.id}
              description={po.description}
              issuedDate={po.issued_date}
              dueDate={po.due_date}
              draftedBy={draftedByLabel}
              approvedBy={approvedByLabel}
              financeApprovedBy={financeApprovedByLabel}
              canEdit={false}
              embedded
            />
          </PoCollapsibleCard>
          {(canEditDraft || (lineItems && lineItems.length > 0)) && (
            <PoCollapsibleCard title="Line Items" icon={<ClipboardList className="h-5 w-5 text-primary" />} count={lineItems?.length ?? 0}>
              <POLineItemsEditor
                poId={po.id}
                items={lineItems || []}
                currencySymbol={currencySymbol}
                canEdit={false}
                embedded
              />
            </PoCollapsibleCard>
          )}

          {(canEditDraft || (siteDetails && siteDetails.length > 0)) && (
            <PoCollapsibleCard title="Site Details" icon={<MapPin className="h-5 w-5 text-primary" />} count={siteDetails?.length ?? 0}>
              <POSiteDetailsEditor
                poId={po.id}
                sites={siteDetails || []}
                canEdit={false}
                embedded
              />
            </PoCollapsibleCard>
          )}

          <section id="history" className="scroll-mt-28 flex flex-col flex-1">
            <PoCollapsibleCard title="Edit History" icon={<History className="h-5 w-5 text-primary" />} className="flex-1">
              <POEditHistory poId={po.id} embedded />
            </PoCollapsibleCard>
          </section>
        </div>

        {/* Right Column: Vendor Info */}
        <div id="vendor" className="space-y-8 scroll-mt-28 flex flex-col">
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

          <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-2xl p-6 flex-1">
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
