# 🏢 TelcoVantage ERP System

![TelcoVantage ERP](screenshot.png)

> **The Intelligent Command Surface for TelcoVantage Philippines.**

A state-of-the-art Enterprise Resource Planning (ERP) system designed to modernize vendor management, financial tracking, and document compliance for TelcoVantage. Built with **Next.js 16**, **Supabase**, and **Google Gemini AI**.

---

## ✨ Core Features

### 📊 Command Center
Real-time operational pulse with high-level metrics on **Current Liability**, **Active POs**, **Pending Vendors**, and **Expiring Documents**. Featuring a unified audit log and daily operational summaries.

### 🛡️ 14-Point Compliance Hub
Advanced accreditation tracking system that monitors critical vendor documents (NDA, SEC, PCAB, etc.) in real-time. 
- **Automated Expiry Warnings**: Never miss a renewal with proactive notification logic.
- **Accreditation Matrix**: A visual grid to monitor the compliance health of the entire vendor ecosystem.

### 🤖 AI Assistant (v2.5 Flash)
An integrated AI assistant powered by Google Gemini that understands the ERP's entire context.
- **Document Analysis**: Upload a PDF and ask questions about its content (summaries, key terms, obligations).
- **Proactive Navigation**: Ask the bot about vendor status, and it will provide direct deep-links and compliance insights.
- **Intelligent Search**: Find anything in the system using natural language.

### 💰 Financial Management
End-to-end tracking of the procurement lifecycle.
- **Purchase Orders (POs)**: Automated PO number generation (PO-YYYY-XXXX) and commitment tracking.
- **Service Invoices**: Link multiple invoices to a single PO with automatic balance calculation.
- **Payment Monitoring**: Track full or partial payments with "Billing Health" visualizations.

### 📄 Document Repository
Centralized document management divided into:
- **Company Library**: Internal policies, licenses, and templates.
- **Vendor Vault**: Secure, versioned storage for all vendor-provided documentation.

---

## 🛠️ Technology Stack

- **Frontend**: Next.js 16 (App Router), Tailwind CSS 4, Lucide Icons, Framer Motion.
- **Backend-as-a-Service**: Supabase (Auth, PostgreSQL, Storage).
- **Intelligence**: Google Gemini AI (v2.5 Flash) with Function Calling.
- **Email & Notifications**: Resend (Transactional emails).
- **Scheduled Tasks**: Vercel Cron Jobs (Daily compliance & due date checks).
- **Type Safety**: TypeScript 5+ with strict mode.
- **Styling**: Custom Design System based on [theme.md](theme.md).

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- Supabase Project
- Google Gemini API Key
- Resend API Key (for notifications)

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
   Create a `.env.local` file with the following:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_key
   RESEND_API_KEY=your_resend_key
   CRON_SECRET=your_cron_secret
   ```

4. **Database Setup**:
   Apply the schema from `database_schema.sql` in your Supabase SQL Editor.

5. **Run the development server**:
   ```bash
   npm run dev
   ```

---

## 📐 Architecture

- **Server-First**: Heavy use of React Server Components (RSC) and Server Actions for performance and security.
- **AI Tooling**: Tools defined in `lib/chat/tools.ts` allow Gemini to securely interact with the database via defined API boundaries.
- **Security**: Row-Level Security (RLS) enabled on all tables, with role-based access checks (Admin, Finance, Procurement, PM) in Server Actions.
- **Daily Operations**: A daily cron job (`/api/cron/daily-reminders`) runs at 8:00 AM PHT to check for document expiries and overdue invoices, triggering email alerts via Resend.

---

## 📄 License

Internal Project for TelcoVantage Philippines. All Rights Reserved.
