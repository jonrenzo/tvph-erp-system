#!/usr/bin/env node
/**
 * Takes a field map JSON and draws colored debug rectangles + labels
 * on a copy of po_template.pdf so you can visually verify each field's
 * position and size.
 *
 * Usage:
 *   node scripts/validate-pdf-map.mjs [field-map.json]
 *
 * If no field map is provided, it generates a grid-overlay PDF instead
 * to help you measure coordinates manually.
 *
 * Field map JSON format:
 * {
 *   "page1": {
 *     "po_number":  { "x": 400, "y": 75,  "w": 74,  "h": 12 },
 *     "po_date":    { "x": 400, "y": 93,  "w": 74,  "h": 12 },
 *     ...
 *   },
 *   "page2": { ... },
 *   "page3": { ... }
 * }
 *
 * Coordinates use top-left origin (Y=0 = top of page).
 * All values in points (1pt = 1/72 inch).
 */

import * as fs from "fs";
import * as path from "path";
import { PDFDocument, rgb } from "pdf-lib";

const TEMPLATE_PATH = path.resolve("po_template.pdf");
const OUTPUT_PATH = path.resolve("po_template-debug.pdf");

const COLORS = [
  [1, 0, 0],    // red
  [0, 0.6, 0],  // green
  [0, 0, 1],    // blue
  [1, 0.6, 0],  // orange
  [0.6, 0, 0.6],// purple
  [0, 0.8, 0.8],// teal
  [1, 0, 0.6],  // pink
  [0.4, 0.4, 0.4], // gray
];

async function generateGrid() {
  console.error("No field map provided. Generating grid-overlay PDF for manual measurement...");
  const doc = await PDFDocument.load(fs.readFileSync(TEMPLATE_PATH));
  const pages = doc.getPages();

  for (const page of pages) {
    const { width, height } = page.getSize();

    // Draw horizontal grid lines every 10pt
    for (let y = 0; y < height; y += 10) {
      const opacity = y % 50 === 0 ? 0.3 : y % 20 === 0 ? 0.15 : 0.06;
      page.drawLine({
        start: { x: 0, y: height - y },
        end: { x: width, y: height - y },
        color: rgb(0, 0, 1),
        thickness: y % 50 === 0 ? 0.8 : 0.3,
        opacity,
      });
      // Label major lines
      if (y % 50 === 0 && y > 0) {
        page.drawText(String(y), {
          x: 2,
          y: height - y + 2,
          size: 4,
          color: rgb(0, 0, 1),
          opacity: 0.4,
        });
      }
    }

    // Draw vertical grid lines every 10pt
    for (let x = 0; x < width; x += 10) {
      const opacity = x % 50 === 0 ? 0.3 : x % 20 === 0 ? 0.15 : 0.06;
      page.drawLine({
        start: { x, y: 0 },
        end: { x, y: height },
        color: rgb(1, 0, 0),
        thickness: x % 50 === 0 ? 0.8 : 0.3,
        opacity,
      });
      if (x % 50 === 0 && x > 0) {
        page.drawText(String(x), {
          x: x + 2,
          y: height - 10,
          size: 4,
          color: rgb(1, 0, 0),
          opacity: 0.4,
        });
      }
    }
  }

  const bytes = await doc.save();
  fs.writeFileSync(OUTPUT_PATH, bytes);
  console.error(`Grid overlay saved to ${OUTPUT_PATH}`);
  console.error("Open this PDF and visually read the coordinates of each field.");
  console.error("Usage: node scripts/validate-pdf-map.mjs");
}

async function validateMap(mapPath) {
  console.error(`Loading field map from ${mapPath}...`);
  const mapData = JSON.parse(fs.readFileSync(mapPath, "utf-8"));
  const doc = await PDFDocument.load(fs.readFileSync(TEMPLATE_PATH));
  const pages = doc.getPages();

  let colorIndex = 0;

  for (let p = 0; p < pages.length; p++) {
    const page = pages[p];
    const { height } = page.getSize();
    const pageKey = `page${p + 1}`;
    const fields = mapData[pageKey];
    if (!fields) continue;

    for (const [name, rect] of Object.entries(fields)) {
      const color = COLORS[colorIndex % COLORS.length];
      colorIndex++;

      // rect: { x, y, w, h } — y is top-left origin
      // pdf-lib uses bottom-left origin, so convert: bottomY = height - y - h
      const bottomY = height - rect.y - rect.h;

      // Draw filled rectangle with low opacity
      page.drawRectangle({
        x: rect.x,
        y: bottomY,
        width: rect.w,
        height: rect.h,
        color: rgb(color[0], color[1], color[2]),
        opacity: 0.15,
        borderColor: rgb(color[0], color[1], color[2]),
        borderWidth: 1,
      });

      // Draw field name label above the rectangle
      page.drawText(name, {
        x: rect.x,
        y: bottomY + rect.h + 1,
        size: 5,
        color: rgb(color[0], color[1], color[2]),
        opacity: 0.9,
      });
    }
  }

  const bytes = await doc.save();
  fs.writeFileSync(OUTPUT_PATH, bytes);
  console.error(`Debug PDF saved to ${OUTPUT_PATH}`);
  console.error(`Validated ${colorIndex} fields across ${pages.length} pages.`);
  console.error("Open po_template-debug.pdf to see colored rectangles overlaid on each field.");
}

async function main() {
  const mapPath = process.argv[2];
  if (mapPath) {
    await validateMap(mapPath);
  } else {
    await generateGrid();
  }
}

main().catch(console.error);
