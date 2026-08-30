// Helpers for turning stored public-bucket URLs into short-lived signed URLs.
//
// Signed URLs are regenerated per page load, but each bucket is signed in one
// Storage request rather than one request per document.

import type { createClient } from "@/utils/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const DEFAULT_EXPIRY_SECONDS = 3600;
// ponytail: in-memory cache 55m of 60m expiry, per server instance. Falls back to re-sign on miss.
const cache = new Map<string, { url: string; exp: number }>();
const CACHE_TTL_MS = 55 * 60 * 1000;

/**
 * Replace a record's `file_url` with a signed URL when it points at the given
 * public-style URL. Records that don't match are returned untouched.
 */
export async function signDocUrl<T extends { file_url?: string | null }>(
  supabase: SupabaseServerClient,
  bucket: string,
  doc: T,
  expiresIn: number = DEFAULT_EXPIRY_SECONDS,
): Promise<T> {
  return (await signDocUrls(supabase, bucket, [doc], expiresIn))[0];
}

/** Sign a list of records with one Storage request against a single bucket. */
export async function signDocUrls<T extends { file_url?: string | null }>(
  supabase: SupabaseServerClient,
  bucket: string,
  docs: T[] | null | undefined,
  expiresIn: number = DEFAULT_EXPIRY_SECONDS,
): Promise<T[]> {
  const records = docs ?? [];
  const marker = `/public/${bucket}/`;
  const paths = records
    .map((doc) => doc.file_url?.split(marker)[1])
    .filter((path): path is string => !!path);

  if (!paths.length) return records;

  const now = Date.now();
  const toFetch: string[] = [];
  const signedByPath = new Map<string, string>();
  for (const p of paths) {
    const key = `${bucket}:${p}`;
    const hit = cache.get(key);
    if (hit && hit.exp > now) signedByPath.set(p, hit.url);
    else toFetch.push(p);
  }

  if (toFetch.length) {
    const { data } = await supabase.storage.from(bucket).createSignedUrls(toFetch, expiresIn);
    for (const item of data ?? []) {
      if (item.path && item.signedUrl) {
        signedByPath.set(item.path as string, item.signedUrl as string);
        cache.set(`${bucket}:${item.path}`, { url: item.signedUrl as string, exp: now + CACHE_TTL_MS });
      }
    }
  }

  return records.map((doc) => {
    const path = doc.file_url?.split(marker)[1];
    const signedUrl = path && signedByPath.get(path);
    return signedUrl ? { ...doc, file_url: signedUrl } : doc;
  });
}
