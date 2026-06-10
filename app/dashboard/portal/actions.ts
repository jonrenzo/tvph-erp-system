"use server";

import { createClient } from "@/utils/supabase/server";
import { requireCapability } from "@/lib/auth/permissions";
import { createPortalLink } from "@/lib/portal/links";

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

  const result = await createPortalLink(entityType, entityId, expiresInDays);
  if ("error" in result) {
    return { error: result.error };
  }

  return { success: true, portalUrl: result.portalUrl };
}
