import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { requireCapability } from "@/lib/auth/permissions";
import { computeApAging } from "@/lib/reports/apAging";
import {
  createReportDocument,
  peso,
  filenameDate,
} from "@/lib/pdf/reports/reportDocument";

export async function GET() {
  const supabase = await createClient();
  const { error: authError } = await requireCapability("export.financial", supabase);
  if (authError) {
    return NextResponse.json(
      { error: authError },
      { status: authError === "Unauthorized" ? 401 : 403 },
    );
  }

  const { data: invoices } = await supabase
    .from("service_invoices")
    .select(
      "amount, status, due_date, invoice_date, vendor_id, vat_amount, ewt_amount, expense_category, vendors(name)",
    );

  const result = computeApAging(invoices as any);

  const cell = (n: number) => (n === 0 ? "-" : peso(n));

  const buffer = await createReportDocument({
    title: "Accounts Payable Aging",
    subtitle: "Outstanding payables by vendor and aging bucket",
    generatedAt: new Date(),
    kpis: [
      { label: "Outstanding Payables", value: peso(result.totalUnpaid) },
      { label: "Total Input VAT", value: peso(result.totalVAT) },
      { label: "Total EWT Withheld", value: peso(result.totalEWT) },
    ],
    sections: [
      {
        heading: "Aging Detail",
        table: {
          columns: [
            { header: "Vendor", width: 26 },
            { header: "Current", width: 12, align: "right" },
            { header: "1-30", width: 12, align: "right" },
            { header: "31-60", width: 12, align: "right" },
            { header: "61-90", width: 12, align: "right" },
            { header: ">90", width: 12, align: "right" },
            { header: "Total", width: 14, align: "right" },
          ],
          rows: result.rows.map((r) => [
            r.vendorName,
            cell(r.current),
            cell(r.days30),
            cell(r.days60),
            cell(r.days90),
            cell(r.over90),
            peso(r.total),
          ]),
          totalsRow: [
            "TOTALS",
            cell(result.rows.reduce((s, r) => s + r.current, 0)),
            cell(result.rows.reduce((s, r) => s + r.days30, 0)),
            cell(result.rows.reduce((s, r) => s + r.days60, 0)),
            cell(result.rows.reduce((s, r) => s + r.days90, 0)),
            cell(result.rows.reduce((s, r) => s + r.over90, 0)),
            peso(result.totalUnpaid),
          ],
        },
      },
    ],
  });

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="ap-aging-${filenameDate()}.pdf"`,
      "Content-Length": String(buffer.byteLength),
    },
  });
}
