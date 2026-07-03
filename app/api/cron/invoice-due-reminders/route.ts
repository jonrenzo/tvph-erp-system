import { NextRequest } from "next/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { createNotification } from "@/utils/notifications";
import { sendEmail } from "@/lib/email/send";
import { InvoiceDueEmail } from "@/lib/email/templates/invoice-due";

/**
 * Scheduled job (invoked daily by pg_cron via pg_net). Finds approved invoices
 * whose due_date is 14 days from today, emails the relevant staff a reminder,
 * and creates an internal notification. De-duplicated per (invoice) via
 * email_log so re-runs never double-send.
 */
export async function POST(request: NextRequest) {
  // --- Auth: shared secret bearer token ---
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createServiceRoleClient();

  // --- Compute the target date: 14 days before due (i.e. due_date = today + 14) ---
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(today);
  targetDate.setDate(targetDate.getDate() + 14);
  const targetDateStr = targetDate.toISOString().slice(0, 10);

  // --- Fetch approved invoices due in exactly 14 days ---
  const { data: invoices, error } = await supabase
    .from("service_invoices")
    .select(`
      id, invoice_number, amount, due_date, expense_category, notes,
      vendor_id,
      vendors ( id, name, contact_email )
    `)
    .eq("status", "approved")
    .eq("due_date", targetDateStr);

  if (error) {
    console.error("invoice-due-reminders query failed:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const inv of invoices ?? []) {
    // De-dup: has this invoice reminder already gone out?
    const { data: existing } = await supabase
      .from("email_log")
      .select("id")
      .eq("kind", "invoice_due_reminder")
      .eq("ref_id", inv.id)
      .limit(1)
      .maybeSingle();

    if (existing) {
      skipped++;
      continue;
    }

    const vendor = (inv.vendors ?? {}) as {
      id?: string;
      name?: string;
      contact_email?: string | null;
    };

    const amount = Number(inv.amount).toLocaleString();
    const dueDate = new Date(inv.due_date as string).toLocaleDateString("en-PH", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const invoiceUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://erp.telcovantage.com"}/dashboard/invoices/${inv.id}`;

    const result = await sendEmail({
      kind: "invoice_due_reminder",
      refId: inv.id as string,
      to: [vendor.contact_email || process.env.EMAIL_FROM || ""],
      subject: `Reminder: Invoice #${inv.invoice_number} is due in 14 days`,
      react: InvoiceDueEmail({
        vendorName: vendor.name || "Vendor",
        invoiceNumber: inv.invoice_number as string,
        amount,
        dueDate,
        daysUntilDue: 14,
        invoiceUrl,
      }),
      meta: {
        days_until_due: 14,
        invoice_id: inv.id,
        invoice_number: inv.invoice_number,
        vendor_id: inv.vendor_id,
      },
      vendorId: inv.vendor_id as string,
    });

    if (result.status === "sent") sent++;
    else failed++;

    // Internal alert so finance owns the follow-up (global staff feed).
    await createNotification({
      type: "invoice",
      title: "🧾 Invoice due in 14 days",
      message: `Invoice #${inv.invoice_number} from ${vendor.name} (₱${amount}) is due on ${dueDate}.`,
      link: `/dashboard/invoices/${inv.id}`,
      created_by: (undefined as unknown as string),
    });
  }

  return Response.json({ processed: invoices?.length ?? 0, sent, skipped, failed });
}
