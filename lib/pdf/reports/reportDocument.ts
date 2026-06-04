// Generic A4 report PDF builder shared by every report route under
// app/api/reports/*. Reuses the brand constants from lib/pdf/constants.ts and the
// same buffer-collection pattern as lib/pdf/generator.ts, but is decoupled from the
// PO-specific header/footer so each report just describes its content as a ReportSpec.

import PDFDocument from "pdfkit";
import { PassThrough } from "stream";
import {
  PAGE_WIDTH,
  PAGE_HEIGHT,
  MARGIN_LEFT,
  MARGIN_RIGHT,
  COLOR_PRIMARY,
  COLOR_TEXT,
  COLOR_BORDER,
  COLOR_LIGHT_GRAY,
  COLOR_WHITE,
  LOGO_PATH,
} from "../constants";

const CONTENT_LEFT = MARGIN_LEFT;
const CONTENT_RIGHT = PAGE_WIDTH - MARGIN_RIGHT;
const CONTENT_WIDTH = CONTENT_RIGHT - CONTENT_LEFT;
const PAGE_TOP = 40;
const PAGE_BOTTOM = PAGE_HEIGHT - 50;

export interface ReportColumn {
  header: string;
  /** Relative weight; widths are normalised to CONTENT_WIDTH. */
  width: number;
  align?: "left" | "right" | "center";
}

export interface ReportTable {
  columns: ReportColumn[];
  rows: (string | number)[][];
  totalsRow?: (string | number)[];
}

export interface ReportKpi {
  label: string;
  value: string;
}

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
      margins: { top: PAGE_TOP, bottom: PAGE_HEIGHT - PAGE_BOTTOM, left: MARGIN_LEFT, right: MARGIN_RIGHT },
      bufferPages: true,
    });

    const buffers: Buffer[] = [];
    const stream = doc.pipe(new PassThrough());
    stream.on("data", (chunk: Buffer) => buffers.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(buffers)));
    stream.on("error", reject);

    drawBrandHeader(doc, spec);

    if (spec.kpis?.length) drawKpiGrid(doc, spec.kpis);

    for (const section of spec.sections ?? []) {
      drawSection(doc, section);
    }

    addPageNumbers(doc);
    doc.end();
  });
}

// ── Layout helpers ──────────────────────────────────────────────────────────

function ensureSpace(doc: Doc, needed: number) {
  if (doc.y + needed > PAGE_BOTTOM) {
    doc.addPage();
    doc.y = PAGE_TOP;
  }
}

function drawBrandHeader(doc: Doc, spec: ReportSpec) {
  const top = PAGE_TOP;
  try {
    doc.image(LOGO_PATH, CONTENT_LEFT, top, { width: 38 });
  } catch {
    // logo missing — continue without it
  }

  const textLeft = CONTENT_LEFT + 48;
  doc
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor(...COLOR_PRIMARY)
    .text("TELCOVANTAGE PHILIPPINES", textLeft, top + 2);
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(...COLOR_TEXT)
    .text("Services Inc. · BGC, Taguig City", textLeft, top + 19);

  // Report title block (right aligned)
  doc
    .font("Helvetica-Bold")
    .fontSize(15)
    .fillColor(...COLOR_TEXT)
    .text(spec.title, CONTENT_LEFT, top + 44, { width: CONTENT_WIDTH, align: "left" });
  if (spec.subtitle) {
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(...COLOR_TEXT)
      .text(spec.subtitle, CONTENT_LEFT, doc.y + 2, { width: CONTENT_WIDTH });
  }
  doc
    .font("Helvetica")
    .fontSize(7.5)
    .fillColor(...COLOR_BORDER)
    .text(
      `Generated ${spec.generatedAt.toLocaleString("en-PH")}`,
      CONTENT_LEFT,
      doc.y + 2,
      { width: CONTENT_WIDTH },
    );

  // Divider
  const dy = doc.y + 6;
  doc
    .moveTo(CONTENT_LEFT, dy)
    .lineTo(CONTENT_RIGHT, dy)
    .lineWidth(1)
    .strokeColor(...COLOR_PRIMARY)
    .stroke();
  doc.y = dy + 12;
}

