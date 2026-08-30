// PO PDF renderer — pdfkit re-creation of public/templates/po_original.pdf
// (F2 fidelity). All layout constants below are measured from the golden
// file's PDF operators (points, letter size 612x792). Adjust a constant,
// not the code.

import "server-only";

import PDFDocument from "pdfkit";
import { PassThrough } from "stream";
import { readFileSync } from "fs";

import { fetchPoData } from "./fetchPoData";
import type { PoData } from "./types";
import { TNC_LIST, TNC_INSTRUCTIONS, TNC_SITES_LEAD, parseTc } from "./terms";
import { createClient } from "@/utils/supabase/server";

// ─── Page geometry (golden po_original.pdf) ─────────────────────────────────
const PAGE_W = 612;
const PAGE_H = 792;
const X0 = 36.4;
const X3 = 581.9;
const CW = X3 - X0;              // 545.5
const X_SHIFT = 14.45;           // page-2 tables shift right (golden)
const BOTTOM = 758;              // content must stay above this
const STROKE_W = 0.5;            // golden cell borders
const GRAY = "#d9d9d9";          // 0.85098 fill

// Vendor block: 4 rows x 3 columns, repeated on every page
const VENDOR_COLS = [X0, 284.25, 404.95, X3];
const VENDOR_ROW_H = 12.707;
const VENDOR_Y = [0, 136.06, 124.96, 146.36]; // top of page 1/2/3 vendor block

// Line items table (page 1 only)
const ITEM_COLS = [X0, 92.85, 149.55, 305.5, 362.2, 404.95, 482.75, X3];
const ITEM_HEADER_TOP = 186.89;
const ITEM_HEADER_H = 24.91;
const ITEM_FRAME_BOTTOM = 310.54; // golden frame bottom (item rows + summary)

// Sites table (page 3): header + data rows + TOTAL (min 4-row golden skeleton)
const SITE_COLS = [X0, 64.1, 99.1, 198.1, 259.1, 332.5, 424.55, X3];
const SITE_ROW_HS = [14.75, 11.48, 11.49, 10.99]; // golden row heights (first 4)

// Bottom bands (delivery / incoterms / important), anchored per page
const BAND_COLS = [X0, 220.45, 404.95, X3];
const BAND_DELIVERY_H = 12.71;
const BAND_MID_H = 49.33;
const BAND_IMPORTANT_H = 24.92;
const BAND_ANCHOR_1 = 535.84;    // page 1 (golden fixed position)
const BAND_ANCHOR_3 = 389.71;    // page 3 (golden fixed position)

// ─── Header block (golden geometry, verified from po_original.pdf ops) ───────
const PO_BOX_X = 395.55;
const PO_BOX_W = 551.25 - PO_BOX_X;
const PO_BOX_Y = 59.85;          // top of first row
const PO_TITLE_X = 400.95;
const PO_TITLE_Y = 70.1;         // baseline (yTop); row 1 of PO box
const PO_VALUE_X = 450.35;
const PO_DIVIDER_X = 444.95;     // vertical divider between label/value (rows 2-3)
const COMPANY_X = 129.45;        // golden company block absolute x
const FOOTER_X = 50.85;          // golden footer baseline x (left-aligned)
const FOOTER_Y = 739.35;         // golden footer baseline (yTop)
const LOGO_X = 50.85;
const LOGO_Y = 35.95;
const LOGO_W = 73.6;
const LOGO_H = 60.25;

// ─── Fonts ───────────────────────────────────────────────────────────────────
const FONT_REGULAR = "public/fonts/Carlito-Regular.ttf";
const FONT_BOLD = "public/fonts/Carlito-Bold.ttf";
const LOGO_PATH = "public/logo-golden.jpg"; // exact JPEG embedded in po_original.pdf (396x324)
// Resolved from project root at module load; buffers survive any CWD at runtime.
// Fonts are passed as Uint8Array views: pdfkit's font path tests `instanceof
// Uint8Array`, which fails across jest/jsdom realms for plain Buffers.
const FONT_REGULAR_BUF = new Uint8Array(readFileSync(FONT_REGULAR).buffer);
const FONT_BOLD_BUF = new Uint8Array(readFileSync(FONT_BOLD).buffer);
// Pre-made image object, not a path/Buffer: pdfkit's image pipeline routes
// path/Buffer sources through `Buffer.from(...)` (Node realm), and its stream
// writer then fails `chunk instanceof Uint8Array` across the jest sandbox realm
// and stringifies the JPEG — every high byte becomes 0xFD (logo renders as a
// black box in tests). A duck-typed {width,height,embed,obj} source skips
// openImage entirely; embed() hands the stream a realm-correct Uint8Array.
const LOGO_BYTES = new Uint8Array(readFileSync(LOGO_PATH));
type PdfRef = { end: (chunk: Uint8Array) => void };
const LOGO_IMAGE = {
  width: 396, // logo-golden.jpg is the exact 396x324 JPEG from po_original.pdf
  height: 324,
  label: "LOGO",
  obj: null as PdfRef | null,
  embed(document: { ref: (data: Record<string, unknown>) => PdfRef }) {
    if (this.obj) return;
    this.obj = document.ref({
      Type: "XObject", Subtype: "Image", BitsPerComponent: 8,
      Width: this.width, Height: this.height,
      ColorSpace: "DeviceRGB", Filter: "DCTDecode",
    });
    this.obj.end(LOGO_BYTES);
  },
};

