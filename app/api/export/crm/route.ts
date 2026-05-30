import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { generateExportBuffer } from "@/utils/import-export";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") === "csv" ? "csv" : "xlsx";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: accounts, error } = await supabase
    .from("crm_accounts")
    .select("*")
    .is("deleted_at", null)
    .order("company_name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const accountIds = (accounts || []).map((a) => a.id);

  const { data: contacts } = await supabase
    .from("crm_contacts")
    .select("*")
    .in("account_id", accountIds)
    .is("deleted_at", null)
    .order("is_primary", { ascending: false });

  const contactsByAccount = new Map<string, any[]>();
  for (const c of contacts || []) {
    const existing = contactsByAccount.get(c.account_id) || [];
    existing.push(c);
    contactsByAccount.set(c.account_id, existing);
  }

  const rows: Record<string, any>[] = [];

  for (const a of accounts || []) {
    const accountContacts = contactsByAccount.get(a.id) || [];

    if (accountContacts.length === 0) {
      rows.push({
        "Company Name": a.company_name,
        "Registered Address": a.registered_address || "",
        TIN: a.tin || "",
        Status: a.status || "pending",
        "Primary Site Location": a.primary_site_location || "",
        "Industry Note": a.industry_note || "",
        Notes: a.notes || "",
        "Contact Full Name": "",
        "Contact Job Title": "",
        "Contact Email": "",
        "Contact Phone": "",
        "Contact Fax": "",
      });
    } else {
      for (const c of accountContacts) {
        rows.push({
          "Company Name": a.company_name,
          "Registered Address": a.registered_address || "",
          TIN: a.tin || "",
          Status: a.status || "pending",
          "Primary Site Location": a.primary_site_location || "",
          "Industry Note": a.industry_note || "",
          Notes: a.notes || "",
          "Contact Full Name": c.full_name || "",
          "Contact Job Title": c.job_title || "",
          "Contact Email": c.email || "",
          "Contact Phone": c.phone || "",
          "Contact Fax": c.fax || "",
        });
      }
    }
  }

  const blob = generateExportBuffer(rows, format);
  const filename = `customers_${new Date().toISOString().split("T")[0]}.${format}`;

  return new NextResponse(blob, {
    headers: {
      "Content-Type": blob.type,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
