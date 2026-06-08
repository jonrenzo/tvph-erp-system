import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_accounts")
    .select("id, company_name")
    .is("deleted_at", null)
    .order("company_name", { ascending: true });

  if (error) return NextResponse.json([], { status: 500 });
  return NextResponse.json(data || []);
}