// ─── Default T&C ──────────────────────────────────────────────────────────────
// TNC_INTRO / TNC_LIST / TNC_INSTRUCTIONS / TNC_SITES_LEAD live in ./terms.ts
// (shared with the draft editor panel).

const IMPORTANT_NOTE =
  "NOTE: THIS IS AN ELECTRONICALLY APPROVED PURCHASE ORDER (PO). MANUAL SIGNATURE IS NOT REQUIRED.";

// ─── Helpers ─────────────────────────────────────────────────────────────────
type Doc = typeof PDFDocument.prototype;

const nf2 = new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf3 = new Intl.NumberFormat("en-PH", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
// golden: whole amounts render without decimals ("144,837"), cents keep 2
const nfMoney = new Intl.NumberFormat("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

function fmtMoney(n: number): string {
  return nf2.format(Number(n) || 0);
}

function fmtKm(n: number): string {
  // golden: "16.093" (3 decimals, trailing zeros trimmed)
  return nf3.format(Number(n) || 0).replace(/\.?0+$/, "") || "0";
}

// Greedy word wrap on the currently-selected font, matching the golden breaks.
function wrapWords(doc: Doc, text: string, width: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (doc.widthOfString(t) <= width || !cur) cur = t;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function fillRow(doc: Doc, cols: number[], y: number, h: number) {
  doc.save().fillColor(GRAY).rect(cols[0], y, cols[cols.length - 1] - cols[0], h).fill().restore();
}

function gridLines(doc: Doc, cols: number[], y: number, h: number, rowH: number) {
  doc.save().lineWidth(STROKE_W).strokeColor("black");
  for (let r = 0; r <= Math.round(h / rowH); r++) {
    const yy = y + r * rowH;
    doc.moveTo(cols[0], yy).lineTo(cols[cols.length - 1], yy).stroke();
  }
  for (const x of cols) {
    doc.moveTo(x, y).lineTo(x, y + h).stroke();
  }
  doc.restore();
}

// ─── Section: header + PO box + footer (every page) ──────────────────────────
function drawHeader(
  doc: Doc,
  data: PoData,
  company: { name: string; address: string; tel: string },
  pageNo: number,
  totalPages: number,
) {
  doc.image(LOGO_IMAGE as never, LOGO_X, LOGO_Y, { width: LOGO_W, height: LOGO_H });

  // Company block (golden: name F2 11pt, address/tel F2 8pt, x=129.45)
  doc.font(FONT_REGULAR).fillColor("black");
  const nameLines = (company.name || "").split("\n").filter(Boolean);
  let y = 47.6;
  doc.fontSize(11);
  for (const line of nameLines) {
    doc.text(line, COMPANY_X, y, { width: PO_BOX_X - COMPANY_X - 8, baseline: "alphabetic", pageBreaks: false });
    y += 14.49;
  }
  doc.fontSize(8);
  // golden: ordinal suffixes in the address ("32nd", "11th") are raised 5pt
  // runs 2.8pt above the baseline; the tel number sits on its own line
  const addrLines = (company.address || "").split("\n").filter(Boolean);
  const drawSeg = (line: string, by: number) => {
    const re = /(\d+)(st|nd|rd|th)\b/g;
    let dx = COMPANY_X, last = 0, m;
    while ((m = re.exec(line))) {
      if (m.index > last) {
        doc.text(line.slice(last, m.index), dx, by, { baseline: "alphabetic", pageBreaks: false });
        dx += doc.widthOfString(line.slice(last, m.index));
      }
      doc.text(m[1], dx, by, { baseline: "alphabetic", pageBreaks: false });
      dx += doc.widthOfString(m[1]);
      doc.fontSize(5);
      const sw = doc.widthOfString(m[2]);
      doc.text(m[2], dx, by - 2.8, { baseline: "alphabetic", pageBreaks: false });
      dx += sw;
      doc.fontSize(8);
      last = m.index + m[0].length;
    }
    if (last < line.length) doc.text(line.slice(last), dx, by, { baseline: "alphabetic", pageBreaks: false });
  };
  y = 73.7; // golden L3 @73.6987
  // golden's address lines run at most ~173pt wide (its data carried \n at
  // those breaks); wrap at that width so a one-line settings value can't
  // run under the PO box (which starts at x400.9)
  addrLines.forEach((line, i) => {
    const isLast = i === addrLines.length - 1;
    const text = isLast && company.tel ? `${line} Tel. No.:` : line;
    for (const l of wrapWords(doc, text, Math.min(PO_BOX_X - COMPANY_X - 8, 173.2))) {
      drawSeg(l, y);
      y += 10.5387; // golden address line advance
    }
  });
  if (company.tel) {
    drawSeg(company.tel, y);
  }

  // PO box (golden: title row borderless; rows 2-3 bordered, divider at 444.95)
  doc.save().lineWidth(STROKE_W).strokeColor("black");
  const row2 = PO_BOX_Y + 12.96; // 72.81
  const row3 = row2 + 12.71;     // 85.52
  const bottom = row3 + 12.71;   // 98.22
  doc.moveTo(PO_BOX_X, row2).lineTo(PO_BOX_X + PO_BOX_W, row2).stroke();
  doc.moveTo(PO_BOX_X, row3).lineTo(PO_BOX_X + PO_BOX_W, row3).stroke();
  doc.moveTo(PO_BOX_X, bottom).lineTo(PO_BOX_X + PO_BOX_W, bottom).stroke();
  doc.moveTo(PO_BOX_X, row2).lineTo(PO_BOX_X, bottom).stroke();
  doc.moveTo(PO_BOX_X + PO_BOX_W, row2).lineTo(PO_BOX_X + PO_BOX_W, bottom).stroke();
  doc.moveTo(PO_DIVIDER_X, row2).lineTo(PO_DIVIDER_X, bottom).stroke();
  doc.restore();

  doc.font(FONT_BOLD).fontSize(10);
  doc.text("PURCHASE ORDER", PO_TITLE_X, PO_TITLE_Y, { baseline: "alphabetic", pageBreaks: false });
  doc.font(FONT_REGULAR);
  doc.text("PO No.", PO_TITLE_X, 82.8, { baseline: "alphabetic", pageBreaks: false });
  doc.text(data.po_number || "", PO_VALUE_X, 82.8, { baseline: "alphabetic", pageBreaks: false });
  doc.text("Date", PO_TITLE_X, 95.5, { baseline: "alphabetic", pageBreaks: false });
  doc.text(data.po_date || "", PO_VALUE_X, 95.5, { baseline: "alphabetic", pageBreaks: false });

  // footer (golden: F2 11pt "Page", F1 bold digits, left at x=50.9, baseline 739.25;
  // fixed golden segment positions: "Page" 50.9 | "1" 74.9 | "of" 83.0 | "3" 94.6)
  doc.fontSize(11);
  doc.font(FONT_REGULAR);
  doc.text("Page", FOOTER_X, FOOTER_Y, { baseline: "alphabetic", pageBreaks: false });
  doc.font(FONT_BOLD).text(String(pageNo), 74.9, FOOTER_Y, { baseline: "alphabetic", pageBreaks: false });
  doc.font(FONT_REGULAR).text("of", 83.0, FOOTER_Y, { baseline: "alphabetic", pageBreaks: false });
  doc.font(FONT_BOLD).text(String(totalPages), 94.6, FOOTER_Y, { baseline: "alphabetic", pageBreaks: false });
  doc.font(FONT_REGULAR);
}

// ─── Section: vendor block (4 rows x 3 cols, repeated every page) ────────────
// Golden text positions (page 1; +14.45 on page 2):
//   labels bold F1 at col+5.4; values F2 at fixed offsets below.
function drawVendorBlock(doc: Doc, data: PoData, pageNo: number) {
  const sh = pageNo === 2 ? X_SHIFT : 0;
  const cols = VENDOR_COLS.map((c) => c + sh);
  const y = VENDOR_Y[pageNo] ?? 136.06;
  // golden: top/bottom horizontals span the full width; the middle rows only
  // reach the right box edge (c2), and the 3rd->4th row boundary only
  // separates the middle cell; the right box (c2->c3) is one tall open cell
  const [c0, c1, c2, c3] = cols;
  const b = y + 4 * VENDOR_ROW_H;
  doc.save().lineWidth(STROKE_W).strokeColor("black");
  doc.moveTo(c0, y).lineTo(c3, y).stroke();
  doc.moveTo(c0, y + VENDOR_ROW_H).lineTo(c2, y + VENDOR_ROW_H).stroke();
  doc.moveTo(c0, y + 2 * VENDOR_ROW_H).lineTo(c2, y + 2 * VENDOR_ROW_H).stroke();
  doc.moveTo(c1, y + 3 * VENDOR_ROW_H).lineTo(c2, y + 3 * VENDOR_ROW_H).stroke();
  doc.moveTo(c0, b).lineTo(c3, b).stroke();
  // the 284.25 vertical skips the CONTACT PERSON row (y+rowH..y+2rowH) so
  // that row spans as one wide cell directly under the VENDOR NO. row
  doc.moveTo(c0, y).lineTo(c0, b).stroke();
  doc.moveTo(c1, y).lineTo(c1, y + VENDOR_ROW_H).stroke();
  doc.moveTo(c1, y + 2 * VENDOR_ROW_H).lineTo(c1, b).stroke();
  doc.moveTo(c2, y).lineTo(c2, b).stroke();
  doc.moveTo(c3, y).lineTo(c3, b).stroke();
  doc.restore();

  const lx = cols[0] + 5.4;   // 41.8
  const cx = cols[1] + 5.4;   // 289.6
  const rx = cols[2] + 5.4;   // 410.4
  const y1 = y + 10.04, y2 = y + 22.74, y3 = y + 35.44, y4 = y + 48.14;

  doc.font(FONT_BOLD).fontSize(10);
  const label = (t: string, x: number, by: number) =>
    doc.text(t, x, by, { baseline: "alphabetic", pageBreaks: false });
  const value = (t: string, x: number, by: number) => {
    doc.font(FONT_REGULAR).text(t, x, by, { baseline: "alphabetic", pageBreaks: false });
    doc.font(FONT_BOLD);
  };

  label("VENDOR", lx, y1);
  value(`: ${data.vendor_name}`, cols[0] + 41.5, y1);
  label("VENDOR NO.:", cx, y1);
  value(data.vendor_no, cols[0] + 312.6, y1);
  label("PAYMENT TERMS:", rx, y1);

  label("CONTACT PERSON", lx, y2);
  value(`: ${data.vendor_contact}`, cols[0] + 81.5, y2);
  value("Refer to the PO notes below.", rx, y + 22.24);

  label("ADDRESS", lx, y3);
  const addrW = cols[1] - (cols[0] + 44.0) - 5.4; // wraps like the golden
  const addrLines = wrapWords(doc, `: ${data.vendor_address}`, addrW);
  value(addrLines[0], cols[0] + 44.0, y3);
  doc.font(FONT_REGULAR);
  addrLines.slice(1).forEach((l, i) => doc.text(l, lx, y + 47.64 + i * 11.0, { baseline: "alphabetic", pageBreaks: false }));
  doc.font(FONT_BOLD);

  label("TEL. NO.:", cx, y3);
  value(data.vendor_tel, cols[0] + 293.3, y3);
  label("FAX NO.:", cx, y4);
  value(data.vendor_fax || "-", cols[0] + 292.7, y4);
  label("DOWNPAYMENT AMT:", rx, y + 46.64);
  value(`PHP ${fmtMoney(data.downpayment_amount)}`, cols[0] + 473.7, y + 46.64);
}

// ─── Section: line items table + summary (page 1) ────────────────────────────
function drawLineItems(doc: Doc, data: PoData): number {
  const [c0, c1, c2, c3, c4, c5, c6, c7] = ITEM_COLS;
  const top = ITEM_HEADER_TOP;

  // header: gray fill, full grid, centered labels (QUANTITY/UoM at golden x)
  doc.font(FONT_BOLD).fontSize(10);
  fillRow(doc, ITEM_COLS, top, ITEM_HEADER_H);
  gridLines(doc, ITEM_COLS, top, ITEM_HEADER_H, ITEM_HEADER_H);
  const hdr = (i: number, t: string, by: number) =>
    doc.text(t, ITEM_COLS[i], by, { width: ITEM_COLS[i + 1] - ITEM_COLS[i], align: "center", baseline: "alphabetic", pageBreaks: false });
  hdr(0, "LINE NO.", top + 10.01);
  hdr(1, "ITEM", top + 10.01);
  hdr(1, "CODE", top + 22.21);
  hdr(2, "DESCRIPTION", top + 10.01);
  doc.text("QUANTITY", 312.0, top + 10.01, { baseline: "alphabetic", pageBreaks: false });
  doc.text("UoM", 373.3, top + 10.01, { baseline: "alphabetic", pageBreaks: false });
  doc.text("UNIT PRICE", 420.5, top + 10.01, { baseline: "alphabetic", pageBreaks: false });
  doc.text("AMOUNT", 512.5, top + 10.01, { baseline: "alphabetic", pageBreaks: false });

  // item rows: full 8-column grid (golden verticals run the whole item
  // area); description wraps under the ITEM CODE column with a bold
  // item_code prefix ("Services: ...")
  doc.font(FONT_REGULAR).fontSize(9);
  const descX = c2 + 5.35;         // 154.9
  const descW = c3 - c2 - 10.8;    // 145.15
  let y = top + ITEM_HEADER_H;     // 211.80
  let lastDescBaseline = 0;

  for (const li of data.line_items) {
    const rowTop = y;
    const code = "Services";  //li.item_code ?? "";
    const boldW = code ? doc.font(FONT_BOLD).widthOfString(code) : 0;
    doc.font(FONT_REGULAR);
    const text = code ? `: ${li.description ?? ""}` : (li.description ?? "");
    // golden: line 1 wraps at (descW - boldW) behind the bold code prefix,
    // continuation lines wrap at the full descW
    const first = wrapWords(doc, text, descW - boldW)[0];
    const lines = [first, ...wrapWords(doc, text.slice(first.length), descW)];

    let by = rowTop + 9.07; // golden desc line-1 @220.8714
    if (code) doc.font(FONT_BOLD).text(code, descX, by, { baseline: "alphabetic", pageBreaks: false });
    doc.font(FONT_REGULAR).text(lines[0], descX + boldW, by, { baseline: "alphabetic", pageBreaks: false });
    for (const l of lines.slice(1)) {
      by += 10.986; // golden line advance
      doc.text(l, descX, by, { baseline: "alphabetic", pageBreaks: false });
    }
    lastDescBaseline = by;

    doc.text(li.line_no, c0, rowTop + 9.06, { width: c1 - c0, align: "center", baseline: "alphabetic", pageBreaks: false });
    doc.text(fmtMoney(li.quantity), 325.9, rowTop + 9.06, { baseline: "alphabetic", pageBreaks: false });
    doc.text(li.uom, 376.5, rowTop + 9.06, { baseline: "alphabetic", pageBreaks: false });
  doc.text(`${nfMoney.format(li.unit_price)} ${data.currency}`, c5, rowTop + 9.06, { width: c6 - c5, align: "center", baseline: "alphabetic", pageBreaks: false });
  doc.text(`${nfMoney.format(li.amount)} ${data.currency}`, c6, rowTop + 9.06, { width: c7 - c6, align: "center", baseline: "alphabetic", pageBreaks: false });

    const rowBottom = lastDescBaseline + 2.44;
    y = rowBottom;
  }

  // summary block: bold label lines with regular values (golden baselines)
  let sy = lastDescBaseline + 21.34; // golden: 253.8304 + 21.3354 = 275.1658
  doc.font(FONT_BOLD).fontSize(9);
  doc.text(`Mobilization Date: ${data.mobilization_date}`, descX, sy, { baseline: "alphabetic", pageBreaks: false });
  sy += 10.986;
  doc.text(`Delivery Date: ${data.delivery_date}`, descX, sy, { baseline: "alphabetic", pageBreaks: false });
  sy += 10.986;
  const prW = doc.widthOfString("PR No.: ");
  doc.text("PR No.:", descX, sy, { baseline: "alphabetic", pageBreaks: false });
  doc.font(FONT_REGULAR).text(data.pr_number, descX + prW, sy, { baseline: "alphabetic", pageBreaks: false });
  sy += 10.986;
  const reqW = doc.font(FONT_BOLD).widthOfString("Requisitioner");
  doc.text("Requisitioner", descX, sy, { baseline: "alphabetic", pageBreaks: false });
  doc.font(FONT_REGULAR).text(`: ${data.requisitioner}`, descX + reqW, sy, { baseline: "alphabetic", pageBreaks: false });
  doc.font(FONT_REGULAR);

  // golden: one continuous 8-column frame around item rows + summary, then
  // an empty full-width box (outer sides only) down to the delivery band
  const frameBottom = Math.max(ITEM_FRAME_BOTTOM, sy + 2.44);
  doc.save().lineWidth(STROKE_W).strokeColor("black");
  for (const cx of ITEM_COLS) {
    doc.moveTo(cx, top + ITEM_HEADER_H).lineTo(cx, frameBottom).stroke();
  }
  doc.moveTo(c0, frameBottom).lineTo(c7, frameBottom).stroke();
  if (frameBottom < BAND_ANCHOR_1) {
    doc.moveTo(c0, frameBottom).lineTo(c0, BAND_ANCHOR_1).stroke();
    doc.moveTo(c7, frameBottom).lineTo(c7, BAND_ANCHOR_1).stroke();
  }
  doc.restore();
  return sy;
}

// ─── Section: terms and conditions (page 2) ──────────────────────────────────
function drawTerms(doc: Doc, data: PoData): { lastBaseline: number; remainder: { indent: number; lines: string[] }[] } {
  const x0 = X0 + X_SHIFT;        // 50.85
  const x3 = X3 + X_SHIFT;        // 596.35
  const top = VENDOR_Y[2] + 4 * VENDOR_ROW_H; // 175.79, just under the vendor block
  const barH = 12.71;

  // gray bar with centered bold title (golden baseline top+10.07)
  fillRow(doc, [x0, x3], top, barH);
  gridLines(doc, [x0, x3], top, barH, barH);
  doc.font(FONT_BOLD).fontSize(10);
  doc.text("TERMS AND CONDITIONS", x0, top + 10.07, { width: x3 - x0, align: "center", baseline: "alphabetic", pageBreaks: false });
  doc.font(FONT_REGULAR).fontSize(9);

  const step = 10.986; // golden line advance (21.97264 for blank lines)
  const itemX = x0 + 5.45;        // 56.3
  // golden true wrap widths (Carlito spaces): intro line 532.8 ("...as may"),
  // instruction-8 must break before +"as" (536.4) -> any value in [535.6, 536.4)
  const itemW = 536.0;
  const hangX = itemX + 18;       // 74.3
  const hangW = itemW - 18;       // 518.0
  const subX = itemX + 35.9;      // 92.2
  // golden sub lines: a 473.9, c 478.3, b must break before +"Payment" (490.3)
  const subW = 486.0;
  // pdfkit 0.18 removed `pageBreaks: false` — its LineWrapper auto-breaks when
  // y exceeds the page and spawns a blank page per overflowing text() call.
  // Cap the terms column so the bands below still fit: band top = lastBaseline
  // + 15.06; the IMPORTANT note wraps to 2 lines on page 2, so its last
  // baseline is y0+84.27 and must stay above 792 - lineHeight. Overflow
  // beyond the cap continues on page 3 (drawTermsTail).
  const TERMS_CAP = 679.0; // lastBaseline <= cap keeps the band stack on the page
  let y = 197.6;                  // golden first content baseline
  let lastBaseline = y;
  const remainder: { indent: number; lines: string[] }[] = [];

  // para/paraHang mirror the golden hanging-indent layout. Overflow lines are
  // collected (indent = x - itemX relative) and continued on page 3 by the tail.
  const para = (text: string, x: number, w: number) => {
    const indent = x - itemX;
    let out: { indent: number; lines: string[] } | null = null;
    for (const l of wrapWords(doc, text, w)) {
      if (y > TERMS_CAP) { out ??= { indent, lines: [] }; out.lines.push(l); continue; }
      doc.text(l, x, y, { baseline: "alphabetic", pageBreaks: false });
      lastBaseline = y;
      y += step;
    }
    if (out) remainder.push(out);
  };
  // first line at (x, w), continuation lines hanging at x+18
  const paraHang = (text: string, x: number, w: number) => {
    const indent = x - itemX;
    const lines = wrapWords(doc, text, w);
    if (y > TERMS_CAP) { remainder.push({ indent, lines }); return; }
    const first = lines[0];
    doc.text(first, x, y, { baseline: "alphabetic", pageBreaks: false });
    lastBaseline = y;
    y += step;
    const rest = text.slice(first.length).trimStart();
    if (rest) para(rest, x + 18, w - 18);
  };

  const tc = data.terms_and_conditions ? parseTc(data.terms_and_conditions) : null;
  // Custom T&C: structured object rendered with the golden hanging-indent
  // geometry (sub-letters at subX, continuations at hangX). A non-JSON /
  // wrong-shape stored string is treated as the golden template (parseTc
  // returns null), so the layout never drifts regardless of edits.
  const items: Array<[string, string[] | null, string[]?]> = tc ? tc.items.map((it) => [it.text, it.subs, it.conts]) : TNC_LIST;
  const instructions: Array<[string, string[] | null]> = tc ? tc.instructions.map((ins) => [ins.text, ins.conts]) : TNC_INSTRUCTIONS;

  para(`Project: ${data.project_name} (${data.vendor_name})`, itemX, itemW);
  y += step; // blank line
  para(`This PO is governed by the Service Agreement for ${data.project_name}${data.ref_no ? ` with Ref No. ${data.ref_no}` : ""}, as may be amended.`, itemX, itemW);
  y += step; // blank line
  para("Terms and Conditions:", itemX, itemW);

  items.forEach(([item, subs, conts], i) => {
    if (item) paraHang(`${i + 1}. ${item}`, itemX, itemW);
    // golden letters the Payment Terms sub-items a./b./c. at x92.2;
    // plain continuation lines (item 2) hang at x+18 like instructions
    subs?.forEach((s, j) => { if (s) paraHang(`${String.fromCharCode(97 + j)}. ${s}`, subX, subW); });
    conts?.forEach((c) => { if (c) paraHang(c, hangX, hangW); });
  });

  y += step; // blank line (golden: item 9 @461.3, A. @483.3)
  para("A. Instructions to Vendor:", itemX, itemW);
  instructions.forEach(([text, cont], i) => {
    if (text) paraHang(`${i + 1}. ${text}`, itemX, itemW);
    cont?.forEach((c) => { if (c) paraHang(c, hangX, hangW); });
  });

  // golden: box around the terms column, bar bottom -> delivery band top
  doc.save().lineWidth(STROKE_W).strokeColor("black");
  doc.moveTo(x0, top + barH).lineTo(x0, lastBaseline + 15.06).stroke();
  doc.moveTo(x3, top + barH).lineTo(x3, lastBaseline + 15.06).stroke();
  doc.restore();
  return { lastBaseline, remainder };
}

// ─── Section: custom T&C overflow (page 3, above the sites section) ──────────
function drawTermsTail(doc: Doc, remainder: { indent: number; lines: string[] }[], y0: number): number {
  const leadX = X0 + 5.4;         // page 3 has no X_SHIFT
  const step = 10.986;
  // ponytail: hard cap so B./table/bands still fit on page 3; overflow
  // beyond it is clipped (extreme edge case)
  const CAP = 500;
  doc.font(FONT_REGULAR).fontSize(9);
  let y = y0;
  for (const p of remainder) {
    if (y > CAP) break;
    for (const l of p.lines) {
      if (y > CAP) break;
      doc.text(l, leadX + p.indent, y, { baseline: "alphabetic", pageBreaks: false });
      y += step;
    }
    y += step; // blank line between paragraphs
  }
  return y;
}

// ─── Section: sites list (page 3) ────────────────────────────────────────────
function drawSites(doc: Doc, data: PoData, y0: number, sitesLead: string[] | null): number {
  const top = VENDOR_Y[3] + 4 * VENDOR_ROW_H; // frame top (golden), content may start lower
  doc.font(FONT_REGULAR).fontSize(9);
  const leadX = X0 + 5.4;         // 41.8
  const leadW = 536.0;            // golden true wrap width (same family as p2 itemW)
  let y = y0;

  // The 9./10. lead paragraphs are part of the T&C template (page-2 items
  // continue onto page 3). For custom T&C the stored sitesLead is rendered
  // with the same geometry; null => golden template.
  const lead = sitesLead ?? TNC_SITES_LEAD;
  if (lead.length) {
    for (const [i, t] of lead.entries()) {
      if (!t) continue;
      const text = `${i + 9}. ${t}`;
      const first = wrapWords(doc, text, leadW)[0];
      doc.text(first, leadX, y, { baseline: "alphabetic", pageBreaks: false });
      y += 10.986;
      const rest = text.slice(first.length).trimStart();
      if (rest) {
        for (const l of wrapWords(doc, rest, leadW - 18)) {
          doc.text(l, leadX + 18, y, { baseline: "alphabetic", pageBreaks: false });
          y += 10.986;
        }
      }
    }
    y += 10.986; // blank line (golden: lead-10 @239.2, B. @261.2)
  }
  doc.text("B. List of Sites and Details", X0 + 5.4, y, { baseline: "alphabetic", pageBreaks: false });
  y += 10.986;
  y += 10.986; // blank line
  doc.text("SUMMARY:", X0 + 23.4, y, { baseline: "alphabetic", pageBreaks: false }); // golden x59.8

  // sites table: header + data rows + TOTAL, padded to at least the golden's
  // 4-row skeleton; rows beyond the golden's four reuse its middle row height
  const rowH = (r: number) => SITE_ROW_HS[r] ?? 11.49;
  // golden: row borders span only the inner cells (64.1..424.55); the outer
  // frame (36.4/581.9) is drawn once around the whole section at the end
  const rowGrid = (y: number, h: number, verts: number[]) => {
    doc.save().lineWidth(STROKE_W).strokeColor("black");
    doc.moveTo(SITE_COLS[1], y).lineTo(SITE_COLS[6], y).stroke();
    doc.moveTo(SITE_COLS[1], y + h).lineTo(SITE_COLS[6], y + h).stroke();
    for (const x of verts) doc.moveTo(x, y).lineTo(x, y + h).stroke();
    doc.restore();
  };
  const tableTop = y + 2.47;      // 285.57
  const headerH = 22.47;
  doc.font(FONT_BOLD).fontSize(9);
  const headerLefts = [75.6, 133.8, 208.3, 269.5, 340.4];
  const headerTexts = ["S/N", "REGION", "AREA/CITY", "NO OF NODES", "ESTIMATED STRAND"];
  headerTexts.forEach((t, i) =>
    doc.text(t, headerLefts[i], tableTop + 9.03, { baseline: "alphabetic", pageBreaks: false }),
  );
  doc.text("CABLE LENGTH (KM)", 340.6, tableTop + 20.03, { baseline: "alphabetic", pageBreaks: false });
  rowGrid(tableTop, headerH, SITE_COLS.slice(1, 7));

  doc.font(FONT_REGULAR).fontSize(9);
  let rt = tableTop + headerH;    // 308.04
  let row = 0;
  let totalNodes = 0;
  let totalKm = 0;

  for (const s of data.site_details) {
    totalNodes += s.no_of_nodes;
    totalKm += s.estimated_strand_km;
    doc.text(String(s.sn), 79.3, rt + 9.06, { baseline: "alphabetic", pageBreaks: false });
    doc.text(s.region, 104.5, rt + 9.06, { baseline: "alphabetic", pageBreaks: false });
    doc.text(s.area_city, 203.5, rt + 9.06, { baseline: "alphabetic", pageBreaks: false });
    doc.text(String(s.no_of_nodes), 322.5, rt + 9.06, { baseline: "alphabetic", pageBreaks: false });
    doc.text(fmtKm(s.estimated_strand_km), 394.1, rt + 9.06, { baseline: "alphabetic", pageBreaks: false });
    rowGrid(rt, rowH(row), SITE_COLS.slice(1, 7));
    rt += rowH(row++);
  }

  // TOTAL row (bold, golden baselines); golden merges the 64.1..259.1 cells
  // (no verticals at 99.1/198.1)
  doc.font(FONT_BOLD).fontSize(9);
  doc.text("TOTAL", 149.5, rt + 9.05, { baseline: "alphabetic", pageBreaks: false });
  doc.text(String(totalNodes), 322.5, rt + 9.05, { baseline: "alphabetic", pageBreaks: false });
  doc.text(fmtKm(totalKm), 393.9, rt + 9.05, { baseline: "alphabetic", pageBreaks: false });
  rowGrid(rt, rowH(row), [SITE_COLS[1], SITE_COLS[4], SITE_COLS[5], SITE_COLS[6]]);
  rt += rowH(row++);
  // golden: skeleton rows below the TOTAL row are borderless; the last one
  // stretches so the table bottom meets the delivery band top exactly (no
  // gap); a long table skips the stretch and keeps the old gap below it
  while (row < 4) {
    const h = row === 3 ? Math.max(rowH(row), BAND_ANCHOR_3 - rt) : rowH(row);
    rt += h;
    row++;
  }
  if (rt < BAND_ANCHOR_3) rt = BAND_ANCHOR_3;
  // golden: continuous outer frame around the whole section (lead text
  // through table bottom); the vendor-block bottom line closes the top
  doc.save().lineWidth(STROKE_W).strokeColor("black");
  doc.moveTo(X0, top).lineTo(X0, rt).stroke();
  doc.moveTo(X3, top).lineTo(X3, rt).stroke();
  doc.restore();
  return rt;                      // table bottom = 389.71 (short tables)
}

// ─── Section: bottom bands (delivery / incoterms / important) ────────────────
function drawBands(doc: Doc, data: PoData, y0: number, pageNo: number) {
  const sh = pageNo === 2 ? X_SHIFT : 0;
  const cols = BAND_COLS.map((c) => c + sh);
  const [x0, x1, x2, x3] = cols;

  // delivery note wraps within its row; the band grows one line per extra
  // wrapped line so a long note never runs into the INCOTERMS row below
  doc.font(FONT_REGULAR).fontSize(10);
  const deliveryLines = wrapWords(doc, "Pls coordinate with Mae Bacayo mae.bacayo@telcovantage.com", x3 - (x0 + 91.0) - 4);
  const y1 = y0 + BAND_DELIVERY_H + (deliveryLines.length - 1) * 12.2;
  const y2 = y1 + BAND_MID_H;
  const y3 = y2 + BAND_IMPORTANT_H;

  // borders: delivery = single box; middle + important rows = full grid
  doc.save().lineWidth(STROKE_W).strokeColor("black");
  const box = (a: number, b: number, c: number, d: number) => {
    doc.moveTo(a, b).lineTo(c, b).stroke();
    doc.moveTo(a, d).lineTo(c, d).stroke();
    doc.moveTo(a, b).lineTo(a, d).stroke();
    doc.moveTo(c, b).lineTo(c, d).stroke();
  };
  box(x0, y0, x3, y1);
  box(x0, y1, x3, y2);
  doc.moveTo(x1, y1).lineTo(x1, y2).stroke();
  doc.moveTo(x2, y1).lineTo(x2, y2).stroke();
  box(x0, y2, x3, y3);
  doc.moveTo(x1, y2).lineTo(x1, y3).stroke();
  doc.moveTo(x2, y2).lineTo(x2, y3).stroke();
  doc.restore();

  // important band: full gray fill (drawn over the borders, same as golden)
  fillRow(doc, cols, y2, BAND_IMPORTANT_H);

  // texts
  doc.font(FONT_BOLD).fontSize(10);
  doc.text("DELIVERY ADDRESS:", x0 + 5.4, y0 + 10.03, { baseline: "alphabetic", pageBreaks: false });
  doc.font(FONT_REGULAR);
  deliveryLines.forEach((l, i) =>
    doc.text(l, x0 + 91.0, y0 + 10.03 + i * 12.2, { baseline: "alphabetic", pageBreaks: false }),
  );
  doc.font(FONT_BOLD);
  doc.text("INCOTERMS:", x0 + 5.4, y1 + 10.03, { baseline: "alphabetic", pageBreaks: false });
  doc.font(FONT_REGULAR);
  doc.text(data.incoterms || "-", x0 + 60.7, y1 + 10.03, { baseline: "alphabetic", pageBreaks: false });
  doc.font(FONT_BOLD);
  doc.text("DATE PREPARED:", x1 + 5.4, y1 + 10.03, { baseline: "alphabetic", pageBreaks: false });
  doc.font(FONT_REGULAR);
  doc.text(data.date_prepared, x1 + 78.9, y1 + 10.03, { baseline: "alphabetic", pageBreaks: false });
  doc.font(FONT_BOLD);
  doc.text("APPROVED BY:", x2 + 5.5, y1 + 10.03, { baseline: "alphabetic", pageBreaks: false });
  doc.font(FONT_REGULAR);
  ["Edardnal Giovanni C. Canicula", "Meinardo A. Opiana", "Teresa Grecia N. Beltran"].forEach((n, i) =>
    doc.text(n, x2 + 5.5, y1 + 22.25 + i * 12.2, { baseline: "alphabetic", pageBreaks: false }),
  );

  // IMPORTANT band (golden: "IMPORTANT !!!" with space, fixed x = x0+47.4 -> 83.8 / 98.25)
  doc.font(FONT_BOLD).fontSize(14);
  doc.text("IMPORTANT !!!", x0 + 47.4, y2 + 13.83, { baseline: "alphabetic", pageBreaks: false });
  doc.fontSize(10);
  const noteLines = wrapWords(doc, IMPORTANT_NOTE, x3 - x1 - 10.7);
  noteLines.forEach((l, i) =>
    doc.text(l, x1 + 5.35, y2 + 10.03 + i * 12.2, { baseline: "alphabetic", pageBreaks: false }),
  );
  doc.font(FONT_REGULAR);
}

// ─── Entry point ─────────────────────────────────────────────────────────────
export async function renderPoDocument(poId: string): Promise<{ buffer: Buffer; filename: string }> {
  const data = await fetchPoData(poId);
  if (!data) throw new Error(`PO not found: ${poId}`);

  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("system_settings")
    .select("company_name, company_address, company_tel")
    .eq("id", 1)
    .single();
  companyCache = {
    name: settings?.company_name || "",
    address: settings?.company_address || "",
    tel: settings?.company_tel || "",
  };

  // Two passes: pass 1 with a placeholder total, then re-stamp "Page n of N"
  // with the real page count. Layout is identical in both passes.
  const render = (totalPages: number): Promise<Buffer> => {
    const doc = new PDFDocument({ size: [PAGE_W, PAGE_H], margin: 0, autoFirstPage: false });
    // each pass is a new document: pdfkit's `if (!image.obj)` guard must not
    // reuse the previous pass's orphaned ref (the XObject would dangle)
    LOGO_IMAGE.obj = null;
    doc.registerFont(FONT_REGULAR, FONT_REGULAR_BUF);
    doc.registerFont(FONT_BOLD, FONT_BOLD_BUF);
    doc.font(FONT_REGULAR); // avoid pdfkit's default Helvetica leaking into first text block

    let pageNo = 0;
    const chrome = () => {
      pageNo++;
      drawHeader(doc, data, companyCtx(), pageNo, totalPages);
      drawVendorBlock(doc, data, pageNo);
    };

    doc.addPage();
    chrome();
    drawLineItems(doc, data);
    drawBands(doc, data, BAND_ANCHOR_1, pageNo);

    doc.addPage();
    chrome();
    const tc = data.terms_and_conditions ? parseTc(data.terms_and_conditions) : null;
    const terms = drawTerms(doc, data);
    drawBands(doc, data, terms.lastBaseline + 15.06, pageNo);

    // golden template always carries the sites page, even with no sites
    // (SUMMARY table renders header + TOTAL + empty skeleton rows); custom
    // T&C overflow from page 2 continues here above the sites section
    doc.addPage();
    chrome();
    let sitesY0 = VENDOR_Y[3] + 4 * VENDOR_ROW_H + 9.03;
    if (terms.remainder.length) sitesY0 = drawTermsTail(doc, terms.remainder, sitesY0);
    const tableBottom = drawSites(doc, data, sitesY0, tc ? tc.sitesLead : null);
    // short tables end flush on the golden band top; long tables push it down
    drawBands(doc, data, tableBottom > BAND_ANCHOR_3 ? tableBottom + 32.96 : tableBottom, pageNo);

    const pass = new PassThrough();
    doc.pipe(pass);
    doc.end();
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      pass.on("data", (c) => chunks.push(c));
      pass.on("end", () => resolve(Buffer.concat(chunks)));
      pass.on("error", reject);
    });
  };

  // ponytail: golden PO is always 3 pages, single pass was 2-pass for counting
  const buffer = await render(3);

  companyCache = null;
  return { buffer, filename: `${data.po_number || poId}.pdf` };
}

let companyCache: { name: string; address: string; tel: string } | null = null;
function companyCtx() {
  return companyCache || { name: "", address: "", tel: "" };
}
