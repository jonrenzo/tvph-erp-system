import type { SupabaseClient } from "@supabase/supabase-js";
import type { StorageProvider } from "./provider";

export function createSupabaseProvider(
  supabase: SupabaseClient,
  bucket: string,
): StorageProvider {
  const api = supabase.storage.from(bucket);
  return {
    bucket,
    async upload(path, body, opts) {
      const { error } = await api.upload(path, body as File, {
        contentType: opts?.contentType,
        upsert: opts?.upsert ?? false,
      });
      return { error: error ? { message: error.message } : null };
    },
    getPublicUrl(path) {
      return api.getPublicUrl(path);
    },
    async createSignedUrl(path, expiresIn) {
      const { data, error } = await api.createSignedUrl(path, expiresIn);
      return {
        data: data ? { signedUrl: data.signedUrl } : null,
        error: error ? { message: error.message } : null,
      };
    },
    async createSignedUrls(paths, expiresIn) {
      const { data, error } = await api.createSignedUrls(paths, expiresIn);
      // data is {path, signedUrl, error}[] in supabase-js
      return {
        data: data as any,
        error: error ? { message: error.message } : null,
      };
    },
    async remove(paths) {
      const { error } = await api.remove(paths);
      return { error: error ? { message: error.message } : null };
    },
    async download(path) {
      const { data, error } = await api.download(path);
      return {
        data: data as Blob | null,
        error: error ? { message: error.message } : null,
      };
    },
  };
}
