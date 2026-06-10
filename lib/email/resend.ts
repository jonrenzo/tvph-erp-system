import "server-only";

import { Resend } from "resend";

let client: Resend | null = null;

/**
 * Lazily-constructed Resend client. Returns null when RESEND_API_KEY is not
 * configured so callers can degrade gracefully (sending is logged as failed
 * rather than throwing).
 */
export function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!client) client = new Resend(process.env.RESEND_API_KEY);
  return client;
}
