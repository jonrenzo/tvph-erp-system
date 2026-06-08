import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const accountId = req.nextUrl.searchParams.get("account_id");

  let query = supabase
    .from("client_purchase_orders")
    .select("id, po_number, amount, currency, status")
    .is("deleted_at", null)
    .neq("status", "cancelled")
    .neq("status", "fully_billed")
    .order("received_date", { ascending: false });

  if (accountId) query = query.eq("account_id", accountId);

  const { data, error } = await query;
  if (error) return NextResponse.json([], { status: 500 });
  return NextResponse.json(data || []);
}
