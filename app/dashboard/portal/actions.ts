"use server";

import crypto from "crypto";
import { createClient } from "@/utils/supabase/server";
import { requireCapability } from "@/lib/auth/permissions";
import { headers } from "next/headers";

export async function generateMagicLink(
  entityId: string,
  entityType: "vendor" | "customer",
  expiresInDays = 7,
) {
  const supabase = await createClient();
  // Require write capability to generate links
  const capability = entityType === "vendor" ? "vendor.write" : "crm.write";
  const { user, error: authError } = await requireCapability(capability, supabase);
  
  if (authError || !user) {
    return { error: authError || "Unauthorized" };
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const { error } = await supabase.from("magic_links").insert({
    token,
    entity_id: entityId,
    entity_type: entityType,
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    return { error: error.message };
  }

  // Dynamically resolve base URL from request headers (auto-handles localhost vs Vercel domains)
  const headersList = await headers();
  const host = headersList.get("host") || "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const portalUrl = `${protocol}://${host}/portal/upload/${token}`;

  return { success: true, portalUrl };
}
