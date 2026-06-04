import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { requireCapability } from "@/lib/auth/permissions";
import { getOperationsSummary } from "@/lib/reports/operations";
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

  const s = await getOperationsSummary(supabase);

  const buffer = await createReportDocument({
    title: "Operations Summary",
    subtitle: "Command Center operational snapshot",
    generatedAt: s.generatedAt,
    kpis: [
      { label: "Current Liability", value: peso(s.outstandingLiability) },
      { label: "Active POs", value: String(s.activePOCount) },
      { label: "PO Commitment", value: peso(s.totalPOCommitment) },
      { label: "Pending Vendors", value: String(s.pendingVendors) },
      { label: "Expiring Docs (30d)", value: String(s.expiringDocs) },
      { label: "Total Paid", value: peso(s.totalPaid) },
    ],
    sections: [
      {
        heading: "Recent System Activity",
        table: {
          columns: [
            { header: "When", width: 32 },
            { header: "User", width: 26 },
            { header: "Action", width: 18 },
            { header: "Entity", width: 24 },
          ],
          rows: s.recentActivity.map((a) => [
            new Date(a.createdAt).toLocaleString("en-PH"),
            a.actorName,
            a.action,
            a.entityType.replace(/_/g, " "),
          ]),
        },
      },
    ],
  });

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="operations-summary-${filenameDate()}.pdf"`,
      "Content-Length": String(buffer.byteLength),
    },
  });
}
