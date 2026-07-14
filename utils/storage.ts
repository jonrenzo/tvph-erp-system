// Helpers for turning stored public-bucket URLs into short-lived signed URLs.
//
// Signed URLs are regenerated per page load, but each bucket is signed in one
// Storage request rather than one request per document.

import type { createClient } from "@/utils/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const DEFAULT_EXPIRY_SECONDS = 3600;

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

  const { data } = await supabase.storage.from(bucket).createSignedUrls(paths, expiresIn);
  const signedByPath = new Map(
    (data ?? [])
      .filter((item) => item.path && item.signedUrl)
      .map((item) => [item.path as string, item.signedUrl as string]),
  );

  return records.map((doc) => {
    const path = doc.file_url?.split(marker)[1];
    const signedUrl = path && signedByPath.get(path);
    return signedUrl ? { ...doc, file_url: signedUrl } : doc;
  });
}
