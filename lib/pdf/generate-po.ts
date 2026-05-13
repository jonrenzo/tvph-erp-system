import { PDFDocument, PDFName } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import * as fs from 'fs'
import * as path from 'path'

const FONT_PATH = 'C:\\Windows\\Fonts\\calibril.ttf'
const FONT_TAG = 'CL'

export interface PoData {
  po_number: string
  issued_date: string
  created_at?: string
  description?: string | null
  amount: number
  currency: string
}

export interface VendorData {
  name: string
  id: string
  address?: string | null
  contact_person?: string | null
  contact_phone?: string | null
  payment_terms?: string | null
}

export interface ProjectData {
  name: string
  description?: string | null
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatCurrency(amount: number, currency: string): string {
  const prefix = currency === 'USD' ? 'USD ' : 'PHP '
  return `${prefix}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function shortId(uuid: string): string {
  return uuid.split('-')[0].toUpperCase()
}

function splitAddress(address?: string | null): { street: string; city: string } {
  if (!address) return { street: '', city: '' }
  const parts = address.split(',').map((s) => s.trim()).filter(Boolean)
  if (parts.length <= 1) return { street: parts[0] || '', city: '' }
  return { street: parts.slice(0, -1).join(', '), city: parts[parts.length - 1] }
}

export async function generatePoDocument(
  po: PoData,
  vendor: VendorData,
  project: ProjectData | null,
): Promise<Uint8Array> {
  const templatePath = path.join(process.cwd(), 'po_template_fillable.pdf')
  const pdfDoc = await PDFDocument.load(fs.readFileSync(templatePath))
  pdfDoc.registerFontkit(fontkit)

  const fontBytes = fs.readFileSync(FONT_PATH)
  const calibriFont = await pdfDoc.embedFont(fontBytes)

  const acroFormRef = pdfDoc.catalog.get(PDFName.of('AcroForm'))
  if (acroFormRef) {
    const acroFormDict = pdfDoc.context.lookup(acroFormRef) as any
    const dr = acroFormDict.get(PDFName.of('DR'))
    const drDict = pdfDoc.context.lookup(dr) as any
    const fontDict = drDict.get(PDFName.of('Font'))
    const fDict = pdfDoc.context.lookup(fontDict) as any
    fDict.set(PDFName.of(FONT_TAG), calibriFont.ref)
  }

  const form = pdfDoc.getForm()

  const setField = (name: string, value?: string | null) => {
    if (value === undefined || value === null) return
    try {
      const field = form.getTextField(name)
      field.setText(value)
      field.acroField.setDefaultAppearance(`/${FONT_TAG} 9 Tf 0 g`)
    } catch {
      // field doesn't exist in the template
    }
  }

  const { street, city } = splitAddress(vendor.address)
  const dateStr = formatDate(po.issued_date)
  const amountStr = formatCurrency(po.amount, po.currency)

  // ── Page 1 ──
  setField('po_number_p1', po.po_number)
  setField('po_date_p1', dateStr)
  setField('vendor_name_p1', vendor.name)
  setField('vendor_number_p1', shortId(vendor.id))
  setField('address_1_p1', street)
  setField('address_2_p1', city)
  setField('contact_person_p1', vendor.contact_person)
  setField('contact_phone_p1', vendor.contact_phone)
  setField('payment_terms_p1', vendor.payment_terms)
  setField('date_prepared_p1', dateStr)
  setField('li_01_line_no', '1')
  setField('li_01_desc', po.description || '')
  setField('li_01_qty', '1')
  setField('li_01_uom', 'LOT')
  setField('li_01_unit_price', amountStr)
  setField('li_01_amount', amountStr)
  setField('pr_number', '')
  setField('requisitioner', '')
  setField('mobilization_date', '')
  setField('delivery_date', '')

  // ── Page 2 ──
  setField('po_number_p2', po.po_number)
  setField('po_date_p2', dateStr)
  setField('vendor_name_p2', vendor.name)
  setField('vendor_number_p2', shortId(vendor.id))
  setField('address_1_p2', street)
  setField('address_2_p2', city)
  setField('contact_person_p2', vendor.contact_person)
  setField('contact_phone_p2', vendor.contact_phone)
  setField('payment_terms_p2', vendor.payment_terms)
  setField('date_prepared_p2', dateStr)

  if (project) {
    setField('project_p2', `${project.name} (${vendor.name})`)
    setField('project_desc_p2', `This PO is governed by the Service Agreement for ${project.name} with Ref No. ____________, as may be amended.`)
  } else {
    setField('project_p2', vendor.name)
    setField('project_desc_p2', '')
  }

  // ── Page 3 ──
  setField('po_number_p3', po.po_number)
  setField('po_date_p3', dateStr)
  setField('vendor_name_p3', vendor.name)
  setField('vendor_number_p3', shortId(vendor.id))
  setField('address_1_p3', street)
  setField('address_2_p3', city)
  setField('contact_person_p3', vendor.contact_person)
  setField('contact_phone_p3', vendor.contact_phone)
  setField('payment_terms_p3', vendor.payment_terms)
  setField('date_prepared_p3', dateStr)

  form.flatten()
  return await pdfDoc.save()
}
