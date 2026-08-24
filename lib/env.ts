import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  // Public base URL used to build absolute links in emails and magic links.
  // Required for emails sent outside a request context (e.g. the reminder cron).
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  // Email (Resend). Optional so the app still boots without email configured;
  // sending fails loudly at send time if RESEND_API_KEY / EMAIL_FROM are missing.
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).optional(),
  EMAIL_REPLY_TO: z.string().min(1).optional(),
  // Set to "false" to drop the internal Cc (sandbox testing where every
  // recipient must be the Resend account owner). Defaults to on in production.
  EMAIL_CC_INTERNAL: z.enum(["true", "false"]).optional(),
  // Shared secret guarding the scheduled reminder route (pg_cron Bearer token).
  CRON_SECRET: z.string().min(1).optional(),
  // Shared secret guarding the partner vendor-list API (Bearer token).
  PARTNER_API_KEY: z.string().min(1).optional(),
  // API key for twinbackend Node Status (custom X-ERP-Key header). Optional so
  // the app boots without it; sync calls fail loudly when unset.
  TWINBACKEND_ERP_KEY: z.string().min(1).optional(),
  // Telegram bot (new-user / existing-user role assignment). Feature no-ops if
  // these are unset.
  TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
  TELEGRAM_ADMIN_CHAT_ID: z.string().min(1).optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(1).optional(),
  // Resend webhook signing secret (whsec_...). Required for /api/resend/webhook.
  RESEND_WEBHOOK_SECRET: z.string().min(1).optional(),
  // Supabase management API (personal access token) + project ref, used by the
  // System panel Logs API proxy. Optional; panel shows "not configured" if unset.
  SUPABASE_ACCESS_TOKEN: z.string().min(1).optional(),
  SUPABASE_PROJECT_REF: z.string().min(1).optional(),
  // Vercel API token for the System panel Vercel runtime-logs proxy. Optional.
  VERCEL_TOKEN: z.string().min(1).optional(),
  // Storage provider — sharepoint moves vendor-documents + po-artifacts to
  // SharePoint via Graph. Defaults to supabase (current S3 behavior).
  STORAGE_PROVIDER: z.enum(["supabase", "sharepoint"]).optional(),
  AZURE_TENANT_ID: z.string().min(1).optional(),
  // alias kept for older docs
  SHAREPOINT_TENANT_ID: z.string().min(1).optional(),
  AZURE_CLIENT_ID: z.string().min(1).optional(),
  AZURE_CLIENT_SECRET: z.string().min(1).optional(),
  SHAREPOINT_SITE_ID: z.string().min(1).optional(),
  SHAREPOINT_DRIVE_ID: z.string().min(1).optional(),
});

const rawEnv = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
  EMAIL_REPLY_TO: process.env.EMAIL_REPLY_TO,
  EMAIL_CC_INTERNAL: process.env.EMAIL_CC_INTERNAL,
  CRON_SECRET: process.env.CRON_SECRET,
  PARTNER_API_KEY: process.env.PARTNER_API_KEY,
  TWINBACKEND_ERP_KEY: process.env.TWINBACKEND_ERP_KEY,
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_ADMIN_CHAT_ID: process.env.TELEGRAM_ADMIN_CHAT_ID,
  TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET,
  RESEND_WEBHOOK_SECRET: process.env.RESEND_WEBHOOK_SECRET,
  SUPABASE_ACCESS_TOKEN: process.env.SUPABASE_ACCESS_TOKEN,
  SUPABASE_PROJECT_REF: process.env.SUPABASE_PROJECT_REF,
  VERCEL_TOKEN: process.env.VERCEL_TOKEN,
  STORAGE_PROVIDER: process.env.STORAGE_PROVIDER,
  AZURE_TENANT_ID: process.env.AZURE_TENANT_ID,
  SHAREPOINT_TENANT_ID: process.env.SHAREPOINT_TENANT_ID,
  AZURE_CLIENT_ID: process.env.AZURE_CLIENT_ID,
  AZURE_CLIENT_SECRET: process.env.AZURE_CLIENT_SECRET,
  SHAREPOINT_SITE_ID: process.env.SHAREPOINT_SITE_ID,
  SHAREPOINT_DRIVE_ID: process.env.SHAREPOINT_DRIVE_ID,
};

// A `.env` file left as `KEY=` yields an empty string, which would fail
// `z.string().min(1)` on optional fields. Treat empty as unset.
export const env = envSchema.parse(
  Object.fromEntries(Object.entries(rawEnv).filter(([, v]) => v !== "")),
);
