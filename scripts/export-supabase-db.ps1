param(
  [string]$DbUrl = $env:SUPABASE_DB_URL,
  [string]$OutDir
)

$ErrorActionPreference = "Stop"

if (-not $DbUrl) {
  throw "Set SUPABASE_DB_URL or pass -DbUrl with the source Supabase Postgres connection string."
}

if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
  throw "Supabase CLI is required. Install it first, then rerun this script."
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
if (-not $OutDir) {
  $OutDir = Join-Path (Get-Location) "turnover-exports/db/$timestamp"
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

supabase db dump --db-url $DbUrl -f (Join-Path $OutDir "roles.sql") --role-only
supabase db dump --db-url $DbUrl -f (Join-Path $OutDir "schema.sql")
supabase db dump --db-url $DbUrl -f (Join-Path $OutDir "data.sql") --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"
supabase db dump --db-url $DbUrl -f (Join-Path $OutDir "migration-history-schema.sql") --schema supabase_migrations
supabase db dump --db-url $DbUrl -f (Join-Path $OutDir "migration-history-data.sql") --use-copy --data-only --schema supabase_migrations

@"
# Restore notes

Generated: $timestamp

Set the destination database URL:

```powershell
`$env:NEW_DB_URL="postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"
```

Restore main database:

```powershell
psql --single-transaction --variable ON_ERROR_STOP=1 --file roles.sql --file schema.sql --command "SET session_replication_role = replica" --file data.sql --dbname `$env:NEW_DB_URL
```

Restore migration history if needed:

```powershell
psql --single-transaction --variable ON_ERROR_STOP=1 --file migration-history-schema.sql --file migration-history-data.sql --dbname `$env:NEW_DB_URL
```

Storage objects are not included in these SQL files. Export and import Supabase Storage buckets separately.
"@ | Set-Content -Path (Join-Path $OutDir "RESTORE.md") -Encoding UTF8

Write-Host "Database turnover export written to: $OutDir"
Write-Host "Do not commit this folder. It contains live database content."
