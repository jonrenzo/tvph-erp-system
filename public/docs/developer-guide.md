# Developer guide

## Read first

Before changing code, read:

- `AGENTS.md`
- `docs/PROJECT_ANALYSIS.md`
- The files that own the workflow you are changing.
- For Next.js behavior, the relevant guide in `node_modules/next/dist/docs/`.

This project uses Next.js 16. Do not assume older Next.js middleware, caching, or routing behavior.

## Common patterns

Module folders usually follow this shape:

```text
app/dashboard/<module>/
  page.tsx
  new/page.tsx
  [id]/page.tsx
  actions.ts
```

Not every module has every file. Follow the nearby pattern.

## Server Actions

- Add `"use server"` at the top of action files.
- Validate inputs at trust boundaries.
- Use `requireCapability()` for protected operations.
- Write audit logs for major mutations.
- Revalidate or redirect after mutations when the page needs fresh data.

## Route handlers

Route handlers live in `app/api/**/route.ts`. Use them for:

- Generated files.
- External webhooks.
- Cron targets.
- Partner APIs.
- Streaming AI chat.

Protect route handlers with capability checks, bearer tokens, or webhook signatures as appropriate.

## UI

- Shared primitives live in `components/ui/`.
- Dashboard-specific components live in `components/dashboard/`.
- Use existing table, toolbar, status, tooltip, pagination, and search components before adding new ones.
- Keep client components small and only add `"use client"` when browser state or effects are needed.

## Business logic

Prefer shared libraries for logic used by both UI and generated output:

- Reports: `lib/reports/`
- PDF rendering: `lib/pdf/`
- Invoice status: `lib/invoices/status.ts`
- Billing status: `lib/billing/status.ts`
- PO sequence: `lib/dashboard/po-sequence.ts`
- Vendor document taxonomy: `lib/vendors/document-types.ts`

## Dependencies

Do not add a package for small utilities. Use the standard library, existing helpers, or installed dependencies first.

If dependencies change, update:

- `package.json`
- `package-lock.json`
- `docs/PROJECT_ANALYSIS.md`
- Relevant Docsify pages

## Documentation updates

Update docs when you change:

- Environment variables.
- Routes or major workflows.
- Database schema, storage buckets, or RLS.
- External integrations.
- Operational scripts.
- Deployment steps.

