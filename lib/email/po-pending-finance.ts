import "server-only";

import { createServiceRoleClient } from "@/utils/supabase/service";
import { sendEmail, type SendEmailResult } from "./send";
import { PoPendingFinanceEmail } from "./templates/po-pending-finance";
import { formatAmount } from "./format";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://erp.telcovantage.com";

/**
 * Emails the finance users recorded in `finance_approval_requested_from` that a
 * PO passed the admin stage and is pending the finance budget check before
 * issuance. POs submitted before finance-approver selection existed fall back
 * to the finance pool (finance-role users + superadmin). Decoupled from the
 * approve action — always resolves to a result so a failed send never blocks
 * the transition.
 */
export async function sendPoPendingFinanceEmail(
  poId: string,
  opts: { actorId?: string | null } = {},
): Promise<SendEmailResult> {
  const supabase = createServiceRoleClient();

  const { data: po, error } = await supabase
    .from("purchase_orders")
    .select("po_number, amount, currency, dp_amount, dp_percent, submitted_for_approval_by, approved_by_user_id, finance_approval_requested_from, vendors ( name )")
    .eq("id", poId)
    .single();

  if (error || !po) {
    return { status: "failed", error: error?.message || "Purchase order not found." };
  }

  const financeApproverIds = (po.finance_approval_requested_from as string[] | null) || [];
  let to: string[];
  if (financeApproverIds.length > 0) {
    const { data: financeUsers } = await supabase
      .from("profiles")
      .select("email")
      .in("id", financeApproverIds);
    to = (financeUsers || [])
      .map((u) => u.email as string | null)
      .filter((e): e is string => !!e);
  } else {
    // Legacy POs predate finance-approver selection — email the finance pool.
    // Recipients mirror CAPABILITY_ROLES["po.approve_finance"] — keep in sync.
    const { data: financeUsers } = await supabase
      .from("profiles")
      .select("email")
      .in("role", ["finance", "superadmin"]);
    to = (financeUsers || [])
      .map((u) => u.email as string | null)
      .filter((e): e is string => !!e);
  }

  if (to.length === 0) {
    return { status: "failed", error: "No finance email addresses found." };
  }

  const submitterId = opts.actorId ?? (po.submitted_for_approval_by as string | null);
  let submittedByName: string | null = null;
  if (submitterId) {
    const { data: submitter } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", submitterId)
      .single();
    submittedByName = (submitter?.full_name as string | null) ?? null;
  }

  const approverId = (po.approved_by_user_id as string | null) ?? opts.actorId ?? null;
  let approvedByName: string | null = null;
  if (approverId) {
    const { data: approver } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", approverId)
      .single();
    approvedByName = (approver?.full_name as string | null) ?? null;
  }

  const vendor = (po.vendors ?? {}) as { name?: string };
  const currency = (po.currency as string) || "PHP";

  const dpAmount = Number(po.dp_amount || 0);
  const dpPercent = Number(po.dp_percent || 0);
  const downpaymentLabel =
    dpAmount > 0
      ? `${formatAmount(dpAmount, currency) ?? ""}${dpPercent > 0 ? ` (${dpPercent}%)` : ""}`
      : null;

  return sendEmail({
    kind: "po_pending_finance",
    refId: poId,
    to,
    subject: `PO ${po.po_number} is awaiting the finance review`,
    react: PoPendingFinanceEmail({
      poNumber: po.po_number as string,
      vendorName: vendor.name || "Vendor",
      amountLabel: formatAmount(po.amount as number, currency),
      downpaymentLabel,
      submittedByName,
      approvedByName,
      reviewUrl: `${BASE_URL}/dashboard/purchase-orders/${poId}`,
    }),
    createdBy: opts.actorId ?? null,
  });
}
