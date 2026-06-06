/**
 * Interactive database purge tool.
 * Pick which module groups to wipe via checkbox prompts.
 *
 * Usage:
 *   npx tsx scripts/purge-db.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */

import * as p from "@clack/prompts";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";
import color from "picocolors";

config({ path: resolve(process.cwd(), ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  p.log.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

// ─── Table metadata ───────────────────────────────────────────────────────────
// pkCol: which column to filter on for "delete all rows"
// Tables are listed in topological order (children first) so FK constraints
// are never violated regardless of which groups the user selects.

interface TableMeta {
  table: string;
  group: string;
  pkCol: string;   // column used for the "not is null" delete filter
}

const ALL_TABLES: TableMeta[] = [
  // ── CRM (no FK parents here) ─────────────────────────────────────────────
  { table: "crm_activities",        group: "crm",         pkCol: "id" },
  { table: "crm_document_versions", group: "crm",         pkCol: "id" },
  { table: "crm_documents",         group: "crm",         pkCol: "id" },
  { table: "crm_opportunities",     group: "crm",         pkCol: "id" },
  { table: "crm_contacts",          group: "crm",         pkCol: "id" },
  { table: "crm_accounts",          group: "crm",         pkCol: "id" },

  // ── PO children (must come before purchase_orders) ───────────────────────
  { table: "purchase_order_artifacts", group: "procurement", pkCol: "id" },
  { table: "po_line_items",            group: "procurement", pkCol: "id" },
  { table: "po_site_details",          group: "procurement", pkCol: "id" },

  // ── Accounting (service_invoices.po_id → purchase_orders — must go first) ─
  { table: "payments",          group: "accounting", pkCol: "id" },
  { table: "service_invoices",  group: "accounting", pkCol: "id" },

  // ── PO parent (safe now that children + invoices are gone) ───────────────
  { table: "purchase_orders",   group: "procurement", pkCol: "id" },

  // ── HR & Assets ──────────────────────────────────────────────────────────
  { table: "asset_maintenance_logs", group: "hr",      pkCol: "id" },
  { table: "employee_documents",     group: "hr",      pkCol: "id" },
  { table: "assets",                 group: "hr",      pkCol: "id" },
  { table: "asset_categories",       group: "hr",      pkCol: "id" },

  // ── Documents ────────────────────────────────────────────────────────────
  { table: "erp_document_comments", group: "documents", pkCol: "id" },
  { table: "erp_document_versions", group: "documents", pkCol: "id" },
  { table: "erp_documents",         group: "documents", pkCol: "id" },
  { table: "collab_documents",      group: "documents", pkCol: "document_name" }, // text PK
  { table: "tvph_documents",        group: "documents", pkCol: "id" },
  { table: "document_categories",   group: "documents", pkCol: "id" },

  // ── Misc ─────────────────────────────────────────────────────────────────
  { table: "magic_links",        group: "misc", pkCol: "id" },
  { table: "notifications",      group: "misc", pkCol: "id" },
  { table: "internal_entities",  group: "misc", pkCol: "id" },

  // ── Vendor junction before parents ───────────────────────────────────────
  { table: "project_vendors",   group: "vendors", pkCol: "project_id" }, // composite PK
  { table: "vendor_documents",  group: "vendors", pkCol: "id" },
  { table: "vendor_contracts",  group: "vendors", pkCol: "id" },
  { table: "vendors",           group: "vendors", pkCol: "id" },

  // ── Projects (referenced by project_vendors above) ───────────────────────
  { table: "projects",          group: "projects", pkCol: "id" },

  // ── Audit (optional, always last) ────────────────────────────────────────
  { table: "audit_logs",        group: "audit",    pkCol: "id" },
];

// ─── UI groups ────────────────────────────────────────────────────────────────

const GROUPS = [
  { value: "crm",         label: "CRM",                    hint: "accounts, contacts, opportunities, activities, documents" },
  { value: "procurement", label: "Procurement & POs",      hint: "purchase orders, line items, site details, artifacts" },
  { value: "accounting",  label: "Accounting",             hint: "service invoices, payments" },
  { value: "vendors",     label: "Vendors",                hint: "vendors, contracts, documents, project links" },
  { value: "projects",    label: "Projects",               hint: "projects table" },
  { value: "hr",          label: "HR & Assets",            hint: "assets, categories, maintenance logs, employee documents" },
  { value: "documents",   label: "Documents & Collateral", hint: "ERP docs, collab docs, TVPH docs, categories" },
  { value: "misc",        label: "Misc",                   hint: "magic links, notifications, internal entities" },
  { value: "audit",       label: "Audit Logs",             hint: "⚠  clears the full activity trail" },
];

// ─── Delete helper ────────────────────────────────────────────────────────────

async function deleteAll(meta: TableMeta): Promise<"ok" | string> {
  const { error } = await supabase
    .from(meta.table)
    .delete()
    .not(meta.pkCol, "is", null);

  if (!error) return "ok";
  return error.message;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.clear();
  p.intro(color.bgRed(color.white(color.bold("  TVPH ERP — Database Purge  "))));
  p.note(
    `${color.yellow("profiles")} and ${color.yellow("auth.users")} are always preserved.\nAll other selected data is ${color.bold("permanently deleted")}.`,
    "Heads up",
  );

  const selected = await p.multiselect({
    message: "Select module groups to purge",
    options: GROUPS.map((g) => ({ value: g.value, label: g.label, hint: g.hint })),
    required: true,
  });

  if (p.isCancel(selected)) { p.cancel("Cancelled."); process.exit(0); }

  const selectedGroups = new Set(selected as string[]);
  const tables = ALL_TABLES.filter((t) => selectedGroups.has(t.group));

  const chosenGroups = GROUPS.filter((g) => selectedGroups.has(g.value));
  const summary = chosenGroups.map((g) => {
    const n = tables.filter((t) => t.group === g.value).length;
    return `  • ${g.label} (${n} table${n !== 1 ? "s" : ""})`;
  }).join("\n");

  p.note(summary, `${tables.length} tables will be wiped`);

  const confirmed = await p.confirm({
    message: color.red("This is irreversible. Proceed?"),
    initialValue: false,
  });

  if (!confirmed || p.isCancel(confirmed)) { p.cancel("Cancelled."); process.exit(0); }

  const spin = p.spinner();
  spin.start("Purging…");

  let ok = 0, fail = 0;
  const errors: string[] = [];

  for (const meta of tables) {
    const result = await deleteAll(meta);
    if (result === "ok") {
      ok++;
      spin.message(`${color.green("✓")} ${meta.table}`);
    } else {
      fail++;
      errors.push(`${meta.table}: ${result}`);
      spin.message(`${color.yellow("⚠")} ${meta.table}`);
    }
  }

  spin.stop(`Done — ${color.green(`${ok} cleared`)}${fail ? color.yellow(`, ${fail} failed`) : ""}`);

  if (errors.length) p.note(errors.join("\n"), color.yellow("Warnings"));

  p.outro(ok === tables.length ? color.green("All done.") : color.yellow("Done with some warnings."));
}

main().catch((e) => { p.log.error(String(e)); process.exit(1); });
