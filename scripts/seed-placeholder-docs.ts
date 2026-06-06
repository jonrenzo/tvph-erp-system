/**
 * Generates a branded placeholder PDF for every vendor_document row that has
 * no file_url, uploads it to the vendor-documents Storage bucket, and writes
 * the public URL back to the row — so the ERP Vendor Vault becomes browsable.
 *
 * Usage:
 *   npx tsx scripts/seed-placeholder-docs.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */

import * as fs from "fs";
import * as path from "path";
import { PassThrough } from "stream";
import { createClient } from "@supabase/supabase-js";
import PDFDocument from "pdfkit";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ─── Label map ───────────────────────────────────────────────────────────────
const DOC_LABELS: Record<string, string> = {
  signed_nda: "Non-Disclosure Agreement",
  statement_of_commitment: "Statement of Commitment",
  company_profile: "Company Profile",
  products_services_list: "Products & Services List",
  vendor_information_summary: "Vendor Information Summary",
  general_information_sheet: "General Information Sheet",
  audited_financial_statements: "Audited Financial Statements",
  sec_registration: "SEC Registration Certificate",
  secretary_certificate: "Secretary's Certificate",
  safety_drug_policy: "Safety & Drug-Free Policy",
  iso_certification: "ISO Certification",
  pcab_license: "PCAB License",
  dole_174: "DOLE Form 174",
  other_licenses: "Other Licenses / Permits",
};

