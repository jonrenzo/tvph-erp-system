import type { PoData } from './types'
import { createClient } from '@/utils/supabase/server'

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-PH', { day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtSlashDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${mm}/${dd}/${d.getFullYear()}`
}

function shortId(uuid: string): string {
  return uuid.split('-')[0].toUpperCase()
}

export async function fetchPoData(id: string): Promise<PoData | null> {
  const supabase = await createClient()

  const { data: po, error } = await supabase
    .from('purchase_orders')
    .select(
      `*,
      vendors (*),
      projects (*),
      po_line_items (*),
      po_site_details (*),
      profiles!purchase_orders_created_by_fkey (full_name)`,
    )
    .eq('id', id)
    .single()

  if (error || !po) return null

  const vendor = po.vendors || {}

  const lineItems = (po.po_line_items ?? []).map((li: any) => ({
    line_no: String(li.line_no).padStart(4, '0'),
    item_code: li.item_code ?? '',
    description: li.description ?? '',
    quantity: Number(li.qty),
    uom: li.uom ?? 'LOT',
    unit_price: Number(li.unit_price),
    amount: Number(li.amount ?? li.qty * li.unit_price),
  }))

  const siteDetails = (po.po_site_details ?? []).map((s: any) => ({
    sn: Number(s.sn),
    region: s.region ?? '',
    area_city: s.area_city ?? '',
    no_of_nodes: Number(s.no_of_nodes),
    estimated_strand_km: Number(s.cable_length_km ?? 0),
  }))

  return {
    po_number: po.po_number ?? '',
    po_date: fmtDate(po.issued_date || po.created_at),
    vendor_name: vendor.name ?? '',
    vendor_no: shortId(vendor.id ?? ''),
    vendor_contact: vendor.contact_person ?? '',
    vendor_address: vendor.address ?? '',
    vendor_tel: vendor.contact_phone ?? '',
    vendor_fax: vendor.contact_fax ?? null,
    downpayment_amount: Number(po.dp_amount || 0),
    payment_terms: vendor.payment_terms ?? '',
    currency: po.currency ?? 'PHP',
    line_items: lineItems,
    terms_and_conditions: po.terms_and_conditions ?? '',
    mobilization_date: fmtSlashDate(po.mobilization_date),
    delivery_date: fmtSlashDate(po.delivery_date),
    pr_number: po.pr_number ?? '',
    requisitioner: (po.profiles as any)?.full_name ?? po.requisitioner ?? '',
    site_details: siteDetails,
    delivery_address_note: `Pls coordinate with Mae Bacayo / Teresa Beltran at Unit 1811, North Tower, Park Triangle Corporate Plaza, 32nd Street cor. 11th Ave, BGC, Taguig City. CP: 0961-4734695 / 0920-9680070`,
    incoterms: null,
    date_prepared: fmtSlashDate(po.created_at),
    approved_by: Array.isArray(po.approved_by) ? po.approved_by : [],
    project_name: po.projects?.name ?? '',
    ref_no: po.agreement_ref_no ?? '',
  }
}
