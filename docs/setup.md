# Setup

## Prerequisites

- Node.js 20 or newer.
- npm.
- Supabase project.
- Google AI Studio key for Gemini features.
- Resend account for production email.
- Optional Telegram bot for role-assignment notifications.

## Install

```bash
npm install
```

## Local development

```bash
npm run dev
```

Open `http://localhost:3000`. The root route redirects to `/login`; authenticated users go to `/dashboard`.

## Environment variables

Create `.env.local` in the project root.

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

NEXT_PUBLIC_SITE_URL=http://localhost:3000

GOOGLE_GENERATIVE_AI_API_KEY=

RESEND_API_KEY=
EMAIL_FROM="TelcoVantage ERP <no-reply@example.com>"
EMAIL_REPLY_TO=
EMAIL_CC_INTERNAL=true

CRON_SECRET=
PARTNER_API_KEY=
TWINBACKEND_ERP_KEY=

TELEGRAM_BOT_TOKEN=
TELEGRAM_ADMIN_CHAT_ID=
TELEGRAM_WEBHOOK_SECRET=

RESEND_WEBHOOK_SECRET=

SUPABASE_ACCESS_TOKEN=
SUPABASE_PROJECT_REF=
VERCEL_TOKEN=
```

## Required keys by feature

| Feature | Required variables |
| --- | --- |
| Basic app boot and login | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Admin scripts, privileged storage, profile sync | `SUPABASE_SERVICE_ROLE_KEY` |
| Public links in emails and magic links | `NEXT_PUBLIC_SITE_URL` |
| AI chat, OCR, AI imports | `GOOGLE_GENERATIVE_AI_API_KEY` |
| Email sending | `RESEND_API_KEY`, `EMAIL_FROM` |
| Scheduled cron routes | `CRON_SECRET` |
| Partner vendor API | `PARTNER_API_KEY` |
| Project node-status sync | `TWINBACKEND_ERP_KEY`, `CRON_SECRET` |
| Telegram role assignment | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID`, `TELEGRAM_WEBHOOK_SECRET` |
| Resend webhook event updates | `RESEND_WEBHOOK_SECRET` |
| System panel Supabase logs | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF` |
| System panel Vercel logs | `VERCEL_TOKEN` |

Empty optional variables are treated as unset by `lib/env.ts`.

## Database setup

Apply every SQL migration in `supabase/migrations/` in filename order. There are currently 67 migrations.

For Supabase CLI, link the project and apply migrations with the team's normal Supabase workflow. For SQL Editor setup, run the files oldest to newest.

Do not skip later migrations. They add RLS, indexes, storage policies, cron jobs, purchase requests, approval flows, client billing, node status, and performance fixes.

## Supabase Vault secrets

Scheduled jobs use Vault secrets from migrations. At minimum, configure:

```sql
select vault.create_secret('https://your-app-domain.com', 'app_base_url');
select vault.create_secret('<same value as CRON_SECRET>', 'cron_secret');
```

Check the cron migrations before production setup:

- `20260609_email_reminders_cron.sql`
- `20260703_invoice_due_reminders_cron.sql`
- `20260806_node_status_cron.sql`

## Docsify docs

Serve the documentation locally:

```bash
npx docsify-cli serve docs
```

This uses `docs/index.html` and the Markdown files in `docs/`.

