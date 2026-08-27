/**
 * Seed client_billing for workflow + dashboard testing.
 * ponytail: single file, no new deps, idempotent via TEST- prefix.
 *
 * Usage:
 *   npx tsx scripts/seed-client-billing.ts [--wipe] [--dry-run]
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 * Safe to re-run — upserts on (account_id, invoice_number) and skips existing TEST- rows.
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
const addMonths = (d: Date, n: number) => {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
};
const vatInc = (ex: number) => Math.round(ex * 1.12);

// ─── row specs: cover every status + aging band + 6-month trend ───────────────
type Spec = {
  invoice_number: string;
  invoice_batch: string;
  region: string;
  num_nodes: number;
  amount_vat_ex: number;
  status: "for_billing" | "for_approval" | "pending_payment" | "collected";
  dueOffset: number; // days from today
  issuedOffset: number;
  endorsedOffset: number | null;
  collectedOffset: number | null; // days ago for collected_at
  notes: string;
};

// timeline needs a visible chain: for_billing → for_approval → endorsed (for_payment/pending) → collected
function atTime(dateStr: string, hh = 9): string {
  return new Date(dateStr + `T${String(hh).padStart(2, "0")}:00:00.000Z`).toISOString();
}
function buildTimeline(spec: Spec, dates: { issued: string; endorsed: string | null; collected: string | null }, createdBy: string | null) {
  // ponytail: minimal chain that shows each milestone date the user asked for
  const chain: { from: string | null; to: string; at: string; note: string }[] = [];
  chain.push({ from: null, to: "for_billing", at: atTime(dates.issued, 9), note: "For Billing — invoice issued" });
  if (spec.status === "for_billing") return chain;

  // approval date: 3 days before endorsed if endorsed exists, else 4 days after issued
  let approvalAt: string;
  if (dates.endorsed) {
    const endorsedD = new Date(dates.endorsed);
    const apprD = new Date(endorsedD.getTime() - 3 * 86400000);
    const issuedD = new Date(dates.issued);
    if (apprD <= issuedD) apprD.setTime(issuedD.getTime() + 2 * 86400000);
    approvalAt = atTime(apprD.toISOString().split("T")[0]!, 10);
  } else {
    const issuedD = new Date(dates.issued);
    const apprD = new Date(issuedD.getTime() + 4 * 86400000);
    approvalAt = atTime(apprD.toISOString().split("T")[0]!, 10);
  }
  chain.push({ from: "for_billing", to: "for_approval", at: approvalAt, note: "Approved — ready for endorsement" });

  if (spec.status === "for_approval") return chain;

  // endorsed = for_payment then auto pending_payment (same endorsed day, +1h)
  if (dates.endorsed) {
    chain.push({ from: "for_approval", to: "for_payment", at: atTime(dates.endorsed, 11), note: "Endorsed to client finance" });
    chain.push({ from: "for_payment", to: "pending_payment", at: new Date(new Date(atTime(dates.endorsed, 11)).getTime() + 3600000).toISOString(), note: "Pending payment — finance received" });
  }
  if (spec.status === "pending_payment") return chain;

  // collected
  if (dates.collected) {
    chain.push({ from: "pending_payment", to: "collected", at: dates.collected, note: "Collected — payment received" });
  }
  return chain;
}

const specs: Spec[] = [
  // for_billing — untouched, ready to test For Billing → For Approval
  { invoice_number: "TEST-2026-001", invoice_batch: "BATCH-2026-08-A", region: "NCR", num_nodes: 42, amount_vat_ex: 185000, status: "for_billing", dueOffset: 30, issuedOffset: -2, endorsedOffset: null, collectedOffset: null, notes: "Seed: for_billing — move to for_approval to test" },
  { invoice_number: "TEST-2026-002", invoice_batch: "BATCH-2026-08-A", region: "Luzon", num_nodes: 28, amount_vat_ex: 240000, status: "for_billing", dueOffset: 25, issuedOffset: -5, endorsedOffset: null, collectedOffset: null, notes: "Seed: for_billing" },
  { invoice_number: "TEST-2026-003", invoice_batch: "BATCH-2026-08-B", region: "Visayas", num_nodes: 15, amount_vat_ex: 95000, status: "for_billing", dueOffset: 18, issuedOffset: -10, endorsedOffset: null, collectedOffset: null, notes: "Seed: for_billing" },
  // for_approval — test For Approval → For Payment (auto Pending)
  { invoice_number: "TEST-2026-004", invoice_batch: "BATCH-2026-07-A", region: "Mindanao", num_nodes: 60, amount_vat_ex: 420000, status: "for_approval", dueOffset: 14, issuedOffset: -20, endorsedOffset: null, collectedOffset: null, notes: "Seed: for_approval — approve to for_payment/pending" },
  { invoice_number: "TEST-2026-005", invoice_batch: "BATCH-2026-07-A", region: "NCR", num_nodes: 33, amount_vat_ex: 310000, status: "for_approval", dueOffset: 10, issuedOffset: -25, endorsedOffset: null, collectedOffset: null, notes: "Seed: for_approval" },
  // pending_payment — aging bands: healthy, close_due, overdue x2, overdue long
  { invoice_number: "TEST-2026-006", invoice_batch: "BATCH-2026-07-B", region: "NCR", num_nodes: 50, amount_vat_ex: 380000, status: "pending_payment", dueOffset: 20, issuedOffset: -30, endorsedOffset: -5, collectedOffset: null, notes: "Seed: pending healthy (>7d to due)" },
  { invoice_number: "TEST-2026-007", invoice_batch: "BATCH-2026-06-A", region: "Luzon", num_nodes: 22, amount_vat_ex: 175000, status: "pending_payment", dueOffset: 5, issuedOffset: -35, endorsedOffset: -8, collectedOffset: null, notes: "Seed: pending close_due (≤7d)" },
  { invoice_number: "TEST-2026-008", invoice_batch: "BATCH-2026-06-A", region: "Visayas", num_nodes: 40, amount_vat_ex: 290000, status: "pending_payment", dueOffset: -4, issuedOffset: -40, endorsedOffset: -12, collectedOffset: null, notes: "Seed: pending overdue 4d — contributes to ar_overdue" },
  { invoice_number: "TEST-2026-009", invoice_batch: "BATCH-2026-06-B", region: "Mindanao", num_nodes: 55, amount_vat_ex: 510000, status: "pending_payment", dueOffset: -18, issuedOffset: -45, endorsedOffset: -20, collectedOffset: null, notes: "Seed: pending overdue 18d" },
  { invoice_number: "TEST-2026-010", invoice_batch: "BATCH-2026-05-A", region: "NCR", num_nodes: 18, amount_vat_ex: 125000, status: "pending_payment", dueOffset: -1, issuedOffset: -50, endorsedOffset: -15, collectedOffset: null, notes: "Seed: pending overdue 1d" },
  { invoice_number: "TEST-2026-011", invoice_batch: "BATCH-2026-05-A", region: "Luzon", num_nodes: 30, amount_vat_ex: 220000, status: "pending_payment", dueOffset: 12, issuedOffset: -28, endorsedOffset: -6, collectedOffset: null, notes: "Seed: pending healthy" },
  // collected — spread across last 6 months for trends + one this month
  { invoice_number: "TEST-2026-012", invoice_batch: "BATCH-2026-04-A", region: "NCR", num_nodes: 48, amount_vat_ex: 450000, status: "collected", dueOffset: -60, issuedOffset: -90, endorsedOffset: -70, collectedOffset: -5, notes: "Seed: collected this month" },
  { invoice_number: "TEST-2026-013", invoice_batch: "BATCH-2026-03-A", region: "Visayas", num_nodes: 35, amount_vat_ex: 335000, status: "collected", dueOffset: -80, issuedOffset: -110, endorsedOffset: -90, collectedOffset: -35, notes: "Seed: collected last month" },
  { invoice_number: "TEST-2026-014", invoice_batch: "BATCH-2026-02-A", region: "Mindanao", num_nodes: 62, amount_vat_ex: 580000, status: "collected", dueOffset: -120, issuedOffset: -150, endorsedOffset: -130, collectedOffset: -95, notes: "Seed: collected ~3mo ago" },
  { invoice_number: "TEST-2026-015", invoice_batch: "BATCH-2026-01-A", region: "Luzon", num_nodes: 27, amount_vat_ex: 195000, status: "collected", dueOffset: -150, issuedOffset: -180, endorsedOffset: -160, collectedOffset: -140, notes: "Seed: collected ~5mo ago" },
];

async function ensureAccounts() {
  const { data: accounts } = await supabase.from("crm_accounts").select("id, company_name").is("deleted_at", null).limit(10);
  if (accounts && accounts.length >= 2) return accounts as { id: string; company_name: string }[];

  console.log("No accounts found — creating 3 dummy clients...");
  if (dryRun) {
    return [
      { id: "dry-run-id-1", company_name: "SKY Fiber — Test" },
      { id: "dry-run-id-2", company_name: "Globe Testco" },
      { id: "dry-run-id-3", company_name: "Converge Test" },
    ];
  }
  const dummy = [
    { company_name: "SKY Fiber — Test", company_type: "active_customer", industry_note: "Telecom" },
    { company_name: "Globe Testco", company_type: "active_customer", industry_note: "Telecom" },
    { company_name: "Converge Test", company_type: "active_customer", industry_note: "Telecom" },
  ];
  const { data: inserted, error } = await supabase.from("crm_accounts").insert(dummy as any).select("id, company_name");
  if (error) {
    console.error("Failed to create dummy accounts:", error.message);
    process.exit(1);
  }
  console.log(`Created ${inserted?.length} dummy accounts.`);
  return inserted as any;
}

async function ensureProjects(accountIds: string[]) {
  const { data: projects } = await supabase.from("projects").select("id, name, account_id").is("deleted_at", null).in("account_id", accountIds).limit(10);
  if (projects && projects.length > 0) return projects as any[];
  // try any project at all
  const { data: anyProjects } = await supabase.from("projects").select("id, name").is("deleted_at", null).limit(5);
  if (anyProjects && anyProjects.length > 0) return anyProjects as any[];
  console.log("No projects found — billing rows will have project_id = null (dashboard still populates).");
  return [];
}

async function main() {
  console.log(`Seed client_billing — ${specs.length} rows — ${wipe ? "WIPE first" : "upsert"}${dryRun ? " (dry-run)" : ""}\n`);

  const accounts = await ensureAccounts();
  const projects = await ensureProjects(accounts.map((a: { id: string }) => a.id));
  const { data: profiles } = await supabase.from("profiles").select("id").limit(1);
  const createdBy = profiles?.[0]?.id ?? null;

  if (wipe && !dryRun) {
    // timelines have FK to billing — delete via billing cascade or explicit like
    const { data: toWipe } = await supabase.from("client_billing").select("id").like("invoice_number", "TEST-%");
    if (toWipe?.length) {
      await supabase.from("client_billing_timeline").delete().in("billing_id", toWipe.map((r: any) => r.id));
    }
    const { error } = await supabase.from("client_billing").delete().like("invoice_number", "TEST-%");
    if (error) console.error("Wipe warning:", error.message);
    else console.log("Wiped existing TEST-% rows.\n");
  }

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < specs.length; i++) {
    const s = specs[i]!;
    const account = accounts[i % accounts.length]!;
    const project = projects.length ? projects[i % projects.length] : null;
    const amount_vat_inc = vatInc(s.amount_vat_ex);
    const date_issued = toISO(addDays(today, s.issuedOffset));
    const date_endorsed = s.endorsedOffset != null ? toISO(addDays(today, s.endorsedOffset)) : null;
    const due_date = toISO(addDays(today, s.dueOffset));
    const est_payment_date = toISO(addDays(new Date(due_date), 15));
    // collected rows: collected_at spread; for trend, use actual collected_at timestamp
    const collected_at = s.collectedOffset != null ? addDays(today, s.collectedOffset).toISOString() : null;

    // idempotency: TEST- numbers are globally unique
    const { data: existing } = await supabase
      .from("client_billing")
      .select("id, status, account_id")
      .eq("invoice_number", s.invoice_number)
      .is("deleted_at", null)
      .maybeSingle();

    if (existing && !wipe) {
      const dates = { issued: date_issued, endorsed: date_endorsed, collected: collected_at };
      const chain = buildTimeline(s, dates, createdBy);
      const { data: existingTimeline } = await supabase.from("client_billing_timeline").select("id").eq("billing_id", (existing as any).id);
      const need = chain.length !== (existingTimeline?.length ?? 0);
      if (need) {
        if (dryRun) {
          console.log(`  ↻ ${s.invoice_number} — would repair timeline (${chain.length} steps: ${chain.map((c) => `${c.to}@${c.at.slice(0, 10)}`).join(" → ")})`);
        } else {
          await supabase.from("client_billing_timeline").delete().eq("billing_id", (existing as any).id);
          const rows = chain.map((c) => ({
            billing_id: (existing as any).id,
            from_status: c.from,
            to_status: c.to,
            changed_by: createdBy,
            changed_at: c.at,
            note: c.note,
          }));
          const { error: tlErr } = await supabase.from("client_billing_timeline").insert(rows as any);
          if (tlErr) console.log(`  ⚠ ${s.invoice_number} timeline repair: ${tlErr.message}`);
          else console.log(`  ↻ ${s.invoice_number} — timeline repaired (${chain.length} steps: ${chain.map((c) => c.to).join(" → ")})`);
        }
      } else {
        console.log(`  ↷ ${s.invoice_number} @ ${account.company_name} — exists, skip`);
      }
      skipped++;
      continue;
    }

    if (dryRun) {
      const dates = { issued: date_issued, endorsed: date_endorsed, collected: collected_at };
      const chain = buildTimeline(s, dates, createdBy);
      console.log(`  · ${s.invoice_number} | ${account.company_name} | ${s.status} | ₱${amount_vat_inc.toLocaleString()} | due ${due_date}${chain.length > 1 ? ` | ${chain.map((c) => `${c.to}@${c.at.slice(0, 10)}`).join(" → ")}` : ""}`);
      created++;
      continue;
    }

    let billingId: string | null = (existing as any)?.id ?? null;

    if (billingId) {
      const { error: upErr } = await supabase
        .from("client_billing")
        .update({
          project_id: project?.id ?? null,
          invoice_batch: s.invoice_batch,
          region: s.region,
          num_nodes: s.num_nodes,
          amount_vat_ex: s.amount_vat_ex,
          amount_vat_inc,
          date_issued,
          date_endorsed,
          due_date,
          est_payment_date,
          status: s.status,
          notes: s.notes,
          collected_at,
          updated_at: new Date().toISOString(),
        })
        .eq("id", billingId);
      if (upErr) {
        console.log(`  ✗ ${s.invoice_number} update: ${upErr.message}`);
        failed++;
        continue;
      }
      await supabase.from("client_billing_timeline").delete().eq("billing_id", billingId);
    } else {
      const { data: ins, error: insErr } = await supabase
        .from("client_billing")
        .insert({
          account_id: account.id,
          project_id: project?.id ?? null,
          invoice_number: s.invoice_number,
          invoice_batch: s.invoice_batch,
          region: s.region,
          num_nodes: s.num_nodes,
          amount_vat_ex: s.amount_vat_ex,
          amount_vat_inc,
          date_issued,
          date_endorsed,
          due_date,
          est_payment_date,
          status: s.status,
          notes: s.notes,
          collected_at,
          created_by: createdBy,
        })
        .select("id")
        .single();
      if (insErr || !ins) {
        console.log(`  ✗ ${s.invoice_number} insert: ${insErr?.message}`);
        failed++;
        continue;
      }
      billingId = (ins as any).id;
    }
    // full dated timeline chain for this status
    {
      const dates = { issued: date_issued, endorsed: date_endorsed, collected: collected_at };
      const chain = buildTimeline(s, dates, createdBy);
      const rows = chain.map((c) => ({
        billing_id: billingId,
        from_status: c.from,
        to_status: c.to,
        changed_by: createdBy,
        changed_at: c.at,
        note: c.note,
      }));
      const { error: tlErr } = await supabase.from("client_billing_timeline").insert(rows as any);
      if (tlErr) console.log(`  ⚠ ${s.invoice_number} timeline: ${tlErr.message}`);
    }

    console.log(`  ✓ ${s.invoice_number} | ${account.company_name} | ${s.status} | ₱${amount_vat_inc.toLocaleString()}`);
    created++;
  }

  if (dryRun) {
    console.log(`\nDry run — ${created} would be created. Run without --dry-run to write.`);
    return;
  }

  // summary for dashboard
  const totalOutstanding = specs.filter((s) => s.status !== "collected").reduce((a, s) => a + vatInc(s.amount_vat_ex), 0);
  const overdue = specs.filter((s) => s.status === "pending_payment" && s.dueOffset < 0).reduce((a, s) => a + vatInc(s.amount_vat_ex), 0);
  const totalCollected = specs.filter((s) => s.status === "collected").reduce((a, s) => a + vatInc(s.amount_vat_ex), 0);
  console.log(`\nDone — ${created} written, ${skipped} skipped, ${failed} failed.`);
  console.log(`Dashboard preview: ar_outstanding ₱${totalOutstanding.toLocaleString()}, ar_overdue ₱${overdue.toLocaleString()}, client_total_paid ₱${totalCollected.toLocaleString()}`);
  console.log(`Next: open /dashboard (finance) for Payment Overview + Trends, /dashboard/client-invoices for aging badges and status filters.`);
  console.log(`Re-run is idempotent; add --wipe to reset TEST-% rows.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
