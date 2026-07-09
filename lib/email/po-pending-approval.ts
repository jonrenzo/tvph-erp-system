import "server-only";

import { createServiceRoleClient } from "@/utils/supabase/service";
import { sendEmail, type SendEmailResult } from "./send";
import { PoPendingApprovalEmail } from "./templates/po-pending-approval";

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
 * Emails the admins/superadmins recorded in `approval_requested_from` that a PO
 * is pending their approval. Decoupled from the submit action — always resolves
 * to a result so a failed send never blocks submission.
 */
export async function sendPoPendingApprovalEmail(
  poId: string,
  opts: { actorId?: string | null } = {},
): Promise<SendEmailResult> {
  const supabase = createServiceRoleClient();

  // Note: submitted_for_approval_by FKs to auth.users, not profiles, so it can't
  // be embedded like created_by — the submitter name is resolved separately.
  const { data: po, error } = await supabase
    .from("purchase_orders")
    .select(
      `po_number, amount, currency, approval_requested_from, submitted_for_approval_by,
       vendors ( name )`,
    )
    .eq("id", poId)
    .single();

  if (error || !po) {
    return { status: "failed", error: error?.message || "Purchase order not found." };
  }

  const approverIds = (po.approval_requested_from as string[] | null) || [];
  if (approverIds.length === 0) {
    return { status: "failed", error: "No approvers were selected for this PO." };
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

  const vendor = (po.vendors ?? {}) as { name?: string };
  const currency = (po.currency as string) || "PHP";

  return sendEmail({
    kind: "po_pending_approval",
    refId: poId,
    to,
    subject: `PO ${po.po_number} is pending your approval`,
    react: PoPendingApprovalEmail({
      poNumber: po.po_number as string,
      vendorName: vendor.name || "Vendor",
      amountLabel: formatAmount(po.amount as number, currency),
      submittedByName,
      reviewUrl: `${BASE_URL}/dashboard/purchase-orders/${poId}`,
    }),
    createdBy: opts.actorId ?? null,
  });
}
