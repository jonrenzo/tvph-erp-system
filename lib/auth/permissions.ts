import "server-only";

import { createClient } from "@/utils/supabase/server";
import { type Role, type Capability, hasCapability } from "./roles";

// Re-export the client-safe RBAC definitions so existing server-side imports
// from "@/lib/auth/permissions" keep working unchanged.
export {
  ROLES,
  ROLE_LABELS,
  CAPABILITY_ROLES,
  hasCapability,
  isSuperadmin,
  isAdminOrAbove,
} from "./roles";
export type { Role, Capability } from "./roles";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export async function getCurrentProfile(supabase?: SupabaseServerClient) {
  supabase = supabase ?? await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, profile: null, role: null, error: "Unauthorized" };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, role, full_name, email")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    return {
      supabase,
      user,
      profile: null,
      role: null,
      error: error?.message || "User profile was not found.",
    };
  }

  return {
    supabase,
    user,
    profile,
    role: profile.role as Role,
    error: null,
  };
}

export async function requireCapability(
  capability: Capability,
  supabase?: SupabaseServerClient,
) {
  supabase = supabase ?? await createClient();
  const context = await getCurrentProfile(supabase);

  if (context.error || !context.user || !context.profile || !context.role) {
    return context;
  }

  if (!hasCapability(context.role, capability)) {
    return {
      ...context,
      error: `Forbidden. Required capability: ${capability}.`,
    };
  }

  return context;
}
