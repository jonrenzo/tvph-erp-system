import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { generateExportBuffer } from "@/utils/import-export";
import { requireCapability } from "@/lib/auth/permissions";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") === "csv" ? "csv" : "xlsx";

  const supabase = await createClient();
  const { error: authError } = await requireCapability("export.financial", supabase);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: authError === "Unauthorized" ? 401 : 403 });
  }

  const { data: pos, error } = await supabase
    .from("purchase_orders")
    .select(`
      *,
      vendors (
        name
      ),
      projects (
        name
      )
    `)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows: Record<string, any>[] = [];

  for (const po of pos || []) {
    rows.push({
      "PO Number": po.po_number,
      "Vendor Name": po.vendors?.name || "",
      "Project Name": po.projects?.name || "",
      Amount: po.amount || 0,
      Currency: po.currency || "PHP",
      Status: po.status || "",
      "Issued Date": po.issued_date ? new Date(po.issued_date).toLocaleDateString() : "",
      "Due Date": po.due_date ? new Date(po.due_date).toLocaleDateString() : "",
      Description: po.description || "",
      "Payment Terms": po.payment_terms || "",
    });
  }

  const blob = generateExportBuffer(rows, format);
  const filename = `purchase_orders_${new Date().toISOString().split("T")[0]}.${format}`;

  return new NextResponse(blob, {
    headers: {
      "Content-Type": blob.type,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
