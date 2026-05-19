"use server";

import { createClient } from "@/utils/supabase/server";

export async function globalSearch(query: string) {
  if (!query || query.length < 2) {
    return {
      vendors: [],
      pos: [],
      invoices: [],
      projects: [],
      payments: [],
      documents: [],
      crm_accounts: [],
      crm_opportunities: [],
    };
  }

  const supabase = await createClient();
  const safeQuery = `%${query}%`;

  const [vendorsRes, posRes, invoicesRes, projectsRes, paymentsRes, documentsRes, crmAccountsRes, crmOpportunitiesRes] = await Promise.all([
    supabase.from("vendors").select("id, name, tin").ilike("name", safeQuery).limit(5),
    supabase.from("purchase_orders").select("id, po_number, amount").ilike("po_number", safeQuery).limit(5),
    supabase.from("service_invoices").select("id, invoice_number, amount").ilike("invoice_number", safeQuery).limit(5),
    supabase.from("projects").select("id, name, project_code").ilike("name", safeQuery).is("deleted_at", null).limit(5),
    supabase.from("payments").select("id, reference_number, amount_paid, invoice_id").ilike("reference_number", safeQuery).is("deleted_at", null).limit(5),
    supabase.from("vendor_documents").select("id, file_name, doc_type, vendor_id").ilike("file_name", safeQuery).limit(5),
    supabase.from("crm_accounts").select("id, company_name, company_type").ilike("company_name", safeQuery).is("deleted_at", null).limit(5),
    supabase.from("crm_opportunities").select("id, title, stage, estimated_contract_value").ilike("title", safeQuery).is("deleted_at", null).limit(5),
  ]);

  return {
    vendors: vendorsRes.data || [],
    pos: posRes.data || [],
    invoices: invoicesRes.data || [],
    projects: projectsRes.data || [],
    payments: paymentsRes.data || [],
    documents: documentsRes.data || [],
    crm_accounts: crmAccountsRes.data || [],
    crm_opportunities: crmOpportunitiesRes.data || [],
  };
}
