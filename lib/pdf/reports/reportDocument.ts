// Report PDF builder — redesigned with a dark header band, accent stripe, KPI
// cards with left-border accents, section rules, and striped tables.

import PDFDocument from "pdfkit";
import { PassThrough } from "stream";
import {
  PAGE_WIDTH,
  PAGE_HEIGHT,
  MARGIN_LEFT,
  MARGIN_RIGHT,
  LOGO_PATH,
} from "../constants";

// ─── Design tokens ────────────────────────────────────────────────────────────
type RGB = [number, number, number];

const ink = {
  brand:    [10, 92, 59]    as RGB,  // deep forest green
  brandDk:  [6, 60, 38]     as RGB,  // darker variant for totals row
  brandAcc: [26, 184, 116]  as RGB,  // bright accent for stripe / hover
  tint:     [238, 248, 243] as RGB,  // alternating row / KPI bg
  border:   [198, 222, 210] as RGB,  // table / card borders
  dark:     [18, 22, 28]    as RGB,  // body text
  mid:      [80, 94, 106]   as RGB,  // secondary text
  muted:    [154, 168, 178] as RGB,  // captions, timestamps
  white:    [255, 255, 255] as RGB,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MAX_CELL_CHARS = 200;

function truncate(v: string | number): string {
  const s = String(v);
  return s.length > MAX_CELL_CHARS ? s.slice(0, MAX_CELL_CHARS - 1) + "…" : s;
}

// ─── Page layout ──────────────────────────────────────────────────────────────
const CL = MARGIN_LEFT;               // 35
const CR = PAGE_WIDTH - MARGIN_RIGHT; // 560.28
const CW = CR - CL;                   // 525.28

const HDR_H    = 76;                                  // main header band
const ACC_H    = 4;                                   // accent stripe
const META_H   = 22;                                  // subtitle / timestamp row
const BODY_Y   = HDR_H + ACC_H + META_H + 14;        // first-page body start
const SLIM_H   = 26;                                  // thin header on pages 2+
const SLIM_Y   = SLIM_H + 2 + 8;                     // body start on pages 2+
const FOOT_Y   = PAGE_HEIGHT - 40;                    // footer rule y
const BOT      = FOOT_Y - 6;                          // content bottom limit

// ─── Public API ───────────────────────────────────────────────────────────────

export interface ReportColumn {
  header: string;
  /** Relative weight; widths are normalised to CW. */
  width: number;
  align?: "left" | "right" | "center";
}
export interface ReportTable {
  columns: ReportColumn[];
  rows: (string | number)[][];
  totalsRow?: (string | number)[];
}
export interface ReportKpi { label: string; value: string }
export interface ReportSection {
  heading?: string;
  paragraphs?: string[];
  table?: ReportTable;
}
export interface ReportSpec {
  title: string;
  subtitle?: string;
  generatedAt: Date;
  kpis?: ReportKpi[];
  sections?: ReportSection[];
}

type Doc = typeof PDFDocument.prototype;

export function createReportDocument(spec: ReportSpec): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      bufferPages: true,
    });

    const bufs: Buffer[] = [];
    const stream = doc.pipe(new PassThrough());
    stream.on("data", (c: Buffer) => bufs.push(c));
    stream.on("end", () => resolve(Buffer.concat(bufs)));
    stream.on("error", reject);

    drawFirstHeader(doc, spec);
    doc.y = BODY_Y;

    if (spec.kpis?.length) drawKpis(doc, spec.kpis, spec);
    for (const s of spec.sections ?? []) drawSection(doc, s, spec);

    finalise(doc, spec);
    doc.end();
  });
}

// ─── Header helpers ──────────────────────────────────────────────────────────

