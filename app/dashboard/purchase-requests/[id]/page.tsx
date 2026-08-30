import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import {
  ArrowLeft,
  Calendar,
  FileText,
  CircleDollarSign,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  FolderGit2,
  ArrowRight,
  Pencil,
  MapPin,
  Wallet,
  Building2,
  type LucideIcon,
} from "lucide-react";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PrSubmitButton } from "@/components/dashboard/purchase-requests/pr-submit-button";
import { PrApprovalActions } from "@/components/dashboard/purchase-requests/pr-approval-actions";
import { PrCancelButton, PrDeleteButton, PrReviveButton } from "@/components/dashboard/purchase-requests/pr-cancel-button";
import { getCurrentProfile, hasCapability } from "@/lib/auth/permissions";
import { LiveListRefresh } from "@/components/dashboard/shared/live-list-refresh";

export default function PurchaseRequestDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<PRDetailSkeleton />}>
      <PRDetailContent paramsPromise={props.params} />
    </Suspense>
  );
}

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-slate-400 text-white border-none dark:bg-slate-800 dark:text-slate-400",
  pending_approval: "bg-amber-400 text-white border-none dark:bg-amber-900/20 dark:text-amber-400",
  pending_finance: "bg-violet-400 text-white border-none dark:bg-violet-900/20 dark:text-violet-400",
  approved: "bg-blue-400 text-white border-none dark:bg-blue-900/20 dark:text-blue-400",
  converted: "bg-emerald-400 text-white border-none dark:bg-emerald-900/20 dark:text-emerald-400",
  cancelled: "bg-red-400 text-white border-none dark:bg-red-900/20 dark:text-red-400",
};

const STATUS_ICON: Record<string, LucideIcon> = {
  draft: FileText,
  pending_approval: Clock,
  pending_finance: Wallet,
  approved: CheckCircle2,
  converted: ArrowRight,
  cancelled: XCircle,
};

