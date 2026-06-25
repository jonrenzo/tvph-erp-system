# Dashboard Redesign — Priority Zones (Role-Aware)

**Date:** 2026-06-25  
**Status:** Approved for implementation

## Context

The current "Command Center" dashboard is finance-heavy and role-blind — every user sees the same AP/AR/liability view regardless of whether they're in operations, finance, or admin. The complaint is "lots of information needs to be in the dashboard" — but data already exists for projects, compliance, and trends; it just isn't surfaced. The redesign adds those domains and makes every band role-relevant.

## Layout — Six Priority Zones (top-to-bottom)

```
1. Header + quick actions       (role-filtered buttons)
2. Attention strip              (near-due POs/invoices, overdue, non-compliant vendors)
3. KPI row                      (role-relevant stat cards)
4. Trends band                  (Recharts: cash-flow line + spend/collections bars)
5. Role panel band              (Projects % + Compliance health)
6. Activity feed                (admin/superadmin only)
```

Each zone is rendered only if the current role is relevant to it. Roles without a widget simply don't see it — no empty cards, no "Access denied" placeholders.

## Role Mapping

| Band | operations | finance | admin / superadmin | viewer |
|---|---|---|---|---|
| Quick actions | New PO | Record Invoice | New PO + Record Invoice | — |
| Attention | POs due, vendor non-compliant, expiring docs | Invoices due, overdue AP & AR | All alerts | — |
| KPIs | Active POs+commitment, pending vendors, active projects, expiring docs | Liability, AR outstanding, collected MTD, settlement rate | Union of both | Counts only (projects, vendors) |
| Trends | PO volume + spend by month | Cash-flow (payments vs collections) | Both | — |
| Panels | Projects % + Compliance | AP aging mini + AR mini | All four | Projects % + Compliance |
| Activity | — | — | ✓ (`audit.read` = superadmin; admin sees 5-item feed) | — |

## Data Layer — `lib/dashboard/`

New file: `lib/dashboard/queries.ts`

- `getProjectProgress(supabase)` — billing proxy: `Σ payments on project POs ÷ Σ those PO amounts`, grouped by project. No schema change. Swaps to milestone-based once issue #5 lands.
- `getMonthlyTrends(supabase)` — group `payments` + `client_payments` by month, last 6 months → `{ month, apPaid, arCollected }[]` for Recharts.

Reuse:
- `computeComplianceSummary()` from `lib/reports/compliance.ts`
- All existing queries from `app/dashboard/page.tsx` (preserved, just reorganised)

Only fetch what the current role renders — e.g. finance doesn't trigger vendor/project queries.

## Components

Split the monolithic `DashboardContent` into focused client/server pieces:

| Component | Type | Purpose |
|---|---|---|
| `DashboardAttention` | Server (async) | Near-due/overdue strips, role-filtered |
| `DashboardKpis` | Server (async) | Stat card row, role-filtered |
| `DashboardTrends` | Client | Recharts lazy-loaded, receives serialised data |
| `DashboardProjects` | Server (async) | Project list + billing % bars |
| `DashboardCompliance` | Server (async) | Compliance gauge + vendor breakdown |
| `DashboardActivity` | Server (async) | Audit log feed, admin/superadmin only |

`app/dashboard/page.tsx` fetches the current role, runs role-gated parallel queries, and passes data down as props. Each component is independently `Suspense`-wrapped with a skeleton.

## Dependencies

- **Add `recharts`** — lazy-loaded client component so it doesn't affect other routes.
- Project % uses billing proxy (money progress) — documented in code comment, no schema change.
- `unstable_instant = { prefetch: "static" }` preserved; no new searchParams on this page.

## Verification

1. Log in as each role (operations / finance / admin / viewer), confirm correct bands appear.
2. Trends chart renders in both light and dark mode without hydration errors.
3. Project % bars show values (may be 0% if no payments yet — that's correct).
4. Compliance gauge matches the Compliance Hub page numbers.
5. Activity feed visible only to admin/superadmin.
