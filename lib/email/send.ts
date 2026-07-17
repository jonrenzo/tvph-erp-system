import "server-only";

import * as React from "react";
import { render } from "@react-email/render";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { getResend } from "./resend";

export type EmailKind =
  | "po_issued"
  | "po_pending_approval"
  | "doc_reminder"
  | "doc_request"
  | "invoice_due_reminder"
  | "payment_request_notification";

/**
 * Internal Cc (e.g. the PO creator / requester). Disabled when
 * EMAIL_CC_INTERNAL=false — useful for Resend sandbox testing, where every
 * recipient (incl. Cc) must be the account owner's address. Defaults to on.
 */
export function internalCc(email?: string | null): string[] {
  if (process.env.EMAIL_CC_INTERNAL === "false") return [];
  return email ? [email] : [];
}

export interface SendEmailAttachment {
  filename: string;
  content: Buffer;
}

export interface SendEmailInput {
  kind: EmailKind;
  refId?: string | null;
  to: string[];
  cc?: string[];
  replyTo?: string | null;
  subject: string;
  react: React.ReactElement;
  attachments?: SendEmailAttachment[];
  meta?: Record<string, unknown>;
  createdBy?: string | null;
  /** Vendor this email was sent to, for the per-vendor Email History. */
  vendorId?: string | null;
}

export interface SendEmailResult {
  status: "sent" | "failed";
  id?: string;
  error?: string;
}

/**
 * Renders a React Email template to HTML, sends it via Resend, and records the
 * attempt in `email_log`. NEVER throws — always resolves to a result object so
 * callers (e.g. the PO issue action) stay decoupled from email failures.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const {
    kind,
    refId = null,
    to,
    cc = [],
    replyTo,
    subject,
    react,
    attachments,
    meta = {},
    createdBy = null,
    vendorId = null,
  } = input;

  // Filter out empty/invalid addresses so a missing vendor email doesn't 500.
  const cleanTo = to.filter((a) => a && a.includes("@"));
  const cleanCc = cc.filter((a) => a && a.includes("@"));

  let status: "sent" | "failed" = "failed";
  let resendId: string | undefined;
  let error: string | undefined;

  try {
    if (cleanTo.length === 0) {
      throw new Error("No valid recipient email address.");
    }

    const resend = getResend();
    if (!resend) {
      throw new Error("RESEND_API_KEY is not configured.");
    }
    const from = process.env.EMAIL_FROM;
    if (!from) {
      throw new Error("EMAIL_FROM is not configured.");
    }

    const html = await render(react);

    const { data, error: sendError } = await resend.emails.send({
      from,
      to: cleanTo,
      cc: cleanCc.length ? cleanCc : undefined,
      replyTo: replyTo || process.env.EMAIL_REPLY_TO || undefined,
      subject,
      html,
      attachments: attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
      })),
    });

    if (sendError) throw new Error(sendError.message);

    status = "sent";
    resendId = data?.id;
  } catch (e: unknown) {
    error = e instanceof Error ? e.message : String(e);
    console.error(`sendEmail(${kind}) failed:`, error);
  }

  // Record the attempt regardless of outcome (service role bypasses RLS).
  try {
    const supabase = createServiceRoleClient();
    await supabase.from("email_log").insert({
      kind,
      ref_id: refId,
      to_addresses: cleanTo,
      cc_addresses: cleanCc,
      subject,
      status,
      resend_id: resendId ?? null,
      error: error ?? null,
      meta,
      created_by: createdBy,
      vendor_id: vendorId,
    });
  } catch (logErr) {
    console.error("Failed to write email_log:", logErr);
  }

  return { status, id: resendId, error };
}