async function PRDetailContent({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const supabase = await createClient();

  const [{ data: pr, error }, { user: currentUser, role: currentRole }] = await Promise.all([
    supabase
      .from("purchase_requests")
      .select("*, projects(name), vendors(name)")
      .eq("id", params.id)
      .is("deleted_at", null)
      .single(),
    getCurrentProfile(supabase),
  ]);

  if (error || !pr) {
    notFound();
  }

  const { data: lineItems } = await supabase
    .from("pr_line_items")
    .select("*")
    .eq("pr_id", pr.id)
    .order("line_no");

  const { data: siteDetails } = await supabase
    .from("pr_site_details")
    .select("*")
    .eq("pr_id", pr.id)
    .order("sn");

  // The PO this PR was converted into (1:1 — enforced by unique index).
  const { data: linkedPO } = await supabase
    .from("purchase_orders")
    .select("id, po_number, status")
    .eq("purchase_request_id", pr.id)
    .maybeSingle();

  // Resolve creator/submitter/approver names
  const adminApprovedIds = ((pr as any).admin_approved_by as string[] | null) || [];
  const approvalRequestedFrom = ((pr as any).approval_requested_from as string[] | null) || [];
  const profileIds = [pr.created_by, pr.submitted_for_approval_by, pr.approved_by_user_id, pr.finance_approved_by_user_id, ...adminApprovedIds, ...approvalRequestedFrom].filter(Boolean) as string[];
  const profiles: Record<string, string> = {};
  if (profileIds.length > 0) {
    const { data: rows } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", Array.from(new Set(profileIds)));
    for (const p of rows || []) profiles[p.id] = p.full_name;
  }
  const adminApprovedLabel = adminApprovedIds.map((id) => profiles[id]).filter(Boolean).join(", ");
  const adminRemainingIds = approvalRequestedFrom.filter((id) => !adminApprovedIds.includes(id));
  const adminRemainingLabel = adminRemainingIds.map((id) => profiles[id]).filter(Boolean).join(", ");

  // Eligible approvers for the submit picker (4-eyes: exclude current user).
  let eligibleApprovers: { id: string; full_name: string; email: string }[] = [];
  let eligibleFinanceApprovers: { id: string; full_name: string; email: string }[] = [];
  if (pr.status === "draft" && currentUser) {
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

  const canSubmit = hasCapability(currentRole, "pr.status");
  const canApprove = hasCapability(currentRole, "pr.approve");
  const canApproveFinance = hasCapability(currentRole, "pr.approve_finance");
  const canCancel = hasCapability(currentRole, "pr.create") && pr.created_by === currentUser?.id;
  const canRevive =
    canCancel || (hasCapability(currentRole, "pr.create") && ["superadmin", "admin"].includes(currentRole ?? ""));
  const canDelete = hasCapability(currentRole, "pr.delete");
  const canConvert = hasCapability(currentRole, "po.create");

  const currencySymbol = pr.currency === "USD" ? "$" : "₱";

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link
            href="/dashboard/purchase-requests"
            className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors mt-1"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">
                {pr.pr_number}
              </h1>
              <span className={`inline-flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-bold border ${STATUS_BADGE[pr.status] || STATUS_BADGE.draft}`}>
                {(() => {
                  const Icon = STATUS_ICON[pr.status] || FileText;
                  return <Icon className="h-3.5 w-3.5 shrink-0" />;
                })()}
                {pr.status.replace(/_/g, " ").toUpperCase()}
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 whitespace-pre-line">
              {pr.description || "No description provided"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 md:ml-auto">
          {pr.status === "draft" && canSubmit && (
            <PrSubmitButton prId={pr.id} eligibleApprovers={eligibleApprovers} eligibleFinanceApprovers={eligibleFinanceApprovers} />
          )}
          {pr.status === "draft" && canCancel && (
            <Link
              href={`/dashboard/purchase-requests/${pr.id}/edit`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 hover:border-primary hover:text-primary transition-all"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Link>
          )}
          {pr.status === "approved" && canConvert && (
            <Link
              href={`/dashboard/purchase-orders/new?from_pr=${pr.id}`}
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm active:scale-95"
            >
              <ArrowRight className="h-4 w-4" />
              Convert to PO
            </Link>
          )}
          {["draft", "pending_approval", "pending_finance", "approved"].includes(pr.status) && canCancel && (
            <PrCancelButton prId={pr.id} />
          )}
          {pr.status === "cancelled" && canRevive && (
            <PrReviveButton prId={pr.id} />
          )}
          {canDelete && (currentRole === "superadmin" || pr.status === "draft") && (
            <PrDeleteButton prId={pr.id} />
          )}
        </div>
      </div>

      {/* Admin approval banner */}
      {pr.status === "pending_approval" && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50">
          <div className="flex items-start gap-3 flex-1">
            <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                Awaiting Admin Approval
              </p>
              <p className="text-xs text-amber-600/80 dark:text-amber-400/60 mt-1">
                This request has been submitted and <span className="font-semibold">cannot be converted</span> until {approvalRequestedFrom.length > 1 ? `all ${approvalRequestedFrom.length} admins approve` : "an admin approves"} it, then finance runs the budget check.
              </p>
              {adminApprovedLabel && (
                <p className="text-xs text-amber-600/80 dark:text-amber-400/60 mt-1">
                  Approved by: <span className="font-semibold">{adminApprovedLabel}</span> ({adminApprovedIds.length}/{approvalRequestedFrom.length || 1}).
                </p>
              )}
              {adminRemainingLabel && adminApprovedIds.length < approvalRequestedFrom.length && (
                <p className="text-xs text-amber-600/80 dark:text-amber-400/60 mt-1">
                  Awaiting: <span className="font-semibold">{adminRemainingLabel}</span>.
                </p>
              )}
            </div>
          </div>
          {canApprove && pr.submitted_for_approval_by !== currentUser?.id ? (
            (() => {
              const alreadyApproved = currentUser ? adminApprovedIds.includes(currentUser.id) : false;
              const isRequested = currentUser ? (approvalRequestedFrom.length <= 1 || approvalRequestedFrom.includes(currentUser.id)) : false;
              if (alreadyApproved) return <p className="text-xs text-amber-600/80 dark:text-amber-400/60">You already approved. Awaiting remaining approval(s).</p>;
              if (!isRequested) return <p className="text-xs text-amber-600/80 dark:text-amber-400/60">You are not one of the requested approvers.</p>;
              return <PrApprovalActions prId={pr.id} stage="admin" />;
            })()
          ) : canApprove ? (
            <p className="text-xs text-amber-600/80 dark:text-amber-400/60">
              You submitted this PR for approval. Another admin or superadmin must approve it.
            </p>
          ) : null}
        </div>
      )}

      {/* Finance approval banner */}
      {pr.status === "pending_finance" && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-2xl bg-violet-50 dark:bg-violet-900/10 border border-violet-200 dark:border-violet-800/50">
          <div className="flex items-start gap-3 flex-1">
            <Clock className="h-5 w-5 text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-violet-700 dark:text-violet-400">
                Awaiting Finance Approval
              </p>
              <p className="text-xs text-violet-600/80 dark:text-violet-400/60 mt-1">
                This request passed the admin stage and now awaits the <span className="font-semibold">finance budget check</span> before it can be converted to a PO.
              </p>
            </div>
          </div>
          {canApproveFinance && pr.approved_by_user_id !== currentUser?.id ? (
            <PrApprovalActions prId={pr.id} stage="finance" />
          ) : canApproveFinance ? (
            <p className="text-xs text-violet-600/80 dark:text-violet-400/60">
              You approved this PR at the admin stage. Another finance or superadmin user must run the budget check.
            </p>
          ) : null}
        </div>
      )}

      {/* Rejected banner (back in draft) */}
      {pr.status === "draft" && pr.rejection_reason && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/50">
          <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">
              Approval Rejected — Returned to Draft
            </p>
            <p className="text-xs text-red-600/80 dark:text-red-400/60 mt-1">
              Reason: <span className="font-medium">{pr.rejection_reason}</span>
            </p>
          </div>
        </div>
      )}

      {/* Converted banner */}
      {pr.status === "converted" && linkedPO && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/50">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              Converted to Purchase Order
            </p>
            <p className="text-xs text-emerald-600/80 dark:text-emerald-400/60 mt-1">
              This request was converted into{" "}
              <Link href={`/dashboard/purchase-orders/${linkedPO.id}`} className="font-semibold underline">
                {linkedPO.po_number}
              </Link>
              . The request is now frozen as an audit record.
            </p>
          </div>
        </div>
      )}

      {/* Downpayment highlight — approvers must see this at a glance */}
      {Number(pr.dp_amount) > 0 ? (
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50">
          <div className="flex items-start gap-3 flex-1">
            <Wallet className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700">
                DOWNPAYMENT {Number(pr.dp_percent) > 0 ? `${Number(pr.dp_percent)}%` : ""}
              </span>
              <p className="text-xl font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                {currencySymbol}{Number(pr.dp_amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
              </p>
            </div>
          </div>
          <p className="text-xs text-amber-600/80 dark:text-amber-400/60 sm:text-right">
            Balance after downpayment:{" "}
            <span className="font-bold">
              {currencySymbol}
              {Math.max(0, Number(pr.amount) - Number(pr.dp_amount)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
            </span>
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
          <Wallet className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              No Downpayment
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              This request does not carry an upfront payment. The full estimated amount is payable on the PO.
            </p>
          </div>
        </div>
      )}

      {/* Details */}
      <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-slate-900 dark:text-white">Request Details</h2>
        </div>
        <div className="p-6 grid grid-cols-2 gap-8">
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <FolderGit2 className="h-3.5 w-3.5" /> Project
            </label>
            <p className="mt-1 text-slate-900 dark:text-slate-300 font-medium">
              {(pr.projects as any)?.name || "No project linked"}
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" /> Preferred Vendor
            </label>
            <p className="mt-1 text-slate-900 dark:text-slate-300 font-medium">
              {(pr.vendors as any)?.name || "Not nominated"}
              {pr.vendor_id && (
                <span className="text-slate-400 font-normal"> — pre-filled on the PO</span>
              )}
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <CircleDollarSign className="h-3.5 w-3.5" /> Estimated Total
            </label>
            <p className="mt-1 text-slate-900 dark:text-slate-300 font-medium">
              {currencySymbol}{Number(pr.amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" /> Requested by
            </label>
            <p className="mt-1 text-slate-900 dark:text-slate-300 font-medium">
              {profiles[pr.created_by] || "Unknown"}
              {pr.created_at && (
                <span className="text-slate-400 font-normal">
                  {" "}on {new Date(pr.created_at).toLocaleDateString(undefined, { dateStyle: "long" })}
                </span>
              )}
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Admin Approval
            </label>
            <p className="mt-1 text-slate-900 dark:text-slate-300 font-medium">
              {pr.approved_by_user_id
                ? `${profiles[pr.approved_by_user_id] || "Unknown"} on ${new Date(pr.approved_at).toLocaleDateString(undefined, { dateStyle: "long" })}`
                : "Not yet approved"}
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5" /> Finance Approval
            </label>
            <p className="mt-1 text-slate-900 dark:text-slate-300 font-medium">
              {pr.finance_approved_by_user_id
                ? `${profiles[pr.finance_approved_by_user_id] || "Unknown"} on ${new Date(pr.finance_approved_at).toLocaleDateString(undefined, { dateStyle: "long" })}`
                : pr.status === "pending_finance"
                  ? "Pending finance budget check"
                  : "Not yet approved"}
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> Submitted for approval
            </label>
            <p className="mt-1 text-slate-900 dark:text-slate-300 font-medium">
              {pr.submitted_for_approval_at
                ? `${profiles[pr.submitted_for_approval_by] || "Unknown"} on ${new Date(pr.submitted_for_approval_at).toLocaleDateString(undefined, { dateStyle: "long" })}`
                : "Not yet submitted"}
            </p>
          </div>
        </div>
      </div>

      {/* Line Items */}
      {lineItems && lineItems.length > 0 && (
        <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <CircleDollarSign className="h-5 w-5 text-primary" /> Estimated Line Items
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
                  <th className="px-4 py-3 font-semibold w-28 text-right">Est. Unit Price</th>
                  <th className="px-4 py-3 font-semibold w-28 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {lineItems.map((li: any) => (
                  <tr key={li.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs">{li.line_no}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{li.item_code || "—"}</td>
                    <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">{li.description}</td>
                    <td className="px-4 py-3 text-right text-slate-900 dark:text-white">{Number(li.qty).toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{li.uom}</td>
                    <td className="px-4 py-3 text-right text-slate-900 dark:text-white">{currencySymbol}{Number(li.unit_price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-white">{currencySymbol}{Number(li.amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/20">
                  <td colSpan={6} className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Estimated Total
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">
                    {currencySymbol}{lineItems.reduce((sum: number, li: any) => sum + Number(li.amount), 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Site Details */}
      {siteDetails && siteDetails.length > 0 && (
        <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" /> Sites &amp; Details
            </h2>
            <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs px-2 py-0.5 rounded-full font-bold">
              {siteDetails.length}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] text-slate-500 uppercase bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3 font-semibold w-12">S/N</th>
                  <th className="px-4 py-3 font-semibold">Region</th>
                  <th className="px-4 py-3 font-semibold">Area / City</th>
                  <th className="px-4 py-3 font-semibold">Node ID</th>
                  <th className="px-4 py-3 font-semibold">Phase</th>
                  <th className="px-4 py-3 font-semibold w-24 text-right">No. of Nodes</th>
                  <th className="px-4 py-3 font-semibold w-32 text-right">Cable (KM)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {siteDetails.map((s: any) => (
                  <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs">{s.sn}</td>
                    <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">{s.region || "—"}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{s.area_city || "—"}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{s.node_id || "—"}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{s.phase || "—"}</td>
                    <td className="px-4 py-3 text-right text-slate-900 dark:text-white">{Number(s.no_of_nodes).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-slate-900 dark:text-white">
                      {Number(s.cable_length_km).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/20">
                  <td colSpan={5} className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Total
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">
                    {siteDetails.reduce((sum: number, s: any) => sum + Number(s.no_of_nodes), 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">
                    {siteDetails.reduce((sum: number, s: any) => sum + Number(s.cable_length_km), 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
      <LiveListRefresh />
    </div>
  );
}

function PRDetailSkeleton() {
  return (
    <div className="p-6 lg:p-8 space-y-8 animate-pulse">
      <div className="h-10 w-96 bg-slate-100 dark:bg-slate-800/50 rounded-lg" />
      <div className="h-48 rounded-2xl bg-slate-100 dark:bg-slate-800/50" />
      <div className="h-64 rounded-2xl bg-slate-100 dark:bg-slate-800/50" />
    </div>
  );
}
