import fs from "node:fs";
import path from "node:path";

const migrations = fs.readdirSync(path.join(process.cwd(), "supabase/migrations"));
const filename = migrations.find((name) => name.endsWith("_payment_reminder_engine.sql"));
if (!filename) throw new Error("payment reminder migration is missing");
const migration = fs.readFileSync(path.join(process.cwd(), "supabase/migrations", filename), "utf8");

it("protects penalties and schedules the vendor route", () => {
  expect(migration).toContain("alter table public.po_penalties enable row level security");
  expect(migration).toContain("create unique index if not exists po_penalties_po_id_idx");
  expect(migration).toContain("first_overdue_on date,");
  expect(migration).toContain("last_calculated_on date,");
  expect(migration).toContain("/api/cron/vendor-deadline-reminders");
});

it("makes automatic penalty dates nullable for upgrades", () => {
  const upgrade = migrations.find((name) => name.endsWith("_payment_reminder_engine_penalty_upgrade.sql"));
  expect(upgrade).toBeDefined();
  const sql = fs.readFileSync(path.join(process.cwd(), "supabase/migrations", upgrade!), "utf8");
  expect(sql).toContain("alter column first_overdue_on drop not null");
  expect(sql).toContain("alter column last_calculated_on drop not null");
});
