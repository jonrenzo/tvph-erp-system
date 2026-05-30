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
 * Replaces placeholders in-place within the XML, handling cases where Word split
 * the placeholder across multiple <w:r> runs.
 * It puts the replacement text into the first run and blanks out the subsequent runs.
 * This preserves all surrounding XML structure and formatting.
 */
function replaceInPlace(xml: string, vars: Record<string, string>): string {
  // Process paragraph by paragraph
  return xml.replace(/(<w:p[ >][\s\S]*?<\/w:p>)/g, (para) => {
    let modified = para;
    
    for (const [ph, val] of Object.entries(vars)) {
      let searchOffset = 0;
      while (true) {
        const spans: { xmlStart: number; xmlEnd: number; text: string }[] = [];
        const wtPattern = /(<w:t[^>]*>)([\s\S]*?)(<\/w:t>)/g;
        let m: RegExpExecArray | null;
        while ((m = wtPattern.exec(modified)) !== null) {
          spans.push({
            xmlStart: m.index + m[1].length,
            xmlEnd: m.index + m[1].length + m[2].length,
            text: m[2],
          });
        }

        let charCount = 0;
        const spansWithChars: { xmlStart: number; xmlEnd: number; text: string; charStart: number }[] = spans.map(s => {
          const res = { ...s, charStart: charCount };
          charCount += s.text.length;
          return res;
        });

        const fullText = spansWithChars.map((s) => s.text).join("");
        const idx = fullText.indexOf(ph, searchOffset);
        
        if (idx === -1) break;

        const phEnd = idx + ph.length;
        const affectedSpans: typeof spansWithChars = [];

        for (const span of spansWithChars) {
          const spanStart = span.charStart;
          const spanEnd = span.charStart + span.text.length;

          if (spanEnd > idx && spanStart < phEnd) {
             affectedSpans.push(span);
          }
        }

        if (affectedSpans.length === 0) break;

        // If replacing with the same value and it's already collapsed into one span, just skip to next
        if (affectedSpans.length === 1 && val === ph) {
           searchOffset = idx + ph.length;
           continue;
        }

        const escapedVal = escapeXml(val);
        const combinedText = affectedSpans.map(s => s.text).join("");
        
        const localIdx = idx - affectedSpans[0].charStart;
        
        const newCombinedText = combinedText.substring(0, localIdx) + escapedVal + combinedText.substring(localIdx + ph.length);
        
        let newXml = modified;
        for (let i = affectedSpans.length - 1; i >= 0; i--) {
           const span = affectedSpans[i];
           const replacement = i === 0 ? newCombinedText : "";
           newXml = newXml.slice(0, span.xmlStart) + replacement + newXml.slice(span.xmlEnd);
        }
        
        modified = newXml;
        searchOffset = 0; // reset after modification
      }
    }
    return modified;
  });
}

/**
 * Expand a loop by duplicating the row, substituting values, and preserving formatting.
 */
function expandLoop<T>(
  xml: string,
  loopName: string,
  items: T[],
  mapFn: (item: T) => Record<string, string>,
): string {
  const openTag = `{#${loopName}}`;
  const closeTag = `{/${loopName}}`;

  let processedXml = replaceInPlace(xml, {
     [openTag]: openTag,
     [closeTag]: closeTag
  });

  const startIdx = processedXml.indexOf(openTag);
  const endIdx = processedXml.indexOf(closeTag);
  if (startIdx === -1 || endIdx === -1) return processedXml;

  const TR_OPEN = "<w:tr ";
  const TR_CLOSE = "</w:tr>";

  const rowStartIdx = processedXml.lastIndexOf(TR_OPEN, startIdx);
  let rowEndIdx = processedXml.indexOf(TR_CLOSE, endIdx);
  if (rowEndIdx !== -1) rowEndIdx += TR_CLOSE.length;
  else return processedXml;

  if (rowStartIdx === -1 || rowEndIdx < TR_CLOSE.length) return processedXml;

  let templateRow = processedXml.slice(rowStartIdx, rowEndIdx);
  templateRow = replaceInPlace(templateRow, {
     [openTag]: "",
     [closeTag]: ""
  });

  const replacementRows = items
    .map((item) => replaceInPlace(templateRow, mapFn(item)))
    .join("");

  return processedXml.slice(0, rowStartIdx) + replacementRows + processedXml.slice(rowEndIdx);
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

  const zip = new PizZip(fs.readFileSync(templatePath));
  let xml = zip.file("word/document.xml")!.asText();

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
  xml = replaceInPlace(xml, vars);

  xml = expandLoop(xml, "line_items", poData.line_items, (item) => ({
    "{line_no}": String(item.line_no),
    "{item_code}": item.item_code ?? "",
    "{description}": item.description,
    "{qty}": formatNumber(item.quantity),
    "{uom}": item.uom,
    "{unit_price}": formatCurrency(poData.currency, item.unit_price),
    "{amount}": formatCurrency(poData.currency, item.amount),
  }));

  xml = expandLoop(xml, "site_details", poData.site_details, (site) => ({
    "{sn}": String(site.sn),
    "{region}": site.region,
    "{area_city}": site.area_city,
    "{no_of_nodes}": String(site.no_of_nodes),
    "{estimated_strand_km}": formatNumber(site.estimated_strand_km),
  }));

  zip.file("word/document.xml", xml);

  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}
