import type PDFDocument from 'pdfkit'
import type { PoData } from '../types'
import {
  MARGIN_LEFT, CONTENT_WIDTH, CONTENT_BOTTOM,
  COL_WIDTHS_SITES, FONT_SIZE_SMALL, FONT_SIZE_NORMAL,
  LINE_HEIGHT_NORMAL, COLOR_TEXT, COLOR_BORDER, COLOR_LIGHT_GRAY,
} from '../constants'

function fmtKms(n: number): string {
  return n.toFixed(2)
}

export function drawSiteDetailsSection(doc: typeof PDFDocument.prototype, poData: PoData) {
  const leftX = MARGIN_LEFT
  const colWidths = COL_WIDTHS_SITES
  const rowH = 16

  // Section label
  if (doc.y + 20 > CONTENT_BOTTOM) {
    doc.addPage()
  }
  doc.font('Helvetica-Bold').fontSize(FONT_SIZE_NORMAL).fillColor(...COLOR_TEXT)
  doc.text('B. List of Sites and Details', leftX + 4, doc.y, { width: CONTENT_WIDTH - 8 })
  doc.y += 4

  // Column headers
  const headers = ['S/N', 'REGION', 'AREA/CITY', 'NO OF NODES', 'EST. STRAND\nCABLE LENGTH (KM)']
  const hdrY = doc.y
  doc.rect(leftX, hdrY, CONTENT_WIDTH, rowH + 4).fillAndStroke(...COLOR_LIGHT_GRAY, ...COLOR_BORDER)
  doc.font('Helvetica-Bold').fontSize(FONT_SIZE_SMALL).fillColor(...COLOR_TEXT)
  let cx = leftX
  headers.forEach((h, i) => {
    const align = i >= 3 ? 'center' : 'left'
    doc.text(h, cx + 2, hdrY + 3, { width: colWidths[i] - 4, align })
    cx += colWidths[i]
  })
  doc.y = hdrY + rowH + 4

  // Data rows
  let totalNodes = 0
  let totalKms = 0

  poData.site_details.forEach((site) => {
    if (doc.y + rowH > CONTENT_BOTTOM) {
      doc.addPage()
    }

    totalNodes += site.no_of_nodes
    totalKms += site.estimated_strand_km

    const rowY = doc.y
    cx = leftX
    colWidths.forEach((w) => {
      doc.rect(cx, rowY, w, rowH).strokeColor(...COLOR_BORDER).lineWidth(0.5).stroke()
      cx += w
    })

    doc.font('Helvetica').fontSize(FONT_SIZE_SMALL).fillColor(...COLOR_TEXT)
    doc.text(String(site.sn), leftX + 2, rowY + 3, { width: colWidths[0] - 4, align: 'center' })
    doc.text(site.region, leftX + colWidths[0] + 2, rowY + 3, { width: colWidths[1] - 4 })
    doc.text(site.area_city, leftX + colWidths[0] + colWidths[1] + 2, rowY + 3, { width: colWidths[2] - 4 })
    doc.text(String(site.no_of_nodes), leftX + colWidths[0] + colWidths[1] + colWidths[2] + 2, rowY + 3, {
      width: colWidths[3] - 4, align: 'center',
    })
    doc.text(fmtKms(site.estimated_strand_km), leftX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 2, rowY + 3, {
      width: colWidths[4] - 4, align: 'center',
    })

    doc.y = rowY + rowH
  })

  // Totals row
  if (poData.site_details.length > 0) {
    if (doc.y + rowH > CONTENT_BOTTOM) {
      doc.addPage()
    }

    const totalY = doc.y
    cx = leftX
    colWidths.forEach((w) => {
      doc.rect(cx, totalY, w, rowH).lineWidth(0.5).stroke()
      cx += w
    })

    doc.font('Helvetica-Bold').fontSize(FONT_SIZE_SMALL).fillColor(...COLOR_TEXT)
    const totalRegionW = colWidths[0] + colWidths[1] + colWidths[2] - 2
    doc.text('TOTAL', leftX + 2, totalY + 3, { width: totalRegionW, align: 'center' })
    doc.text(String(totalNodes), leftX + colWidths[0] + colWidths[1] + colWidths[2] + 2, totalY + 3, {
      width: colWidths[3] - 4, align: 'center',
    })
    doc.text(fmtKms(totalKms), leftX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 2, totalY + 3, {
      width: colWidths[4] - 4, align: 'center',
    })

    doc.y = totalY + rowH
  }
}