function drawFirstHeader(doc: Doc, spec: ReportSpec) {
  // Dark green band (edge to edge)
  doc.rect(0, 0, PAGE_WIDTH, HDR_H).fillAndStroke(ink.brand, ink.brand);

  // Logo
  try {
    doc.image(LOGO_PATH, CL, 19, { width: 36 });
  } catch { /* missing logo — continue */ }

  // Company name
  const nameX = CL + 44;
  doc
    .font("Helvetica-Bold")
    .fontSize(9.5)
    .fillColor(...ink.white)
    .text("TELCOVANTAGE PHILIPPINES", nameX, 20, { width: 200, lineBreak: false });
  doc
    .font("Helvetica")
    .fontSize(7.5)
    .fillColor(180, 220, 200)
    .text("Services Inc. · BGC, Taguig City", nameX, 34, { width: 200, lineBreak: false });

  // Report title (right-aligned)
  const titleW = 240;
  doc
    .font("Times-Bold")
    .fontSize(18)
    .fillColor(...ink.white)
    .text(spec.title, CR - titleW, 18, { width: titleW, align: "right", lineBreak: false });

  // Bright accent stripe
  doc.rect(0, HDR_H, PAGE_WIDTH, ACC_H).fillAndStroke(ink.brandAcc, ink.brandAcc);

  // Metadata row: subtitle left, generated date right
  const metaY = HDR_H + ACC_H + 7;
  if (spec.subtitle) {
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor(...ink.mid)
      .text(spec.subtitle, CL, metaY, { width: CW * 0.6, lineBreak: false });
  }
  doc
    .font("Helvetica")
    .fontSize(7)
    .fillColor(...ink.muted)
    .text(
      `Generated ${spec.generatedAt.toLocaleString("en-PH")}`,
      CR - 175,
      metaY,
      { width: 175, align: "right", lineBreak: false },
    );

  // Thin divider
  const divY = HDR_H + ACC_H + META_H + 4;
  doc
    .moveTo(CL, divY)
    .lineTo(CR, divY)
    .lineWidth(0.5)
    .strokeColor(...ink.border)
    .stroke();
}

