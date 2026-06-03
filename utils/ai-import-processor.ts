import * as XLSX from "xlsx";
import { buildRichColumnMap } from "./import-export";
import type { RichColumnMapping } from "./import-export";
import { createServiceRoleClient } from "./supabase/service";
import { recordAuditLog } from "@/utils/audit";
import type { SupabaseClient } from "@supabase/supabase-js";

type ImportResult = {
  created: number;
  updated: number;
  errors: { row: number; reason: string }[];
  totalRows: number;
  summary: string;
};

const VALID_VENDOR_FIELDS = new Set([
  "name", "address", "tin", "contact_person", "contact_email",
  "contact_phone", "contact_fax", "bank_name", "bank_account_number",
  "bank_account_name", "payment_terms", "currency", "notes", "status",
]);

const VALID_CRM_ACCOUNT_FIELDS = new Set([
  "company_name", "registered_address", "tin", "status",
  "company_type", "primary_site_location", "industry_note", "notes",
]);

function parseFile(buffer: ArrayBuffer): Record<string, string>[] {
  const data = new Uint8Array(buffer);
  const workbook = XLSX.read(data, { type: "array", codepage: 65001 });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
}

function extractSecondaryContact(
  row: Record<string, string>,
  columnMap: RichColumnMapping,
): Record<string, string> | null {
  const nameCol = Object.entries(columnMap).find(([, v]) => v.field === "_sc_name")?.[0];
  const emailCol = Object.entries(columnMap).find(([, v]) => v.field === "_sc_email")?.[0];
  const phoneCol = Object.entries(columnMap).find(([, v]) => v.field === "_sc_phone")?.[0];

  const name = nameCol && row[nameCol] ? String(row[nameCol]).trim() : "";
  const email = emailCol && row[emailCol] ? String(row[emailCol]).trim() : "";
  const phone = phoneCol && row[phoneCol] ? String(row[phoneCol]).trim() : "";

  if (!name && !email && !phone) return null;
  return { contact_name: name, contact_email: email, contact_phone: phone };
}

function extractSecondaryBanking(
  row: Record<string, string>,
  columnMap: RichColumnMapping,
): Record<string, string> | null {
  const nameCol = Object.entries(columnMap).find(([, v]) => v.field === "_sb_bank_name")?.[0];
  const acctNoCol = Object.entries(columnMap).find(([, v]) => v.field === "_sb_account_number")?.[0];
  const acctNameCol = Object.entries(columnMap).find(([, v]) => v.field === "_sb_account_name")?.[0];

  const name = nameCol && row[nameCol] ? String(row[nameCol]).trim() : "";
  const acctNo = acctNoCol && row[acctNoCol] ? String(row[acctNoCol]).trim() : "";
  const acctName = acctNameCol && row[acctNameCol] ? String(row[acctNameCol]).trim() : "";

  if (!name && !acctNo && !acctName) return null;
  return { bank_name: name, account_number: acctNo, account_name: acctName };
}

