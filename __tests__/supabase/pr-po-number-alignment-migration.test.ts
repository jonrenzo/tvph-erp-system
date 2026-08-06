import fs from "fs";
import path from "path";

const sql = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations", "20260806_pr_po_number_alignment.sql"),
  "utf8",
);

describe("pr/po number alignment migration", () => {
  it("shares one sequence: PRs consume po_number_seq and pr_number_seq is dropped", () => {
    expect(sql).toMatch(/nextval\('public\.po_number_seq'\)/);
    expect(sql).toMatch(/drop sequence if exists public\.pr_number_seq/);
  });

  it("derives the PO number from the PR number at conversion", () => {
    expect(sql).toMatch(/purchase_request_id is not null/i);
    expect(sql).toMatch(/'PO-' \|\| substr\(v_pr_number, 4\)/);
  });

  it("falls back to the sequence when the derived PO number is already taken", () => {
    expect(sql).toMatch(/not exists \(select 1 from public\.purchase_orders where po_number = v_candidate\)/);
    expect(sql).toMatch(/nextval\('public\.po_number_seq'\)/);
  });

  it("aligns every PO's pr_number with its own number (incl. legacy phantoms)", () => {
    expect(sql).toMatch(/update public\.purchase_orders\s+set pr_number = 'PR-' \|\| substr\(po_number, 4\)/i);
  });

  it("renames converted PRs to match their PO only when the target is free", () => {
    expect(sql).toMatch(/update public\.purchase_requests pr/i);
    expect(sql).toMatch(/'PR-' \|\| substr\(po\.po_number, 4\)/i);
    expect(sql).toMatch(/not exists \(\s*select 1 from public\.purchase_requests other/i);
  });
});
