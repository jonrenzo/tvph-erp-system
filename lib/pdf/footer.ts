import type PDFDocument from 'pdfkit'
import type { PoData } from './types'
import {
  MARGIN_LEFT, MARGIN_RIGHT, PAGE_WIDTH, PAGE_HEIGHT, MARGIN_BOTTOM, CONTENT_WIDTH,
  FONT_SIZE_SMALL, FONT_SIZE_NORMAL,
  LINE_HEIGHT_SMALL, LINE_HEIGHT_NORMAL,
  COLOR_TEXT, COLOR_BORDER, COLOR_LIGHT_GRAY, COLOR_WHITE, COLOR_PRIMARY,
} from './constants'

export function drawFooter(doc: typeof PDFDocument.prototype, poData: PoData) {
  const leftX = MARGIN_LEFT
  const rightEdge = PAGE_WIDTH - MARGIN_RIGHT
  const footerTop = 766
  const rowH = 18
  const cellPad = 4

  // ── Row 1: Delivery Address ──
  const r1y = footerTop
  doc.rect(leftX, r1y, CONTENT_WIDTH, rowH + 4).strokeColor(...COLOR_BORDER).lineWidth(0.5).stroke()
  doc.font('Helvetica-Bold').fontSize(FONT_SIZE_SMALL)
  doc.fillColor(...COLOR_TEXT)
  const addrText = `DELIVERY ADDRESS: ${poData.delivery_address_note}`
  doc.text(addrText, leftX + cellPad, r1y + 3, {
    width: CONTENT_WIDTH - cellPad * 2,
  })

  // ── Row 2: Incoterms | Date Prepared | Approved By ──
  const r2y = r1y + rowH + 4
  const w1 = CONTENT_WIDTH * 0.22
  const w2 = CONTENT_WIDTH * 0.28
  const w3 = CONTENT_WIDTH * 0.5

  doc.rect(leftX, r2y, w1, rowH + 8).strokeColor(...COLOR_BORDER).lineWidth(0.5).stroke()
  doc.rect(leftX + w1, r2y, w2, rowH + 8).strokeColor(...COLOR_BORDER).lineWidth(0.5).stroke()
  doc.rect(leftX + w1 + w2, r2y, w3, rowH + 8).strokeColor(...COLOR_BORDER).lineWidth(0.5).stroke()

  doc.font('Helvetica-Bold').fontSize(FONT_SIZE_SMALL)
  doc.fillColor(...COLOR_TEXT)
  doc.text('INCOTERMS:', leftX + cellPad, r2y + 3, { width: w1 - cellPad * 2, lineBreak: false })
  doc.font('Helvetica').fontSize(FONT_SIZE_SMALL)
  doc.text(poData.incoterms || '-', leftX + cellPad, r2y + LINE_HEIGHT_SMALL + 3, { width: w1 - cellPad * 2 })

  doc.font('Helvetica-Bold').fontSize(FONT_SIZE_SMALL)
  doc.text('DATE PREPARED:', leftX + w1 + cellPad, r2y + 3, { width: w2 - cellPad * 2, lineBreak: false })
  doc.font('Helvetica').fontSize(FONT_SIZE_SMALL)
  doc.text(poData.date_prepared, leftX + w1 + cellPad, r2y + LINE_HEIGHT_SMALL + 3, { width: w2 - cellPad * 2 })

  doc.font('Helvetica-Bold').fontSize(FONT_SIZE_SMALL)
  doc.text('APPROVED BY:', leftX + w1 + w2 + cellPad, r2y + 2, { width: w3 - cellPad * 2, lineBreak: false })
  doc.font('Helvetica').fontSize(FONT_SIZE_SMALL)
  let ay = r2y + LINE_HEIGHT_SMALL
  poData.approved_by.forEach((name) => {
    doc.text(name, leftX + w1 + w2 + cellPad, ay, { width: w3 - cellPad * 2 })
    ay += LINE_HEIGHT_SMALL
  })

  // ── Row 3: IMPORTANT!!! Banner ──
  const r3y = r2y + rowH + 8
  const bannerH = 16
  doc.rect(leftX, r3y, 100, bannerH).fillAndStroke(COLOR_PRIMARY, COLOR_PRIMARY)
  doc.fillColor(...COLOR_WHITE).font('Helvetica-Bold').fontSize(FONT_SIZE_SMALL)
  doc.text('IMPORTANT !!!', leftX + 4, r3y + 4, { width: 92, align: 'center' })

  const remainingW = rightEdge - (leftX + 100)
  doc.rect(leftX + 100, r3y, remainingW, bannerH).strokeColor(...COLOR_BORDER).lineWidth(0.5).stroke()
  doc.fillColor(...COLOR_TEXT).font('Helvetica-Bold').fontSize(FONT_SIZE_SMALL)
  doc.text(
    'NOTE: THIS IS AN ELECTRONICALLY APPROVED PURCHASE ORDER.',
    leftX + 100 + cellPad,
    r3y + 4,
    { width: remainingW - cellPad * 2 },
  )

  // ── Page number (optional — centered at very bottom) ──
  doc.font('Helvetica').fontSize(6).fillColor(...COLOR_TEXT)
  const pageText = `Page ${doc.bufferedPageRange()?.count || doc.page?.pageNumber || 1}`
  doc.text(pageText, MARGIN_LEFT, PAGE_HEIGHT - MARGIN_BOTTOM + 8, {
    width: CONTENT_WIDTH,
    align: 'center',
  })
}
