import type PDFDocument from 'pdfkit'
import type { PoData, PageContext } from './types'
import {
  MARGIN_LEFT, MARGIN_RIGHT, MARGIN_TOP, CONTENT_WIDTH, PAGE_WIDTH, LOGO_WIDTH, LOGO_PATH,
  FONT_SIZE_SMALL, FONT_SIZE_NORMAL, FONT_SIZE_MEDIUM, FONT_SIZE_LARGE,
  LINE_HEIGHT_NORMAL, LINE_HEIGHT_MEDIUM, COLOR_TEXT, COLOR_BORDER, COLOR_LIGHT_GRAY,
  COL_WIDTHS_LINE_ITEMS,
} from './constants'

function fmt(n: number): string {
  return n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function drawHeader(doc: typeof PDFDocument.prototype, poData: PoData, context: PageContext) {
  const leftX = MARGIN_LEFT
  const rightEdge = PAGE_WIDTH - MARGIN_RIGHT

  // ── Band 1: Logo + Company Info (left) | PO Box (right) ──
  const band1Top = MARGIN_TOP
  const band1Height = 70

  try {
    doc.image(LOGO_PATH, leftX, band1Top, { width: LOGO_WIDTH })
  } catch {
    // logo missing — continue without it
  }

  const textLeft = leftX + LOGO_WIDTH + 8
  doc.font('Helvetica-Bold').fontSize(FONT_SIZE_LARGE)
  doc.fillColor(...COLOR_TEXT)
  doc.text('TELCOVANTAGE PHILIPPINES SERVICES INC.', textLeft, band1Top + 2, {
    width: CONTENT_WIDTH - LOGO_WIDTH - 140,
  })

  doc.font('Helvetica').fontSize(FONT_SIZE_SMALL)
  doc.text('Unit 1811, North Tower, Park Triangle Corporate Plaza', textLeft, band1Top + 16, {
    width: CONTENT_WIDTH - LOGO_WIDTH - 140,
  })
  doc.text('32nd Street corner 11th Avenue, BGC, Taguig City', textLeft, band1Top + 26, {
    width: CONTENT_WIDTH - LOGO_WIDTH - 140,
  })
  doc.text('Tel. No.: 0961-4734695', textLeft, band1Top + 36, {
    width: CONTENT_WIDTH - LOGO_WIDTH - 140,
  })

  // PO Box (right side)
  const boxX = rightEdge - 170
  const boxW = 170
  doc.rect(boxX, band1Top, boxW, band1Height).strokeColor(...COLOR_BORDER).lineWidth(0.5).stroke()

  const rowH = band1Height / 3
  const cellPad = 4

  // Row 0: "PURCHASE ORDER" header
  doc.rect(boxX, band1Top, boxW, rowH).fillAndStroke(...COLOR_LIGHT_GRAY, ...COLOR_BORDER)
  doc.fillColor(...COLOR_TEXT).font('Helvetica-Bold').fontSize(FONT_SIZE_NORMAL)
  doc.text('PURCHASE ORDER', boxX, band1Top + 3, {
    width: boxW, align: 'center', lineBreak: false,
  })

  // Row 1: PO No.
  const row1Y = band1Top + rowH
  doc.rect(boxX, row1Y, boxW, rowH).strokeColor(...COLOR_BORDER).lineWidth(0.5).stroke()
  doc.rect(boxX, row1Y, boxW / 3, rowH).strokeColor(...COLOR_BORDER).lineWidth(0.5).stroke()
  doc.font('Helvetica-Bold').fontSize(FONT_SIZE_SMALL)
  doc.text('PO No.:', boxX + cellPad, row1Y + 4, { width: boxW / 3 - cellPad * 2, lineBreak: false })
  doc.font('Helvetica').fontSize(FONT_SIZE_SMALL)
  doc.text(poData.po_number, boxX + boxW / 3 + cellPad, row1Y + 4, {
    width: (boxW * 2) / 3 - cellPad * 2,
  })

  // Row 2: Date
  const row2Y = row1Y + rowH
  doc.rect(boxX, row2Y, boxW, rowH).strokeColor(...COLOR_BORDER).lineWidth(0.5).stroke()
  doc.rect(boxX, row2Y, boxW / 3, rowH).strokeColor(...COLOR_BORDER).lineWidth(0.5).stroke()
  doc.font('Helvetica-Bold').fontSize(FONT_SIZE_SMALL)
  doc.text('Date:', boxX + cellPad, row2Y + 4, { width: boxW / 3 - cellPad * 2, lineBreak: false })
  doc.font('Helvetica').fontSize(FONT_SIZE_SMALL)
  doc.text(poData.po_date, boxX + boxW / 3 + cellPad, row2Y + 4, {
    width: (boxW * 2) / 3 - cellPad * 2,
  })

  // ── Band 2: Vendor strip ──
  const band2Top = band1Top + band1Height + 4
  const band2H = 48
  doc.rect(leftX, band2Top, CONTENT_WIDTH, band2H).strokeColor(...COLOR_BORDER).lineWidth(0.5).stroke()

  const colMidX = leftX + CONTENT_WIDTH * 0.55
  const rightColX = colMidX + 6
  const rowLabelW = 80

  const drawVendorField = (yOff: number, label: string, value: string, isLast = false) => {
    if (isLast && !value) return
    doc.font('Helvetica-Bold').fontSize(FONT_SIZE_SMALL)
    doc.fillColor(...COLOR_TEXT)
    doc.text(label + ':', leftX + 4, band2Top + yOff, { width: rowLabelW, lineBreak: false })
    doc.font('Helvetica').fontSize(FONT_SIZE_SMALL)
    doc.text(value, leftX + rowLabelW + 4, band2Top + yOff, { width: colMidX - leftX - rowLabelW - 10 })
  }

  const drawRightField = (yOff: number, label: string, value: string) => {
    doc.font('Helvetica-Bold').fontSize(FONT_SIZE_SMALL)
    doc.fillColor(...COLOR_TEXT)
    doc.text(label + ':', rightColX, band2Top + yOff, { width: rowLabelW, lineBreak: false })
    doc.font('Helvetica').fontSize(FONT_SIZE_SMALL)
    doc.text(value, rightColX + rowLabelW, band2Top + yOff, { width: rightEdge - rightColX - rowLabelW - 4 })
  }

  drawVendorField(2, 'VENDOR', poData.vendor_name)
  drawVendorField(14, 'CONTACT', poData.vendor_contact)
  drawVendorField(26, 'ADDRESS', poData.vendor_address)

  drawRightField(2, 'VENDOR NO.', poData.vendor_no)
  drawRightField(14, 'PAYMENT TERMS', 'Refer to the PO notes below.')
  drawRightField(26, 'DOWNPAYMENT AMT.', `PHP ${fmt(poData.downpayment_amount)}`)
  drawRightField(38, 'TEL. NO.', poData.vendor_tel)
  drawRightField(38, 'FAX NO.', poData.vendor_fax || '-')

  // ── Band 3: Column headers or section label ──
  const band3Top = band2Top + band2H + 1
  const band3H = 18

  if (context === 'line_items') {
    const headers = ['LINE NO.', 'ITEM CODE', 'DESCRIPTION', 'QUANTITY', 'UoM', 'UNIT PRICE', 'AMOUNT']
    doc.rect(leftX, band3Top, CONTENT_WIDTH, band3H).fillAndStroke(...COLOR_LIGHT_GRAY, ...COLOR_BORDER)

    let cx = leftX
    doc.font('Helvetica-Bold').fontSize(FONT_SIZE_SMALL)
    headers.forEach((h, i) => {
      const align = i >= 3 ? 'center' : 'left'
      doc.fillColor(...COLOR_TEXT).text(h, cx + 2, band3Top + 4, {
        width: COL_WIDTHS_LINE_ITEMS[i] - 4, align,
      })
      cx += COL_WIDTHS_LINE_ITEMS[i]
    })
  } else if (context === 'terms') {
    doc.rect(leftX, band3Top, CONTENT_WIDTH, band3H).fillAndStroke(...COLOR_LIGHT_GRAY, ...COLOR_BORDER)
    doc.fillColor(...COLOR_TEXT).font('Helvetica-Bold').fontSize(FONT_SIZE_NORMAL)
    doc.text('TERMS AND CONDITIONS', leftX + 4, band3Top + 4, { width: CONTENT_WIDTH - 8 })
  }
}
