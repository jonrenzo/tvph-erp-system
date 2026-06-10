import "server-only";

import { createServiceRoleClient } from "@/utils/supabase/service";
import { createNotification } from "@/utils/notifications";
import { ROLE_LABELS, type Role } from "@/lib/auth/roles";
import type { InlineKeyboard } from "./client";

// Roles the bot may assign — never superadmin (dev-only, assigned in-app).
export const BOT_ASSIGNABLE_ROLES: Role[] = ["admin", "finance", "operations", "viewer"];

function isAssignable(role: string): role is Role {
  return (BOT_ASSIGNABLE_ROLES as string[]).includes(role);
}

/** Role picker keyboard for a given user. */
export function roleKeyboard(userId: string): InlineKeyboard {
  return {
    inline_keyboard: [
      BOT_ASSIGNABLE_ROLES.map((r) => ({
        text: ROLE_LABELS[r],
        callback_data: `r|p|${userId}|${r}`,
      })),
    ],
  };
}

/** Confirm/cancel keyboard before applying a role. */
export function confirmKeyboard(userId: string, role: Role): InlineKeyboard {
  return {
    inline_keyboard: [
      [{ text: `✅ Confirm ${ROLE_LABELS[role]}`, callback_data: `r|s|${userId}|${role}` }],
      [{ text: "✖ Cancel", callback_data: `r|c|${userId}` }],
    ],
  };
}

export async function getUserDisplay(userId: string) {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("profiles")
    .select("full_name, email, role")
    .eq("id", userId)
    .maybeSingle();
  return data;
}

/** A keyboard listing the whole team (one button per member) for /users. */
export async function teamKeyboard(): Promise<InlineKeyboard> {
  const supabase = createServiceRoleClient();
  const { data: team } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .order("full_name");

  const rows = (team ?? []).map((m) => [
    {
      text: `${m.full_name || m.email} · ${ROLE_LABELS[m.role as Role] ?? m.role}`,
      callback_data: `r|u|${m.id}`,
    },
  ]);
  return { inline_keyboard: rows };
}

/**
 * Applies a role change requested via the bot. Validates the role (never
 * superadmin), updates the profile, writes an audit log, and posts an in-app
 * notification. Returns a display name + label on success.
 */
export async function assignRole(
  userId: string,
  role: string,
): Promise<{ ok: true; name: string; label: string } | { ok: false; error: string }> {
  if (!isAssignable(role)) {
    return { ok: false, error: "That role can't be assigned from Telegram." };
  }

  const supabase = createServiceRoleClient();
  const { data: target } = await supabase
    .from("profiles")
    .select("full_name, email, role")
    .eq("id", userId)
    .maybeSingle();

  if (!target) return { ok: false, error: "User not found." };
  if (target.role === "superadmin") {
    return { ok: false, error: "Superadmin accounts can only be changed in the app." };
  }

  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) return { ok: false, error: error.message };

  // Audit directly (webhook has no user session); performed_by is nullable.
  await supabase.from("audit_logs").insert({
    entity_type: "profile",
    entity_id: userId,
    action: "UPDATE",
    changes: { before: { role: target.role }, after: { role }, via: "telegram" },
    performed_by: null,
  });

  await createNotification({
    type: "hr",
    title: "👤 Role updated (Telegram)",
    message: `${target.full_name || target.email} is now ${ROLE_LABELS[role as Role]}.`,
    link: "/dashboard/settings?tab=team",
    created_by: userId,
  });

  return { ok: true, name: target.full_name || target.email, label: ROLE_LABELS[role as Role] };
}
