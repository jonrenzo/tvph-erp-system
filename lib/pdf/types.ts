export interface PoLineItem {
  line_no: string
  item_code: string | null
  description: string
  quantity: number
  uom: string
  unit_price: number
  amount: number
}

export interface PoSiteDetail {
  sn: number
  region: string
  area_city: string
  no_of_nodes: number
  estimated_strand_km: number
}

export interface PoData {
  po_number: string
  po_date: string
  vendor_name: string
  vendor_no: string
  vendor_contact: string
  vendor_address: string
  vendor_tel: string
  vendor_fax: string | null
  downpayment_amount: number
  payment_terms: string
  currency: string
  line_items: PoLineItem[]
  terms_and_conditions: string
  mobilization_date: string
  delivery_date: string
  pr_number: string
  requisitioner: string
  site_details: PoSiteDetail[]
  delivery_address_note: string
  incoterms: string | null
  date_prepared: string
  approved_by: string[]
  project_name: string
  ref_no: string
}

export type PageContext = 'line_items' | 'terms' | 'sites'
