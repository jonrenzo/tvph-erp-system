#!/usr/bin/env node
/**
 * One-time utility to create a stampable PO template by masking dynamic fields.
 * Input:  ./po_template.pdf
 * Output: ./public/template/po/po_template_blank.pdf
 */

import fs from "node:fs";
import path from "node:path";
import { PDFDocument, rgb } from "pdf-lib";

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, "po_template.pdf");
const OUT_DIR = path.join(ROOT, "public", "template", "po");
const OUT_FILLED = path.join(OUT_DIR, "po_template_filled.pdf");
const OUT_BLANK = path.join(OUT_DIR, "po_template_blank.pdf");

function mask(page, x, y, width, height) {
  page.drawRectangle({ x, y, width, height, color: rgb(1, 1, 1) });
}

async function main() {
  if (!fs.existsSync(SOURCE)) {
    throw new Error(`Source template not found: ${SOURCE}`);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.copyFileSync(SOURCE, OUT_FILLED);

  const bytes = fs.readFileSync(SOURCE);
  const doc = await PDFDocument.load(bytes);
  const pages = doc.getPages();
  if (pages.length < 3) {
    throw new Error("Expected at least 3 pages in PO template");
  }

  // Page 1
  const p1 = pages[0];
  mask(p1, 441, 717, 129, 14);
  mask(p1, 441, 700, 129, 14);
  mask(p1, 88, 636, 220, 12);
  mask(p1, 370, 636, 80, 12);
  mask(p1, 88, 621, 220, 12);
  mask(p1, 370, 621, 80, 12);
  mask(p1, 88, 593, 220, 26);
  mask(p1, 454, 593, 116, 26);
  mask(p1, 454, 575, 116, 14);
  mask(p1, 160, 370, 400, 220);
  mask(p1, 42, 370, 118, 220);
  mask(p1, 246, 140, 120, 12);

  // Page 2
  const p2 = pages[1];
  mask(p2, 441, 717, 129, 14);
  mask(p2, 441, 700, 129, 14);
  mask(p2, 88, 636, 220, 12);
  mask(p2, 370, 636, 80, 12);
  mask(p2, 88, 621, 220, 12);
  mask(p2, 370, 621, 80, 12);
  mask(p2, 88, 593, 220, 26);
  mask(p2, 454, 593, 116, 26);
  mask(p2, 454, 575, 116, 14);
  mask(p2, 246, 140, 120, 12);
  mask(p2, 42, 550, 528, 40);

  // Page 3
  const p3 = pages[2];
  mask(p3, 441, 717, 129, 14);
  mask(p3, 441, 700, 129, 14);
  mask(p3, 88, 636, 220, 12);
  mask(p3, 370, 636, 80, 12);
  mask(p3, 88, 621, 220, 12);
  mask(p3, 370, 621, 80, 12);
  mask(p3, 88, 593, 220, 26);
  mask(p3, 454, 593, 116, 26);
  mask(p3, 454, 575, 116, 14);
  mask(p3, 246, 140, 120, 12);
  mask(p3, 76, 390, 510, 120);

  fs.writeFileSync(OUT_BLANK, await doc.save());
  console.log(`Saved: ${OUT_BLANK}`);
  console.log(`Saved: ${OUT_FILLED}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
