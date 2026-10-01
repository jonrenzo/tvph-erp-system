# Testing

## Commands

```bash
npm run lint
npm run test
npm run test:coverage
npm run build
```

Run `npm run lint`, `npm run test`, and `npm run build` before shipping.

## Test locations

Tests live under `__tests__/`.

Current coverage focuses on:

- Purchase request and purchase order logic.
- Approval workflows.
- PO issue controls.
- Signed PO review.
- Completion certificates.
- Invoice amount guards.
- Payment due dates.
- PDF rendering helpers.
- Supabase migration expectations.
- Dashboard and shared UI behavior.
- Tooltips, toasts, and header z-index behavior.
- Node-status client and sync logic.

## Test style

- Keep tests close to the business rule being protected.
- Add one focused test for each non-trivial bug fix.
- Prefer testing shared logic directly over snapshotting UI.
- For SQL migrations, add migration text tests under `__tests__/supabase/` when the migration is risky.

