#!/usr/bin/env node
/**
 * Converts po_template.pdf to high-res PNG images (one per page).
 * Requires poppler (pdftoppm) installed on the system.
 *
 * Run once: node scripts/convert-template.mjs
 *
 * Output: public/template/page-1.png, page-2.png, page-3.png
 */

import * as fs from "fs";
import * as path from "path";
import { spawnSync } from "child_process";

const TEMPLATE_PATH = path.resolve("po_template.pdf");
const OUTPUT_DIR = path.resolve("public/template");
const DPI = 300;

async function main() {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    console.error(`Template not found at ${TEMPLATE_PATH}`);
    process.exit(1);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // pdftoppm converts to PNG and prepends a prefix + page number
  // Output files: page-1.png, page-2.png, page-3.png
  const prefix = path.join(OUTPUT_DIR, "page");

  console.log(`Converting template at ${DPI} DPI...`);

  const result = spawnSync("pdftoppm", [
    "-png",
    "-r", String(DPI),
    "-l", "3",   // max 3 pages
    TEMPLATE_PATH,
    prefix,
  ], { stdio: "pipe", encoding: "utf-8" });

  if (result.status !== 0) {
    console.error("pdftoppm failed:", result.stderr || result.stdout);
    process.exit(1);
  }

  if (result.stderr) console.error(result.stderr);

  // Verify output
  const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith(".png")).sort();
  console.log(`Generated ${files.length} PNGs:`);
  for (const f of files) {
    const p = path.join(OUTPUT_DIR, f);
    const stat = fs.statSync(p);
    console.log(`  ${f} (${(stat.size / 1024).toFixed(0)}KB)`);
  }
  console.log("Done.");
}

main().catch(console.error);
