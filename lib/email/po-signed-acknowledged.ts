import "server-only";

import { createServiceRoleClient } from "@/utils/supabase/service";
import { sendEmail, type SendEmailResult } from "./send";
import { formatAmount } from "./format";
import { PoSignedAcknowledgedEmail } from "./templates/po-signed-acknowledged";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://erp.telcovantage.com";


/**
 * Emails all operations/admin/finance staff that the originator acknowledged
 * the vendor-signed copy of a PO, so the team knows the deployment may begin.
 * Decoupled from the review action — always resolves to a result so a failed
 * send never blocks the approval.
 */
export async function sendPoSignedAcknowledgedEmail(
  poId: string,
  opts: { actorId?: string | null } = {},
): Promise<SendEmailResult> {
  const supabase = createServiceRoleClient();

  const { data: po, error } = await supabase
    .from("purchase_orders")
    .select("po_number, amount, currency, dp_amount, dp_percent, vendors ( name )")
    .eq("id", poId)
    .single();

  if (error || !po) {
    return { status: "failed", error: error?.message || "Purchase order not found." };
  }

  // Recipients mirror CAPABILITY_ROLES["po.write"] + finance — keep in sync.
  const { data: staffUsers } = await supabase
    .from("profiles")
    .select("email")
    .in("role", ["superadmin", "admin", "operations", "finance"]);

  const to = (staffUsers || [])
    .map((u) => u.email as string | null)
    .filter((e): e is string => !!e);

  if (to.length === 0) {
    return { status: "failed", error: "No staff email addresses found." };
  }

  let acknowledgedByName: string | null = null;
  if (opts.actorId) {
    const { data: actor } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", opts.actorId)
      .single();
    acknowledgedByName = (actor?.full_name as string | null) ?? null;
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
    kind: "po_signed_acknowledged",
    refId: poId,
    to,
    subject: `PO ${po.po_number} signed copy acknowledged — deployment may begin`,
    react: PoSignedAcknowledgedEmail({
      poNumber: po.po_number as string,
      vendorName: vendor.name || "Vendor",
      amountLabel: formatAmount(po.amount as number, currency),
      downpaymentLabel,
      acknowledgedByName,
      reviewUrl: `${BASE_URL}/dashboard/purchase-orders/${poId}`,
    }),
    createdBy: opts.actorId ?? null,
  });
}
