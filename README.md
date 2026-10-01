<div align="center">

<img src="/public/banner.png" alt="TelcoVantage ERP Banner" />

<br />

**Internal ERP platform for TelcoVantage Philippines.**

Vendor accreditation, purchase requests, purchase orders, AP, AR, CRM, projects, HR, assets, documents, reports, notifications, and AI-assisted workflows.

</div>

---

## Documentation

Turnover documentation now lives in the Docsify site under [docs/](./docs/README.md). In a deployed app, visit `/docs`.

Open it locally with:

```bash
npx docsify-cli serve docs
```

Then visit `http://localhost:3000`.

The deployed `/docs` route serves a copy of the Docsify site from `public/docs/`. Keep the source in `docs/` updated first, then copy it to `public/docs/` before deployment.

## Quick start

```bash
npm install
npm run dev
```

Create `.env.local` first. The minimum local login setup needs:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Most admin, storage, email, AI, cron, and integration features need more keys. See [docs/setup.md](./docs/setup.md).

## Common commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js development server. |
| `npm run build` | Build for production. |
| `npm run start` | Start the production build. |
| `npm run lint` | Run ESLint. |
| `npm run test` | Run Jest. |
| `npm run test:watch` | Run Jest in watch mode. |
| `npm run test:coverage` | Run Jest with coverage. |
| `npm run seed:billing:dry` | Preview client billing seed/import work. |
| `npm run seed:billing` | Seed client billing data. |
| `npm run seed:billing:wipe` | Wipe then seed client billing data. |

## Handoff

Start here:

- [Turnover guide](./docs/handoff.md)
- [Setup](./docs/setup.md)
- [Architecture](./docs/architecture.md)
- [Operations](./docs/operations.md)
- [Developer guide](./docs/developer-guide.md)
- [Troubleshooting](./docs/troubleshooting.md)

The short project inventory used by agents is [docs/PROJECT_ANALYSIS.md](./docs/PROJECT_ANALYSIS.md).
