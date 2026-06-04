// Pure vendor-compliance computation shared by the Compliance Hub page and the
// Compliance report. Extracted from app/dashboard/compliance/page.tsx so the page,
// the report, and the summary cards all agree on one set of numbers.

// TelcoVantage's vendor accreditation is a 14-point requirement. Only 7 of the 14
// document types are enumerated below so far; the matrix columns and missing/expired
// detection use these, but the *score denominator* is the full 14 (TOTAL_REQUIRED_DOCS)
// so compliance percentages stay honest.
// TODO: enumerate the remaining 7 required doc types here and the matrix will pick
// them up automatically.
export const TOTAL_REQUIRED_DOCS = 14;

export const REQUIRED_DOCS = [
  { id: "signed_nda", label: "NDA" },
  { id: "statement_of_commitment", label: "Commitment" },
  { id: "sec_registration", label: "SEC" },
  { id: "pcab_license", label: "PCAB" },
  { id: "dole_174", label: "DOLE" },
  { id: "audited_financial_statements", label: "Financials" },
  { id: "company_profile", label: "Profile" },
] as const;

export type DocStatus = "missing" | "submitted" | "approved" | "expired";

export interface ComplianceVendorDoc {
  doc_type: string;
  status: string;
  expiry_date?: string | null;
}

export interface ComplianceVendor {
  id: string;
  name: string;
  status: string;
  vendor_documents?: ComplianceVendorDoc[] | null;
}

export interface VendorComplianceScore {
  score: number;
  total: number;
  percentage: number;
}

export interface ComplianceSummary {
  /** Average of every vendor's compliance percentage. */
  overallPercentage: number;
  /** Count of documents awaiting review (status = submitted). */
  pendingReviews: number;
  /** Vendors missing at least one required doc (missing or expired). */
  nonCompliant: number;
  totalVendors: number;
}

export function getDocStatus(
  vendorDocs: ComplianceVendorDoc[] | null | undefined,
  type: string,
): DocStatus {
  const doc = vendorDocs?.find((d) => d.doc_type === type);
  if (!doc) return "missing";
  return (doc.status as DocStatus) || "missing";
}

export function calculateScore(
  vendorDocs: ComplianceVendorDoc[] | null | undefined,
): VendorComplianceScore {
  // Count every submitted/approved document the vendor has, capped at the full
  // 14-point requirement. (Denominator is the real requirement, not just the
  // currently-enumerated subset.)
  const submitted =
    vendorDocs?.filter(
      (d) => d.status === "submitted" || d.status === "approved",
    ).length || 0;
  const total = TOTAL_REQUIRED_DOCS;
  const score = Math.min(submitted, total);
  return { score, total, percentage: Math.round((score / total) * 100) };
}

/** Roll up org-wide compliance metrics from all vendors. */
export function computeComplianceSummary(
  vendors: ComplianceVendor[] | null | undefined,
): ComplianceSummary {
  const list = vendors ?? [];
  const totalVendors = list.length;

  let percentageSum = 0;
  let pendingReviews = 0;
  let nonCompliant = 0;

  for (const vendor of list) {
    const docs = vendor.vendor_documents ?? [];
    const { percentage } = calculateScore(docs);
    percentageSum += percentage;
    pendingReviews += docs.filter((d) => d.status === "submitted").length;

    // Non-compliant = not fully accredited, or holding an expired required doc.
    const hasExpired = docs.some((d) => d.status === "expired");
    if (percentage < 100 || hasExpired) nonCompliant += 1;
  }

  return {
    overallPercentage: totalVendors
      ? Math.round(percentageSum / totalVendors)
      : 0,
    pendingReviews,
    nonCompliant,
    totalVendors,
  };
}
