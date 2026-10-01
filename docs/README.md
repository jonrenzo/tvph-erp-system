# TelcoVantage ERP documentation

This is the handoff documentation for the TelcoVantage ERP system.

The application is a private Next.js and Supabase ERP for TelcoVantage Philippines. It manages vendor accreditation, purchase requests, purchase orders, supplier invoices, customer billing, CRM, projects, documents, HR, assets, reports, audit logs, notifications, and AI-assisted workflows.

Use this documentation for onboarding future users, administrators, and developers.

## Start here

- Business and operational handoff: [Turnover guide](handoff.md)
- Local setup and environment keys: [Setup](setup.md)
- How the system is built: [Architecture](architecture.md)
- Feature inventory: [Modules](modules.md)
- Production routines and maintenance: [Operations](operations.md)
- Developer conventions: [Developer guide](developer-guide.md)

## Current stack

| Layer | Technology |
| --- | --- |
| App | Next.js 16.2 App Router, React 19.2, TypeScript 5 |
| UI | Tailwind CSS 4, Lucide React, Recharts, Sonner, next-themes |
| Backend | Supabase Auth, PostgreSQL, RLS, Storage, Realtime |
| AI | Vercel AI SDK, Gemini 2.5 Flash |
| Email | Resend, React Email |
| Documents | pdf-lib, pdfkit, PizZip, DOCX/PDF templates |
| Testing | Jest 30, Testing Library, jsdom, ts-jest |
| Package manager | npm |

## Repository map

```text
app/                    Next.js App Router pages, layouts, API routes, Server Actions
components/             Dashboard, portal, docx, and shared UI components
lib/                    Auth, email, PDF, reports, chat tools, integrations, business logic
utils/                  Supabase clients, audit, notifications, import/export helpers
supabase/migrations/    SQL schema, RLS, storage, cron, indexes, feature migrations
scripts/                Operational scripts
__tests__/              Jest tests
docs/                   Docsify documentation source
public/docs/            Existing static user guide served by the app at /docs
```

## Handoff rule

Keep [PROJECT_ANALYSIS.md](PROJECT_ANALYSIS.md) and this Docsify site current when project structure, dependencies, environment variables, routes, database schema, or major workflows change.

