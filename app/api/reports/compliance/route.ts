import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { requireCapability } from "@/lib/auth/permissions";
import {
  REQUIRED_DOCS,
  TOTAL_REQUIRED_DOCS,
  getDocStatus,
  calculateScore,
  computeComplianceSummary,
  type ComplianceVendor,
} from "@/lib/reports/compliance";
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
    .select("id, name, status, vendor_documents(doc_type, status, expiry_date)")
    .is("deleted_at", null)
    .order("name");

  const list = (vendors as ComplianceVendor[]) ?? [];
  const summary = computeComplianceSummary(list);

  const rows = list.map((v) => {
    const { score, total } = calculateScore(v.vendor_documents);
    const gaps = REQUIRED_DOCS.filter((req) => {
      const status = getDocStatus(v.vendor_documents, req.id);
      return status === "missing" || status === "expired";
    }).map((req) => req.label);
    return [
      v.name,
      `${score}/${total}`,
      (v.status || "").toUpperCase(),
      gaps.length ? gaps.join(", ") : "Complete",
    ];
  });

  const buffer = await createReportDocument({
    title: "Vendor Compliance Status",
    subtitle: `${TOTAL_REQUIRED_DOCS}-point accreditation tracking`,
    generatedAt: new Date(),
    kpis: [
      { label: "Overall Compliance", value: `${summary.overallPercentage}%` },
      { label: "Pending Reviews", value: String(summary.pendingReviews) },
      { label: "Non-Compliant", value: String(summary.nonCompliant) },
    ],
    sections: [
      {
        heading: "Vendor Detail",
        table: {
          columns: [
            { header: "Vendor", width: 30 },
            { header: "Score", width: 12, align: "center" },
            { header: "Status", width: 16, align: "center" },
            { header: "Missing / Expired", width: 42 },
          ],
          rows,
        },
      },
    ],
  });

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="compliance-status-${filenameDate()}.pdf"`,
      "Content-Length": String(buffer.byteLength),
    },
  });
}
