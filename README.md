<div align="center">
  <img src="/public/banner.png" alt="TelcoVantage ERP Banner" />
</div>

# TelcoVantage ERP System

<div align="center">
  <img src="https://img.shields.io/badge/Next.js-16.2-black?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19.2-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4.0-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/Google_Gemini-4285F4?style=for-the-badge&logo=google&logoColor=white" alt="Gemini AI" />
</div>

<br/>

![TelcoVantage ERP](/public/screenshot.png)

> **The Intelligent Command Surface for TelcoVantage Philippines.**

A state-of-the-art Enterprise Resource Planning (ERP) system designed to modernize vendor management, financial tracking, project oversight, and document compliance for TelcoVantage. Built with **Next.js 16**, **Supabase**, and **Google Gemini AI**.

---

## 📑 Table of Contents

- [Core Features](#core-features)
- [Technology Stack](#technology-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Architecture](#architecture)
- [Troubleshooting & FAQ](#troubleshooting--faq)
- [License](#license)

---

## 🚀 Core Features

### Command Center
Real-time operational pulse with high-level metrics on **Current Liability**, **Active POs**, **Pending Vendors**, and **Expiring Documents**. Featuring a unified audit log and daily operational summaries.

### Vendor Management
Full vendor lifecycle management including profile details (banking, contacts, TIN), status tracking (pending/active/inactive), secondary contacts and banking, and multi-currency support (PHP/USD).

### 14-Point Compliance Hub
Advanced accreditation tracking system that monitors 14 critical vendor documents (NDA, SEC, PCAB, ISO, DOLE 174, etc.) in real-time.
- **Document Status Tracking**: Track each document through not_submitted → submitted → approved → expired.
- **Accreditation Matrix**: A visual grid to monitor the compliance health of the entire vendor ecosystem.

### Projects & Contracts
- **Project Management**: Create and manage projects with status tracking, description, and contract references.
- **Vendor-Project Linking**: Assign vendors to projects with safety checks preventing unlinking when open POs or unpaid invoices exist.
- **Master Contract Repository**: Full contract lifecycle with start/end dates, total value, file attachments, and status tracking.

### Purchase Orders
End-to-end PO management with:
- **Auto-numbering**: PO-YYYY-XXXX format via database trigger.
- **NDA Gate**: Requires approved NDA before PO creation.
- **Project Assignment**: Link POs to specific projects and internal entities.
- **Status Workflow**: draft → issued → partially_paid → paid / overpaid / cancelled.

### Financial Management
- **Service Invoices**: Link multiple invoices to a single PO with automatic balance calculation.
- **PO Amount Guard**: Prevents invoice amounts exceeding remaining PO capacity.
- **Payment Monitoring**: Record payments (full/installment/down payment) with auto-updating invoice and PO status.
- **Overpayment Detection**: Red warning banners and override capability for authorized roles.
- **Billing Health Visualization**: Progress rings and percentage bars showing invoiced vs PO amounts.

### AI Assistant (Gemini 2.5 Flash)
An integrated AI assistant powered by Google Gemini that understands the ERP's entire context.
- **Document Analysis**: Upload a PDF and ask questions about its content (summaries, key terms, obligations).
- **Proactive Navigation**: Ask the bot about vendor status, and it will provide direct deep-links and compliance insights.
- **Intelligent Search**: Find anything in the system using natural language with 8 custom tools (vendors, POs, compliance, financials, documents).

### Document Repository
Centralized document management divided into:
- **Company Library**: 4 folders — Legal & Compliance, HR & Staffing, Financials, Company Templates.
- **Vendor Vault**: Per-vendor document grid with compliance health indicators and full-screen preview (PDF, images, Office files via Google Docs viewer).

### Audit Logs
Comprehensive activity tracking across all entities (CREATE/UPDATE/DELETE) with:
- Dedicated audit log page with filters by action and entity type.
- Contextual audit log card on relevant pages with infinite scroll.

### Global Search & Real-time Notifications
- **Cmd+K Search Modal**: Keyboard navigation, searching across vendors, POs, invoices, projects, payments, and documents.
- **Supabase Realtime**: 6 notification types with a notification bell dropdown, mark-all-read, and 30-day auto-cleanup.

---

## 💻 Technology Stack

- **Frontend**: Next.js 16.2.4 (App Router, `cacheComponents`), React 19.2.4, Tailwind CSS 4, Lucide Icons, Framer Motion.
- **Backend-as-a-Service**: Supabase (Auth, PostgreSQL, Realtime, Storage, RLS).
- **Intelligence**: Google Gemini AI (v2.5 Flash) via Vercel AI SDK (`ai`, `@ai-sdk/google`).
- **PDF Generation**: `pdf-lib` with fillable PO template and embedded font support.
- **Validation**: Zod 4 for schema validation.
- **Type Safety**: TypeScript 5+ with strict mode.
- **Styling**: Custom Design System based on [theme.md](theme.md).
- **Theme**: Next Themes with dark/light mode.

### Coming Soon
- **Scheduled Tasks**: Daily cron jobs for compliance expiry checks and overdue invoice reminders.
- **Email Notifications**: Transactional emails via Resend for document expiry alerts and invoice reminders.

---

## 🛠️ Getting Started

### Prerequisites
- Node.js 20+
- Supabase Project
- Google Gemini API Key

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/jonrenzo/tvph-erp-system.git
   cd tvph-erp-system
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Environment Setup**:
   Create a `.env.local` file with the following keys:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_key
   ```

4. **Database Setup**:
   Apply the migration to your Supabase project:
   ```bash
   # Run the initial schema migration via Supabase SQL Editor
   # Copy the contents of supabase/migrations/20250514_initial_schema.sql
   # and execute it in your Supabase project's SQL Editor.
   ```

5. **Run the development server**:
   ```bash
   npm run dev
   ```

---

## 🏗️ Architecture

- **Server-First**: Heavy use of React Server Components (RSC) and Server Actions for performance and security.
- **AI Tooling**: Tools defined in `lib/chat/tools.ts` (8 tools) allow Gemini to securely interact with the database via defined API boundaries with role-based access checks.
- **Security**: Row-Level Security (RLS) enabled on all tables, with role-based access checks (admin, finance, procurement, project_manager) in Server Actions.
- **Auth Proxy**: `proxy.ts` handles session refresh, root-level redirects (authenticated → `/dashboard`, unauthenticated → `/login`), and protects all `/dashboard/*` routes.
- **Real-time**: Supabase Realtime subscriptions power the notification bell and live updates.
- **Audit Trail**: All mutations go through `recordAuditLog()` in `utils/audit.ts` for full traceability.

---

## 🐛 Troubleshooting & FAQ

**Q: I'm getting Supabase connection errors on startup.**  
**A:** Ensure that `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in your `.env.local` are exactly as provided in your Supabase dashboard. Missing or incorrectly formatted keys are the most common cause.

**Q: The initial database migration is failing.**  
**A:** If `supabase/migrations/20250514_initial_schema.sql` fails to execute, make sure you are running it in the SQL Editor of a *fresh* Supabase project. If there are conflicting tables, you may need to reset your database to avoid conflicts.

**Q: AI features are throwing rate limit or timeout errors.**  
**A:** The Google Gemini API (`gemini-2.5-flash`) may impose rate limits on the free tier. If you see timeouts, check your API usage quota in Google AI Studio. Also ensure `GOOGLE_GENERATIVE_AI_API_KEY` is correctly set.

**Q: My Next.js build is caching old data, styles, or module resolution is failing.**  
**A:** Next.js uses an aggressive caching strategy. If you don't see your code changes, try stopping the development server, deleting the `.next` directory (`rm -rf .next`), and restarting with `npm run dev`.

---

## 📄 License

Internal Project for TelcoVantage Philippines. All Rights Reserved.
