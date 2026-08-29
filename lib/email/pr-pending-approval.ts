import "server-only";

import { createServiceRoleClient } from "@/utils/supabase/service";
import { sendEmail, type SendEmailResult } from "./send";
import { formatAmount } from "./format";
import { PrPendingApprovalEmail } from "./templates/pr-pending-approval";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://erp.telcovantage.com";


/**
 * Emails the admins/superadmins recorded in `approval_requested_from` that a PR
 * is pending their approval. Decoupled from the submit action — always resolves
 * to a result so a failed send never blocks submission.
 */
export async function sendPrPendingApprovalEmail(
  prId: string,
  opts: { actorId?: string | null } = {},
): Promise<SendEmailResult> {
  const supabase = createServiceRoleClient();

  const { data: pr, error } = await supabase
    .from("purchase_requests")
    .select(
      `pr_number, amount, dp_amount, dp_percent, currency, description, approval_requested_from,
       vendors ( name )`,
    )
    .eq("id", prId)
    .single();

  if (error || !pr) {
    return { status: "failed", error: error?.message || "Purchase request not found." };
  }

  const approverIds = (pr.approval_requested_from as string[] | null) || [];
  if (approverIds.length === 0) {
    return { status: "failed", error: "No approvers were selected for this PR." };
  }

  const { data: approvers } = await supabase
    .from("profiles")
    .select("email")
    .in("id", approverIds);

  const to = (approvers || [])
    .map((a) => a.email as string | null)
    .filter((e): e is string => !!e);

  if (to.length === 0) {
    return { status: "failed", error: "No approver email addresses found." };
  }

  const currency = (pr.currency as string) || "PHP";
  const downpayment = Number(pr.dp_amount) || 0;
  const dpPercent = Number(pr.dp_percent) || 0;
  const vendor = (pr.vendors ?? {}) as { name?: string };

  return sendEmail({
    kind: "pr_pending_approval",
    refId: prId,
    to,
    subject: `TelcoVantage ERP Gateway - Purchase Request (${pr.pr_number})`,
    react: PrPendingApprovalEmail({
      prNumber: pr.pr_number as string,
      vendorName: vendor.name || "—",
      purpose: (pr.description as string | null) || "—",
      amountLabel: formatAmount(pr.amount as number, currency),
      downpaymentLabel: downpayment > 0 ? formatAmount(downpayment, currency) : null,
      downpaymentPercent: dpPercent > 0 ? dpPercent : null,
      reviewUrl: `${BASE_URL}/dashboard/purchase-requests/${prId}`,
    }),
    createdBy: opts.actorId ?? null,
  });
}