function drawKpiGrid(doc: Doc, kpis: ReportKpi[]) {
  const perRow = 3;
  const gap = 8;
  const cardW = (CONTENT_WIDTH - gap * (perRow - 1)) / perRow;
  const cardH = 46;

  kpis.forEach((kpi, i) => {
    const col = i % perRow;
    if (col === 0) {
      ensureSpace(doc, cardH + gap);
      if (i > 0) doc.y += gap;
    }
    const x = CONTENT_LEFT + col * (cardW + gap);
    const y = doc.y;

    doc
      .rect(x, y, cardW, cardH)
      .fillAndStroke(COLOR_LIGHT_GRAY, COLOR_BORDER);
    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor(...COLOR_TEXT)
      .text(kpi.label.toUpperCase(), x + 8, y + 8, { width: cardW - 16 });
    doc
      .font("Helvetica-Bold")
      .fontSize(14)
      .fillColor(...COLOR_PRIMARY)
      .text(kpi.value, x + 8, y + 22, { width: cardW - 16, lineBreak: false });

    // advance doc.y only at the end of a row
    if (col === perRow - 1 || i === kpis.length - 1) doc.y = y + cardH;
  });
  doc.y += 14;
}

function drawSection(doc: Doc, section: ReportSection) {
  if (section.heading) {
    ensureSpace(doc, 24);
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor(...COLOR_TEXT)
      .text(section.heading, CONTENT_LEFT, doc.y, { width: CONTENT_WIDTH });
    doc.y += 4;
  }

  for (const para of section.paragraphs ?? []) {
    ensureSpace(doc, 20);
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(...COLOR_TEXT)
      .text(para, CONTENT_LEFT, doc.y, { width: CONTENT_WIDTH });
    doc.y += 4;
  }

  if (section.table) drawTable(doc, section.table);
  doc.y += 12;
}

function drawTable(doc: Doc, table: ReportTable) {
  const totalWeight = table.columns.reduce((s, c) => s + c.width, 0);
  const widths = table.columns.map((c) => (c.width / totalWeight) * CONTENT_WIDTH);
  const rowH = 18;
  const cellPad = 4;

  const drawHeaderRow = () => {
    const y = doc.y;
    doc.rect(CONTENT_LEFT, y, CONTENT_WIDTH, rowH).fillAndStroke(COLOR_PRIMARY, COLOR_PRIMARY);
    let x = CONTENT_LEFT;
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(...COLOR_WHITE);
    table.columns.forEach((col, i) => {
      doc.text(col.header.toUpperCase(), x + cellPad, y + 5, {
        width: widths[i] - cellPad * 2,
        align: col.align ?? "left",
        lineBreak: false,
      });
      x += widths[i];
    });
    doc.y = y + rowH;
  };

  ensureSpace(doc, rowH * 2);
  drawHeaderRow();

  const drawRow = (cells: (string | number)[], bold = false) => {
    if (doc.y + rowH > PAGE_BOTTOM) {
      doc.addPage();
      doc.y = PAGE_TOP;
      drawHeaderRow();
    }
    const y = doc.y;
    doc.rect(CONTENT_LEFT, y, CONTENT_WIDTH, rowH).strokeColor(...COLOR_BORDER).lineWidth(0.5).stroke();
    let x = CONTENT_LEFT;
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8).fillColor(...COLOR_TEXT);
    table.columns.forEach((col, i) => {
      doc.text(String(cells[i] ?? ""), x + cellPad, y + 5, {
        width: widths[i] - cellPad * 2,
        align: col.align ?? "left",
        lineBreak: false,
      });
      x += widths[i];
    });
    doc.y = y + rowH;
  };

  if (table.rows.length === 0) {
    const y = doc.y;
    doc.rect(CONTENT_LEFT, y, CONTENT_WIDTH, rowH).strokeColor(...COLOR_BORDER).lineWidth(0.5).stroke();
    doc.font("Helvetica-Oblique").fontSize(8).fillColor(...COLOR_BORDER);
    doc.text("No records to display.", CONTENT_LEFT + cellPad, y + 5, {
      width: CONTENT_WIDTH - cellPad * 2,
      align: "center",
      lineBreak: false,
    });
    doc.y = y + rowH;
  } else {
    table.rows.forEach((r) => drawRow(r));
  }

  if (table.totalsRow) drawRow(table.totalsRow, true);
}

function addPageNumbers(doc: Doc) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor(...COLOR_BORDER)
      .text(
        `Page ${i + 1} of ${range.count}`,
        MARGIN_LEFT,
        PAGE_HEIGHT - 38,
        { width: CONTENT_WIDTH, align: "center", lineBreak: false },
      );
  }
}

// ── Shared formatters for report routes ──────────────────────────────────────

export function peso(n: number): string {
  return `PHP ${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function filenameDate(d: Date = new Date()): string {
  return d.toISOString().split("T")[0];
}
