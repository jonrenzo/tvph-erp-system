import type PDFDocument from 'pdfkit'
import type { PoData } from '../types'
import {
  MARGIN_LEFT, CONTENT_WIDTH, CONTENT_BOTTOM,
  COL_WIDTHS_LINE_ITEMS, FONT_SIZE_SMALL, FONT_SIZE_NORMAL,
  LINE_HEIGHT_NORMAL, LINE_HEIGHT_SMALL,
  COLOR_TEXT, COLOR_BORDER, COLOR_LIGHT_GRAY,
} from '../constants'

function fmt(n: number): string {
  return n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function drawLineItemsSection(doc: typeof PDFDocument.prototype, poData: PoData) {
  const leftX = MARGIN_LEFT
  const colWidths = COL_WIDTHS_LINE_ITEMS

  poData.line_items.forEach((item, idx) => {
    // Calculate row height
    const descLines = estimateDescriptionLines(item.description, colWidths[2])
    const subFields = poData.mobilization_date || poData.delivery_date || poData.pr_number || poData.requisitioner ? 4 : 0
    const itemHeight = Math.max(descLines * LINE_HEIGHT_NORMAL + subFields * LINE_HEIGHT_SMALL + 6, 60)
    const rowH = itemHeight
    const isLast = idx === poData.line_items.length - 1

    // Overflow check
    if (doc.y + rowH > CONTENT_BOTTOM) {
      doc.addPage()
    }

    const rowY = doc.y

    // Draw cell borders
    let cx = leftX
    colWidths.forEach((w) => {
      doc.rect(cx, rowY, w, rowH).strokeColor(...COLOR_BORDER).lineWidth(0.5).stroke()
      cx += w
    })

    // LINE NO
    doc.font('Helvetica').fontSize(FONT_SIZE_SMALL).fillColor(...COLOR_TEXT)
    doc.text(item.line_no, leftX + 2, rowY + 4, { width: colWidths[0] - 4, align: 'left' })

    // ITEM CODE
    doc.text(item.item_code || '', leftX + colWidths[0] + 2, rowY + 4, { width: colWidths[1] - 4 })

    // DESCRIPTION — with sub-fields
    const descX = leftX + colWidths[0] + colWidths[1]
    let dy = rowY + 4

    const descParts = item.description.split('\n')
    descParts.forEach((line, li) => {
      const isFirstLine = li === 0 && descParts.length > 1
      doc.font(isFirstLine ? 'Helvetica-Bold' : 'Helvetica').fontSize(FONT_SIZE_SMALL)
      doc.text(line, descX + 2, dy, { width: colWidths[2] - 4 })
      dy += LINE_HEIGHT_NORMAL
    })
    if (descParts.length === 1) {
      doc.font('Helvetica').fontSize(FONT_SIZE_SMALL)
      doc.text(item.description, descX + 2, dy, { width: colWidths[2] - 4 })
    }

    // Sub-fields (only on last item)
    if (isLast) {
      dy = rowY + descLines * LINE_HEIGHT_NORMAL + 4
      if (poData.mobilization_date) {
        doc.font('Helvetica-Bold').fontSize(FONT_SIZE_SMALL)
        doc.text(`Mobilization Date:`, descX + 2, dy, { width: colWidths[2] - 4, continued: true })
        doc.font('Helvetica')
        doc.text(` ${poData.mobilization_date}`)
        dy += LINE_HEIGHT_SMALL
      }
      if (poData.delivery_date) {
        doc.font('Helvetica-Bold').fontSize(FONT_SIZE_SMALL)
        doc.text(`Delivery Date:`, descX + 2, dy, { width: colWidths[2] - 4, continued: true })
        doc.font('Helvetica')
        doc.text(` ${poData.delivery_date}`)
        dy += LINE_HEIGHT_SMALL
      }
      if (poData.pr_number) {
        doc.font('Helvetica-Bold').fontSize(FONT_SIZE_SMALL)
        doc.text(`PR No.:`, descX + 2, dy, { width: colWidths[2] - 4, continued: true })
        doc.font('Helvetica')
        doc.text(` ${poData.pr_number}`)
        dy += LINE_HEIGHT_SMALL
      }
      if (poData.requisitioner) {
        doc.font('Helvetica-Bold').fontSize(FONT_SIZE_SMALL)
        doc.text(`Requisitioner:`, descX + 2, dy, { width: colWidths[2] - 4, continued: true })
        doc.font('Helvetica')
        doc.text(` ${poData.requisitioner}`)
      }
    }

    // QUANTITY
    const qtyX = leftX + colWidths[0] + colWidths[1] + colWidths[2]
    doc.font('Helvetica').fontSize(FONT_SIZE_SMALL).fillColor(...COLOR_TEXT)
    doc.text(item.quantity.toString(), qtyX, rowY + 4, { width: colWidths[3] - 4, align: 'center' })

    // UoM
    const uomX = qtyX + colWidths[3]
    doc.text(item.uom, uomX, rowY + 4, { width: colWidths[4] - 4, align: 'center' })

    // UNIT PRICE
    const priceX = uomX + colWidths[4]
    doc.text(fmt(item.unit_price), priceX, rowY + 4, { width: colWidths[5] - 4, align: 'right' })

    // AMOUNT
    const amtX = priceX + colWidths[5]
    doc.text(fmt(item.amount), amtX, rowY + 4, { width: colWidths[6] - 4, align: 'right' })

    doc.y = rowY + rowH + 1
  })
}

function estimateDescriptionLines(text: string, width: number): number {
  const avgCharWidth = 4.5
  const charsPerLine = Math.max(Math.floor(width / avgCharWidth), 1)
  const lines = text.split('\n').reduce((sum, line) => sum + Math.ceil((line.length || 1) / charsPerLine), 0)
  return Math.max(lines, 1)
}
