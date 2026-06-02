"use server";

import crypto from "crypto";
import { createClient } from "@/utils/supabase/server";
import { requireCapability } from "@/lib/auth/permissions";

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

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const portalUrl = `${baseUrl}/portal/upload/${token}`;

  return { success: true, portalUrl };
}
