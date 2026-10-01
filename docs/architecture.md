# Architecture

## Shape of the app

The app uses Next.js App Router with React Server Components by default. Reads usually happen in server components. Mutations live in `"use server"` actions, mostly in route-specific `actions.ts` files. External integrations and generated files use App Router route handlers under `app/api/`.

Supabase provides Auth, PostgreSQL, Row Level Security, Storage, and Realtime notifications.

## Auth guard

`proxy.ts` is the Next.js 16 auth guard. It refreshes the Supabase session and handles redirects:

- Unauthenticated `/dashboard/*` requests go to `/login`.
- Authenticated `/` and `/login` requests go to `/dashboard`.

Read the local Next.js docs in `node_modules/next/dist/docs/` before changing Next.js routing, proxy, cache, or Server Action behavior.

## Supabase clients

| File | Use |
| --- | --- |
| `utils/supabase/client.ts` | Browser client. Use only in client components. |
| `utils/supabase/server.ts` | Cookie-aware server client. Use for normal authenticated server reads/writes. |
| `utils/supabase/service.ts` | Service-role client. Server-only privileged work. Never expose to the browser. |

Do not swap these casually. Most security boundaries depend on using the right client.

## Authorization

Capabilities live in `lib/auth/roles.ts`. Server-side enforcement goes through `requireCapability()` in `lib/auth/permissions.ts`.

The sidebar and buttons can hide unavailable actions, but UI hiding is cosmetic. Server Actions and Route Handlers must enforce capabilities.

## Configuration

`next.config.ts` currently:

- Disables `cacheComponents` because it caused stale approval banners after mutations.
- Sets Server Action and proxy body limits to `60mb`.
- Externalizes `pdfkit`.
- Sets common security headers.
- Redirects `/docs` to the older static user guide in `public/docs/index.html`.

## Data flow

```text
Browser
  -> Next.js page/component
  -> Supabase server client for authenticated reads
  -> Server Action or Route Handler for mutations/integrations
  -> requireCapability for protected operations
  -> Supabase PostgreSQL, Storage, Realtime
```

Generated documents and reports usually flow through `lib/pdf/`, `lib/docx/`, or route handlers under `app/api/`.

## Important conventions

- Keep business rules close to the server action or shared library that owns the workflow.
- Put shared report calculations in `lib/reports/` so UI and PDF output match.
- Add audit log entries for major mutations through `utils/audit.ts`.
- Use `utils/notifications.ts` for in-app notifications.
- Prefer existing `components/ui/` primitives before adding new UI patterns.

