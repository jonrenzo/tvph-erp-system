import "server-only";

import { createServiceRoleClient } from "@/utils/supabase/service";
import { sendEmail, type SendEmailResult } from "./send";
import { formatAmount } from "./format";
import { PrApprovedEmail } from "./templates/pr-approved";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://erp.telcovantage.com";


/**
 * Emails procurement (po.create capability holders: operations/admin/superadmin)
 * that a PR was approved and is ready to convert into a PO. Always resolves —
 * a failed send never blocks approval.
 */
export async function sendPrApprovedEmail(
  prId: string,
  opts: { actorId?: string | null } = {},
): Promise<SendEmailResult> {
  const supabase = createServiceRoleClient();

  const { data: pr, error } = await supabase
    .from("purchase_requests")
    .select("pr_number, amount, dp_amount, dp_percent, currency, approved_by_user_id")
    .eq("id", prId)
    .single();

  if (error || !pr) {
    return { status: "failed", error: error?.message || "Purchase request not found." };
  }

  // Recipients mirror CAPABILITY_ROLES["po.create"] — keep in sync if roles change.
  const { data: converters } = await supabase
    .from("profiles")
    .select("email")
    .in("role", ["superadmin", "admin", "operations"]);

  const to = (converters || [])
    .map((p) => p.email as string | null)
    .filter((e): e is string => !!e);

  if (to.length === 0) {
    return { status: "failed", error: "No procurement email addresses found." };
  }

  let approvedByName: string | null = null;
  const approverId = opts.actorId ?? (pr.approved_by_user_id as string | null);
  if (approverId) {
    const { data: approver } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", approverId)
      .single();
    approvedByName = (approver?.full_name as string | null) ?? null;
  }

  const currency = (pr.currency as string) || "PHP";
  const downpayment = Number(pr.dp_amount) || 0;
  const dpPercent = Number(pr.dp_percent) || 0;

  return sendEmail({
    kind: "pr_approved",
    refId: prId,
    to,
    subject: `PR ${pr.pr_number} approved — ready to convert to a PO`,
    react: PrApprovedEmail({
      prNumber: pr.pr_number as string,
      amountLabel: formatAmount(pr.amount as number, currency),
      downpaymentLabel: downpayment > 0 ? formatAmount(downpayment, currency) : null,
      downpaymentPercent: dpPercent > 0 ? dpPercent : null,
      approvedByName,
      convertUrl: `${BASE_URL}/dashboard/purchase-requests/${prId}`,
    }),
    createdBy: opts.actorId ?? null,
  });
}
