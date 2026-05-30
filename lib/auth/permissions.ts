import "server-only";

import { createClient } from "@/utils/supabase/server";

export const ROLES = [
  "admin",
  "finance",
  "procurement",
  "project_manager",
  "commercial_manager",
  "user",
] as const;

export type Role = (typeof ROLES)[number];

export type Capability =
  | "audit.read"
  | "contract.write"
  | "crm.write"
  | "document.approve"
  | "document.write"
  | "export.crm"
  | "export.financial"
  | "export.vendor"
  | "invoice.pay"
  | "invoice.write"
  | "po.create"
  | "po.delete"
  | "po.status"
  | "po.write"
  | "project.write"
  | "settings.manage"
  | "user.manage"
  | "vendor.delete"
  | "vendor.status"
  | "vendor.write";

const CAPABILITY_ROLES = {
  "audit.read": ["admin"],
  "contract.write": ["admin", "procurement", "project_manager"],
  "crm.write": ["admin", "commercial_manager"],
  "document.approve": ["admin"],
  "document.write": ["admin"],
  "export.crm": ["admin", "commercial_manager"],
  "export.financial": ["admin", "finance"],
  "export.vendor": ["admin", "procurement", "finance"],
  "invoice.pay": ["admin", "finance"],
  "invoice.write": ["admin", "finance"],
  "po.create": ["admin", "procurement"],
  "po.delete": ["admin"],
  "po.status": ["admin", "procurement", "finance"],
  "po.write": ["admin", "procurement"],
  "project.write": ["admin", "project_manager", "procurement"],
  "settings.manage": ["admin"],
  "user.manage": ["admin"],
  "vendor.delete": ["admin"],
  "vendor.status": ["admin", "procurement"],
  "vendor.write": ["admin", "procurement"],
} as const satisfies Record<Capability, readonly Role[]>;

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export function hasCapability(role: string | null | undefined, capability: Capability) {
  return Boolean(role && (CAPABILITY_ROLES[capability] as readonly string[]).includes(role));
}

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
