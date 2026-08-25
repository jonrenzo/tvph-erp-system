import "server-only";

import { createServiceRoleClient } from "@/utils/supabase/service";
import { sendEmail, type SendEmailResult } from "./send";
import { PoPendingExecEmail } from "./templates/po-pending-exec";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://erp.telcovantage.com";

function formatAmount(amount: number | null | undefined, currency: string) {
  if (amount == null) return null;
  try {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: currency === "USD" ? "USD" : "PHP",
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

function execRequiredLabel(execRequired: number): string | null {
  if (execRequired === 1) return "CTO or CEO (1 of 2)";
  if (execRequired >= 2) return "CTO and CEO (2 of 2, distinct)";
  return null;
}

/**
 * Emails CTO/CEO that a PO passed admin and needs executive review.
 * Recipients are profiles with role cto/ceo. For T3 after one approval, only the remaining role is emailed.
 */
export async function sendPoPendingExecEmail(
  poId: string,
  opts: { actorId?: string | null; remainingRole?: "cto" | "ceo" | null } = {},
): Promise<SendEmailResult> {
  const supabase = createServiceRoleClient();

  const { data: po, error } = await supabase
    .from("purchase_orders")
    .select(
      "po_number, amount, currency, dp_amount, dp_percent, submitted_for_approval_by, approved_by_user_id, exec_required_count, exec_approved_by, vendors ( name )",
    )
    .eq("id", poId)
    .single();

  if (error || !po) {
    return { status: "failed", error: error?.message || "Purchase order not found." };
  }

  const execRequired = Number((po as any).exec_required_count ?? 0);
  // Determine recipient roles: if remainingRole specified (T3 second slot), email only that role
  const targetRoles = opts.remainingRole ? [opts.remainingRole] : ["cto", "ceo"];

  let to: string[] = [];
  const { data: execUsers } = await supabase
    .from("profiles")
    .select("id, email, role")
    .in("role", targetRoles);

  // Filter out already-approved execs so we don't re-email them unnecessarily (except superadmin fallback)
  const approvedIds = new Set(((po as any).exec_approved_by as string[] | null) || []);
  const remainingExecs = (execUsers || []).filter((u) => !approvedIds.has(u.id as string));
  // If all have already approved (should not happen), fall back to all
  const pool = remainingExecs.length > 0 ? remainingExecs : execUsers || [];
  to = (pool || []).map((u) => u.email as string | null).filter((e): e is string => !!e);

  // Fallback: if no cto/ceo profiles exist (e.g. seed missing), try superadmin pool so email still sends
  if (to.length === 0) {
    const { data: fallback } = await supabase.from("profiles").select("email").in("role", ["superadmin"]);
    to = (fallback || []).map((u) => u.email as string | null).filter((e): e is string => !!e);
  }

  if (to.length === 0) {
    return { status: "failed", error: "No executive email addresses found." };
  }

  const submitterId = (po as any).submitted_for_approval_by as string | null;
  let submittedByName: string | null = null;
  if (submitterId) {
    const { data: submitter } = await supabase.from("profiles").select("full_name").eq("id", submitterId).single();
    submittedByName = (submitter?.full_name as string | null) ?? null;
  }

  const approverId = (po as any).approved_by_user_id as string | null;
  let approvedByName: string | null = null;
  if (approverId) {
    const { data: approver } = await supabase.from("profiles").select("full_name").eq("id", approverId).single();
    approvedByName = (approver?.full_name as string | null) ?? null;
  }

  const vendor = ((po as any).vendors ?? {}) as { name?: string };
  const currency = ((po as any).currency as string) || "PHP";
  const dpAmount = Number((po as any).dp_amount || 0);
  const dpPercent = Number((po as any).dp_percent || 0);
  const downpaymentLabel =
    dpAmount > 0 ? `${formatAmount(dpAmount, currency) ?? ""}${dpPercent > 0 ? ` (${dpPercent}%)` : ""}` : null;

  const remainingLabel = opts.remainingRole
    ? opts.remainingRole === "cto"
      ? "CTO (CEO already approved)"
      : "CEO (CTO already approved)"
    : execRequired >= 2
      ? "CTO and CEO (both required)"
      : "CTO or CEO (either)";

  return sendEmail({
    kind: "po_pending_exec",
    refId: poId,
    to,
    subject: `PO ${po.po_number} needs executive approval${execRequired >= 2 ? " (CTO + CEO)" : ""}`,
    react: PoPendingExecEmail({
      poNumber: po.po_number as string,
      vendorName: vendor.name || "Vendor",
      amountLabel: formatAmount((po as any).amount as number, currency),
      downpaymentLabel,
      submittedByName,
      approvedByName,
      execRequiredLabel: execRequiredLabel(execRequired),
      remainingLabel,
      reviewUrl: `${BASE_URL}/dashboard/purchase-orders/${poId}`,
    }),
    createdBy: opts.actorId ?? null,
  });
}
