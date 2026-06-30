import { createHmac, timingSafeEqual } from "crypto";
import { createServiceRoleClient } from "@/utils/supabase/service";

const ok = () => Response.json({ ok: true });

// Svix signature verification without the svix package.
// Spec: https://docs.svix.com/receiving/verifying-payloads/how-manual
function verifySignature(
  secret: string,
  msgId: string,
  msgTimestamp: string,
  body: string,
  sigHeader: string,
): boolean {
  // Reject stale events (>5 min drift).
  const ts = parseInt(msgTimestamp, 10);
  if (isNaN(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;

  // Secret arrives as "whsec_<base64>"; strip the prefix.
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const toSign = `${msgId}.${msgTimestamp}.${body}`;
  const expected = createHmac("sha256", secretBytes).update(toSign).digest("base64");

  // svix-signature is space-separated "v1,<base64>" entries; accept if any matches.
  return sigHeader.split(" ").some((part) => {
    const sig = part.replace(/^v1,/, "");
    try {
      return timingSafeEqual(Buffer.from(sig, "base64"), Buffer.from(expected, "base64"));
    } catch {
      return false;
    }
  });
}

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return new Response("Webhook not configured", { status: 500 });

  const msgId = request.headers.get("svix-id") ?? "";
  const msgTimestamp = request.headers.get("svix-timestamp") ?? "";
  const sigHeader = request.headers.get("svix-signature") ?? "";

  const body = await request.text();

  if (!verifySignature(secret, msgId, msgTimestamp, body, sigHeader)) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: { type?: string; data?: { email_id?: string } };
  try {
    payload = JSON.parse(body);
  } catch {
    return ok();
  }

  const emailId = payload.data?.email_id;
  if (!emailId) return ok();

  const col =
    payload.type === "email.delivered"  ? "delivered_at" :
    payload.type === "email.opened"     ? "opened_at"    :
    payload.type === "email.bounced" || payload.type === "email.complained" ? "bounced_at" :
    null;

  if (col) {
    const supabase = createServiceRoleClient();
    // .is(col, null) → only sets the first timestamp; idempotent on duplicate events.
    await supabase
      .from("email_log")
      .update({ [col]: new Date().toISOString() })
      .eq("resend_id", emailId)
      .is(col, null);
  }

  return ok();
}
