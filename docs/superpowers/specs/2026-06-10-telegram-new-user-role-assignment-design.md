# Telegram New-User Role Assignment — Design

## Problem / intent

New people enter the ERP two ways: an admin **invites** them (role chosen at invite — no action needed), or they log in via **Microsoft SSO** for the first time, which auto-creates a profile with the default low role (`viewer`). For that SSO path, the director wants an **instant phone ping** to assign the person's real role, tappable from Telegram without opening the web app.

## Trigger

In `app/auth/callback/route.ts` → `syncMicrosoftProfile`, the existing **new-profile branch** (no existing profile → insert with role `viewer`). After the insert, fire a Telegram alert. The auth flow must never block or fail if Telegram errors (fire-and-forget, wrapped in try/catch). Naturally once-per-user (only the first SSO login hits this branch).

## Flow

1. New SSO user provisioned as `viewer` → bot DMs the allowlisted admin chat:
   > New user: `jane@telcovantage.com` (Jane Dela Cruz) just signed in. Assign a role:
   > `[Admin] [Finance] [Operations] [Viewer]`
2. Tapping a role edits the message to **"Confirm <Role>? [Yes] [No]"** (guards against fat-finger).
3. **Yes** → update `profiles.role` (service role), write an audit log ("via Telegram"), edit message to **"✅ Jane is now Operations"**. **No** → restore the role buttons.
4. In-app parity: also insert a row in the existing `notifications` table so the web bell shows the same alert.

`superadmin` is **never** offered or accepted (dev-only; assigned in-app).

### Managing existing users (added scope)

Beyond new-user alerts, the bot also manages **current** users on demand:
- `/users` — the bot replies with the team list; tapping a person shows their current role + the same `[Admin][Finance][Operations][Viewer]` buttons (with confirm), reusing the identical change-role + audit flow.
- Optional `/whoami` / help command. Same security: only the allowlisted chat ID; `superadmin` never assignable via the bot.
This reuses the webhook's callback handler — the only addition is a command handler that lists users and emits the per-user role keyboard.

## Components

- `lib/telegram/client.ts` — thin `fetch` wrapper for Telegram Bot API (`sendMessage`, `editMessageText`, `answerCallbackQuery`). No-ops if `TELEGRAM_BOT_TOKEN` unset.
- `lib/telegram/notify.ts` — `sendNewUserRoleAlert({ userId, email, fullName })`: builds the inline keyboard, sends to `TELEGRAM_ADMIN_CHAT_ID`. `callback_data` encodes action+user+role, e.g. `role|pick|<uuid>|operations`, `role|set|<uuid>|operations`, `role|cancel|<uuid>` (all < 64 bytes).
- `app/api/telegram/webhook/route.ts` — POST handler for Telegram updates (callback queries).
- Trigger call added to `syncMicrosoftProfile` new-profile branch.

## Security

- Verify header `X-Telegram-Bot-Api-Secret-Token` == `TELEGRAM_WEBHOOK_SECRET` (set at webhook registration).
- Verify the update's `chat.id` == `TELEGRAM_ADMIN_CHAT_ID` (rejects anyone else who finds/messages the bot).
- Server-side allowlist of assignable roles = `admin | finance | operations | viewer`; reject anything else.
- Role change uses the service-role Supabase client (no web session in a webhook). Audit log records the change with a "via Telegram" note.

## Config (verified)

- Bot: **@tvph_bot** ("TelcoVantage Bot"), id `8929032696`.
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID=5856907459`, `TELEGRAM_WEBHOOK_SECRET` — in `.env.local`; must also be set in the **prod** env. Add to `lib/env.ts` schema (all optional; feature no-ops if unset).
- **One-time webhook registration** (prod only — Telegram can't reach localhost): `setWebhook` → `https://erp.telcovantage.com/api/telegram/webhook` with `secret_token`. Provide a small script + runbook.

## Dependencies

None — plain `fetch`. No new packages. Depends on the **5-role RBAC consolidation** being in place (the buttons assign `admin/finance/operations/viewer`), so that work lands first.

## Local vs prod

Notify side (sending the DM) is testable locally. Button taps require the deployed webhook (or a tunnel like ngrok) because Telegram calls the public URL.

## Verification

1. Set env, register webhook on prod.
2. Simulate a first SSO login (or call `sendNewUserRoleAlert` directly) → DM arrives with role buttons.
3. Tap a role → confirm prompt → Yes → `profiles.role` updated, audit row written, message shows "✅ … is now …", web bell shows a notification.
4. Negative: a message from a non-allowlisted chat ID is rejected; a forged request without the secret header is rejected; `superadmin` cannot be assigned.
