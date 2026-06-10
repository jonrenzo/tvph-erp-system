// One-time (per environment) Telegram webhook registration.
//
// Usage:
//   node scripts/register-telegram-webhook.mjs https://erp.telcovantage.com
//   node scripts/register-telegram-webhook.mjs --delete    # unregister
//
// Reads TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET from the environment
// (e.g. `node --env-file=.env.local scripts/register-telegram-webhook.mjs <url>`).

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
if (!token) {
  console.error("Missing TELEGRAM_BOT_TOKEN in env.");
  process.exit(1);
}

const arg = process.argv[2];
const api = (method, body) =>
  fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.json());

if (arg === "--delete") {
  console.log(await api("deleteWebhook", { drop_pending_updates: true }));
  process.exit(0);
}

const base = (arg || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
if (!base.startsWith("https://")) {
  console.error("Provide the public HTTPS base URL, e.g. https://erp.telcovantage.com");
  process.exit(1);
}

const res = await api("setWebhook", {
  url: `${base}/api/telegram/webhook`,
  secret_token: secret,
  allowed_updates: ["message", "callback_query"],
});
console.log("setWebhook:", res);
console.log("getWebhookInfo:", await api("getWebhookInfo", {}));
