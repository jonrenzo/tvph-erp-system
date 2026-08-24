// Helpers for turning stored public-bucket URLs into short-lived signed URLs.
//
// Signed URLs are regenerated per page load, but each bucket is signed in one
// Storage request rather than one request per document.

import type { createClient } from "@/utils/supabase/server";
import { getStorageProvider } from "@/lib/storage";
import { resolveStorageKind } from "@/lib/storage/provider";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const DEFAULT_EXPIRY_SECONDS = 3600;

function extractPath(fileUrl: string, bucket: string): string | null {
  const marker = `/public/${bucket}/`;
  if (fileUrl.includes(marker)) return fileUrl.split(marker)[1] || null;
  // SharePoint urls are graph webUrls, not s3 markers. They already contain drive info
  // but we still need a stable id. For SharePoint file_url is webUrl, treat whole as path fallback
  if (fileUrl.includes("sharepoint.com") || fileUrl.includes("graph.microsoft.com")) return null;
  // Legacy: file_url may be a plain path without marker
  if (!fileUrl.startsWith("http")) return fileUrl;
  return null;
}

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
  // SharePoint file_urls are webUrls, not S3 markers. They are already viewable for
  // organization scope, so return as is. S3 marker paths get signed via provider.
  const kind = resolveStorageKind(bucket);
  if (kind === "sharepoint") {
    // Try to sign SharePoint paths that look like graph webUrls — otherwise passthrough.
    // For legacy rows that still hold S3 urls after migration, fall through to S3 path handling.
    const hasGraphUrls = records.some((d) => d.file_url?.includes("sharepoint.com") || d.file_url?.includes("graph.microsoft.com"));
    if (hasGraphUrls) return records;
  }

  const paths = records
    .map((doc) => (doc.file_url ? extractPath(doc.file_url, bucket) : null))
    .filter((path): path is string => !!path);

  if (!paths.length) return records;

  const provider = getStorageProvider(supabase as any, bucket);
  const { data } = await provider.createSignedUrls(paths, expiresIn);
  const signedByPath = new Map(
    (data ?? [])
      .filter((item) => item.path && item.signedUrl)
      .map((item) => [item.path as string, item.signedUrl as string]),
  );

  return records.map((doc) => {
    const path = doc.file_url ? extractPath(doc.file_url, bucket) : null;
    const signedUrl = path && signedByPath.get(path);
    return signedUrl ? { ...doc, file_url: signedUrl } : doc;
  });
}
