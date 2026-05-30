import * as XLSX from "xlsx";

export const VENDOR_HEADERS: { header: string; field: string }[] = [
  { header: "Vendor Name", field: "name" },
  { header: "Address", field: "address" },
  { header: "TIN", field: "tin" },
  { header: "Contact Person", field: "contact_person" },
  { header: "Contact Email", field: "contact_email" },
  { header: "Contact Phone", field: "contact_phone" },
  { header: "Contact Fax", field: "contact_fax" },
  { header: "Bank Name", field: "bank_name" },
  { header: "Bank Account Number", field: "bank_account_number" },
  { header: "Bank Account Name", field: "bank_account_name" },
  { header: "Payment Terms", field: "payment_terms" },
  { header: "Currency", field: "currency" },
  { header: "Notes", field: "notes" },
  { header: "Status", field: "status" },
];

export const VENDOR_SUB_HEADERS: { header: string; field: string; type: "contact" | "banking" }[] = [
  { header: "Secondary Contact Name", field: "contact_name", type: "contact" },
  { header: "Secondary Contact Email", field: "contact_email", type: "contact" },
  { header: "Secondary Contact Phone", field: "contact_phone", type: "contact" },
  { header: "Secondary Bank Name", field: "bank_name", type: "banking" },
  { header: "Secondary Bank Account Number", field: "account_number", type: "banking" },
  { header: "Secondary Bank Account Name", field: "account_name", type: "banking" },
];

export const CRM_ACCOUNT_HEADERS: { header: string; field: string }[] = [
  { header: "Company Name", field: "company_name" },
  { header: "Registered Address", field: "registered_address" },
  { header: "TIN", field: "tin" },
  { header: "Status", field: "status" },
  { header: "Primary Site Location", field: "primary_site_location" },
  { header: "Industry Note", field: "industry_note" },
  { header: "Notes", field: "notes" },
];

export const CRM_CONTACT_HEADERS: { header: string; field: string }[] = [
  { header: "Contact Full Name", field: "full_name" },
  { header: "Contact Job Title", field: "job_title" },
  { header: "Contact Email", field: "email" },
  { header: "Contact Phone", field: "phone" },
  { header: "Contact Fax", field: "fax" },
];

const HEADER_ALIASES: Record<string, string> = {
  "vendor name": "name",
  "name": "name",
  "company name": "company_name",
  "company": "company_name",
  "address": "address",
  "registered address": "registered_address",
  "tin": "tin",
  "tax id": "tin",
  "tax identification number": "tin",
  "contact person": "contact_person",
  "contact name": "contact_person",
  "contact full name": "full_name",
  "full name": "full_name",
  "contact email": "contact_email",
  "email": "contact_email",
  "email address": "contact_email",
  "contact phone": "contact_phone",
  "phone": "contact_phone",
  "telephone": "contact_phone",
  "contact number": "contact_phone",
  "contact fax": "contact_fax",
  "fax": "contact_fax",
  "bank name": "bank_name",
  "bank account number": "bank_account_number",
  "account number": "bank_account_number",
  "bank account name": "bank_account_name",
  "account name": "bank_account_name",
  "payment terms": "payment_terms",
  "currency": "currency",
  "notes": "notes",
  "status": "status",
  "primary site location": "primary_site_location",
  "site location": "primary_site_location",
  "industry note": "industry_note",
  "industry": "industry_note",
  "contact job title": "job_title",
  "job title": "job_title",
  "position": "job_title",
  "designation": "job_title",
  "secondary contact name": "_sc_name",
  "secondary contact email": "_sc_email",
  "secondary contact phone": "_sc_phone",
  "secondary bank name": "_sb_bank_name",
  "secondary bank account number": "_sb_account_number",
  "secondary bank account name": "_sb_account_name",
  "secondary contact name_raw": "_sc_name_raw",
  "secondary contact email_raw": "_sc_email_raw",
  "secondary contact phone_raw": "_sc_phone_raw",
  "secondary bank name_raw": "_sb_bank_name_raw",
  "secondary bank account number_raw": "_sb_account_number_raw",
  "secondary bank account name_raw": "_sb_account_name_raw",
};

export function normalizeHeader(header: string): string | null {
  const normalized = header.trim().toLowerCase().replace(/[_\s-]+/g, " ");
  return HEADER_ALIASES[normalized] || HEADER_ALIASES[normalized.replace(/\s+/g, "_")] || null;
}

export function buildColumnMap(fileHeaders: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const header of fileHeaders) {
    const field = normalizeHeader(header);
    if (field) {
      map[header] = field;
    }
  }
  return map;
}

export function parseFile(buffer: ArrayBuffer): Record<string, string>[] {
  const data = new Uint8Array(buffer);
  const workbook = XLSX.read(data, { type: "array", codepage: 65001 });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
  return json;
}

export function generateExportBuffer(
  data: Record<string, any>[],
  format: "csv" | "xlsx",
): Blob {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(data);

  const colWidths = Object.keys(data[0] || {}).map((key) => ({
    wch: Math.max(
      key.length,
      ...data.map((row) => String(row[key] ?? "").length),
    ),
  }));
  sheet["!cols"] = colWidths;

  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");

  const bookType = format === "csv" ? "csv" : "xlsx";
  const output = XLSX.write(workbook, { type: "buffer", bookType });

  const contentType = format === "csv"
    ? "text/csv"
    : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  return new Blob([output as any], { type: contentType });
}

export function inferFormat(fileName: string): "csv" | "xlsx" {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "csv") return "csv";
  return "xlsx";
}
