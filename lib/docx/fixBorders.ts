import PizZip from "pizzip";

const NONE_BORDERS =
  '<w:tblBorders>' +
  '<w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/>' +
  '<w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/>' +
  '<w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/>' +
  '<w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/>' +
  '<w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/>' +
  '<w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/>' +
  '</w:tblBorders>';

/**
 * Post-process a DOCX buffer saved by the Eigenpal editor to fix table borders.
 *
 * The editor resolves the `TableGrid` style (which defines `single` borders)
 * and bakes those borders into every table that uses that style — even when
 * the document had explicit `none` overrides.
 *
 * This function ONLY strips borders from tables that use the `TableGrid` style
 * (layout tables). Data tables that intentionally have borders are left alone.
 *
 * It also patches the `TableGrid` style definition in styles.xml so its own
 * border definition is `none`.
 */
export function fixDocxBorders(buf: Buffer): Buffer {
  const zip = new PizZip(buf);

  // --- Fix document.xml: only strip borders from TableGrid-styled tables ---
  const docEntry = zip.file("word/document.xml");
  if (docEntry) {
    let xml = docEntry.asText();

    // Process each table individually
    xml = xml.replace(/<w:tbl>[\s\S]*?<\/w:tbl>/g, (table) => {
      const hasTableGrid = table.includes('<w:tblStyle w:val="TableGrid"/>');
      if (hasTableGrid) {
        // Layout table — force borders to none
        return table.replace(
          /<w:tblBorders>[\s\S]*?<\/w:tblBorders>/,
          NONE_BORDERS,
        );
      }
      // Data table — leave borders intact
      return table;
    });

    zip.file("word/document.xml", xml);
  }

  // --- Fix styles.xml: neuter the TableGrid style's border definition ---
  const stylesEntry = zip.file("word/styles.xml");
  if (stylesEntry) {
    let stylesXml = stylesEntry.asText();
    stylesXml = stylesXml.replace(
      /(<w:style[^>]*w:styleId="TableGrid"[^>]*>[\s\S]*?)<w:tblBorders>[\s\S]*?<\/w:tblBorders>/,
      "$1" + NONE_BORDERS,
    );
    zip.file("word/styles.xml", stylesXml);
  }

  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}
