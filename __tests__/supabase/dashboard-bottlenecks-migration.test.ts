import fs from "node:fs";
import path from "node:path";

const migration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20260714_dashboard_bottlenecks.sql"),
  "utf8",
);

describe("dashboard bottlenecks migration", () => {
  it("limits the finance RPC to accounting and admin roles", () => {
    const financialsFunction = migration.split("create or replace function public.get_dashboard_project_progress")[0];

    expect(financialsFunction).toContain("and role in ('superadmin', 'admin', 'finance')");
    expect(financialsFunction).toContain("from authorized");
  });
});
