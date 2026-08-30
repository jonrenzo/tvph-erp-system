import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { invoiceStatusLabel, invoiceStatusBadgeClasses } from "@/lib/invoices/status";
import { statusBadgeClasses } from "@/lib/ui/status-badge";
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
  PenLine,
  AlertTriangle,
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
import { PoEmailHistory } from "@/components/dashboard/purchase-orders/po-email-history";
import { PoSignedReview } from "@/components/dashboard/purchase-orders/po-signed-review";
import { getCurrentProfile, hasCapability } from "@/lib/auth/permissions";
import { signDocUrls } from "@/utils/storage";
import { LiveListRefresh } from "@/components/dashboard/shared/live-list-refresh";
import TabbedNav from "@/components/dashboard/tabbed-nav";

const menuItemClass = "flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors";
const DRAFT_OR_PENDING = ["draft", "pending_approval", "pending_exec_approval", "pending_finance"];
const ISSUED_OR_LATER = ["issued", "pending_signature", "signed_received", "signed", "paid", "overpaid"];

export default function PurchaseOrderDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  return (
    <Suspense fallback={<PODetailSkeleton />}>
      <PODetailContent paramsPromise={props.params} searchParamsPromise={props.searchParams} />
    </Suspense>
  );
}

async function PODetailContent({ paramsPromise, searchParamsPromise }: { paramsPromise: Promise<{ id: string }>; searchParamsPromise: Promise<{ tab?: string }> }) {
  const params = await paramsPromise;
  const searchParams = await searchParamsPromise;
  const tab = searchParams.tab || "overview";
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

  const isLegacy = po.source === "legacy";

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

  // Latest e-signature record — drives the "awaiting signature" / "signed" banner.
  const { data: poSignature } = await supabase
    .from("po_signatures")
    .select("signer_name, signer_title, ip_address, signed_at, signed_file_url, signed_file_name")
    .eq("po_id", po.id)
    .order("signed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const canSendEmail = hasCapability(currentRole, "email.send");
  const canApprovePO = hasCapability(currentRole, "po.approve");
  const canApproveExec = hasCapability(currentRole, "po.approve_exec");
  const canApprovePOFinance = hasCapability(currentRole, "po.approve_finance");
  const canEditTerms = hasCapability(currentRole, "po.write");
  const canOverridePenalty = ["finance", "admin", "superadmin"].includes(currentRole || "");

  // Sign the stored signed-PO URL for the dashboard user (private bucket).
  const [signedSig] = await signDocUrls(
    supabase,
    "po-artifacts",
    poSignature?.signed_file_url ? [{ file_url: poSignature.signed_file_url }] : [],
  );

  // Originator-only draft editing: only the user who drafted the PO can fix it
  // while it is still a draft or pending approval. Editing happens on the
  // dedicated /editor page — this page is read-only. Legacy placeholder POs
  // (amount 0, no scan) remain editable after issued so stubs can be completed.
  const isOriginator = !!currentUser && currentUser.id === po.created_by;
  const isPlaceholderLegacy = isLegacy && Number(po.amount) === 0;
  const canEditLegacyPlaceholder = isPlaceholderLegacy && (isOriginator || canEditTerms);
  const canEditDraft = (isOriginator && ["draft", "pending_approval"].includes(po.status)) || canEditLegacyPlaceholder;
  const canEditAny = canEditDraft || (canEditTerms && po.status === "draft") || canEditLegacyPlaceholder;
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
  const adminApprovedIds = ((po as any).admin_approved_by as string[] | null) || [];
  const requestedAdminIds = ((po.approval_requested_from as string[] | null) || []);
  const poProfileIds = [
    po.created_by,
    po.approved_by_user_id,
    po.finance_approved_by_user_id,
    ...requestedAdminIds,
    ...adminApprovedIds,
    ...((po.finance_approval_requested_from as string[] | null) || []),
    ...(((po as any).exec_approved_by as string[] | null) || []),
    ...(((po as any).exec_approval_requested_from as string[] | null) || []),
  ].filter(Boolean) as string[];
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

  // Names of the users selected to approve at submit time — shown on the
  // "awaiting approval" banners so everyone knows who is expected to act.
  const adminApproversLabel = requestedAdminIds
    .map((id) => poProfiles[id]?.full_name)
    .filter(Boolean)
    .join(", ");
  const adminApprovedLabel = adminApprovedIds.map((id) => poProfiles[id]?.full_name).filter(Boolean).join(", ");
  const adminRemainingIds = requestedAdminIds.filter((id) => !adminApprovedIds.includes(id));
  const adminRemainingLabel = adminRemainingIds.map((id) => poProfiles[id]?.full_name).filter(Boolean).join(", ");
  const financeApproversLabel = ((po.finance_approval_requested_from as string[] | null) || [])
    .map((id) => poProfiles[id]?.full_name)
    .filter(Boolean)
    .join(", ");
  const execApprovedIds = ((po as any).exec_approved_by as string[] | null) || [];
  const execRequiredCount = Number((po as any).exec_required_count ?? 0);
  const execApprovedLabel = execApprovedIds.map((id) => poProfiles[id]?.full_name).filter(Boolean).join(", ");
  const execRemainingIds = (((po as any).exec_approval_requested_from as string[] | null) || []).filter((id) => !execApprovedIds.includes(id));
  // Prefer cto/ceo profiles for remaining label; fallback to any exec
  const execRemainingLabel = execRemainingIds.map((id) => poProfiles[id]?.full_name).filter(Boolean).join(", ") || (execRequiredCount === 2 && execApprovedIds.length === 1 ? "remaining executive (CTO or CEO)" : "");
  const execTierLabel = execRequiredCount === 1 ? "CTO or CEO (1 of 2)" : execRequiredCount >= 2 ? "CTO and CEO (2 of 2)" : "";

  // Eligible approvers for the submit-for-approval picker: admins/superadmins
  // and finance/superadmin users other than the current user (the 4-eyes rule
  // blocks self-approval). Only needed while the PO is a draft.
  let eligibleApprovers: { id: string; full_name: string; email: string }[] = [];
  let eligibleFinanceApprovers: { id: string; full_name: string; email: string }[] = [];
  if (po.status === "draft" && currentUser) {
    const { data: admins } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("role", ["superadmin", "admin"])
      .neq("id", currentUser.id)
      .order("full_name");
    eligibleApprovers = admins || [];

    const { data: financeUsers } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("role", ["superadmin", "finance"])
      .neq("id", currentUser.id)
      .order("full_name");
    eligibleFinanceApprovers = financeUsers || [];
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

  // Fetch all payment requests for this PO (invoice-driven: 1 invoice = 1 PR)
  const { data: paymentRequests } = await supabase
    .from('payment_requests')
    .select('id, request_number, amount, due_in_days, notes, status, completion_cert_id, percent_complete, created_at, rejection_reason, is_downpayment, invoice_id')
    .eq('po_id', po.id)
    .in('status', ['pending', 'approved', 'rejected', 'fully_invoiced'])
    .order('created_at', { ascending: false });

  // Keep single-object compat for sections that expect it (pick first pending/approved or latest)
  const paymentRequest = paymentRequests?.[0] || null;
  // Compute PR consumption for legacy display (now 1:1 so remaining is 0 when invoiced)
  const prInvoices = (invoices || []).filter((inv: any) => inv.payment_request_id === paymentRequest?.id);
  const prConsumed = prInvoices.filter((inv: any) => ['pending_payment', 'partially_paid', 'paid'].includes(inv.status)).reduce((sum: number, inv: any) => sum + Number(inv.amount), 0);
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
<span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${statusBadgeClasses(po.status)}`}>
                {po.status === "pending_signature" ? "AWAITING SIGNED PO" : po.status === "pending_exec_approval" ? "AWAITING EXEC APPROVAL" : po.status === "signed_received" ? "SIGNED PO RECEIVED" : po.status.replace(/_/g, " ").toUpperCase()}
              </span>
              {isLegacy && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  LEGACY
                </span>
              )}
              {isPlaceholderLegacy && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border border-amber-300 dark:border-amber-700 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                  PLACEHOLDER — NO SCAN
                </span>
              )}
              {dpAmount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/50 text-sm font-bold">
                  DP — ₱{dpAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
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
            <PoIssueButton poId={po.id} eligibleApprovers={eligibleApprovers} eligibleFinanceApprovers={eligibleFinanceApprovers} />
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
            (!isLegacy && ISSUED_OR_LATER.includes(po.status) && canSendEmail) ||
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
              {!isLegacy && ISSUED_OR_LATER.includes(po.status) && canSendEmail && (
                <PoResendButton poId={po.id} menu />
              )}
              {canCreatePR && (
                <Link
                  href={`/dashboard/invoices/new?poId=${po.id}`}
                  className={menuItemClass}
                >
                  <FileText className="h-4 w-4" />
                  Record Invoice
                </Link>
              )}
            </PoMoreDropdown>
          )}
        </div>
      </div>

      {/* Placeholder legacy banner — created with only PO number + vendor */}
      {isPlaceholderLegacy && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Placeholder legacy PO — no scan yet</p>
            <p className="text-xs text-amber-600/80 dark:text-amber-400/60 mt-1">
              Created with only PO number and vendor. You can link service invoices now. The amount will update from the first invoice. Use Edit PO to fill issued date, amount, or upload the scan later.
            </p>
            {canEditAny && (
              <Link href={`/dashboard/purchase-orders/${po.id}/editor`} className="inline-flex items-center gap-1.5 mt-2 text-xs font-bold text-amber-700 dark:text-amber-300 hover:underline">
                <Pencil className="h-3 w-3" /> Edit PO
              </Link>
            )}
          </div>
        </div>
      )}

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

      {/* Signature status banner */}
      {po.status === "pending_signature" && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50">
          <PenLine className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
              Awaiting Signed PO
            </p>
            <p className="text-xs text-amber-600/80 dark:text-amber-400/60 mt-1">
              A signature request was sent{po.sent_at ? ` on ${new Date(po.sent_at).toLocaleDateString(undefined, { dateStyle: "long" })}` : ""} — awaiting the vendor's signed copy.
              {canSendEmail ? " Use “Resend to Vendor” above to re-send the link." : ""}
            </p>
          </div>
        </div>
      )}
      {po.status !== "pending_signature" && poSignature?.signed_at && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/50">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              Signed by {poSignature.signer_name || "Vendor"}
            </p>
            <p className="text-xs text-emerald-600/80 dark:text-emerald-400/60 mt-1">
              {[poSignature.signer_title, new Date(poSignature.signed_at).toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" }), poSignature.ip_address && poSignature.ip_address !== "Unknown" ? `IP ${poSignature.ip_address}` : null]
                .filter(Boolean)
                .join(" · ")}
              {canSendEmail ? " Use “Resend to Vendor” to re-send if needed." : ""}
            </p>
          </div>
        </div>
      )}

      {["pending_signature", "signed_received"].includes(po.status) && poSignature?.signed_at && poSignature?.signed_file_url && (
        <PoSignedReview
          poId={po.id}
          signedFileUrl={signedSig?.file_url ?? poSignature.signed_file_url}
          canReview={hasCapability(currentRole, "po.write")}
        />
      )}

      {/* PO Approval Banners */}
      {po.status === "pending_approval" && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50">
          <div className="flex items-start gap-3 flex-1">
            <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                Awaiting Admin Approval {requestedAdminIds.length > 1 ? `(${adminApprovedIds.length}/${requestedAdminIds.length})` : ""}
              </p>
              <p className="text-xs text-amber-600/80 dark:text-amber-400/60 mt-1">
                This PO has been submitted for approval and <span className="font-semibold">cannot be sent to the vendor</span> until {requestedAdminIds.length > 1 ? `all ${requestedAdminIds.length} admins approve` : "an admin approves"} it.
              </p>
              {adminApproversLabel && (
                <p className="text-xs text-amber-600/80 dark:text-amber-400/60 mt-1">
                  Requested approvers: <span className="font-semibold">{adminApproversLabel}</span>.
                </p>
              )}
              {adminApprovedLabel && (
                <p className="text-xs text-amber-600/80 dark:text-amber-400/60 mt-1">
                  Approved by: <span className="font-semibold">{adminApprovedLabel}</span> ({adminApprovedIds.length}/{requestedAdminIds.length || 1}).
                </p>
              )}
              {adminRemainingLabel && adminApprovedIds.length < requestedAdminIds.length && (
                <p className="text-xs text-amber-600/80 dark:text-amber-400/60 mt-1">
                  Awaiting: <span className="font-semibold">{adminRemainingLabel}</span>.
                </p>
              )}
            </div>
          </div>
          {canApprovePO && po.submitted_for_approval_by !== currentUser?.id ? (
            (() => {
              const already = currentUser ? adminApprovedIds.includes(currentUser.id) : false;
              const isRequested = currentUser ? (requestedAdminIds.length <= 1 || requestedAdminIds.includes(currentUser.id)) : false;
              if (already) return <p className="text-xs text-amber-600/80 dark:text-amber-400/60">You already approved. Awaiting remaining approval(s).</p>;
              if (!isRequested) return <p className="text-xs text-amber-600/80 dark:text-amber-400/60">You are not one of the requested approvers.</p>;
              return <PoApprovalActions poId={po.id} />;
            })()
          ) : canApprovePO ? (
            <p className="text-xs text-amber-600/80 dark:text-amber-400/60">
              You submitted this PO for approval. Another admin or superadmin must approve it.
            </p>
          ) : null}
        </div>
      )}

      {po.status === "pending_exec_approval" && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-2xl bg-violet-50 dark:bg-violet-900/10 border border-violet-200 dark:border-violet-800/50">
          <div className="flex items-start gap-3 flex-1">
            <ShieldCheck className="h-5 w-5 text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-violet-700 dark:text-violet-400">
                Awaiting Executive Approval — {execTierLabel || "CTO/CEO"} · ₱{Number(po.amount).toLocaleString()}
              </p>
              <p className="text-xs text-violet-600/80 dark:text-violet-400/60 mt-1">
                {execRequiredCount === 1
                  ? "Either the CTO or CEO can approve (1 of 2)."
                  : execRequiredCount >= 2
                    ? "Both CTO and CEO must approve (2 of 2, distinct)."
                    : "Executive review required."}{" "}
                <span className="font-semibold">Cannot proceed to finance until complete.</span>
              </p>
              {execApprovedLabel && (
                <p className="text-xs text-violet-600/80 dark:text-violet-400/60 mt-1">
                  Approved by: <span className="font-semibold">{execApprovedLabel}</span> ({execApprovedIds.length}/{execRequiredCount}).
                </p>
              )}
              {execRemainingLabel && execApprovedIds.length < execRequiredCount && (
                <p className="text-xs text-violet-600/80 dark:text-violet-400/60 mt-1">
                  Awaiting: <span className="font-semibold">{execRemainingLabel}</span>.
                </p>
              )}
            </div>
          </div>
          {canApproveExec && !execApprovedIds.includes(currentUser?.id ?? "") ? (
            <PoApprovalActions poId={po.id} stage="exec" />
          ) : canApproveExec ? (
            <p className="text-xs text-violet-600/80 dark:text-violet-400/60">
              You already approved at the executive stage. Awaiting {execRequiredCount >= 2 && execApprovedIds.length === 1 ? (currentRole === "cto" ? "CEO" : currentRole === "ceo" ? "CTO" : "remaining executive") : "remaining approval"}.
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
                This PO has been approved by admin{execRequiredCount > 0 ? " and executive" : ""} and <span className="font-semibold">cannot be sent to the vendor</span> until finance completes the budget check.
              </p>
              {financeApproversLabel && (
                <p className="text-xs text-violet-600/80 dark:text-violet-400/60 mt-1">
                  Awaiting finance review from: <span className="font-semibold">{financeApproversLabel}</span>.
                </p>
              )}
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

      <TabbedNav
        defaultTab={tab}
        basePath={`/dashboard/purchase-orders/${po.id}`}
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "certificates", label: "Certificates" },
          { id: "invoices", label: "Invoices" },
          { id: "details", label: "Details" },
          { id: "history", label: "History" },
          { id: "vendor", label: "Vendor" },
        ]}
        sections={{
          overview: (
            <div className="space-y-8">
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
              {isOverpaid ? `Overpaid ₱${overpaidAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}` : "On Track"}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Hero */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                {isOverpaid ? "Overpaid Balance" : "Remaining to Pay"}
              </label>
              <div className={`text-3xl font-bold ${isOverpaid ? "text-red-600" : "text-slate-900 dark:text-white"}`}>
                ₱{(isOverpaid ? overpaidAmount : remainingBalance).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
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
              <div className="text-sm font-bold text-slate-900 dark:text-white">₱{poAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</div>
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
                {dpTarget > 0 ? `₱${dpTarget.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}` : "—"}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Balance after DP</label>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                {dpTarget > 0 ? `₱${balanceAfterDp.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}` : "—"}
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

          {/* Payment Requests summary — aggregated (invoice-driven) */}
          {paymentRequests && paymentRequests.length > 0 && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-3">
                Payment Requests — {paymentRequests.length} total
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-xs">
                <div className="flex justify-between items-center"><span className="text-slate-500">Total Requested</span><span className="font-bold text-slate-900 dark:text-white">₱{paymentRequests.reduce((s: number, pr: any) => s + Number(pr.amount), 0).toLocaleString()}</span></div>
                <div className="flex justify-between items-center"><span className="text-slate-500">Pending</span><span className="font-bold text-amber-600">{paymentRequests.filter((pr: any) => pr.status === 'pending').length}</span></div>
                <div className="flex justify-between items-center"><span className="text-slate-500">Approved</span><span className="font-bold text-emerald-600">{paymentRequests.filter((pr: any) => pr.status === 'approved' || pr.status === 'fully_invoiced').length}</span></div>
              </div>
            </div>
          )}
            </div>
      {/* Payment Requests — invoice-driven: list all, CTA is Record Invoice */}
      <PaymentRequestButton
        poId={po.id}
        poAmount={poAmount}
        paymentRequest={paymentRequest as any}
        paymentRequests={paymentRequests as any}
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
            </div>
          ),
          certificates: (
            (signedCerts.length > 0 || canSubmitCert) && (
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
            )
          ),
          invoices: (
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
            </div>
          ),
          details: (
            <div className="space-y-8">
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
            </div>
          ),
          history: (
            <div className="space-y-8">
            <PoEmailHistory poId={po.id} poNumber={po.po_number} />
            <PoCollapsibleCard title="Edit History" icon={<History className="h-5 w-5 text-primary" />}>
              <POEditHistory poId={po.id} embedded />
            </PoCollapsibleCard>
            </div>
          ),
          vendor: (
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
            {isLegacy && po.legacy_project ? (
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-medium px-2 py-0.5 text-slate-500 dark:text-slate-400 mr-1">
                  LEGACY
                </span>
                {po.legacy_project}
              </div>
            ) : (
              <POProjectAssigner
                poId={po.id}
                currentProjectId={po.project_id}
                projects={allProjects || []}
              />
            )}
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
          ),
        }}
      />
      <LiveListRefresh />
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
