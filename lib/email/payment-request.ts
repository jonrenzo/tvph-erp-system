import "server-only";

import { createServiceRoleClient } from "@/utils/supabase/service";
import { sendEmail } from "./send";
import { PaymentRequestNotificationEmail } from "./templates/payment-request-notification";
import { internalCc } from "./send";

export async function sendPaymentRequestNotification(
  poId: string,
  vendorId: string,
  amount: number,
  dueInDays: number,
  notes: string | null,
  creatorId: string,
  poNumber: string,
  vendorName: string,
) {
  try {
    const supabase = createServiceRoleClient();

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .in("role", ["superadmin", "admin", "operations", "finance"])
      .neq("id", creatorId);

    if (!profiles || profiles.length === 0) return { success: true };

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://erp.telcovantage.com";
    const poLink = `${siteUrl}/dashboard/purchase-orders/${poId}`;

    const toEmails = profiles.map((p) => p.email).filter(Boolean) as string[];
    if (toEmails.length === 0) return { success: true };

    await sendEmail({
      kind: "payment_request_notification",
      refId: poId,
      to: toEmails,
      cc: internalCc(),
      subject: `Payment Request Created — ${vendorName} (PO ${poNumber})`,
      react: PaymentRequestNotificationEmail({
        poNumber,
        vendorName,
        amount: amount.toLocaleString(),
        dueInDays,
        notes,
        poLink,
        creatorName: profiles.find((p) => p.id === creatorId)?.full_name || "A user",
      }),
      vendorId,
      meta: { poId, amount, dueInDays },
    });

    return { success: true };
  } catch (e) {
    console.error("Failed to send payment request notification:", e);
    return { error: e instanceof Error ? e.message : "Unknown error" };
  }
}
