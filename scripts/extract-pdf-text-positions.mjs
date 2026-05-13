#!/usr/bin/env node
/**
 * Extracts all text elements with page number, x/y position, font size,
 * and width from po_template.pdf.
 *
 * Usage: node scripts/extract-pdf-text-positions.mjs [page]
 *
 * Outputs a tab-separated table sorted top-to-bottom, left-to-right per page.
 * Pass a page number to extract only that page.
 */

import * as fs from "fs";
import * as path from "path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const TEMPLATE_PATH = path.resolve("po_template.pdf");
const PAGE_SIZE = [612, 792]; // US Letter points

function normalizeY(rawY, pageHeight = PAGE_SIZE[1]) {
  // pdf.js uses bottom-left origin; we convert to top-left origin for convenience
  return pageHeight - rawY;
}

function formatPt(v) {
  return `${v.toFixed(1)}pt`;
}

async function main() {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    console.error(`Template not found at ${TEMPLATE_PATH}`);
    process.exit(1);
  }

  const targetPage = process.argv[2] ? parseInt(process.argv[2], 10) : null;

  const data = new Uint8Array(fs.readFileSync(TEMPLATE_PATH));
  const doc = await getDocument({ data }).promise;
  const numPages = doc.numPages;
  console.error(`Pages: ${numPages}`);

  for (let p = 1; p <= numPages; p++) {
    if (targetPage && p !== targetPage) continue;

    const page = await doc.getPage(p);
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });

    const items = textContent.items.map((item) => {
      const tx = item.transform;
      // tx[4] = x, tx[5] = y (bottom-left origin)
      const x = tx[4];
      const y = tx[5];
      const fontSize = item.height || 0;
      const width = item.width || 0;
      const text = item.str;
      const fontName = item.fontName || "?";

      return {
        page: p,
        x,
        y,
        yTop: normalizeY(y + fontSize, viewport.height),
        fontSize,
        width,
        text,
        fontName,
      };
    });

    // Sort: top-to-bottom (yTop ascending), then left-to-right (x ascending)
    items.sort((a, b) => {
      const ydiff = a.yTop - b.yTop;
      if (Math.abs(ydiff) > 3) return ydiff;
      return a.x - b.x;
    });

    // Print header
    console.log(`\n${"=".repeat(90)}`);
    console.log(`PAGE ${p} — ${items.length} text items`);
    console.log(`${"=".repeat(90)}`);
    console.log(
      `  ${"Page".padEnd(5)} ${"X".padEnd(8)} ${"Y-top".padEnd(8)} ${"W".padEnd(8)} ${"FontSize".padEnd(9)} ${"Text"}`
    );
    console.log(`  ${"-".repeat(5)} ${"-".repeat(8)} ${"-".repeat(8)} ${"-".repeat(8)} ${"-".repeat(9)} ${"-".repeat(40)}`);

    for (const item of items) {
      const text = item.text.replace(/\n/g, "\\n").substring(0, 80);
      console.log(
        `  ${String(item.page).padEnd(5)} ${item.x.toFixed(1).padEnd(8)} ${item.yTop.toFixed(1).padEnd(8)} ${item.width.toFixed(1).padEnd(8)} ${item.fontSize.toFixed(1).padEnd(9)} ${text}`
      );
    }
  }

  console.error("\nDone. Copy the values above into your field map.");
  console.error("NOTE: Y is top-left origin (0 = top of page).");
  await doc.destroy();
}

main().catch(console.error);
