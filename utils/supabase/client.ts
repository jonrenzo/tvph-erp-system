import { createBrowserClient } from '@supabase/ssr'

// ponytail: singleton prevents Navigator LockManager contention (fixes NextJS 46 "exclusive lock immediately failed" on rapid Server Action + storage calls)
let browserClient: ReturnType<typeof createBrowserClient> | null = null;
export function createClient() {
  if (browserClient) return browserClient;
  browserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return browserClient;
}
