import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseProvider } from "./supabase";
import { createSharePointProvider } from "./sharepoint";
import { resolveStorageKind } from "./provider";
import type { StorageProvider } from "./provider";

export function getStorageProvider(supabase: SupabaseClient, bucket: string): StorageProvider {
  const kind = resolveStorageKind(bucket);
  if (kind === "sharepoint") return createSharePointProvider(bucket);
  return createSupabaseProvider(supabase, bucket);
}

// ponytail: path helpers for the human folder plan. Callers can use these for new uploads
// so SharePoint browsing is clean, but the provider still accepts legacy vendors/... paths.
export function vendorStoragePath(vendorCode: string, vendorId: string, vendorName: string, docType: string, fileName: string): string {
  const slug = vendorName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  const short = vendorId.slice(0, 4);
  const typeSlug = docType.replace(/[^a-z0-9]+/gi, "-");
  return `01_Vendor-Documents/${vendorCode}_${slug}_${short}/${typeSlug}/${fileName}`;
}

export function poGeneratedPath(poNumber: string, vendorCode: string, year: string, fileName: string): string {
  return `02_Purchase-Orders/${year}/${poNumber}_${vendorCode}/01_Generated/${fileName}`;
}

export function poSignedPath(poNumber: string, vendorCode: string, year: string, fileName: string): string {
  return `02_Purchase-Orders/${year}/${poNumber}_${vendorCode}/02_Signed/${fileName}`;
}

export function poArtifactPath(poNumber: string, vendorCode: string, year: string, fileName: string): string {
  return `02_Purchase-Orders/${year}/${poNumber}_${vendorCode}/03_Artifacts/${fileName}`;
}
