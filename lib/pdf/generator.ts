import PDFDocument from 'pdfkit'
import { PassThrough } from 'stream'
import type { PoData, PageContext } from './types'
import { CONTENT_TOP } from './constants'
import { drawHeader } from './header'
import { drawFooter } from './footer'
import { drawLineItemsSection } from './sections/lineItems'
import { drawTCSection } from './sections/termsAndConditions'
import { drawSiteDetailsSection } from './sections/siteDetails'

export function createPoDocument(poData: PoData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      autoFirstPage: false,
      bufferPages: true,
    })

    let currentContext: PageContext = 'line_items'

    doc.on('pageAdded', () => {
      drawHeader(doc, poData, currentContext)
      drawFooter(doc, poData)
      doc.y = CONTENT_TOP
    })

    doc.addPage()

    // ── Section 1: Line Items ──
    currentContext = 'line_items'
    drawLineItemsSection(doc, poData)

    // Spacer after line items
    doc.y += 10

    // ── Section 2: Terms & Conditions ──
    currentContext = 'terms'
    drawTCSection(doc, poData.terms_and_conditions)

    // Spacer
    doc.y += 8

    // ── Section 3: Site Details ──
    currentContext = 'sites'
    drawSiteDetailsSection(doc, poData)

    // Collect buffer
    const buffers: Buffer[] = []
    const stream = doc.pipe(new PassThrough())
    stream.on('data', (chunk: Buffer) => buffers.push(chunk))
    stream.on('end', () => resolve(Buffer.concat(buffers)))
    stream.on('error', reject)

    doc.end()
  })
}
