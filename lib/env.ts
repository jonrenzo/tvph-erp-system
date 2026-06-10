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
});

export const env = envSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
  EMAIL_REPLY_TO: process.env.EMAIL_REPLY_TO,
  EMAIL_CC_INTERNAL: process.env.EMAIL_CC_INTERNAL,
  CRON_SECRET: process.env.CRON_SECRET,
});
