import "server-only";

import { createServiceRoleClient } from "@/utils/supabase/service";
import { renderPoDocument } from "@/lib/pdf/renderPoDocument";
import { sendEmail, type SendEmailResult } from "./send";
import { PoIssuedEmail } from "./templates/po-issued";
import { PoForSignatureEmail } from "./templates/po-for-signature";
import { formatAmount, formatDate } from "./format";

/**
 * Resolves the Cc list for a vendor-facing PO email: requestor, approver(s),
 * vendor secondary contacts, and the PO's manual cc_emails. All cc'd
 * unconditionally.
 */
async function resolvePoCcEmails(
  supabase: ReturnType<typeof createServiceRoleClient>,
  po: { approved_by_user_id?: string | null; finance_approved_by_user_id?: string | null },
  creatorEmail?: string | null,
  secondaryEmails: string[] = [],
  poCcEmails: string[] = [],
): Promise<string[]> {
  const approverIds = [po.approved_by_user_id, po.finance_approved_by_user_id].filter(
    (id): id is string => !!id,
  );
  const approverEmails = approverIds.length
    ? ((await supabase.from("profiles").select("email").in("id", approverIds)).data || [])
        .map((a) => a.email as string)
        .filter((e): e is string => !!e)
    : [];
  return [
    ...(creatorEmail ? [creatorEmail] : []),
    ...approverEmails,
    ...secondaryEmails,
    ...poCcEmails,
  ];
}

/**
 * Renders the PO PDF and emails it to the vendor's primary contact, Cc'ing the
 * requestor, the approver(s), and the vendor's secondary contacts. Decoupled
 * from the issue action — always resolves to a result so a failed send never
 * blocks issuing. Used by both auto-send and manual resend.
 */
export async function sendPoIssuedEmail(
  poId: string,
  opts: { actorId?: string | null } = {},
): Promise<SendEmailResult> {
  const supabase = createServiceRoleClient();

  const { data: po, error } = await supabase
    .from("purchase_orders")
    .select(
      `po_number, amount, currency, issued_date, created_by, vendor_id, cc_emails,
       approved_by_user_id, finance_approved_by_user_id,
       vendors ( name, contact_person, contact_email, secondary_contacts ),
       creator:profiles!created_by ( full_name, email, phone ),
       projects ( name ),
       po_site_details ( area_city )`,
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
    secondary_contacts?: { email?: string | null }[] | null;
  };
  if (!vendor.contact_email) {
    return {
      status: "failed",
      error: "Vendor has no contact email on file. Add a contact email to the vendor before the PO can be sent.",
    };
  }
  const creator = (po.creator ?? {}) as {
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
  };
  const ccEmails = await resolvePoCcEmails(
    supabase,
    po,
    creator.email,
    (vendor.secondary_contacts || []).map((c) => c.email || ""),
    (po.cc_emails as string[] | null) || [],
  );

  const rendered = await renderPoDocument(poId);
  if (!rendered) {
    return { status: "failed", error: "Failed to render PO PDF." };
  }

  const currency = (po.currency as string) || "PHP";

  const areas = [...new Set(
    ((po.po_site_details as { area_city?: string }[] | null) || [])
      .map((s) => s.area_city)
      .filter((a): a is string => !!a),
  )].join(", ");
  const project = (po.projects ?? {}) as { name?: string };
  const subjectParts = [areas || "—", po.po_number as string, project.name || "—"];

  return sendEmail({
    kind: "po_issued",
    refId: poId,
    to: [vendor.contact_email || ""],
    cc: ccEmails,
    subject: `Purchase Order ${subjectParts.join(" - ")}`,
    react: PoIssuedEmail({
      vendorName: vendor.name || "Vendor",
      vendorContact: vendor.contact_person,
      poNumber: po.po_number as string,
      poDate: formatDate(po.issued_date as string),
      amountLabel: formatAmount(po.amount as number, currency),
      senderName: creator.full_name,
      issuerName: creator.full_name,
      issuerEmail: creator.email,
      issuerPhone: creator.phone,
    }),
    attachments: [{ filename: rendered.filename, content: rendered.buffer }],
    createdBy: opts.actorId ?? (po.created_by as string | null),
    vendorId: po.vendor_id as string | null,
  });
}

/**
 * Emails the vendor a magic link to e-sign an issued PO, with the PO PDF
 * attached so the vendor can review it before signing, Cc'ing the requestor,
 * the approver(s), and the vendor's secondary contacts. Decoupled from the
 * action that sets status to 'pending_signature' — always resolves to a result.
 */
export async function sendPoForSignatureEmail(
  poId: string,
  opts: { signUrl: string; actorId?: string | null },
): Promise<SendEmailResult> {
  const supabase = createServiceRoleClient();

  const { data: po, error } = await supabase
    .from("purchase_orders")
    .select(
      `po_number, amount, currency, issued_date, created_by, vendor_id, cc_emails,
       approved_by_user_id, finance_approved_by_user_id,
       vendors ( name, contact_person, contact_email, secondary_contacts ),
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
    secondary_contacts?: { email?: string | null }[] | null;
  };
  if (!vendor.contact_email) {
    return {
      status: "failed",
      error: "Vendor has no contact email on file. Add a contact email to the vendor before the PO can be sent.",
    };
  }
  const creator = (po.creator ?? {}) as {
    full_name?: string | null;
    email?: string | null;
  };
  const ccEmails = await resolvePoCcEmails(
    supabase,
    po,
    creator.email,
    (vendor.secondary_contacts || []).map((c) => c.email || ""),
    (po.cc_emails as string[] | null) || [],
  );

  const currency = (po.currency as string) || "PHP";

  const rendered = await renderPoDocument(poId);
  if (!rendered) {
    return { status: "failed", error: "Failed to render PO PDF." };
  }

  return sendEmail({
    kind: "po_for_signature",
    refId: poId,
    to: [vendor.contact_email || ""],
    cc: ccEmails,
    subject: `E-Sign Purchase Order ${po.po_number as string} — TVPH`,
    react: PoForSignatureEmail({
      vendorName: vendor.name || "Vendor",
      vendorContact: vendor.contact_person,
      poNumber: po.po_number as string,
      poDate: formatDate(po.issued_date as string),
      amountLabel: formatAmount(po.amount as number, currency),
      signUrl: opts.signUrl,
      senderName: creator.full_name,
    }),
    attachments: [{ filename: rendered.filename, content: rendered.buffer }],
    createdBy: opts.actorId ?? (po.created_by as string | null),
    vendorId: po.vendor_id as string | null,
  });
}
