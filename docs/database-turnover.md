# Database turnover

Use this when the database content must be turned over without transferring the original Supabase account.

Do not commit live SQL dumps to this repository. The dump can contain vendors, customers, contacts, payment records, Auth data, storage metadata, operational notes, and other business records. Git history is the wrong place for that data.

## Recommended handoff

1. The receiving company creates its own Supabase organization and project.
2. Export the current database into local SQL files.
3. Transfer the SQL files through an approved private channel.
4. Restore into the company-owned Supabase project.
5. Copy Storage bucket objects separately.
6. Rotate app environment variables to the new project.
7. Smoke-test the new project before DNS/app cutover.

Supabase documents this as a project-to-project migration with separate database and storage steps. Storage objects and dashboard settings are not fully covered by a plain SQL dump.

## Export database SQL files

Set the source database URL in your shell. Use the connection string from the Supabase dashboard.

PowerShell:

```powershell
$env:SUPABASE_DB_URL="postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"
.\scripts\export-supabase-db.ps1
```

The script writes files under `turnover-exports/db/<timestamp>/`, which is ignored by Git:

```text
roles.sql
schema.sql
data.sql
migration-history-schema.sql
migration-history-data.sql
RESTORE.md
```

## Restore into the new project

Set the destination database URL, then run the restore commands from the generated `RESTORE.md`.

The basic restore order is:

```bash
psql \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file roles.sql \
  --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql \
  --dbname "$NEW_DB_URL"
```

If migration history is needed, restore `migration-history-schema.sql` and `migration-history-data.sql` after the main restore.

## Storage handoff

The SQL dump does not copy the actual files in Supabase Storage. Export each bucket separately:

- `avatars`
- `vendor-documents`
- `tvph-documents`
- `erp-documents`
- `customer-documents`
- `employee-documents`
- PO/payment buckets from later migrations

Use a private transfer location controlled by the receiving company. After upload to the new project, test previews and downloads from the app.

## Environment cutover

Update production secrets to point at the receiving company's project:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `PARTNER_API_KEY`
- `TWINBACKEND_ERP_KEY`
- `RESEND_WEBHOOK_SECRET`
- Telegram variables if enabled
- Supabase management variables for the System panel, if enabled

Then redeploy the app.

## Post-restore checks

1. Sign in with a known admin account.
2. Confirm roles in `profiles`.
3. Open vendors, POs, invoices, CRM, documents, and reports.
4. Upload and preview a test file in Storage.
5. Send a test email.
6. Run cron routes manually with `CRON_SECRET`.
7. Confirm `/docs` loads.

