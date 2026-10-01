# Integrations

## Supabase

Supabase provides Auth, PostgreSQL, RLS, Storage, Realtime, cron support through `pg_cron`, and outbound calls through `pg_net`.

## Gemini

Gemini 2.5 Flash is used through the Vercel AI SDK for:

- Dashboard AI assistant.
- OCR and document analysis flows.
- AI-assisted CSV/XLSX import mapping.

Required variable:

```env
GOOGLE_GENERATIVE_AI_API_KEY=
```

## Resend

Resend sends PO emails, PR/PO approval emails, payment request notifications, document requests, expiry reminders, and client billing summaries.

Main files:

- `lib/email/send.ts`
- `lib/email/resend.ts`
- `lib/email/templates/`
- `app/api/resend/webhook/route.ts`

Webhook verification uses Svix signature headers and `RESEND_WEBHOOK_SECRET`.

## Telegram

Telegram can notify admins when a Microsoft SSO user signs in and needs a role. Inline actions can assign roles.

Main files:

- `lib/telegram/client.ts`
- `lib/telegram/notify.ts`
- `lib/telegram/service.ts`
- `app/api/telegram/webhook/route.ts`
- `scripts/register-telegram-webhook.mjs`

## twinbackend node status

Project node status sync calls twinbackend with `TWINBACKEND_ERP_KEY`.

Main files:

- `lib/node-status/client.ts`
- `lib/node-status/sync.ts`
- `app/api/cron/node-status/route.ts`

## Partner vendor API

`GET /api/vendors` returns the current vendor list to partner systems.

It requires:

```http
Authorization: Bearer <PARTNER_API_KEY>
```

The response includes vendor id, vendor code, name, status, address, and primary contact fields.

See [PARTNER_VENDOR_API.md](PARTNER_VENDOR_API.md). Avoid committing real API keys in examples.

