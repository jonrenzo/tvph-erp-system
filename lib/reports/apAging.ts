// Pure AP-aging computation shared by the Accounting page and the AP Aging report.
// Single source of truth for the aging-bucket logic that used to live inline in
// app/dashboard/accounting/page.tsx.

export interface ApAgingInvoice {
  amount: number | string | null;
  status: string | null;
  due_date?: string | null;
  invoice_date?: string | null;
  vendor_id: string | null;
  vendors?: { name: string | null } | null;
  vat_amount?: number | string | null;
  ewt_amount?: number | string | null;
  expense_category?: string | null;
}

export interface ApAgingRow {
  vendorId: string;
  vendorName: string;
  current: number;
  days30: number;
  days60: number;
  days90: number;
  over90: number;
  total: number;
}

export interface ApAgingResult {
  /** Aging rows, only vendors with outstanding balances, sorted by total desc. */
  rows: ApAgingRow[];
  totalPaidExpenses: number; // sum of invoices already marked paid
  totalUnpaid: number; // outstanding payables
  totalVAT: number;
  totalEWT: number;
  expensesByCategory: Record<string, number>;
}

const num = (v: unknown): number => Number(v ?? 0) || 0;

/**
 * Compute AP aging buckets, expense breakdown and tax totals from service invoices.
 * `now` is injectable so reports and pages are deterministic / testable.
 */
export function computeApAging(
  invoices: ApAgingInvoice[] | null | undefined,
  now: Date = new Date(),
): ApAgingResult {
  let totalPaidExpenses = 0;
  let totalUnpaid = 0;
  let totalVAT = 0;
  let totalEWT = 0;

  const expensesByCategory: Record<string, number> = {};
  const apAging: Record<string, ApAgingRow> = {};

  for (const inv of invoices ?? []) {
    const amount = num(inv.amount);

    const category = inv.expense_category || "uncategorized";
    expensesByCategory[category] = (expensesByCategory[category] || 0) + amount;

    if (inv.status === "paid") {
      totalPaidExpenses += amount;
    } else {
      totalUnpaid += amount;

      const dueDate = new Date(inv.due_date || inv.invoice_date || now);
      const diffDays = Math.ceil(
        Math.abs(now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      const vendorId = inv.vendor_id || "unknown";
      if (!apAging[vendorId]) {
        apAging[vendorId] = {
          vendorId,
          vendorName: inv.vendors?.name || "Unknown",
          current: 0,
          days30: 0,
          days60: 0,
          days90: 0,
          over90: 0,
          total: 0,
        };
      }

      const row = apAging[vendorId];
      if (dueDate >= now) row.current += amount;
      else if (diffDays <= 30) row.days30 += amount;
      else if (diffDays <= 60) row.days60 += amount;
      else if (diffDays <= 90) row.days90 += amount;
      else row.over90 += amount;
      row.total += amount;
    }

    totalVAT += num(inv.vat_amount);
    totalEWT += num(inv.ewt_amount);
  }

  const rows = Object.values(apAging)
    .filter((v) => v.total > 0)
    .sort((a, b) => b.total - a.total);

  return {
    rows,
    totalPaidExpenses,
    totalUnpaid,
    totalVAT,
    totalEWT,
    expensesByCategory,
  };
}
