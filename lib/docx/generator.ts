import fs from 'node:fs'
import path from 'node:path'
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import { fetchPoData } from '../pdf/fetchPoData'

function formatCurrency(currency: string, value: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export async function generatePurchaseOrderDocx(poId: string): Promise<Buffer> {
  const poData = await fetchPoData(poId)

  if (!poData) {
    throw new Error('Purchase order not found')
  }

  const templatePath = path.join(process.cwd(), 'public', 'templates', 'PO_TEMPLATE_ORIGINAL.docx')
  if (!fs.existsSync(templatePath)) {
    throw new Error('Template file not found at ' + templatePath)
  }

  const content = fs.readFileSync(templatePath)
  const zip = new PizZip(content)
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  })

  // Format data
  const data = {
    po_number: poData.po_number,
    issued_date: poData.po_date,
    vendor_name: poData.vendor_name,
    vendor_no: poData.vendor_no,
    payment_terms: poData.payment_terms,
    dp_amount: formatCurrency(poData.currency, poData.downpayment_amount),
    contact_person: poData.vendor_contact,
    address: poData.vendor_address,
    tel_no: poData.vendor_tel,
    fax_no: poData.vendor_fax || 'N/A',
    
    line_items: poData.line_items.map((item) => ({
      line_no: item.line_no,
      item_code: item.item_code,
      description: item.description,
      qty: formatNumber(item.quantity),
      uom: item.uom,
      unit_price: formatCurrency(poData.currency, item.unit_price),
      amount: formatCurrency(poData.currency, item.amount),
    })),
    
    mobilization_date: poData.mobilization_date,
    delivery_date: poData.delivery_date,
    pr_no: poData.pr_number,
    requisitioner: poData.requisitioner,
    incoterms: poData.incoterms || 'N/A',
    prepared_date: poData.date_prepared,
    project_name: poData.project_name,
    date_prepared: poData.date_prepared,
  }

  doc.render(data)
  
  const buffer = doc.getZip().generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  })

  return buffer
}
