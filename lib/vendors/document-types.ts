// Canonical list of the 14-point vendor accreditation documents.
// Shared by the document UI, the expiry-reminder cron, and the doc-request email.
export const DOCUMENT_TYPES = [
  { id: "signed_nda", label: "Signed NDA" },
  { id: "statement_of_commitment", label: "Statement of Commitment" },
  { id: "company_profile", label: "Company Profile and Client References" },
  { id: "products_services_list", label: "List of Products or Services" },
  { id: "vendor_information_summary", label: "Vendor Information Summary" },
  { id: "general_information_sheet", label: "Latest General Information Sheet" },
  { id: "audited_financial_statements", label: "Audited Financial Statements (3yrs)" },
  { id: "sec_registration", label: "SEC Registration / Articles" },
  { id: "secretary_certificate", label: "Secretary Certificate" },
  { id: "safety_drug_policy", label: "Safety & Drug Free Policy" },
  { id: "iso_certification", label: "ISO Certification" },
  { id: "pcab_license", label: "PCAB License" },
  { id: "dole_174", label: "DOLE 174" },
  { id: "other_licenses", label: "Other Licenses or Permits" },
] as const;

/** Human-friendly label for a document, preferring a custom label when present. */
export function docTypeLabel(docType: string, customLabel?: string | null): string {
  if (customLabel) return customLabel;
  return (
    DOCUMENT_TYPES.find((t) => t.id === docType)?.label ??
    docType.replace(/_/g, " ")
  );
}