export async function importVendorsFromFile(
  buffer: ArrayBuffer,
  authSupabase: SupabaseClient,
  userId: string,
): Promise<ImportResult> {
  let rows: Record<string, string>[];
  try {
    rows = parseFile(buffer);
  } catch {
    return { created: 0, updated: 0, errors: [{ row: 0, reason: "Failed to parse file. Ensure it's valid CSV or Excel." }], totalRows: 0, summary: "File parse failed." };
  }

  if (rows.length === 0) {
    return { created: 0, updated: 0, errors: [{ row: 0, reason: "File appears to be empty." }], totalRows: 0, summary: "File is empty." };
  }

  const fileHeaders = Object.keys(rows[0]);
  const columnMap: RichColumnMapping = buildRichColumnMap(fileHeaders);
  const unmapped = fileHeaders.filter((h) => columnMap[h]?.source === "unmapped");
  const validStatuses = ["pending", "active", "inactive"];

  const supabase = createServiceRoleClient();

  const getVal = (row: Record<string, string>, targetField: string): string => {
    const fc = Object.keys(columnMap).find((k) => columnMap[k]?.field === targetField);
    return fc ? String(row[fc] ?? "").trim() : "";
  };

  const groups = new Map<string, { row: Record<string, string>; rowIndex: number }[]>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const nameRaw = getVal(row, "name");
    const tinRaw = getVal(row, "tin");
    const name = String(nameRaw).trim().toLowerCase();
    const tin = String(tinRaw).trim().toLowerCase();
    const key = name || tin || `row_${i}`;
    const group = groups.get(key) || [];
    group.push({ row, rowIndex: i });
    groups.set(key, group);
  }

  let created = 0;
  let updated = 0;
  const errors: { row: number; reason: string }[] = [];

  for (const [, group] of groups) {
    const firstRow = group[0].row;

    try {
      const mainFields: Record<string, any> = {};
      for (const [fileCol, mapping] of Object.entries(columnMap)) {
        if (mapping.field && VALID_VENDOR_FIELDS.has(mapping.field)) {
          const val = firstRow[fileCol];
          mainFields[mapping.field] = val !== undefined && val !== null ? String(val).trim() : null;
        }
      }

      const name = getVal(firstRow, "name");
      if (!name) {
        for (const g of group) errors.push({ row: g.rowIndex + 2, reason: "Missing vendor name." });
        continue;
      }
      mainFields.name = name;

      if (mainFields.status && !validStatuses.includes(mainFields.status.toLowerCase())) {
        mainFields.status = "pending";
      }

      const secondaryContacts: Record<string, string>[] = [];
      const secondaryBanking: Record<string, string>[] = [];

      for (const g of group) {
        const sc = extractSecondaryContact(g.row, columnMap);
        if (sc) secondaryContacts.push(sc);
        const sb = extractSecondaryBanking(g.row, columnMap);
        if (sb) secondaryBanking.push(sb);
      }

      const { data: existing } = await supabase
        .from("vendors")
        .select("id, secondary_contacts, secondary_banking, name, tin")
        .or(`name.ilike.${mainFields.name.replace(/'/g, "''")}${mainFields.tin ? `,tin.ilike.${mainFields.tin.replace(/'/g, "''")}` : ""}`)
        .is("deleted_at", null)
        .maybeSingle();

      if (existing) {
        const updateFields: Record<string, any> = { updated_at: new Date().toISOString() };
        for (const [k, v] of Object.entries(mainFields)) {
          if (k !== "name") updateFields[k] = v;
        }

        const mergedContacts = [...(existing.secondary_contacts || []), ...secondaryContacts];
        const mergedBanking = [...(existing.secondary_banking || []), ...secondaryBanking];
        if (mergedContacts.length) updateFields.secondary_contacts = mergedContacts;
        if (mergedBanking.length) updateFields.secondary_banking = mergedBanking;

        const { error: updateErr } = await supabase
          .from("vendors")
          .update(updateFields)
          .eq("id", existing.id);
        if (updateErr) {
          for (const g of group) errors.push({ row: g.rowIndex + 2, reason: updateErr.message });
          continue;
        }
        updated++;
      } else {
        const insertData: Record<string, any> = {
          ...mainFields,
          status: mainFields.status || "pending",
          secondary_contacts: secondaryContacts.length ? secondaryContacts : [],
          secondary_banking: secondaryBanking.length ? secondaryBanking : [],
          created_by: userId,
        };
        const { error: insertErr } = await supabase
          .from("vendors")
          .insert(insertData);
        if (insertErr) {
          for (const g of group) errors.push({ row: g.rowIndex + 2, reason: insertErr.message });
          continue;
        }
        created++;
      }
    } catch (err: any) {
      for (const g of group) errors.push({ row: g.rowIndex + 2, reason: err.message || "Unexpected error" });
    }
  }

  await recordAuditLog({
    entity_type: "vendor",
    entity_id: "bulk",
    action: "CREATE",
    changes: { after: { import_summary: { created, updated, errors: errors.length } } },
    performed_by: userId,
  });

  const unmappedNote = unmapped.length > 0 ? ` (${unmapped.length} unmapped columns: ${unmapped.join(", ")})` : "";
  const summary = `Imported ${created} vendor${created !== 1 ? "s" : ""}${updated > 0 ? `, updated ${updated} existing` : ""}${errors.length > 0 ? `, ${errors.length} error${errors.length > 1 ? "s" : ""}` : ""}.${unmappedNote}`;

  return { created, updated, errors, totalRows: rows.length, summary };
}

export async function importCustomersFromFile(
  buffer: ArrayBuffer,
  authSupabase: SupabaseClient,
  userId: string,
): Promise<ImportResult> {
  let rows: Record<string, string>[];
  try {
    rows = parseFile(buffer);
  } catch {
    return { created: 0, updated: 0, errors: [{ row: 0, reason: "Failed to parse file. Ensure it's valid CSV or Excel." }], totalRows: 0, summary: "File parse failed." };
  }

  if (rows.length === 0) {
    return { created: 0, updated: 0, errors: [{ row: 0, reason: "File appears to be empty." }], totalRows: 0, summary: "File is empty." };
  }

  const fileHeaders = Object.keys(rows[0]);
  const columnMap = buildRichColumnMap(fileHeaders);
  const unmapped = fileHeaders.filter((h) => columnMap[h]?.source === "unmapped");
  const validStatuses = ["pending", "active", "inactive"];

  const supabase = createServiceRoleClient();

  const getVal = (row: Record<string, string>, targetField: string): string => {
    const fc = Object.keys(columnMap).find((k) => columnMap[k]?.field === targetField);
    return fc ? String(row[fc] ?? "").trim() : "";
  };

  const accountContactMap = new Map<string, { row: Record<string, string>; rowIndex: number }[]>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const companyNameRaw = getVal(row, "company_name");
    const tinRaw = getVal(row, "tin");
    const companyName = String(companyNameRaw).trim().toLowerCase();
    const tin = String(tinRaw).trim().toLowerCase();
    const key = companyName || tin || `row_${i}`;
    const existing = accountContactMap.get(key) || [];
    existing.push({ row, rowIndex: i });
    accountContactMap.set(key, existing);
  }

  let created = 0;
  let updated = 0;
  let contactsCreated = 0;
  const errors: { row: number; reason: string }[] = [];

  for (const [, contactRows] of accountContactMap) {
    try {
      const firstRow = contactRows[0].row;
      const accountData: Record<string, any> = {};
      for (const [fileCol, mapping] of Object.entries(columnMap)) {
        if (mapping.field && VALID_CRM_ACCOUNT_FIELDS.has(mapping.field)) {
          const val = firstRow[fileCol];
          accountData[mapping.field] = val !== undefined && val !== null ? String(val).trim() : null;
        }
      }

      const companyName = accountData.company_name;
      if (!companyName) {
        for (const cr of contactRows) errors.push({ row: cr.rowIndex + 2, reason: "Missing company name." });
        continue;
      }

      if (accountData.status && !validStatuses.includes(accountData.status.toLowerCase())) {
        accountData.status = "pending";
      }
      const effectiveStatus = accountData.status || "pending";
      accountData.company_type =
        effectiveStatus === "active" ? "active_customer"
        : effectiveStatus === "inactive" ? "inactive_customer"
        : "prospect";

      const { data: existingAccount } = await supabase
        .from("crm_accounts")
        .select("id")
        .or(`company_name.ilike.${companyName.replace(/'/g, "''")}${accountData.tin ? `,tin.ilike.${accountData.tin.replace(/'/g, "''")}` : ""}`)
        .is("deleted_at", null)
        .maybeSingle();

      let accountId: string;

      if (existingAccount) {
        accountId = existingAccount.id;
        const updateFields: Record<string, any> = { updated_at: new Date().toISOString() };
        for (const [k, v] of Object.entries(accountData)) {
          if (k !== "company_name") updateFields[k] = v;
        }
        const { error: updateErr } = await supabase
          .from("crm_accounts")
          .update(updateFields)
          .eq("id", accountId);
        if (updateErr) {
          for (const cr of contactRows) errors.push({ row: cr.rowIndex + 2, reason: updateErr.message });
          continue;
        }
        updated++;
      } else {
        const { data: newAccount, error: insertErr } = await supabase
          .from("crm_accounts")
          .insert({ ...accountData, status: effectiveStatus, created_by: userId })
          .select("id")
          .single();
        if (insertErr || !newAccount) {
          for (const cr of contactRows) errors.push({ row: cr.rowIndex + 2, reason: insertErr?.message || "Failed to create account" });
          continue;
        }
        accountId = newAccount.id;
        created++;
      }

      let firstContact = true;
      for (const cr of contactRows) {
        try {
          const contactData: Record<string, any> = {};
          for (const [fileCol, mapping] of Object.entries(columnMap)) {
            if (mapping.field) {
              const rawVal = cr.row[fileCol];
              const val = rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== "" ? String(rawVal).trim() : null;
              if (["full_name", "contact_person"].includes(mapping.field)) {
                contactData.full_name = val;
              } else if (["email", "contact_email"].includes(mapping.field)) {
                contactData.email = val;
              } else if (["phone", "contact_phone"].includes(mapping.field)) {
                contactData.phone = val;
              } else if (["fax", "contact_fax"].includes(mapping.field)) {
                contactData.fax = val;
              } else if (mapping.field === "job_title") {
                contactData.job_title = val;
              }
            }
          }

          if (!contactData.full_name && !contactData.email && !contactData.phone) {
            // If there's no contact information for this row, just skip creating a contact.
            // This allows importing companies without contacts, or handles merged cells gracefully.
            continue;
          }

          // DB requires full_name — fall back to email or phone if name is missing
          if (!contactData.full_name) {
            contactData.full_name = contactData.email || contactData.phone;
          }

          if (contactData.email) {
            const { data: existingContact } = await supabase
              .from("crm_contacts")
              .select("id")
              .eq("account_id", accountId)
              .eq("email", contactData.email)
              .is("deleted_at", null)
              .maybeSingle();

            if (existingContact) {
              const { error: updateContactErr } = await supabase
                .from("crm_contacts")
                .update({ ...contactData, is_primary: firstContact, updated_at: new Date().toISOString(), deleted_at: null })
                .eq("id", existingContact.id);
              if (updateContactErr) {
                errors.push({ row: cr.rowIndex + 2, reason: updateContactErr.message });
              }
              contactsCreated++;
              firstContact = false;
              continue;
            }
          }

          const { error: insertContactErr } = await supabase
            .from("crm_contacts")
            .insert({ ...contactData, account_id: accountId, is_primary: firstContact, created_by: userId });
          if (insertContactErr) {
            errors.push({ row: cr.rowIndex + 2, reason: insertContactErr.message });
          } else {
            contactsCreated++;
          }
          firstContact = false;
        } catch (err: any) {
          errors.push({ row: cr.rowIndex + 2, reason: err.message || "Unexpected error" });
        }
      }
    } catch (err: any) {
      for (const cr of contactRows) errors.push({ row: cr.rowIndex + 2, reason: err.message || "Unexpected error" });
    }
  }

  await recordAuditLog({
    entity_type: "crm_account",
    entity_id: "bulk",
    action: "CREATE",
    changes: { after: { import_summary: { accounts_created: created, accounts_updated: updated, contacts_created: contactsCreated, errors: errors.length } } },
    performed_by: userId,
  });

  const unmappedNote = unmapped.length > 0 ? ` (${unmapped.length} unmapped columns: ${unmapped.join(", ")})` : "";
  const summary = `Imported ${created} customer${created !== 1 ? "s" : ""}${updated > 0 ? `, updated ${updated} existing` : ""}${contactsCreated > 0 ? `, ${contactsCreated} contact${contactsCreated > 1 ? "s" : ""}` : ""}${errors.length > 0 ? `, ${errors.length} error${errors.length > 1 ? "s" : ""}` : ""}.${unmappedNote}`;

  return { created, updated, errors, totalRows: rows.length, summary };
}
