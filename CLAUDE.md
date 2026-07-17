# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

`next.config.ts` enables `cacheComponents: true`, which changes caching/dynamic-rendering behavior — be aware of it when adding data-fetching code. Note on the auth guard: Next.js 16 deprecated `middleware.ts` in favor of `proxy.ts`, and this repo has migrated — the session-refresh/redirect guard now lives in `proxy.ts` (exports `proxy(request)`), not `middleware.ts`.

## Commands

```bash
npm run dev            # Start dev server (Turbopack)
npm run build           # Production build
npm run start           # Start production build
npm run lint            # ESLint
npm run test            # Run Jest once
npm run test:watch      # Jest watch mode
npm run test:coverage   # Jest with coverage
```

Run a single test file or pattern:

```bash
npx jest __tests__/app/dashboard/purchase-orders/actions.test.ts
npx jest -t "name of test case"
```

Before shipping any change, run `npm run lint`, `npm run test`, and `npm run build` — build failures here often surface Server Component/Server Action boundary mistakes that lint and tests miss.

## Architecture

TelcoVantage ERP is a server-first Next.js App Router app backed by Supabase (Auth, Postgres, RLS, Storage, Realtime). Read `README.md` for full product-module documentation (vendors/accreditation, procurement/POs, AP invoices & payments, CRM/client POs/client invoices, projects, documents, HR, assets, reports, AI assistant, email/cron/Telegram). The notes below cover cross-cutting structure that spans multiple files.

### Request/data flow

- Data loading happens in React Server Components under `app/dashboard/**`.
- Mutations live in module-specific `actions.ts` files (e.g. `app/dashboard/purchase-orders/actions.ts`) marked `"use server"`.
- External-facing integrations (PDF/DOCX generation, exports, reports, chat, cron, Telegram, webhooks) are App Router Route Handlers under `app/api/**/route.ts`.
- `proxy.ts` refreshes the Supabase session on every request and redirects unauthenticated `/dashboard/*` requests to `/login` (and authenticated users away from `/` and `/login`). This is the session-refresh/redirect layer only — it is not the authorization boundary.

### Supabase clients — three, not interchangeable

- `utils/supabase/client.ts` — browser client.
- `utils/supabase/server.ts` — cookie-aware SSR client for Server Components/Actions/Route Handlers; respects RLS as the calling user.
- `utils/supabase/service.ts` — service-role client (`createServiceRoleClient()`) that bypasses RLS. Use only for privileged server-only work (invitations, password-reset metadata, profile sync, some storage flows, operational scripts). Requires `SUPABASE_SERVICE_ROLE_KEY`.

### Authorization model (the real enforcement boundary)

- `lib/auth/roles.ts` defines the client-safe RBAC primitives: the `Role` union (`superadmin`, `admin`, `finance`, `operations`, `viewer`), the `Capability` union, and the `CAPABILITY_ROLES` map of which roles hold each capability. This file has no server-only imports, so it's shared by client components (sidebar, RBAC views) too.
- `lib/auth/permissions.ts` wraps it with server-only helpers: `getCurrentProfile()` loads the authenticated user + profile + role, and `requireCapability(capability)` is the actual authorization gate — call it at the top of every Server Action and Route Handler that mutates data or reads sensitive data. The UI hiding role-restricted nav items is cosmetic; `requireCapability` is what actually enforces access.
- `superadmin` has every capability. `admin` has everything except three superadmin-only destructive capabilities (`audit.read`, `vendor.delete`, `po.delete`). When adding a new capability, add it to both the `Capability` union and `CAPABILITY_ROLES` in `lib/auth/roles.ts`.

### Database migrations

- `supabase/migrations/*.sql` is the schema source of truth, applied in filename order (note: filenames mix `2025*` and `2026*` prefixes — sort lexicographically, not by "year"). There is no single consolidated schema file; the initial migration plus every later migration together define the current schema (RBAC consolidation, CRM, document versioning, HR/assets, client POs/invoices, email log, cron jobs, payment reservations, etc.).
- Scheduled jobs (`document-expiry-reminders`) run via `pg_cron` + `pg_net`, reading `app_base_url` and `cron_secret` from Supabase Vault — these are separate from the app's own env vars and must be created with `vault.create_secret(...)` as described in `supabase/migrations/20260609_email_reminders_cron.sql`.
- When adding a migration, follow the existing `YYYYMMDD_description.sql` naming and keep it additive/idempotent where possible since migrations are applied straight through in order with no down-migrations.

### Shared business logic

- `lib/reports/*` holds calculations (AP aging, compliance, vendor register, operations summary) shared between the dashboard UI and the PDF report routes (`app/api/reports/*`) — update both consumers' expectations when changing a calculation here, don't duplicate the math in the route handler.
- `lib/chat/*` holds the Gemini assistant's tool implementations (list/create/update vendors, customers, POs, documents; compliance/financial summaries). Mutating tools require explicit user confirmation before executing — preserve that pattern when adding new tools.
- `lib/pdf/*` and `lib/docx/*` render/generate PO and report documents; the browser DOCX editor (`components/docx/`) can round-trip edited output back through `app/api/purchase-orders/[id]/save-docx`.
- `utils/audit.ts` — call this from every significant mutation; audit logging is treated as a required side effect, not optional.
- `utils/notifications.ts` — in-app notification helper backing the Realtime notification bell.

### Testing conventions

Tests live under `__tests__/` mirroring the source path (e.g. `app/dashboard/purchase-orders/actions.ts` → `__tests__/app/dashboard/purchase-orders/actions.test.ts`), using Jest 30 + Testing Library + jsdom, configured via `next/jest` in `jest.config.js`. The `@/*` path alias resolves the same way in tests as in app code. Existing coverage focuses on PO creation/issue-control logic, completion certificates, invoice amount guards (PO/completion-percentage overbilling guards), and a handful of shared UI components (toaster, tooltip, header) — follow that same actions/business-logic-first testing emphasis over incidental UI snapshot tests.