const COLOR_PRIMARY = "#0A5C3B";
const LOGO_PATH = path.join(process.cwd(), "public", "logo.png");
const TODAY = new Date().toLocaleDateString("en-PH", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

// ─── PDF generator ───────────────────────────────────────────────────────────
function buildPdf(vendorName: string, docType: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      bufferPages: true,
    });

    const buffers: Buffer[] = [];
    const stream = doc.pipe(new PassThrough());
    stream.on("data", (c: Buffer) => buffers.push(c));
    stream.on("end", () => resolve(Buffer.concat(buffers)));
    stream.on("error", reject);

    const label = DOC_LABELS[docType] ?? docType.replace(/_/g, " ").toUpperCase();

    // ── Header band ──────────────────────────────────────────────────────────
    doc.rect(0, 0, 595, 88).fill(COLOR_PRIMARY);

    if (fs.existsSync(LOGO_PATH)) {
      doc.image(LOGO_PATH, 40, 19, { height: 48 });
    }

    doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(10)
      .text("TelcoVantage Philippines, Inc.", 105, 24);
    doc.font("Helvetica").fontSize(7.5).fillColor("rgba(255,255,255,0.70)")
      .text("Vendor Accreditation Document", 105, 39);

    // ── SAMPLE watermark ─────────────────────────────────────────────────────
    doc.save();
    doc.rotate(-42, { origin: [297, 421] });
    doc.font("Helvetica-Bold").fontSize(88)
      .fillColor("#EEEEEE").fillOpacity(0.55)
      .text("SAMPLE", 40, 370, { width: 515, align: "center" });
    doc.fillOpacity(1);
    doc.restore();

    // ── Document title ───────────────────────────────────────────────────────
    doc.font("Helvetica-Bold").fontSize(20).fillColor(COLOR_PRIMARY)
      .text(label, 50, 120, { width: 495, align: "center" });

    doc.moveTo(50, 170).lineTo(545, 170)
      .strokeColor(COLOR_PRIMARY).lineWidth(1.5).stroke();

    // ── Vendor info card ─────────────────────────────────────────────────────
    doc.rect(50, 185, 495, 85).fill("#F7F7F7").stroke();
    doc.font("Helvetica").fontSize(7.5).fillColor("#888888")
      .text("VENDOR / SUPPLIER", 66, 198);
    doc.font("Helvetica-Bold").fontSize(15).fillColor("#111111")
      .text(vendorName, 66, 212, { width: 460 });
    doc.font("Helvetica").fontSize(8).fillColor("#555555")
      .text(`Document Type: ${label}`, 66, 238)
      .text(`Date Generated: ${TODAY}`, 66, 252);

    // ── Notice banner ─────────────────────────────────────────────────────────
    doc.rect(50, 295, 495, 72).fill("#FFFDE7");
    doc.rect(50, 295, 5, 72).fill("#FFC107");
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#6D4C00")
      .text("PLACEHOLDER DOCUMENT", 68, 308);
    doc.font("Helvetica").fontSize(8).fillColor("#5D4037").text(
      "This file was generated automatically as sample data. Replace it with the actual " +
        "signed document by navigating to the vendor's profile in the ERP system and " +
        "uploading through the Documents tab.",
      68,
      322,
      { width: 465 }
    );

    // ── Placeholder content lines ─────────────────────────────────────────────
    const lineSpecs = [
      { y: 400, w: 450 }, { y: 418, w: 370 }, { y: 436, w: 490 },
      { y: 454, w: 320 }, { y: 472, w: 405 }, { y: 500, w: 480 },
      { y: 518, w: 280 }, { y: 536, w: 440 },
    ];
    lineSpecs.forEach(({ y, w }) => {
      doc.rect(50, y, w, 7).fill("#EBEBEB");
    });

    // ── Signature lines ───────────────────────────────────────────────────────
    [
      { x1: 50, x2: 240, label: "Authorized Signatory — Vendor" },
      { x1: 310, x2: 495, label: "Received & Verified by TelcoVantage" },
    ].forEach(({ x1, x2, label: sigLabel }) => {
      doc.moveTo(x1, 618).lineTo(x2, 618)
        .strokeColor("#AAAAAA").lineWidth(0.5).stroke();
      doc.font("Helvetica").fontSize(7).fillColor("#AAAAAA")
        .text(sigLabel, x1, 624, { width: x2 - x1 });
    });

    // ── Footer band ───────────────────────────────────────────────────────────
    doc.rect(0, 778, 595, 64).fill(COLOR_PRIMARY);
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#FFFFFF")
      .text(label.toUpperCase(), 50, 793, { width: 495, align: "center" });
    doc.font("Helvetica").fontSize(6.5).fillColor("rgba(255,255,255,0.65)")
      .text(
        `${vendorName}  •  Generated ${TODAY}  •  TelcoVantage ERP  •  PLACEHOLDER`,
        50,
        810,
        { width: 495, align: "center" }
      );

    doc.end();
  });
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("Fetching vendor documents with no file attached...\n");

  const { data: docs, error } = await supabase
    .from("vendor_documents")
    .select("id, vendor_id, doc_type, vendors(name)")
    .is("file_url", null);

  if (error) { console.error("Query failed:", error.message); process.exit(1); }
  if (!docs?.length) { console.log("All vendor documents already have files. Nothing to do."); return; }

  console.log(`Found ${docs.length} documents to fill.\n`);

  let ok = 0;
  let fail = 0;

  for (const doc of docs) {
    const vendorName = (doc.vendors as any)?.name ?? "Unknown Vendor";
    const storagePath = `${doc.vendor_id}/${doc.doc_type}_${doc.id}.pdf`;
    const tag = `${vendorName} / ${doc.doc_type}`;

    process.stdout.write(`  ${tag.padEnd(55)} `);

    try {
      const buffer = await buildPdf(vendorName, doc.doc_type);

      const { error: uploadErr } = await supabase.storage
        .from("vendor-documents")
        .upload(storagePath, buffer, { contentType: "application/pdf", upsert: true });

      if (uploadErr) throw new Error(`Upload: ${uploadErr.message}`);

      const { data: { publicUrl } } = supabase.storage
        .from("vendor-documents")
        .getPublicUrl(storagePath);

      const { error: updateErr } = await supabase
        .from("vendor_documents")
        .update({ file_url: publicUrl })
        .eq("id", doc.id);

      if (updateErr) throw new Error(`DB update: ${updateErr.message}`);

      console.log("✓");
      ok++;
    } catch (err: any) {
      console.log(`✗  ${err.message}`);
      fail++;
    }
  }

  console.log(`\nDone — ${ok} uploaded, ${fail} failed.`);
}

main();
