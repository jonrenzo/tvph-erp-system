# Deployment

## Build

```bash
npm install
npm run build
npm run start
```

Production hosting must provide every required environment variable for the enabled features.

## Deployment checklist

1. Apply Supabase migrations.
2. Confirm storage buckets and policies exist.
3. Configure environment variables.
4. Configure Supabase Auth redirect URLs.
5. Configure Resend sender domain and DNS.
6. Configure Supabase Vault secrets for cron.
7. Register Telegram webhook if enabled.
8. Run `npm run build`.
9. Smoke-test login, dashboard, vendor documents, PO issue, email, and reports.

## Auth redirects

Configure Supabase Auth redirect URLs for the production domain and local development domain. Include callback routes used by the app.

## Email DNS

Use [godaddy-resend-dns-records.md](godaddy-resend-dns-records.md) as the DNS handoff reference for Resend.

## Public docs route

`/docs` currently redirects to `public/docs/index.html` through `next.config.ts`.

The Docsify source in this folder is repo documentation. If the team wants Docsify served by the app, either move the built/static Docsify assets under `public/docs` or change the redirect deliberately.

