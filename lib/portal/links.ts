import "server-only";

import crypto from "crypto";
import { headers } from "next/headers";
import { createServiceRoleClient } from "@/utils/supabase/service";

export type PortalEntityType = "vendor" | "customer";

/**
 * Resolves the public base URL for building absolute links.
 * Prefers NEXT_PUBLIC_SITE_URL (required for non-request contexts like cron),
 * falling back to the incoming request host when available.
 */
export async function getBaseUrl(): Promise<string> {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  try {
    const headersList = await headers();
    const host = headersList.get("host");
    if (host) {
      const protocol = host.includes("localhost") ? "http" : "https";
      return `${protocol}://${host}`;
    }
  } catch {
    // headers() is unavailable outside a request scope (e.g. cron) — fall through.
  }

  // Final fallback (e.g. the reminder cron with NEXT_PUBLIC_SITE_URL unset):
  // use the production site rather than localhost so emailed links never break.
  return "https://erp.telcovantage.com";
}

/**
 * Mints a one-time magic-link token for an entity and returns the absolute
 * portal upload URL. Uses the service-role client so it works both in request
 * handlers and in the scheduled reminder job (no user session required).
 *
 * Callers are responsible for any capability/authorization checks.
 */
export async function createPortalLink(
  entityType: PortalEntityType,
  entityId: string,
  expiresInDays = 7,
): Promise<{ portalUrl: string; token: string; expiresAt: string } | { error: string }> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("magic_links").insert({
    token,
    entity_id: entityId,
    entity_type: entityType,
    expires_at: expiresAt.toISOString(),
  });

  if (error) return { error: error.message };

  const baseUrl = await getBaseUrl();
  return {
    portalUrl: `${baseUrl}/portal/upload/${token}`,
    token,
    expiresAt: expiresAt.toISOString(),
  };
}
