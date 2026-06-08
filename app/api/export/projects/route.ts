import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { generateExportBuffer } from "@/utils/import-export";
import { requireCapability } from "@/lib/auth/permissions";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") === "csv" ? "csv" : "xlsx";

  const supabase = await createClient();
  const { error: authError } = await requireCapability("export.project", supabase);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: authError === "Unauthorized" ? 401 : 403 });
  }

  const { data: projects, error } = await supabase
    .from("projects")
    .select(`
      id, name, description, contract_url, status, created_at,
      project_vendors (
        vendors ( name )
      )
    `)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows: Record<string, any>[] = [];

  for (const p of projects || []) {
    const vendorNames = (p.project_vendors || [])
      .map((pv: any) => pv.vendors?.name)
      .filter(Boolean)
      .join(", ");

    rows.push({
      "Project Name": p.name,
      Description: p.description || "",
      "Contract URL": p.contract_url || "",
      Status: p.status || "active",
      "Linked Vendors": vendorNames,
    });
  }

  const blob = generateExportBuffer(rows, format);
  const filename = `projects_${new Date().toISOString().split("T")[0]}.${format}`;

  return new NextResponse(blob, {
    headers: {
      "Content-Type": blob.type,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
