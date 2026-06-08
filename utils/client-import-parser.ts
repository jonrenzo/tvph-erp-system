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

const VALID_PROJECT_FIELDS = new Set([
  "name", "description", "contract_url", "status",
]);

const getValueByDbField = (
  row: Record<string, string>,
  colMap: Record<string, string>,
  targetField: string
): string => {
  const fileCol = Object.keys(colMap).find((key) => colMap[key] === targetField);
  return fileCol ? String(row[fileCol] ?? "").trim() : "";
};

export function validateImportFile(
  buffer: ArrayBuffer,
  type: "Customers" | "Vendors" | "Projects",
  customMapping?: Record<string, string>
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
  const columnMap = customMapping ?? buildColumnMap(fileHeaders);
  const unmappedColumns = fileHeaders.filter((h) => !columnMap[h]);
  const errors: ValidationError[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowIndex = i + 2; // Row index matching spreadsheet row (1-based + 1 for header)

    if (type === "Customers") {
      // Find company name in row using the mapped column
      const companyName = getValueByDbField(row, columnMap, "company_name");

      if (!companyName) {
        errors.push({ row: rowIndex, reason: "Missing company name." });
        continue;
      }

      // Contact details are optional — the server-side import skips empty contacts gracefully

    } else if (type === "Vendors") {
      const name = getValueByDbField(row, columnMap, "name");

      if (!name) {
        errors.push({ row: rowIndex, reason: "Missing vendor name." });
      }
    } else if (type === "Projects") {
      const name = getValueByDbField(row, columnMap, "name");

      if (!name) {
        errors.push({ row: rowIndex, reason: "Missing project name." });
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
