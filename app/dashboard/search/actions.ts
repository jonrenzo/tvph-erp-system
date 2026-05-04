"use server";

import { createClient } from "@/utils/supabase/server";

export async function globalSearch(query: string) {
  if (!query || query.length < 2) return { vendors: [], pos: [], invoices: [] };

  const supabase = await createClient();
  const safeQuery = `%${query}%`;

  const [vendorsRes, posRes, invoicesRes] = await Promise.all([
    supabase.from("vendors").select("id, name, tin").ilike("name", safeQuery).limit(5),
    supabase.from("purchase_orders").select("id, po_number, amount").ilike("po_number", safeQuery).limit(5),
    supabase.from("service_invoices").select("id, invoice_number, amount").ilike("invoice_number", safeQuery).limit(5),
  ]);

  return {
    vendors: vendorsRes.data || [],
    pos: posRes.data || [],
    invoices: invoicesRes.data || [],
  };
}
