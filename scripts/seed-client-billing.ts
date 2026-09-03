/**
 * Seed client_billing with realistic mock data covering the updated workflow.
 * - Invoice number nullable (null on for_billing drafts, filled on approval)
 * - Free-text project on one row, linked project on the rest
 * - Node details with mixed MRS (full / partial / none)
 * - Due date = issued + 30 days
 * - RTD SharePoint link on some approved rows
 *
 * Usage:
 *   npx tsx scripts/seed-client-billing.ts [--wipe] [--dry-run]
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const wipe = process.argv.includes("--wipe");
const dryRun = process.argv.includes("--dry-run");

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

// ─── helpers ──────────────────────────────────────────────────────────────────
const today = new Date();
today.setHours(0, 0, 0, 0);
const toISO = (d: Date) => d.toISOString().split("T")[0]!;
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
const vatInc = (ex: number) => Math.round(ex * 1.12);

// ─── row specs ────────────────────────────────────────────────────────────────
type NodeSpec = { node_id: string; region: string; area_city: string; phase: string; cable: number; has_mrs: boolean };
type Spec = {
  invoice_number: string | null;
  invoice_batch: string | null;
  projectFree: string | null; // if set, project_id = null and this is stored as project_name_free
  region: string;
  amount_vat_ex: number;
  status: "for_billing" | "pending_sky_technical" | "pending_payment" | "collected";
  issuedOffset: number;
  endorsedOffset: number | null;
  collectedOffset: number | null;
  notes: string;
  rtdUrl: string | null;
  nodes: NodeSpec[];
};

function atTime(dateStr: string, hh = 9): string {
  return new Date(dateStr + `T${String(hh).padStart(2, "0")}:00:00.000Z`).toISOString();
}

function buildTimeline(spec: Spec, dates: { issued: string; endorsed: string | null; collected: string | null }, createdBy: string | null) {
  const chain: { from: string | null; to: string; at: string; note: string }[] = [];
  chain.push({ from: null, to: "for_billing", at: atTime(dates.issued, 9), note: "For Billing — created" });
  if (spec.status === "for_billing") return chain;

  let approvalAt: string;
  if (dates.endorsed) {
    const endorsedD = new Date(dates.endorsed);
    const apprD = new Date(endorsedD.getTime() - 3 * 86400000);
    if (apprD <= new Date(dates.issued)) apprD.setTime(new Date(dates.issued).getTime() + 2 * 86400000);
    approvalAt = atTime(apprD.toISOString().split("T")[0]!, 10);
  } else {
    approvalAt = atTime(addDays(new Date(dates.issued), 4).toISOString().split("T")[0]!, 10);
  }
  chain.push({ from: "for_billing", to: "pending_sky_technical", at: approvalAt, note: "Submitted to Sky Technical" });
  if (spec.status === "pending_sky_technical") return chain;

  if (dates.endorsed) {
    chain.push({ from: "pending_sky_technical", to: "for_payment", at: atTime(dates.endorsed, 11), note: "Sky Technical approved — endorsed to finance" });
    chain.push({ from: "for_payment", to: "pending_payment", at: new Date(new Date(atTime(dates.endorsed, 11)).getTime() + 3600000).toISOString(), note: "Pending payment — finance received" });
  }
  if (spec.status === "pending_payment") return chain;
  if (dates.collected) chain.push({ from: "pending_payment", to: "collected", at: dates.collected, note: "Collected — payment received" });
  return chain;
}

const RTD = "https://telcovantage.sharepoint.com/sites/RTD/billing-sample.pdf";

const specs: Spec[] = [
  // ── for_billing: drafts with no invoice yet (pending invoice assignment) ────
  {
    invoice_number: null, invoice_batch: null, projectFree: null, region: "NCR", amount_vat_ex: 185000,
    status: "for_billing", issuedOffset: -2, endorsedOffset: null, collectedOffset: null,
    notes: "Draft: invoice to be assigned at Sky Technical approval. 3 nodes, 2 with MRS.",
    rtdUrl: null,
    nodes: [
      { node_id: "NCR-001", region: "NCR", area_city: "Quezon City", phase: "1", cable: 0.52, has_mrs: true },
      { node_id: "NCR-002", region: "NCR", area_city: "Quezon City", phase: "1", cable: 0.48, has_mrs: true },
      { node_id: "NCR-003", region: "NCR", area_city: "Quezon City", phase: "1", cable: 0.61, has_mrs: false },
    ],
  },
  {
    invoice_number: null, invoice_batch: null, projectFree: "Sky Fiber Expansion — Phase 3 (free text)", region: "CALABARZON", amount_vat_ex: 95000,
    status: "for_billing", issuedOffset: -5, endorsedOffset: null, collectedOffset: null,
    notes: "Draft with free-text project (no linked project). 2 nodes, all with MRS.",
    rtdUrl: null,
    nodes: [
      { node_id: "CBZ-010", region: "CALABARZON", area_city: "Cavite", phase: "2", cable: 1.2, has_mrs: true },
      { node_id: "CBZ-011", region: "CALABARZON", area_city: "Cavite", phase: "2", cable: 0.85, has_mrs: true },
    ],
  },
  {
    invoice_number: null, invoice_batch: null, projectFree: null, region: "Region III", amount_vat_ex: 240000,
    status: "for_billing", issuedOffset: -7, endorsedOffset: null, collectedOffset: null,
    notes: "Draft: 5 nodes, only 2 with MRS — will trigger MRS summary email.",
    rtdUrl: null,
    nodes: [
      { node_id: "R3-020", region: "Region III", area_city: "Angeles", phase: "1", cable: 0.33, has_mrs: true },
      { node_id: "R3-021", region: "Region III", area_city: "Angeles", phase: "1", cable: 0.41, has_mrs: false },
      { node_id: "R3-022", region: "Region III", area_city: "Angeles", phase: "1", cable: 0.55, has_mrs: true },
      { node_id: "R3-023", region: "Region III", area_city: "Angeles", phase: "1", cable: 0.38, has_mrs: false },
      { node_id: "R3-024", region: "Region III", area_city: "Angeles", phase: "1", cable: 0.62, has_mrs: false },
    ],
  },
  // ── pending_sky_technical: submitted, invoice assigned at submit ───────────
  {
    invoice_number: "INV-2026-101", invoice_batch: "BATCH-AUG-01", projectFree: null, region: "NCR", amount_vat_ex: 420000,
    status: "pending_sky_technical", issuedOffset: -15, endorsedOffset: null, collectedOffset: null,
    notes: "Submitted to Sky Technical — awaiting approval. Invoice assigned.",
    rtdUrl: RTD,
    nodes: [
      { node_id: "NCR-100", region: "NCR", area_city: "Makati", phase: "1", cable: 0.72, has_mrs: true },
      { node_id: "NCR-101", region: "NCR", area_city: "Makati", phase: "1", cable: 0.65, has_mrs: true },
      { node_id: "NCR-102", region: "NCR", area_city: "Makati", phase: "1", cable: 0.58, has_mrs: false },
      { node_id: "NCR-103", region: "NCR", area_city: "Makati", phase: "1", cable: 0.44, has_mrs: true },
    ],
  },
  {
    invoice_number: "INV-2026-102", invoice_batch: "BATCH-AUG-01", projectFree: null, region: "Region VI", amount_vat_ex: 310000,
    status: "pending_sky_technical", issuedOffset: -18, endorsedOffset: null, collectedOffset: null,
    notes: "Pending Sky Technical — 8 nodes, mixed MRS (email summary case).",
    rtdUrl: RTD,
    nodes: [
      { node_id: "R6-030", region: "Region VI", area_city: "Iloilo City", phase: "3", cable: 0.35, has_mrs: true },
      { node_id: "R6-031", region: "Region VI", area_city: "Iloilo City", phase: "3", cable: 0.42, has_mrs: false },
      { node_id: "R6-032", region: "Region VI", area_city: "Iloilo City", phase: "3", cable: 0.51, has_mrs: true },
      { node_id: "R6-033", region: "Region VI", area_city: "Iloilo City", phase: "3", cable: 0.29, has_mrs: false },
      { node_id: "R6-034", region: "Region VI", area_city: "Iloilo City", phase: "3", cable: 0.66, has_mrs: true },
      { node_id: "R6-035", region: "Region VI", area_city: "Iloilo City", phase: "3", cable: 0.38, has_mrs: false },
      { node_id: "R6-036", region: "Region VI", area_city: "Iloilo City", phase: "3", cable: 0.47, has_mrs: true },
      { node_id: "R6-037", region: "Region VI", area_city: "Iloilo City", phase: "3", cable: 0.33, has_mrs: false },
    ],
  },
  // ── pending_payment: approved & endorsed, aging bands ────────────────────
  {
    invoice_number: "INV-2026-080", invoice_batch: "BATCH-JUL-02", projectFree: null, region: "NCR", amount_vat_ex: 380000,
    status: "pending_payment", issuedOffset: -30, endorsedOffset: -5, collectedOffset: null,
    notes: "Pending — healthy (>7d to due).",
    rtdUrl: RTD,
    nodes: [
      { node_id: "NCR-200", region: "NCR", area_city: "Pasig", phase: "1", cable: 0.9, has_mrs: true },
      { node_id: "NCR-201", region: "NCR", area_city: "Pasig", phase: "1", cable: 0.75, has_mrs: true },
    ],
  },
  {
    invoice_number: "INV-2026-081", invoice_batch: "BATCH-JUL-02", projectFree: null, region: "Region I", amount_vat_ex: 175000,
    status: "pending_payment", issuedOffset: -35, endorsedOffset: -8, collectedOffset: null,
    notes: "Pending — close due (≤7d).",
    rtdUrl: RTD,
    nodes: [
      { node_id: "R1-040", region: "Region I", area_city: "Dagupan", phase: "2", cable: 1.1, has_mrs: false },
      { node_id: "R1-041", region: "Region I", area_city: "Dagupan", phase: "2", cable: 0.95, has_mrs: true },
      { node_id: "R1-042", region: "Region I", area_city: "Dagupan", phase: "2", cable: 0.88, has_mrs: false },
    ],
  },
  {
    invoice_number: "INV-2026-082", invoice_batch: "BATCH-JUL-03", projectFree: null, region: "Region VII", amount_vat_ex: 290000,
    status: "pending_payment", issuedOffset: -40, endorsedOffset: -12, collectedOffset: null,
    notes: "Pending — overdue 4d.",
    rtdUrl: RTD,
    nodes: [
      { node_id: "R7-050", region: "Region VII", area_city: "Cebu City", phase: "1", cable: 0.6, has_mrs: true },
      { node_id: "R7-051", region: "Region VII", area_city: "Cebu City", phase: "1", cable: 0.55, has_mrs: true },
    ],
  },
  {
    invoice_number: "INV-2026-083", invoice_batch: "BATCH-JUL-03", projectFree: null, region: "MIMAROPA", amount_vat_ex: 510000,
    status: "pending_payment", issuedOffset: -45, endorsedOffset: -20, collectedOffset: null,
    notes: "Pending — overdue 18d, large amount.",
    rtdUrl: RTD,
    nodes: [
      { node_id: "MIM-060", region: "MIMAROPA", area_city: "Puerto Princesa", phase: "1", cable: 2.1, has_mrs: true },
      { node_id: "MIM-061", region: "MIMAROPA", area_city: "Puerto Princesa", phase: "1", cable: 1.8, has_mrs: true },
      { node_id: "MIM-062", region: "MIMAROPA", area_city: "Puerto Princesa", phase: "1", cable: 1.5, has_mrs: true },
      { node_id: "MIM-063", region: "MIMAROPA", area_city: "Puerto Princesa", phase: "1", cable: 1.2, has_mrs: true },
    ],
  },
  {
    invoice_number: "INV-2026-084", invoice_batch: "BATCH-JUL-04", projectFree: null, region: "Region X", amount_vat_ex: 125000,
    status: "pending_payment", issuedOffset: -50, endorsedOffset: -15, collectedOffset: null,
    notes: "Pending — overdue 1d.",
    rtdUrl: null,
    nodes: [
      { node_id: "R10-070", region: "Region X", area_city: "Cagayan de Oro", phase: "1", cable: 0.4, has_mrs: false },
    ],
  },
  {
    invoice_number: "INV-2026-085", invoice_batch: "BATCH-JUL-04", projectFree: null, region: "BARMM", amount_vat_ex: 220000,
    status: "pending_payment", issuedOffset: -28, endorsedOffset: -6, collectedOffset: null,
    notes: "Pending — healthy, BARMM region.",
    rtdUrl: RTD,
    nodes: [
      { node_id: "BAR-080", region: "BARMM", area_city: "Cotabato City", phase: "1", cable: 0.7, has_mrs: true },
      { node_id: "BAR-081", region: "BARMM", area_city: "Cotabato City", phase: "1", cable: 0.6, has_mrs: false },
    ],
  },
  // ── collected: spread across last 6 months for trends ──────────────────
  {
    invoice_number: "INV-2026-060", invoice_batch: "BATCH-JUN-01", projectFree: null, region: "NCR", amount_vat_ex: 450000,
    status: "collected", issuedOffset: -90, endorsedOffset: -70, collectedOffset: -5,
    notes: "Collected this month.",
    rtdUrl: RTD,
    nodes: [
      { node_id: "NCR-300", region: "NCR", area_city: "Taguig", phase: "2", cable: 0.8, has_mrs: true },
      { node_id: "NCR-301", region: "NCR", area_city: "Taguig", phase: "2", cable: 0.65, has_mrs: true },
      { node_id: "NCR-302", region: "NCR", area_city: "Taguig", phase: "2", cable: 0.55, has_mrs: true },
    ],
  },
  {
    invoice_number: "INV-2026-050", invoice_batch: "BATCH-MAY-01", projectFree: null, region: "Region VII", amount_vat_ex: 335000,
    status: "collected", issuedOffset: -110, endorsedOffset: -90, collectedOffset: -35,
    notes: "Collected last month.",
    rtdUrl: RTD,
    nodes: [
      { node_id: "R7-300", region: "Region VII", area_city: "Cebu", phase: "2", cable: 1.3, has_mrs: true },
      { node_id: "R7-301", region: "Region VII", area_city: "Cebu", phase: "2", cable: 1.0, has_mrs: true },
    ],
  },
  {
    invoice_number: "INV-2026-030", invoice_batch: "BATCH-MAR-01", projectFree: null, region: "Region XI", amount_vat_ex: 580000,
    status: "collected", issuedOffset: -150, endorsedOffset: -130, collectedOffset: -95,
    notes: "Collected ~3mo ago. Davao region.",
    rtdUrl: RTD,
    nodes: [
      { node_id: "R11-310", region: "Region XI", area_city: "Davao City", phase: "1", cable: 2.5, has_mrs: true },
      { node_id: "R11-311", region: "Region XI", area_city: "Davao City", phase: "1", cable: 2.0, has_mrs: true },
      { node_id: "R11-312", region: "Region XI", area_city: "Davao City", phase: "1", cable: 1.8, has_mrs: true },
      { node_id: "R11-313", region: "Region XI", area_city: "Davao City", phase: "1", cable: 1.5, has_mrs: true },
    ],
  },
  {
    invoice_number: "INV-2026-010", invoice_batch: "BATCH-JAN-01", projectFree: null, region: "CAR", amount_vat_ex: 195000,
    status: "collected", issuedOffset: -180, endorsedOffset: -160, collectedOffset: -140,
    notes: "Collected ~5mo ago. CAR region.",
    rtdUrl: null,
    nodes: [
      { node_id: "CAR-320", region: "CAR", area_city: "Baguio", phase: "1", cable: 0.95, has_mrs: true },
      { node_id: "CAR-321", region: "CAR", area_city: "Baguio", phase: "1", cable: 0.88, has_mrs: true },
    ],
  },
];

async function ensureAccounts() {
  const { data: accounts } = await supabase.from("crm_accounts").select("id, company_name").is("deleted_at", null).limit(10);
  if (accounts && accounts.length >= 2) return accounts as { id: string; company_name: string }[];
  console.log("No accounts found — creating 3 dummy clients...");
  if (dryRun) return [{ id: "dry-run-id-1", company_name: "SKY Fiber — Test" }, { id: "dry-run-id-2", company_name: "Globe Testco" }, { id: "dry-run-id-3", company_name: "Converge Test" }];
  const dummy = [
    { company_name: "SKY Fiber — Test", company_type: "active_customer", industry_note: "Telecom" },
    { company_name: "Globe Testco", company_type: "active_customer", industry_note: "Telecom" },
    { company_name: "Converge Test", company_type: "active_customer", industry_note: "Telecom" },
  ];
  const { data: inserted, error } = await supabase.from("crm_accounts").insert(dummy as any).select("id, company_name");
  if (error) { console.error("Failed to create dummy accounts:", error.message); process.exit(1); }
  console.log(`Created ${inserted?.length} dummy accounts.`);
  return inserted as any;
}

async function ensureProjects(accountIds: string[]) {
  const { data: projects } = await supabase.from("projects").select("id, name, account_id").is("deleted_at", null).in("account_id", accountIds).limit(10);
  if (projects && projects.length > 0) return projects as any[];
  const { data: anyProjects } = await supabase.from("projects").select("id, name").is("deleted_at", null).limit(5);
  if (anyProjects && anyProjects.length > 0) return anyProjects as any[];
  console.log("No projects found — rows will have project_id = null (free text or null).");
  return [];
}

async function main() {
  console.log(`Seed client_billing — ${specs.length} rows — ${wipe ? "WIPE first" : "upsert"}${dryRun ? " (dry-run)" : ""}\n`);

  const accounts = await ensureAccounts();
  const projects = await ensureProjects(accounts.map((a: { id: string }) => a.id));
  const { data: profiles } = await supabase.from("profiles").select("id").limit(1);
  const createdBy = profiles?.[0]?.id ?? null;

  if (wipe && !dryRun) {
    const { data: toWipe } = await supabase.from("client_billing").select("id").like("invoice_number", "INV-%");
    if (toWipe?.length) await supabase.from("client_billing_timeline").delete().in("billing_id", toWipe.map((r: any) => r.id));
    const { error } = await supabase.from("client_billing").delete().like("invoice_number", "INV-%");
    if (error) console.error("Wipe warning:", error.message);
    else console.log("Wiped existing INV-% rows.\n");
    // also clear null-invoice drafts (can't match by invoice_number, so clear all for_billing without invoice)
    const { data: drafts } = await supabase.from("client_billing").select("id").is("invoice_number", null).is("deleted_at", null);
    if (drafts?.length) {
      await supabase.from("client_billing_timeline").delete().in("billing_id", drafts.map((r: any) => r.id));
      await supabase.from("client_billing_nodes").delete().in("billing_id", drafts.map((r: any) => r.id));
      await supabase.from("client_billing").delete().in("id", drafts.map((r: any) => r.id));
      console.log(`Wiped ${drafts.length} draft rows (null invoice).\n`);
    }
  }

  let created = 0, skipped = 0, failed = 0;

  for (let i = 0; i < specs.length; i++) {
    const s = specs[i]!;
    const account = accounts[i % accounts.length]!;
    const project = s.projectFree ? null : (projects.length ? projects[i % projects.length] : null);
    const amount_vat_inc = vatInc(s.amount_vat_ex);
    const date_issued = toISO(addDays(today, s.issuedOffset));
    const date_endorsed = s.endorsedOffset != null ? toISO(addDays(today, s.endorsedOffset)) : null;
    const due_date = toISO(addDays(new Date(date_issued), 30));
    const est_payment_date = toISO(addDays(new Date(due_date), 15));
    const collected_at = s.collectedOffset != null ? addDays(today, s.collectedOffset).toISOString() : null;
    const num_nodes = s.nodes.length;
    const region = s.nodes[0]?.region || s.region;

    // null-invoice rows can't use invoice_number for idempotency — skip check
    let existing: any = null;
    if (s.invoice_number) {
      const { data } = await supabase.from("client_billing").select("id, status, account_id").eq("invoice_number", s.invoice_number).is("deleted_at", null).maybeSingle();
      existing = data;
    }

    if (existing && !wipe) {
      const dates = { issued: date_issued, endorsed: date_endorsed, collected: collected_at };
      const chain = buildTimeline(s, dates, createdBy);
      const { data: existingTimeline } = await supabase.from("client_billing_timeline").select("id").eq("billing_id", existing.id);
      if ((existingTimeline?.length ?? 0) !== chain.length) {
        if (dryRun) console.log(`  ↻ ${s.invoice_number} — would repair timeline (${chain.length} steps)`);
        else {
          await supabase.from("client_billing_timeline").delete().eq("billing_id", existing.id);
          await supabase.from("client_billing_timeline").insert(chain.map(c => ({ billing_id: existing.id, from_status: c.from, to_status: c.to, changed_by: createdBy, changed_at: c.at, note: c.note })) as any);
          console.log(`  ↻ ${s.invoice_number} — timeline repaired`);
        }
      } else console.log(`  ↷ ${s.invoice_number} @ ${account.company_name} — exists, skip`);
      skipped++;
      continue;
    }

    if (dryRun) {
      const dates = { issued: date_issued, endorsed: date_endorsed, collected: collected_at };
      const chain = buildTimeline(s, dates, createdBy);
      const mrs = `${s.nodes.filter(n => n.has_mrs).length}/${s.nodes.length} MRS`;
      console.log(`  · ${s.invoice_number || "(no invoice)"} | ${account.company_name} | ${s.status} | ₱${amount_vat_inc.toLocaleString()} | due ${due_date} | ${mrs}${chain.length > 1 ? ` | ${chain.map(c => c.to).join(" → ")}` : ""}`);
      created++;
      continue;
    }

    let billingId: string | null = existing?.id ?? null;

    const payload: Record<string, any> = {
      account_id: account.id,
      project_id: project?.id ?? null,
      project_name_free: s.projectFree || null,
      invoice_number: s.invoice_number,
      invoice_batch: s.invoice_batch,
      region, num_nodes,
      amount_vat_ex: s.amount_vat_ex, amount_vat_inc,
      date_issued, date_endorsed, due_date, est_payment_date,
      status: s.status, notes: s.notes,
      file_url: s.rtdUrl, file_name: s.rtdUrl ? "RTD" : null,
      collected_at, updated_at: new Date().toISOString(),
    };

    if (billingId) {
      const { error: upErr } = await supabase.from("client_billing").update(payload).eq("id", billingId);
      if (upErr) { console.log(`  ✗ ${s.invoice_number || "(draft)"} update: ${upErr.message}`); failed++; continue; }
      await supabase.from("client_billing_timeline").delete().eq("billing_id", billingId);
      await supabase.from("client_billing_nodes").delete().eq("billing_id", billingId);
    } else {
      const { data: ins, error: insErr } = await supabase.from("client_billing").insert({ ...payload, created_by: createdBy }).select("id").single();
      if (insErr || !ins) { console.log(`  ✗ ${s.invoice_number || "(draft)"} insert: ${insErr?.message}`); failed++; continue; }
      billingId = (ins as any).id;
    }

    if (s.nodes.length) {
      const toInsert = s.nodes.map((n, idx) => ({
        billing_id: billingId, sn: idx + 1, region: n.region, area_city: n.area_city,
        node_id: n.node_id, phase: n.phase, no_of_nodes: 1, cable_length_km: n.cable, has_mrs: n.has_mrs,
      }));
      const { error: ndErr } = await supabase.from("client_billing_nodes").insert(toInsert as any);
      if (ndErr) console.log(`  ⚠ ${s.invoice_number || "(draft)"} nodes: ${ndErr.message}`);
    }

    {
      const dates = { issued: date_issued, endorsed: date_endorsed, collected: collected_at };
      const chain = buildTimeline(s, dates, createdBy);
      const { error: tlErr } = await supabase.from("client_billing_timeline").insert(chain.map(c => ({ billing_id: billingId, from_status: c.from, to_status: c.to, changed_by: createdBy, changed_at: c.at, note: c.note })) as any);
      if (tlErr) console.log(`  ⚠ ${s.invoice_number || "(draft)"} timeline: ${tlErr.message}`);
    }

    const mrs = `${s.nodes.filter(n => n.has_mrs).length}/${s.nodes.length} MRS`;
    console.log(`  ✓ ${s.invoice_number || "(no invoice)"} | ${account.company_name} | ${s.status} | ₱${amount_vat_inc.toLocaleString()} | ${mrs}`);
    created++;
  }

  if (dryRun) { console.log(`\nDry run — ${created} would be created.`); return; }

  const totalOutstanding = specs.filter(s => s.status !== "collected").reduce((a, s) => a + vatInc(s.amount_vat_ex), 0);
  const overdue = specs.filter(s => s.status === "pending_payment" && new Date(toISO(addDays(today, 30))) < today).reduce((a, s) => a + 0, 0);
  const totalCollected = specs.filter(s => s.status === "collected").reduce((a, s) => a + vatInc(s.amount_vat_ex), 0);
  console.log(`\nDone — ${created} written, ${skipped} skipped, ${failed} failed.`);
  console.log(`Dashboard preview: ar_outstanding ₱${totalOutstanding.toLocaleString()}, client_total_paid ₱${totalCollected.toLocaleString()}`);
  console.log(`Re-run is idempotent; add --wipe to reset.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
