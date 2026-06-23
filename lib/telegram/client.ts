import "server-only";

// Thin wrapper over the Telegram Bot API. All methods no-op (return null) when
// TELEGRAM_BOT_TOKEN is unset, so the feature degrades gracefully.

const API = "https://api.telegram.org";

export interface InlineKeyboard {
  inline_keyboard: { text: string; callback_data: string }[][];
}

async function call(method: string, payload: Record<string, unknown>) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(`${API}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!json.ok) console.error(`Telegram ${method} failed:`, json.description);
    return json;
  } catch (e) {
    console.error(`Telegram ${method} error:`, e);
    return null;
  }
}

export function sendMessage(
  chatId: string | number,
  text: string,
  replyMarkup?: InlineKeyboard,
) {
  return call("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    reply_markup: replyMarkup,
  });
}

export function editMessageText(
  chatId: string | number,
  messageId: number,
  text: string,
  replyMarkup?: InlineKeyboard,
) {
  return call("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    reply_markup: replyMarkup,
  });
}

export function answerCallbackQuery(callbackQueryId: string, text?: string) {
  return call("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
  });
}

export function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
