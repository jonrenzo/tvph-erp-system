import type PDFDocument from 'pdfkit'
import {
  MARGIN_LEFT, CONTENT_WIDTH, CONTENT_BOTTOM,
  FONT_SIZE_NORMAL, FONT_SIZE_SMALL, FONT_SIZE_MEDIUM,
  LINE_HEIGHT_NORMAL, LINE_HEIGHT_SMALL, LINE_HEIGHT_MEDIUM,
  COLOR_TEXT,
} from '../constants'

interface TCElement {
  type: 'numbered' | 'sub_item' | 'section_header' | 'paragraph' | 'project_line'
  text: string
}

export function parseTC(text: string): TCElement[] {
  const elements: TCElement[] = []
  const lines = text.split('\n')

  for (const raw of lines) {
    const line = raw.trimEnd()
    if (!line) {
      elements.push({ type: 'paragraph', text: '' })
      continue
    }

    if (/^Project:/i.test(line)) {
      elements.push({ type: 'project_line', text: line })
    } else if (/^[A-Z][A-Z\s]{2,}:$/.test(line) || /^[A-Z]\.\s/.test(line)) {
      elements.push({ type: 'section_header', text: line })
    } else if (/^\d+\.\s/.test(line)) {
      elements.push({ type: 'numbered', text: line })
    } else if (/^\s{2,}[a-z]\)\s/.test(line) || /^\s{2,}[a-z]\.\s/.test(line)) {
      elements.push({ type: 'sub_item', text: line.trimStart() })
    } else {
      elements.push({ type: 'paragraph', text: line })
    }
  }

  return elements
}

export function drawTCSection(doc: typeof PDFDocument.prototype, text: string) {
  const leftX = MARGIN_LEFT + 4
  const maxW = CONTENT_WIDTH - 8

  const elements = parseTC(text)

  for (const el of elements) {
    const lineH = el.type === 'section_header' ? LINE_HEIGHT_MEDIUM
      : el.type === 'paragraph' && el.text === '' ? LINE_HEIGHT_NORMAL * 0.5
      : LINE_HEIGHT_NORMAL

    if (el.text === '') {
      doc.y += lineH
      continue
    }

    // Overflow check
    if (doc.y + lineH > CONTENT_BOTTOM) {
      doc.addPage()
    }

    switch (el.type) {
      case 'project_line':
        doc.font('Helvetica-Bold').fontSize(FONT_SIZE_NORMAL).fillColor(...COLOR_TEXT)
        doc.text(el.text, leftX, doc.y, { width: maxW })
        break

      case 'section_header':
        doc.font('Helvetica-Bold').fontSize(FONT_SIZE_MEDIUM).fillColor(...COLOR_TEXT)
        doc.text(el.text, leftX, doc.y, { width: maxW })
        break

      case 'numbered': {
        const match = el.text.match(/^(\d+\.\s)(.*)$/)
        if (match) {
          const numW = 18
          doc.font('Helvetica-Bold').fontSize(FONT_SIZE_SMALL).fillColor(...COLOR_TEXT)
          doc.text(match[1], leftX, doc.y, { width: numW, lineBreak: false })
          doc.font('Helvetica').fontSize(FONT_SIZE_SMALL)
          doc.text(match[2], leftX + numW, doc.y, { width: maxW - numW })
        } else {
          doc.font('Helvetica').fontSize(FONT_SIZE_SMALL).fillColor(...COLOR_TEXT)
          doc.text(el.text, leftX, doc.y, { width: maxW })
        }
        break
      }

      case 'sub_item': {
        const match = el.text.match(/^([a-z][.\)]\s)(.*)$/)
        const indent = 20
        if (match) {
          const labelW = 14
          doc.font('Helvetica-Bold').fontSize(FONT_SIZE_SMALL).fillColor(...COLOR_TEXT)
          doc.text(match[1], leftX + indent, doc.y, { width: labelW, lineBreak: false })
          doc.font('Helvetica').fontSize(FONT_SIZE_SMALL)
          doc.text(match[2], leftX + indent + labelW, doc.y, { width: maxW - indent - labelW })
        } else {
          doc.font('Helvetica').fontSize(FONT_SIZE_SMALL).fillColor(...COLOR_TEXT)
          doc.text(el.text, leftX + indent, doc.y, { width: maxW - indent })
        }
        break
      }

      case 'paragraph':
        doc.font('Helvetica').fontSize(FONT_SIZE_SMALL).fillColor(...COLOR_TEXT)
        doc.text(el.text, leftX, doc.y, { width: maxW })
        break
    }
  }
}
