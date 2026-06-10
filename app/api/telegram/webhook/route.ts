import { NextRequest } from "next/server";
import { sendMessage, editMessageText, answerCallbackQuery } from "@/lib/telegram/client";
import {
  assignRole,
  roleKeyboard,
  confirmKeyboard,
  teamKeyboard,
  getUserDisplay,
  BOT_ASSIGNABLE_ROLES,
} from "@/lib/telegram/service";
import { ROLE_LABELS, type Role } from "@/lib/auth/roles";

const ok = () => Response.json({ ok: true });

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function POST(request: NextRequest) {
  // 1. Auth: Telegram's secret-token header must match.
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (!process.env.TELEGRAM_WEBHOOK_SECRET || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const allow = process.env.TELEGRAM_ADMIN_CHAT_ID;
  const update = await request.json().catch(() => null);
  if (!update) return ok();

  // 2. ---- Commands (text messages) ----
  if (update.message) {
    const chatId = update.message.chat?.id;
    if (!allow || String(chatId) !== allow) return ok(); // ignore non-allowlisted chats
    const text: string = update.message.text ?? "";

    if (text.startsWith("/users")) {
      await sendMessage(chatId, "👥 <b>Team</b> — tap someone to change their role:", await teamKeyboard());
    } else if (text.startsWith("/start") || text.startsWith("/help")) {
      await sendMessage(
        chatId,
        "🤖 <b>TelcoVantage role bot</b>\n" +
          "You'll get an alert when a new user signs in. Tap a role to assign it.\n\n" +
          "<b>/users</b> — manage existing users' roles",
      );
    }
    return ok();
  }

  // 3. ---- Button taps (callback queries) ----
  if (update.callback_query) {
    const cq = update.callback_query;
    const chatId = cq.message?.chat?.id;
    const messageId = cq.message?.message_id;
    if (!allow || String(chatId) !== allow) {
      await answerCallbackQuery(cq.id);
      return ok();
    }

    const parts: string[] = (cq.data ?? "").split("|"); // r | <action> | <uid> | <role?>
    const action = parts[1];
    const userId = parts[2];

    if (action === "u" && userId) {
      const u = await getUserDisplay(userId);
      const name = u?.full_name || u?.email || "user";
      await editMessageText(
        chatId,
        messageId,
        `Assign a role for <b>${escapeHtml(name)}</b> (now ${ROLE_LABELS[u?.role as Role] ?? u?.role}):`,
        roleKeyboard(userId),
      );
    } else if (action === "p" && userId) {
      const role = parts[3];
      if ((BOT_ASSIGNABLE_ROLES as string[]).includes(role)) {
        const u = await getUserDisplay(userId);
        const name = u?.full_name || u?.email || "user";
        await editMessageText(
          chatId,
          messageId,
          `Set <b>${escapeHtml(name)}</b> to <b>${ROLE_LABELS[role as Role]}</b>?`,
          confirmKeyboard(userId, role as Role),
        );
      }
    } else if (action === "s" && userId) {
      const role = parts[3];
      const result = await assignRole(userId, role);
      if (result.ok) {
        await editMessageText(chatId, messageId, `✅ <b>${escapeHtml(result.name)}</b> is now <b>${result.label}</b>.`);
        await answerCallbackQuery(cq.id, "Role updated");
        return ok();
      } else {
        await editMessageText(chatId, messageId, `⚠️ ${escapeHtml(result.error)}`);
      }
    } else if (action === "c" && userId) {
      const u = await getUserDisplay(userId);
      const name = u?.full_name || u?.email || "user";
      await editMessageText(
        chatId,
        messageId,
        `Assign a role for <b>${escapeHtml(name)}</b>:`,
        roleKeyboard(userId),
      );
    }

    await answerCallbackQuery(cq.id);
    return ok();
  }

  return ok();
}
