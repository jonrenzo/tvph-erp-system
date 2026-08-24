import type { SupabaseClient } from "@supabase/supabase-js";

export type UploadOptions = {
  contentType?: string;
  upsert?: boolean;
};

export type SignedUrlResult = { signedUrl: string | null; path: string };
export type SignedUrlsResult = { path: string; signedUrl: string | null; error?: string }[];

export interface StorageProvider {
  bucket: string;
  upload(path: string, body: Blob | Buffer | ArrayBuffer | File | Uint8Array, opts?: UploadOptions): Promise<{ error: { message: string } | null }>;
  getPublicUrl(path: string): { data: { publicUrl: string } };
  createSignedUrl(path: string, expiresIn: number): Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }>;
  createSignedUrls(paths: string[], expiresIn: number): Promise<{ data: SignedUrlsResult | null; error: { message: string } | null }>;
  remove(paths: string[]): Promise<{ error: { message: string } | null }>;
  download(path: string): Promise<{ data: Blob | null; error: { message: string } | null }>;
}

// Supabase-backed provider keeps the current S3 behavior. SharePoint provider
// will implement the same interface against Graph.
export type StorageProviderKind = "supabase" | "sharepoint";

export function resolveStorageKind(bucket: string): StorageProviderKind {
  const global = (process.env.STORAGE_PROVIDER as StorageProviderKind | undefined) || "supabase";
  if (global !== "sharepoint") return "supabase";
  // Only these buckets move to SharePoint per plan. Others stay on Supabase.
  const sharepointBuckets = new Set(["vendor-documents", "po-artifacts"]);
  return sharepointBuckets.has(bucket) ? "sharepoint" : "supabase";
}

export function isSharePointEnabled(): boolean {
  return process.env.STORAGE_PROVIDER === "sharepoint";
}
