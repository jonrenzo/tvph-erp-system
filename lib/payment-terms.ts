export type PenaltyType = "monthly" | "fixed";

export function manilaDateString(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function addCalendarDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function calculatePaymentDueDate(submittedAt: Date, netDays: number): string {
  return addCalendarDays(manilaDateString(submittedAt), netDays);
}

export function calculatePenaltyAmount({ amount, rate, type, overdueDays }: {
  amount: number; rate: number; type: PenaltyType; overdueDays: number;
}): number {
  return Math.round(amount * rate * (type === "fixed" ? 1 : Math.max(0, overdueDays) / 30) * 100) / 100;
}
