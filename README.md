<div align="center">

<img src="/public/banner.png" alt="TelcoVantage ERP Banner" />

<br/>

**The Intelligent Command Surface for TelcoVantage Philippines.**

*Vendor management. Financial intelligence. Project oversight. AI-powered.*

<br/>

[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19.2-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)
[![Gemini AI](https://img.shields.io/badge/Gemini_2.5_Flash-AI-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev)

<br/>

![TelcoVantage ERP](/public/screenshot.png)

</div>

---

## ⚡ What is TelcoVantage ERP?

TelcoVantage ERP is a **full-stack enterprise operations platform** purpose-built for the telecom industry in the Philippines. It replaces spreadsheets, disconnected tools, and manual compliance tracking with a single intelligent system — unified, auditable, and AI-augmented.

Built on a **server-first Next.js 16** architecture with React Server Components, Supabase RLS, and Google Gemini AI powering an in-app assistant that actually understands your business data.

---

## 🗺️ Table of Contents

- [Core Modules](#-core-modules)
- [Technology Stack](#-technology-stack)
- [Getting Started](#-getting-started)
- [Architecture Deep-Dive](#-architecture-deep-dive)
- [Roles & Permissions](#-roles--permissions)
- [Troubleshooting](#-troubleshooting)

---

## 🧩 Core Modules

### 🖥️ Command Center
> *The pulse of your operations.*

Your real-time operational dashboard. Surfaces key metrics at a glance — **Current Liability**, **Active POs**, **Pending Vendors**, and **Expiring Documents** — alongside a unified audit log and AI-generated daily operational summaries. Everything important, one screen.

---

### 🏢 Vendor Management
> *Full lifecycle. Zero surprises.*

End-to-end vendor lifecycle management with:
- Complete vendor profiles: banking details, TIN, primary & secondary contacts
- Status pipeline: `pending → active → inactive`
- Multi-currency support: **PHP / USD**
- Compliance health visibility at every touchpoint

---

### 🛡️ 14-Point Compliance Hub
> *The most dangerous word in compliance is "I think it's still valid."*

Advanced accreditation tracking across 14 critical vendor documents:

| Document | Document | Document |
|----------|----------|----------|
| NDA | SEC Registration | PCAB License |
| ISO Certification | DOLE 174 | BIR Certificate |
| PhilHealth | SSS | Pag-IBIG |
| DTI/Business Permit | Mayor's Permit | Contractor's License |
| COE / Track Record | Insurance Certificate | |

Each document tracks through: `not_submitted → submitted → approved → expired`

The **Accreditation Matrix** gives you a bird's-eye compliance grid across your entire vendor ecosystem — instantly spot what's at risk.

---

### 📋 Projects & Contracts
> *One source of truth for everything in the field.*

- Create and manage projects with status tracking and full contract references
- **Vendor-Project Linking** with safety guards — cannot unlink a vendor while open POs or unpaid invoices exist
- **Master Contract Repository**: full lifecycle tracking with start/end dates, total value, file attachments, and status

---

### 📦 Purchase Orders
> *PO-YYYY-XXXX. Numbered. Governed. Trackable.*

Rigorous PO management with built-in guardrails:

| Feature | Detail |
|---------|--------|
| Auto-numbering | `PO-YYYY-XXXX` via database trigger |
| NDA Gate | Requires approved NDA before any PO can be issued |
| Project Assignment | Link POs to projects and internal entities |
| Status Workflow | `draft → issued → partially_paid → paid / overpaid / cancelled` |

---

### 💰 Financial Management
> *Know where every peso is.*

- **Service Invoices** linked to a single PO with automatic balance calculation
- **PO Amount Guard** — prevents invoice amounts from exceeding remaining PO capacity
- **Payment Monitoring** — full/installment/down payment recording with auto-status updates
- **Overpayment Detection** — red warning banners with authorized override capability
- **Billing Health Visualization** — progress rings and percentage bars showing invoiced vs. PO amounts

---

### 🤖 AI Assistant (Gemini 2.5 Flash)
> *Ask anything. Get answers with deep-links.*

An AI assistant that understands your ERP's entire context — not a generic chatbot.

| Capability | Description |
|------------|-------------|
| **Document Analysis** | Upload a PDF and interrogate it — summaries, key terms, obligations |
| **Proactive Navigation** | Ask about vendor status → get direct deep-links and compliance insights |
| **Intelligent Search** | 8 custom tools: vendors, POs, compliance, financials, documents |
| **Natural Language Queries** | "Which vendors have expiring NDAs this month?" — just ask. |

---

### 📁 Document Repository
> *One vault. Two layers.*

- **Company Library** — 4 organized folders: Legal & Compliance, HR & Staffing, Financials, Company Templates
- **Vendor Vault** — Per-vendor document grid with compliance health indicators and full-screen preview support (PDF, images, and Office files via Google Docs viewer)

---

### 📜 Audit Logs
> *Every action. Every actor. Every timestamp.*

- Comprehensive `CREATE / UPDATE / DELETE` tracking across all entities
- Dedicated audit log page with filters by action type and entity
- Contextual inline audit log cards with infinite scroll on all relevant pages

---

### 🔔 Global Search & Real-time Notifications

- **`Cmd+K` Search Modal** — keyboard-navigable, searches across vendors, POs, invoices, projects, payments, and documents
- **Supabase Realtime** — 6 notification types, notification bell dropdown, mark-all-read, 30-day auto-cleanup

---

## 💻 Technology Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
│  Next.js 16.2.4 (App Router)  ·  React 19.2.4  ·  TypeScript 5 │
│  Tailwind CSS 4  ·  Framer Motion  ·  Lucide Icons              │
├─────────────────────────────────────────────────────────────────┤
│                      BACKEND-AS-A-SERVICE                       │
│  Supabase — Auth · PostgreSQL · Realtime · Storage · RLS        │
├─────────────────────────────────────────────────────────────────┤
│                         INTELLIGENCE                            │
│  Google Gemini 2.5 Flash  ·  Vercel AI SDK (@ai-sdk/google)     │
├─────────────────────────────────────────────────────────────────┤
│                        DOCUMENT LAYER                           │
│  pdf-lib (PO generation with fillable templates)  ·  Zod 4      │
└─────────────────────────────────────────────────────────────────┘
```

### 🔮 Roadmap

| Feature | Status |
|---------|--------|
| Daily cron jobs for compliance expiry checks | 🚧 Coming Soon |
| Transactional email alerts via Resend | 🚧 Coming Soon |
| Overdue invoice reminders | 🚧 Coming Soon |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 20+
- A **Supabase** project
- A **Google Gemini API** key ([Get one here](https://aistudio.google.com))

### Installation

**1. Clone the repo**
```bash
git clone https://github.com/jonrenzo/tvph-erp-system.git
cd tvph-erp-system
```

**2. Install dependencies**
```bash
npm install
```

**3. Configure environment variables**

Create `.env.local` at the project root:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_key
```

**4. Initialize the database**

> ⚠️ Run this on a **fresh** Supabase project to avoid table conflicts.

```bash
# Copy the contents of:
# supabase/migrations/20250514_initial_schema.sql
# Paste and execute in your Supabase project's SQL Editor.
```

**5. Start the development server**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to `/login`. Authenticate and land on `/dashboard`.

---

## 🏗️ Architecture Deep-Dive

```
Request
  │
  ▼
proxy.ts ──── Unauthenticated? ──► /login
  │
  │ Authenticated
  ▼
/dashboard/* (RSC-first, Server Actions)
  │
  ├─── lib/chat/tools.ts ──── 8 Gemini tools ──── Supabase (RLS-enforced)
  ├─── utils/audit.ts ──────── recordAuditLog() on every mutation
  └─── Supabase Realtime ───── notification bell / live updates
```

| Pillar | Implementation |
|--------|---------------|
| **Server-First** | Heavy use of React Server Components (RSC) and Server Actions — minimal client JS, maximum performance |
| **AI Tooling** | 8 AI tools in `lib/chat/tools.ts` let Gemini securely query the database through defined API boundaries |
| **Security** | RLS enabled on all tables; role-based access checks (`admin`, `finance`, `procurement`, `project_manager`) in Server Actions |
| **Auth Flow** | `proxy.ts` handles session refresh, root redirects, and protects all `/dashboard/*` routes |
| **Audit Trail** | Every mutation calls `recordAuditLog()` — full traceability, no exceptions |

---

## 👥 Roles & Permissions

| Role | Capabilities |
|------|-------------|
| `admin` | Full access — all modules, destructive actions, user management |
| `finance` | Invoice and payment management, financial reports |
| `procurement` | PO creation, vendor management, compliance tracking |
| `project_manager` | Project and contract management, vendor-project linking |

---

## 🐛 Troubleshooting

<details>
<summary><strong>Supabase connection errors on startup</strong></summary>

Ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` match exactly what's shown in your Supabase dashboard under **Project Settings → API**. Missing or malformed keys are the most common cause.
</details>

<details>
<summary><strong>Database migration is failing</strong></summary>

Run `supabase/migrations/20250514_initial_schema.sql` only on a **fresh** Supabase project. If tables already exist from a previous attempt, reset the database under **Database → Reset** in the Supabase dashboard before re-running the migration.
</details>

<details>
<summary><strong>AI features throwing rate limit or timeout errors</strong></summary>

The Gemini API (`gemini-2.5-flash`) enforces rate limits on the free tier. Check your quota in [Google AI Studio](https://aistudio.google.com). Also verify `GOOGLE_GENERATIVE_AI_API_KEY` is correctly set in `.env.local`.
</details>

<details>
<summary><strong>Stale styles or module resolution failures</strong></summary>

Next.js caches aggressively. Clear the cache and restart:
```bash
rm -rf .next
npm run dev
```
</details>

---

<div align="center">

**TelcoVantage ERP** · Internal Project · TelcoVantage Philippines

*All Rights Reserved.*

</div>
