# Operations

## Routine checks

Run these checks after deployment and before major handoff:

```bash
npm run lint
npm run test
npm run build
```

Then test the important business paths:

- Login.
- Vendor create/update.
- Vendor document upload.
- Purchase request create/approve/convert.
- Purchase order approve/issue/signature flow.
- Supplier invoice create/payment.
- Client invoice flow.
- Report generation.
- Notifications.
- Email send.

## Cron routes

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/cron/document-reminders` | POST | Sends vendor document expiry reminders. |
| `/api/cron/invoice-due-reminders` | POST | Sends invoice due reminders. |
| `/api/cron/node-status` | POST | Syncs project-linked vendor node status. |

All cron routes require:

```http
Authorization: Bearer <CRON_SECRET>
```

## Telegram webhook

Register:

```bash
node scripts/register-telegram-webhook.mjs https://your-app-domain.com
```

Delete:

```bash
node scripts/register-telegram-webhook.mjs --delete
```

## Billing seed scripts

Use with care:

```bash
npm run seed:billing:dry
npm run seed:billing
npm run seed:billing:wipe
```

Check the script before running wipe mode.

## Database maintenance

- Back up PostgreSQL and Supabase Storage before migrations.
- Apply migrations in order.
- Keep service-role keys in secret storage only.
- Review RLS changes carefully.
- Keep `docs/PROJECT_ANALYSIS.md` current after major schema changes.

## User documentation

The app route `/docs` currently serves `public/docs/index.html`, not this Docsify source. That existing guide has screenshots under `public/docs/img/`.

The Docsify turnover source lives in `docs/`.

