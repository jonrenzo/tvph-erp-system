import { docTypeLabel } from "@/lib/vendors/document-types";

export const EMAIL_KIND_LABELS: Record<string, string> = {
  po_issued: "Purchase Order",
  po_for_signature: "E-Signature Request",
  po_pending_approval: "Approval Request",
  po_pending_exec: "Executive Review",
  po_pending_finance: "Finance Review",
  po_signed_acknowledged: "Signed PO Acknowledged",
  po_signed_received: "Signed PO Received",
  payment_request_notification: "Payment Request",
  doc_reminder: "Document Reminder",
  doc_request: "Document Request",
  // rarely surfaced but included for completeness
  pr_pending_approval: "PR Approval Request",
  pr_approved: "PR Approved",
  pr_pending_finance: "PR Finance Review",
  invoice_due_reminder: "Invoice Reminder",
  invoice_due_date: "Invoice Due",
  vendor_deadline_reminder: "Vendor Deadline",
};

const PO_KINDS = new Set([
  "po_issued",
  "po_for_signature",
  "po_pending_approval",
  "po_pending_exec",
  "po_pending_finance",
  "po_signed_acknowledged",
  "po_signed_received",
  "payment_request_notification",
]);

export function emailReference(
  row: { kind: string; ref_id: string | null; meta: Record<string, unknown> | null },
  poNumbers: Map<string, string>,
): string {
  if (PO_KINDS.has(row.kind)) {
    return (row.ref_id && poNumbers.get(row.ref_id)) || "Purchase order";
  }
  if (row.kind === "doc_reminder") return docTypeLabel(String(row.meta?.doc_type ?? ""));
  if (row.kind === "doc_request") return "Documents requested";
  return (row.ref_id && poNumbers.get(row.ref_id)) || row.kind;
}
