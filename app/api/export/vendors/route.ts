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

  const { data: vendors, error } = await supabase
    .from("vendors")
    .select("*")
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows: Record<string, any>[] = [];

  for (const v of vendors || []) {
    rows.push({
      "Vendor Name": v.name,
      Address: v.address || "",
      TIN: v.tin || "",
      "Contact Person": v.contact_person || "",
      "Contact Email": v.contact_email || "",
      "Contact Phone": v.contact_phone || "",
      "Contact Fax": v.contact_fax || "",
      "Bank Name": v.bank_name || "",
      "Bank Account Number": v.bank_account_number || "",
      "Bank Account Name": v.bank_account_name || "",
      "Payment Terms": v.payment_terms || "",
      Currency: v.currency || "PHP",
      Notes: v.notes || "",
      Status: v.status || "pending",
    });

    const secondaryContacts: any[] = v.secondary_contacts || [];
    for (const sc of secondaryContacts) {
      rows.push({
        "Vendor Name": v.name,
        Address: v.address || "",
        TIN: v.tin || "",
        "Contact Person": v.contact_person || "",
        "Contact Email": v.contact_email || "",
        "Contact Phone": v.contact_phone || "",
        "Contact Fax": v.contact_fax || "",
        "Bank Name": v.bank_name || "",
        "Bank Account Number": v.bank_account_number || "",
        "Bank Account Name": v.bank_account_name || "",
        "Payment Terms": v.payment_terms || "",
        Currency: v.currency || "PHP",
        Notes: v.notes || "",
        Status: v.status || "pending",
        "Secondary Contact Name": sc.contact_name || "",
        "Secondary Contact Email": sc.contact_email || "",
        "Secondary Contact Phone": sc.contact_phone || "",
        "Secondary Bank Name": "",
        "Secondary Bank Account Number": "",
        "Secondary Bank Account Name": "",
      });
    }

    const secondaryBanking: any[] = v.secondary_banking || [];
    for (const sb of secondaryBanking) {
      rows.push({
        "Vendor Name": v.name,
        Address: v.address || "",
        TIN: v.tin || "",
        "Contact Person": v.contact_person || "",
        "Contact Email": v.contact_email || "",
        "Contact Phone": v.contact_phone || "",
        "Contact Fax": v.contact_fax || "",
        "Bank Name": v.bank_name || "",
        "Bank Account Number": v.bank_account_number || "",
        "Bank Account Name": v.bank_account_name || "",
        "Payment Terms": v.payment_terms || "",
        Currency: v.currency || "PHP",
        Notes: v.notes || "",
        Status: v.status || "pending",
        "Secondary Contact Name": "",
        "Secondary Contact Email": "",
        "Secondary Contact Phone": "",
        "Secondary Bank Name": sb.bank_name || "",
        "Secondary Bank Account Number": sb.account_number || "",
        "Secondary Bank Account Name": sb.account_name || "",
      });
    }
  }

  const blob = generateExportBuffer(rows, format);
  const filename = `vendors_${new Date().toISOString().split("T")[0]}.${format}`;

  return new NextResponse(blob, {
    headers: {
      "Content-Type": blob.type,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
