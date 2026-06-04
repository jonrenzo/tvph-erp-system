import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { requireCapability } from "@/lib/auth/permissions";
import {
  createReportDocument,
  filenameDate,
} from "@/lib/pdf/reports/reportDocument";

export async function GET() {
  const supabase = await createClient();
  const { error: authError } = await requireCapability("export.vendor", supabase);
  if (authError) {
    return NextResponse.json(
      { error: authError },
      { status: authError === "Unauthorized" ? 401 : 403 },
    );
  }

  const { data: vendors } = await supabase
    .from("vendors")
    .select("name, tin, contact_person, contact_email, payment_terms, status")
    .is("deleted_at", null)
    .order("name");

  const list = vendors ?? [];
  const active = list.filter((v) => v.status === "active").length;
  const pending = list.filter((v) => v.status === "pending").length;

  const buffer = await createReportDocument({
    title: "Vendor Register",
    subtitle: "Master list of accredited and pending vendors",
    generatedAt: new Date(),
    kpis: [
      { label: "Total Vendors", value: String(list.length) },
      { label: "Active", value: String(active) },
      { label: "Pending", value: String(pending) },
    ],
    sections: [
      {
        table: {
          columns: [
            { header: "Vendor", width: 26 },
            { header: "TIN", width: 16 },
            { header: "Contact", width: 22 },
            { header: "Terms", width: 18 },
            { header: "Status", width: 14, align: "center" },
          ],
          rows: list.map((v) => [
            v.name ?? "",
            v.tin ?? "-",
            v.contact_person ?? v.contact_email ?? "-",
            v.payment_terms ?? "-",
            (v.status ?? "pending").toUpperCase(),
          ]),
        },
      },
    ],
  });

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="vendor-register-${filenameDate()}.pdf"`,
      "Content-Length": String(buffer.byteLength),
    },
  });
}
