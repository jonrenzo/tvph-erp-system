import "server-only";

import { sendMessage } from "./client";
import { roleKeyboard } from "./service";

/**
 * DMs the allowlisted admin chat when a brand-new SSO user is provisioned as
 * `viewer`, with tap-to-assign role buttons. No-ops if Telegram isn't
 * configured. Never throws — safe to call from the auth callback.
 */
export async function sendNewUserRoleAlert(user: {
  userId: string;
  email: string;
  fullName?: string | null;
}) {
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!chatId || !process.env.TELEGRAM_BOT_TOKEN) return;

  const name = user.fullName ? `${escapeHtml(user.fullName)} ` : "";
  const text =
    `🆕 <b>New user signed in</b>\n` +
    `${name}<code>${escapeHtml(user.email)}</code>\n` +
    `Currently <b>Viewer</b>. Assign a role:`;

  try {
    await sendMessage(chatId, text, roleKeyboard(user.userId));
  } catch (e) {
    console.error("sendNewUserRoleAlert failed:", e);
  }
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
