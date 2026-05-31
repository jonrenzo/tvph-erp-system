import { parseFile, buildColumnMap } from "./import-export";

export type ValidationError = {
  row: number;
  reason: string;
};

export type ClientParsedResult = {
  rows: Record<string, string>[];
  columnMapping: Record<string, string>;
  unmappedColumns: string[];
  errors: ValidationError[];
};

const VALID_CRM_ACCOUNT_FIELDS = new Set([
  "company_name", "registered_address", "tin", "status",
  "company_type", "primary_site_location", "industry_note", "notes",
]);

const VALID_VENDOR_FIELDS = new Set([
  "name", "address", "tin", "contact_person", "contact_email",
  "contact_phone", "contact_fax", "bank_name", "bank_account_number",
  "bank_account_name", "payment_terms", "currency", "notes", "status",
]);

export function validateImportFile(
  buffer: ArrayBuffer,
  type: "Customers" | "Vendors"
): ClientParsedResult {
  const rows = parseFile(buffer);
  
  if (rows.length === 0) {
    return {
      rows: [],
      columnMapping: {},
      unmappedColumns: [],
      errors: [{ row: 1, reason: "The file appears to be empty." }]
    };
  }

  const fileHeaders = Object.keys(rows[0]);
  const columnMap = buildColumnMap(fileHeaders);
  const unmappedColumns = fileHeaders.filter((h) => !columnMap[h]);
  const errors: ValidationError[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowIndex = i + 2; // Row index matching spreadsheet row (1-based + 1 for header)

    if (type === "Customers") {
      // Find company name in row
      const companyName = String(
        row["Company Name"] ?? 
        row["company_name"] ?? 
        row["Company"] ?? 
        ""
      ).trim();

      if (!companyName) {
        errors.push({ row: rowIndex, reason: "Missing company name." });
        continue;
      }

      // Check contact details (requires at least one of full_name, email, or phone)
      const contactName = String(row["Contact Full Name"] ?? row["full_name"] ?? row["Contact Name"] ?? "").trim();
      const contactEmail = String(row["Contact Email"] ?? row["email"] ?? row["email_address"] ?? "").trim();
      const contactPhone = String(row["Contact Phone"] ?? row["phone"] ?? row["telephone"] ?? row["contact_number"] ?? "").trim();

      // If any contact headers were mapped or populated, we check if they are all empty
      const hasAnyContactHeader = fileHeaders.some(h => 
        ["full_name", "contact_email", "contact_phone"].includes(columnMap[h])
      );

      if (hasAnyContactHeader && !contactName && !contactEmail && !contactPhone) {
        errors.push({ row: rowIndex, reason: "Contact in row must have at least a name, email, or phone number." });
      }

    } else if (type === "Vendors") {
      const name = String(
        row["Vendor Name"] ?? 
        row["name"] ?? 
        row["Name"] ?? 
        ""
      ).trim();

      if (!name) {
        errors.push({ row: rowIndex, reason: "Missing vendor name." });
      }
    }
  }

  return {
    rows,
    columnMapping: columnMap,
    unmappedColumns,
    errors
  };
}
