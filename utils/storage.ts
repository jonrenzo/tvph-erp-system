// Helpers for turning stored public-bucket URLs into short-lived signed URLs.
//
// NOTE (perf): signed URLs are regenerated on every page load. For documents-heavy
// pages this is many storage round-trips per render. The calls are already batched
// (Promise.all), so latency is bounded, but a future improvement is to cache signed
// URLs (e.g. unstable_cache / Redis keyed by path) with a TTL just under the signing
// expiry, or to serve files through a public CDN path. Deferred — see project roadmap.

import type { createClient } from "@/utils/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const DEFAULT_EXPIRY_SECONDS = 3600;

/**
 * Replace a record's `file_url` with a signed URL when it points at the given
 * public bucket. Records that don't match are returned untouched.
 */
export async function signDocUrl<T extends { file_url?: string | null }>(
  supabase: SupabaseServerClient,
  bucket: string,
  doc: T,
  expiresIn: number = DEFAULT_EXPIRY_SECONDS,
): Promise<T> {
  const marker = `/public/${bucket}/`;
  if (!doc.file_url?.includes(marker)) return doc;

  const path = doc.file_url.split(marker)[1];
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  return { ...doc, file_url: data?.signedUrl || doc.file_url };
}

/** Sign a list of records in parallel against a single bucket. */
export function signDocUrls<T extends { file_url?: string | null }>(
  supabase: SupabaseServerClient,
  bucket: string,
  docs: T[] | null | undefined,
  expiresIn: number = DEFAULT_EXPIRY_SECONDS,
): Promise<T[]> {
  return Promise.all((docs ?? []).map((d) => signDocUrl(supabase, bucket, d, expiresIn)));
}