function drawSlimHeader(doc: Doc, title: string) {
  doc.rect(0, 0, PAGE_WIDTH, SLIM_H).fillAndStroke(ink.brand, ink.brand);
  doc
    .font("Helvetica-Bold")
    .fontSize(7.5)
    .fillColor(...ink.white)
    .text("TELCOVANTAGE PHILIPPINES", CL, 9, { width: 200, lineBreak: false });
  doc
    .font("Helvetica")
    .fontSize(7.5)
    .fillColor(180, 220, 200)
    .text(title, CR - 220, 9, { width: 220, align: "right", lineBreak: false });
  doc.rect(0, SLIM_H, PAGE_WIDTH, 2).fillAndStroke(ink.brandAcc, ink.brandAcc);
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function guard(doc: Doc, needed: number, title: string) {
  if (doc.y + needed > BOT) {
    doc.addPage();
    drawSlimHeader(doc, title);
    doc.y = SLIM_Y;
  }
}

// ─── KPI grid ─────────────────────────────────────────────────────────────────

function drawKpis(doc: Doc, kpis: ReportKpi[], spec: ReportSpec) {
  const cols = 3;
  const gap  = 10;
  const cW   = (CW - gap * (cols - 1)) / cols;
  const cH   = 54;
  const bar  = 4;

  kpis.forEach((kpi, i) => {
    const col = i % cols;
    if (col === 0) {
      guard(doc, cH + gap, spec.title);
      if (i > 0) doc.y += gap;
    }
    const x = CL + col * (cW + gap);
    const y = doc.y;

    // Card bg + border
    doc.rect(x, y, cW, cH).fillAndStroke(ink.tint, ink.border);
    // Left accent bar
    doc.rect(x, y, bar, cH).fillAndStroke(ink.brand, ink.brand);

    // Label
    doc
      .font("Helvetica")
      .fontSize(6.5)
      .fillColor(...ink.mid)
      .text(kpi.label.toUpperCase(), x + bar + 8, y + 10, {
        width: cW - bar - 16,
        lineBreak: false,
      });
    // Value
    doc
      .font("Helvetica-Bold")
      .fontSize(15)
      .fillColor(...ink.brand)
      .text(kpi.value, x + bar + 8, y + 24, {
        width: cW - bar - 16,
        lineBreak: false,
      });

    if (col === cols - 1 || i === kpis.length - 1) doc.y = y + cH;
  });

  doc.y += 18;
}

// ─── Sections ────────────────────────────────────────────────────────────────

function drawSection(doc: Doc, section: ReportSection, spec: ReportSpec) {
  if (section.heading) {
    guard(doc, 30, spec.title);
    const y = doc.y;
    doc.rect(CL, y, 4, 15).fillAndStroke(ink.brand, ink.brand);
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(...ink.dark)
      .text(section.heading, CL + 10, y + 2, { width: CW - 10, lineBreak: false });
    doc
      .moveTo(CL, y + 19)
      .lineTo(CR, y + 19)
      .lineWidth(0.5)
      .strokeColor(...ink.border)
      .stroke();
    doc.y = y + 26;
  }

  for (const para of section.paragraphs ?? []) {
    guard(doc, 18, spec.title);
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(...ink.dark)
      .text(para, CL, doc.y, { width: CW });
    doc.y += 4;
  }

  if (section.table) drawTable(doc, section.table, spec);
  doc.y += 14;
}

// ─── Table ────────────────────────────────────────────────────────────────────

function drawTable(doc: Doc, table: ReportTable, spec: ReportSpec) {
  const total = table.columns.reduce((s, c) => s + c.width, 0);
  const ws    = table.columns.map((c) => (c.width / total) * CW);
  const hdrH  = 19;
  const pad   = 5;

  const drawHeaderRow = () => {
    const y = doc.y;
    doc.rect(CL, y, CW, hdrH).fillAndStroke(ink.brand, ink.brand);
    let x = CL;
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(...ink.white);
    table.columns.forEach((col, i) => {
      doc.text(col.header.toUpperCase(), x + pad, y + 6, {
        width: ws[i] - pad * 2,
        align: col.align ?? "left",
        lineBreak: false,
      });
      x += ws[i];
    });
    doc.y = y + hdrH;
  };

  guard(doc, hdrH * 3, spec.title);
  drawHeaderRow();

  const drawRow = (cells: (string | number)[], idx: number, bold = false, totals = false) => {
    // Calculate dynamic row height based on tallest wrapped cell
    const fontName = bold || totals ? "Helvetica-Bold" : "Helvetica";
    doc.font(fontName).fontSize(8);
    let maxH = hdrH;
    table.columns.forEach((col, i) => {
      const text = String(cells[i] ?? "");
      if (text) {
        const h = doc.heightOfString(text, { width: ws[i] - pad * 2, lineGap: 1 });
        maxH = Math.max(maxH, h + 10);
      }
    });
    const rowH = Math.max(hdrH, Math.ceil(maxH));

    if (doc.y + rowH > BOT) {
      doc.addPage();
      drawSlimHeader(doc, spec.title);
      doc.y = SLIM_Y;
      drawHeaderRow();
    }
    const y = doc.y;
    const bg = totals ? ink.brandDk : idx % 2 === 0 ? ink.white : ink.tint;
    doc.rect(CL, y, CW, rowH).fillAndStroke(bg, ink.border);
    // Column dividers
    let divX = CL;
    doc.strokeColor(...ink.border).lineWidth(0.3);
    ws.slice(0, -1).forEach((w) => {
      divX += w;
      doc.moveTo(divX, y).lineTo(divX, y + rowH).stroke();
    });

    const fg = totals ? (ink.white as RGB) : (ink.dark as RGB);
    let x = CL;
    doc.font(fontName).fontSize(8).fillColor(...fg);
    table.columns.forEach((col, i) => {
      doc.text(truncate(cells[i] ?? ""), x + pad, y + 5, {
        width: ws[i] - pad * 2,
        align: col.align ?? "left",
        lineBreak: true,
        lineGap: 1,
      });
      x += ws[i];
    });
    doc.y = y + rowH;
  };

  if (table.rows.length === 0) {
    const y = doc.y;
    doc.rect(CL, y, CW, hdrH).fillAndStroke(ink.tint, ink.border);
    doc
      .font("Helvetica-Oblique")
      .fontSize(8)
      .fillColor(...ink.muted)
      .text("No records to display.", CL + pad, y + 6, {
        width: CW - pad * 2,
        align: "center",
        lineBreak: false,
      });
    doc.y = y + hdrH;
  } else {
    table.rows.forEach((r, i) => drawRow(r, i));
  }

  if (table.totalsRow) drawRow(table.totalsRow, 0, true, true);
}

// ─── Finalise: add footer to every page ───────────────────────────────────────

function finalise(doc: Doc, spec: ReportSpec) {
  void spec;
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc
      .moveTo(CL, FOOT_Y)
      .lineTo(CR, FOOT_Y)
      .lineWidth(0.5)
      .strokeColor(...ink.border)
      .stroke();
    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor(...ink.muted)
      .text("TELCOVANTAGE PHILIPPINES SERVICES INC.", CL, FOOT_Y + 8, {
        width: CW * 0.5,
        lineBreak: false,
      });
    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor(...ink.muted)
      .text(`Page ${i + 1} of ${range.count}`, CL, FOOT_Y + 8, {
        width: CW,
        align: "right",
        lineBreak: false,
      });
  }
}

// ─── Shared formatters ────────────────────────────────────────────────────────

export function peso(n: number): string {
  return `PHP ${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function filenameDate(d: Date = new Date()): string {
  return d.toISOString().split("T")[0];
}
