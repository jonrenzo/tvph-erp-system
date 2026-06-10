import "server-only";

import { createServiceRoleClient } from "@/utils/supabase/service";
import { renderPoPdf } from "@/lib/pdf/renderPoPdf";
import { sendEmail, internalCc, type SendEmailResult } from "./send";
import { PoIssuedEmail } from "./templates/po-issued";

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

function formatDate(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-PH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Renders the PO PDF and emails it to the vendor's primary contact, Cc'ing the
 * PO creator. Decoupled from the issue action — always resolves to a result so
 * a failed send never blocks issuing. Used by both auto-send and manual resend.
 */
export async function sendPoIssuedEmail(
  poId: string,
  opts: { actorId?: string | null } = {},
): Promise<SendEmailResult> {
  const supabase = createServiceRoleClient();

  const { data: po, error } = await supabase
    .from("purchase_orders")
    .select(
      `po_number, amount, currency, issued_date, created_by, vendor_id,
       vendors ( name, contact_person, contact_email ),
       creator:profiles!created_by ( full_name, email )`,
    )
    .eq("id", poId)
    .single();

  if (error || !po) {
    return { status: "failed", error: error?.message || "Purchase order not found." };
  }

  const vendor = (po.vendors ?? {}) as {
    name?: string;
    contact_person?: string | null;
    contact_email?: string | null;
  };
  const creator = (po.creator ?? {}) as { full_name?: string | null; email?: string | null };

  const rendered = await renderPoPdf(poId);
  if (!rendered) {
    return { status: "failed", error: "Failed to render PO PDF." };
  }

  const currency = (po.currency as string) || "PHP";

  return sendEmail({
    kind: "po_issued",
    refId: poId,
    to: [vendor.contact_email || ""],
    cc: internalCc(creator.email),
    subject: `Purchase Order ${po.po_number} from TVPH`,
    react: PoIssuedEmail({
      vendorName: vendor.name || "Vendor",
      vendorContact: vendor.contact_person,
      poNumber: po.po_number as string,
      poDate: formatDate(po.issued_date as string),
      amountLabel: formatAmount(po.amount as number, currency),
      senderName: creator.full_name,
    }),
    attachments: [{ filename: rendered.filename, content: rendered.buffer }],
    createdBy: opts.actorId ?? (po.created_by as string | null),
    vendorId: po.vendor_id as string | null,
  });
}
