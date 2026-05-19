export interface PoData {
  po_number: string
  issued_date: string
  date_prepared?: string
  created_at?: string
  description?: string | null
  amount: number
  currency: string
  dp_amount?: number
  agreement_ref_no?: string | null
  vendors?: VendorData | null
  projects?: ProjectData | null
}

export interface VendorData {
  name: string
  vendor_no?: string
  id: string
  address?: string | null
  contact_person?: string | null
  contact_phone?: string | null
  contact_fax?: string | null
  payment_terms?: string | null
}

export interface ProjectData {
  name: string
  description?: string | null
}

export interface PoLineItemData {
  line_no: number
  item_code?: string
  description: string
  qty: number
  uom: string
  unit_price: number
  amount: number
}

export interface PoSiteDetailData {
  sn: number
  region: string
  area_city: string
  no_of_nodes: number
  cable_length_km: number
}

export interface PoTemplateData {
  po: PoData
  lineItems: PoLineItemData[]
  siteDetails: PoSiteDetailData[]
}
