import "server-only";

import { createServiceRoleClient } from "@/utils/supabase/service";
import { sendEmail, type SendEmailResult } from "./send";
import { PrPendingFinanceEmail } from "./templates/pr-pending-finance";

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

/**
 * Emails the finance pool (finance-role users + superadmin) that a PR passed
 * the admin stage and is pending the finance budget check. Decoupled from the
 * approve action — always resolves to a result so a failed send never blocks
 * the transition.
 */
export async function sendPrPendingFinanceEmail(
  prId: string,
  opts: { actorId?: string | null } = {},
): Promise<SendEmailResult> {
  const supabase = createServiceRoleClient();

  const { data: pr, error } = await supabase
    .from("purchase_requests")
    .select("pr_number, amount, dp_amount, dp_percent, currency, description, vendors ( name )")
    .eq("id", prId)
    .single();

  if (error || !pr) {
    return { status: "failed", error: error?.message || "Purchase request not found." };
  }

  // Recipients mirror CAPABILITY_ROLES["pr.approve_finance"] — keep in sync.
  const { data: financeUsers } = await supabase
    .from("profiles")
    .select("email")
    .in("role", ["finance", "superadmin"]);

  const to = (financeUsers || [])
    .map((u) => u.email as string | null)
    .filter((e): e is string => !!e);

  if (to.length === 0) {
    return { status: "failed", error: "No finance email addresses found." };
  }

  const currency = (pr.currency as string) || "PHP";
  const downpayment = Number(pr.dp_amount) || 0;
  const dpPercent = Number(pr.dp_percent) || 0;
  const vendor = (pr.vendors ?? {}) as { name?: string };

  return sendEmail({
    kind: "pr_pending_finance",
    refId: prId,
    to,
    subject: `TelcoVantage ERP Gateway - Purchase Request (${pr.pr_number}) awaiting finance review`,
    react: PrPendingFinanceEmail({
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
