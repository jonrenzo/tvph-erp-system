/**
 * One-time migration: copy vendor-documents + po-artifacts from Supabase Storage to SharePoint.
 * Keeps same logical paths (vendors/... and po/...) so DB file_url rewrite is minimal.
 * For the new human folder plan (01_Vendor-Documents, 02_Purchase-Orders) run with --remap.
 *
 * Usage:
 *   npx tsx scripts/migrate-to-sharepoint.ts           # dry run
 *   npx tsx scripts/migrate-to-sharepoint.ts --apply   # real copy + DB rewrite
 *   npx tsx scripts/migrate-to-sharepoint.ts --apply --remap
 */

import { createServiceRoleClient } from "../utils/supabase/service";
import { createSharePointProvider } from "../lib/storage/sharepoint";
import { createSupabaseProvider } from "../lib/storage/supabase";

const DRY = !process.argv.includes("--apply");
const REMAP = process.argv.includes("--remap");

type Row = { file_url: string; id?: string };

function extractPath(url: string, bucket: string): string | null {
  const marker = `/public/${bucket}/`;
  if (url.includes(marker)) return url.split(marker)[1];
  if (url.includes("sharepoint.com") || url.includes("graph.microsoft.com")) return null;
  if (!url.startsWith("http")) return url;
  return null;
}

async function migrateBucket(bucket: string, table: string, idCol: string, urlCol: string) {
  const supabase = createServiceRoleClient();
  const s3 = createSupabaseProvider(supabase as any, bucket);
  const sp = createSharePointProvider(bucket);

  console.log(`\n--- ${bucket} (${table}) dryRun=${DRY} remap=${REMAP} ---`);

  // Fetch distinct urls from the table(s)
  const { data, error } = await (supabase.from(table) as any).select(`${idCol}, ${urlCol}`).not(urlCol, "is", null).limit(5000);
  if (error) { console.error(`fetch ${table} failed`, error.message); return; }
  const rows = ((data as unknown) as Row[]).filter((r) => (r as any)[urlCol]);

  let copied = 0; let skipped = 0; let failed = 0;
  for (const row of rows) {
    const url = (row as any)[urlCol] as string;
    const path = extractPath(url, bucket);
    if (!path) { skipped++; continue; }
    if (DRY) { copied++; continue; }

    // Download from S3
    const dl = await s3.download(path);
    if (dl.error || !dl.data) { console.error(`download ${path} failed`, dl.error?.message); failed++; continue; }
    const bytes = Buffer.from(await (dl.data as Blob).arrayBuffer());

    // Optional remap to human folders could go here — keep path same for now
    const targetPath = path;

    const up = await sp.upload(targetPath, bytes, { upsert: false });
    if (up.error) { console.error(`upload ${targetPath} failed`, up.error.message); failed++; continue; }

    const { data: { publicUrl } } = sp.getPublicUrl(targetPath);
    const { error: updErr } = await supabase.from(table).update({ [urlCol]: publicUrl }).eq(idCol, row.id);
    if (updErr) { console.error(`db update ${row.id} failed`, updErr.message); failed++; continue; }
    copied++;
    if (copied % 50 === 0) console.log(`  copied ${copied}/${rows.length}`);
  }
  console.log(`done ${bucket}: copied=${copied} skipped=${skipped} failed=${failed} total=${rows.length}`);
}

async function main() {
  // Vendor docs: vendor_document_files + vendor_document_file_versions + vendor_documents.file_url
  await migrateBucket("vendor-documents", "vendor_document_files", "id", "file_url");
  await migrateBucket("vendor-documents", "vendor_document_file_versions", "id", "file_url");
  await migrateBucket("vendor-documents", "vendor_documents", "id", "file_url");

  // PO artifacts
  await migrateBucket("po-artifacts", "po_signatures", "id", "signed_file_url");
  await migrateBucket("po-artifacts", "purchase_order_artifacts", "id", "file_url");

  if (DRY) console.log("\nDry run done. Re-run with --apply to copy and rewrite.");
}

main().catch((e) => { console.error(e); process.exit(1); });
