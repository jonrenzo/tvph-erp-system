# Troubleshooting

## Login fails

Check:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Supabase Auth provider settings.
- Supabase redirect URLs.
- `proxy.ts` matcher and redirect behavior.

## Admin actions fail

Check:

- User role in `profiles`.
- Capability mapping in `lib/auth/roles.ts`.
- Server action uses `requireCapability()`.
- `SUPABASE_SERVICE_ROLE_KEY` is set for service-role work.

## Uploads fail

Check:

- Storage bucket exists.
- Storage policy allows the intended action.
- Server Action body limit in `next.config.ts`.
- File size is below the app's upload limit.
- Service-role key exists for privileged upload flows.

## Emails do not send

Check:

- `RESEND_API_KEY`
- `EMAIL_FROM`
- Sender domain DNS.
- `NEXT_PUBLIC_SITE_URL`
- Resend logs.
- `email_log` records.

## Resend webhook fails

Check:

- `RESEND_WEBHOOK_SECRET`
- `svix-id`, `svix-timestamp`, and `svix-signature` headers.
- Server time drift. Events older than five minutes are rejected.

## AI chat, OCR, or imports fail

Check:

- `GOOGLE_GENERATIVE_AI_API_KEY`
- User authentication.
- Route handler logs for `/api/chat`.
- Input file type and size.

## Cron jobs do not run

Check:

- `CRON_SECRET` in app environment.
- Supabase Vault `cron_secret`.
- Supabase Vault `app_base_url`.
- Relevant cron migration ran.
- Route can receive POST requests from Supabase.

## Node status sync fails

Check:

- `TWINBACKEND_ERP_KEY`
- `/api/cron/node-status` auth header.
- Project/vendor links.
- `node_status` and `vendor_sync_state` tables.

## Partner vendor API returns 401

Check:

- `PARTNER_API_KEY`
- Request header is exactly `Authorization: Bearer <key>`.
- The key is not exposed in client-side code.

## Build fails after Next.js changes

Read the relevant docs under `node_modules/next/dist/docs/`. This repo uses Next.js 16. Do not assume older middleware or cache conventions.

