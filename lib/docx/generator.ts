import fs from "node:fs";
import path from "node:path";
import PizZip from "pizzip";
import { fetchPoData } from "../pdf/fetchPoData";

function formatCurrency(currency: string, value: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Escape text for safe embedding in XML text nodes */
function escapeXml(str: string): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Replace all occurrences of a placeholder in raw OOXML.
 *
 * Problem: Word often splits a placeholder like {po_number} across multiple
 * <w:r> runs (e.g. "{po_" in run 1, "number}" in run 2) due to spellcheck
 * or autocorrect. We handle this with two passes:
 *
 *   Pass 1 — Naive replace: catches placeholders already in a single run.
 *   Pass 2 — XML-stripped replace: strips all XML tags from the text, finds
 *             the placeholder in the plain-text view, then replaces the
 *             corresponding span of runs in the original XML.
 */
function replacePlaceholders(
  xml: string,
  vars: Record<string, string>,
): string {
  // Pass 1: direct replacement (handles single-run placeholders)
  let result = xml;
  for (const [ph, val] of Object.entries(vars)) {
    result = result.split(ph).join(escapeXml(val));
  }
  return result;
}

/**
 * Collapses placeholders that Word split across <w:r> runs within a <w:p>,
 * then applies replacePlaceholders.  We work paragraph by paragraph so we
 * never accidentally merge runs from different paragraphs.
 */
function applySubstitutions(xml: string, vars: Record<string, string>): string {
  // First try a simple pass — works for most cases where Word didn't split
  let result = replacePlaceholders(xml, vars);

  // Second pass: for any placeholder still present (i.e. split across runs),
  // collapse its runs inside each <w:p> block and retry.
  const remaining = Object.entries(vars).filter(([ph]) => result.includes(ph));
  if (remaining.length === 0) return result;

  result = result.replace(/(<w:p[ >][\s\S]*?<\/w:p>)/g, (para) => {
    // Check if this paragraph even contains part of a remaining placeholder
    const strippedText = para.replace(/<[^>]+>/g, "");
    const hasPhPart = remaining.some(([ph]) => {
      // Check if any contiguous substring of ph appears in the stripped text
      for (let len = 2; len <= ph.length; len++) {
        if (strippedText.includes(ph.slice(0, len))) return true;
      }
      return false;
    });
    if (!hasPhPart) return para;

    // Collect all <w:t> text nodes, build a map of char-index → xml-position
    // so we can splice in the replacement value later.
    interface RunSpan {
      xmlStart: number;
      xmlEnd: number;
      text: string;
    }
    const spans: RunSpan[] = [];
    const wtPattern = /(<w:t[^>]*>)([\s\S]*?)(<\/w:t>)/g;
    let m: RegExpExecArray | null;
    // eslint-disable-next-line no-cond-assign
    while ((m = wtPattern.exec(para)) !== null) {
      spans.push({
        xmlStart: m.index + m[1].length, // start of text content
        xmlEnd: m.index + m[1].length + m[2].length,
        text: m[2],
      });
    }

    if (spans.length === 0) return para;

    const fullText = spans.map((s) => s.text).join("");

    // For each remaining placeholder, check if it appears in fullText
    // (possibly spanning multiple spans).
    let modified = para;
    let offset = 0; // track XML offset changes from prior replacements

    for (const [ph, val] of remaining) {
      const idx = fullText.indexOf(ph);
      if (idx === -1) continue;

      // Map fullText character positions to XML positions
      let charCount = 0;
      let xmlReplaceStart = -1;
      let xmlReplaceEnd = -1;
      const phEnd = idx + ph.length;

      for (const span of spans) {
        const spanStart = charCount;
        const spanEnd = charCount + span.text.length;

        if (xmlReplaceStart === -1 && spanEnd > idx) {
          // Start of replacement: the offset within this span where ph begins
          const innerOffset = idx - spanStart;
          xmlReplaceStart = span.xmlStart + offset + innerOffset;
        }

        if (xmlReplaceEnd === -1 && spanEnd >= phEnd) {
          const innerOffset = phEnd - spanStart;
          xmlReplaceEnd = span.xmlStart + offset + innerOffset;
          break;
        }

        charCount += span.text.length;
      }

      if (xmlReplaceStart === -1 || xmlReplaceEnd === -1) continue;

      const escapedVal = escapeXml(val);
      modified =
        modified.slice(0, xmlReplaceStart) +
        escapedVal +
        modified.slice(xmlReplaceEnd);
      // Adjust offset for subsequent replacements in the same paragraph
      offset += escapedVal.length - (xmlReplaceEnd - xmlReplaceStart);
    }

    return modified;
  });

  return result;
}

/**
 * Replace a {#loopName}...{/loopName} block with one copy of the enclosed
 * table row(s) per item, substituting per-item placeholders.
 *
 * Works entirely at the XML string level — no OOXML model parsing —
 * so the row's formatting (w:trPr, w:tcPr, w:rPr) is preserved exactly.
 */
function replaceLoop<T>(
  xml: string,
  loopName: string,
  items: T[],
  mapFn: (item: T) => Record<string, string>,
): string {
  const openTag = `{#${loopName}}`;
  const closeTag = `{/${loopName}}`;

  const startIdx = xml.indexOf(openTag);
  const endIdx = xml.indexOf(closeTag);
  if (startIdx === -1 || endIdx === -1) return xml;

  // Expand to encompass the full <w:tr> rows that contain the tags
  const TR_OPEN = "<w:tr ";
  const TR_CLOSE = "</w:tr>";

  const rowStartIdx = xml.lastIndexOf(TR_OPEN, startIdx);
  const rowEndIdx = xml.indexOf(TR_CLOSE, endIdx) + TR_CLOSE.length;
  if (rowStartIdx === -1 || rowEndIdx < TR_CLOSE.length) return xml;

  // Template row: strip the loop tags themselves (content formatting stays)
  let templateRow = xml.slice(rowStartIdx, rowEndIdx);
  templateRow = templateRow.split(openTag).join("").split(closeTag).join("");

  const replacementRows = items
    .map((item) => {
      const vars = mapFn(item);
      return applySubstitutions(templateRow, vars);
    })
    .join("");

  return xml.slice(0, rowStartIdx) + replacementRows + xml.slice(rowEndIdx);
}

export async function generatePurchaseOrderDocx(poId: string): Promise<Buffer> {
  const poData = await fetchPoData(poId);
  if (!poData) throw new Error("Purchase order not found");

  const templatePath = path.join(
    process.cwd(),
    "public",
    "templates",
    "PO_TEMPLATE_ORIGINAL.docx",
  );
  if (!fs.existsSync(templatePath)) {
    throw new Error("Template file not found at " + templatePath);
  }

  // ── Load as raw ZIP — never let docxtemplater touch the OOXML ──
  const zip = new PizZip(fs.readFileSync(templatePath));
  let xml = zip.file("word/document.xml")!.asText();

  // ── Scalar substitutions ──
  const vars: Record<string, string> = {
    "{po_number}": poData.po_number,
    "{issued_date}": poData.po_date,
    "{vendor_name}": poData.vendor_name,
    "{vendor_no}": poData.vendor_no,
    "{payment_terms}": poData.payment_terms,
    "{dp_amount}": formatCurrency(poData.currency, poData.downpayment_amount),
    "{contact_person}": poData.vendor_contact,
    "{address}": poData.vendor_address,
    "{tel_no}": poData.vendor_tel,
    "{fax_no}": poData.vendor_fax ?? "N/A",
    "{mobilization_date}": poData.mobilization_date,
    "{delivery_date}": poData.delivery_date,
    "{pr_no}": poData.pr_number,
    "{requisitioner}": poData.requisitioner,
    "{incoterms}": poData.incoterms ?? "N/A",
    "{prepared_date}": poData.date_prepared,
    "{date_prepared}": poData.date_prepared,
    "{project_name}": poData.project_name,
  };
  xml = applySubstitutions(xml, vars);

  // ── Loop: line items ──
  xml = replaceLoop(xml, "line_items", poData.line_items, (item) => ({
    "{line_no}": String(item.line_no),
    "{item_code}": item.item_code ?? "",
    "{description}": item.description,
    "{qty}": formatNumber(item.quantity),
    "{uom}": item.uom,
    "{unit_price}": formatCurrency(poData.currency, item.unit_price),
    "{amount}": formatCurrency(poData.currency, item.amount),
  }));

  // ── Loop: site details ──
  xml = replaceLoop(xml, "site_details", poData.site_details, (site) => ({
    "{sn}": String(site.sn),
    "{region}": site.region,
    "{area_city}": site.area_city,
    "{no_of_nodes}": String(site.no_of_nodes),
    "{estimated_strand_km}": formatNumber(site.estimated_strand_km),
  }));

  // ── Write XML back; all other ZIP entries (styles, fonts, media) untouched ──
  zip.file("word/document.xml", xml);

  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}
