import { NextRequest } from "next/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { createNotification } from "@/utils/notifications";
import { createPortalLink } from "@/lib/portal/links";
import { docTypeLabel } from "@/lib/vendors/document-types";
import { sendEmail } from "@/lib/email/send";
import { DocExpiryEmail } from "@/lib/email/templates/doc-expiry";

const DEFAULT_REMINDER_DAYS = [30, 14, 7, 1];

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Scheduled job (invoked daily by pg_cron via pg_net). Finds approved vendor
 * documents whose expiry falls on a configured milestone, emails the vendor a
 * renewal reminder, and notifies internal staff. De-duplicated per (document,
 * milestone) via email_log so re-runs never double-send.
 */
export async function POST(request: NextRequest) {
  // --- Auth: shared secret bearer token ---
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createServiceRoleClient();

  // --- Resolve configured lead-time milestones (always include day 0) ---
  const { data: settings } = await supabase
    .from("email_settings")
    .select("reminder_days")
    .eq("id", 1)
    .maybeSingle();

  const configured: number[] =
    Array.isArray(settings?.reminder_days) && settings.reminder_days.length
      ? settings.reminder_days
      : DEFAULT_REMINDER_DAYS;

  const milestones = Array.from(new Set([...configured, 0]))
    .filter((n) => Number.isInteger(n) && n >= 0)
    .sort((a, b) => b - a);

  // Map each target expiry date -> milestone (days until expiry).
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateToMilestone = new Map<string, number>();
  for (const m of milestones) {
    const target = new Date(today);
    target.setDate(target.getDate() + m);
    dateToMilestone.set(isoDate(target), m);
  }

  // --- Fetch approved documents expiring on any milestone date ---
  const { data: docs, error } = await supabase
    .from("vendor_documents")
    .select(
      `id, doc_type, label, expiry_date, uploaded_by, vendor_id,
       vendors ( id, name, contact_person, contact_email )`,
    )
    .eq("status", "approved")
    .is("archived_at", null)
    .in("expiry_date", Array.from(dateToMilestone.keys()));

  if (error) {
    console.error("document-reminders query failed:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const doc of docs ?? []) {
    const milestone = dateToMilestone.get(doc.expiry_date as string);
    if (milestone === undefined) continue;

    // De-dup: has this exact (document, milestone) reminder already gone out?
    const { data: existing } = await supabase
      .from("email_log")
      .select("id")
      .eq("kind", "doc_reminder")
      .eq("ref_id", doc.id)
      .eq("meta->>milestone", String(milestone))
      .limit(1)
      .maybeSingle();

    if (existing) {
      skipped++;
      continue;
    }

    const vendor = (doc.vendors ?? {}) as {
      id?: string;
      name?: string;
      contact_person?: string | null;
      contact_email?: string | null;
    };
    const label = docTypeLabel(doc.doc_type as string, doc.label as string | null);

    // Mint a fresh upload link for the vendor portal.
    const link = await createPortalLink("vendor", doc.vendor_id as string);
    const portalUrl = "error" in link ? "" : link.portalUrl;

    const result = await sendEmail({
      kind: "doc_reminder",
      refId: doc.id as string,
      to: [vendor.contact_email || ""],
      subject:
        milestone <= 0
          ? `Action needed: your ${label} has expired`
          : `Reminder: your ${label} expires in ${milestone} day${milestone === 1 ? "" : "s"}`,
      react: DocExpiryEmail({
        vendorName: vendor.name || "Vendor",
        vendorContact: vendor.contact_person,
        documentLabel: label,
        expiryDate: new Date(doc.expiry_date as string).toLocaleDateString("en-PH", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
        daysUntilExpiry: milestone,
        portalUrl,
      }),
      meta: { milestone, doc_type: doc.doc_type, vendor_id: doc.vendor_id },
      vendorId: doc.vendor_id as string,
    });

    if (result.status === "sent") sent++;
    else failed++;

    // Internal alert so procurement owns the follow-up (global staff feed).
    await createNotification({
      type: "document",
      title: milestone <= 0 ? "📄 Vendor document expired" : "📄 Vendor document expiring",
      message:
        milestone <= 0
          ? `${vendor.name}'s ${label} has expired.`
          : `${vendor.name}'s ${label} expires in ${milestone} day${milestone === 1 ? "" : "s"}.`,
      link: `/dashboard/vendors/${doc.vendor_id}`,
      created_by: (doc.uploaded_by as string | null) ?? (undefined as unknown as string),
    });
  }

  return Response.json({ processed: docs?.length ?? 0, sent, skipped, failed });
}
