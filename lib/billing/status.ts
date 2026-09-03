import { statusBadgeClasses } from '@/lib/ui/status-badge';

export const BILLING_STATUSES = [
  'for_billing',
  'pending_sky_technical',
  'for_payment',
  'pending_payment',
  'collected',
] as const;
export type BillingStatus = (typeof BILLING_STATUSES)[number];

const LABELS: Record<string, string> = {
  for_billing: 'For Billing',
  pending_sky_technical: 'Submitted to Sky Technical',
  for_payment: 'For Payment',
  pending_payment: 'Pending Payment',
  collected: 'Collected',
};

const ALLOWED: Record<string, string[]> = {
  for_billing: ['pending_sky_technical'],
  pending_sky_technical: ['for_billing', 'for_payment'],
  for_payment: ['pending_payment', 'collected'],
  pending_payment: ['collected'],
  collected: [],
};

export function billingStatusLabel(status: string): string {
  return LABELS[status] ?? status.replace(/_/g, ' ');
}

export function billingStatusBadgeClasses(status: string): string {
  return statusBadgeClasses(status);
}

export function billingStatusShortLabel(status: string): string {
  if (status === "pending_sky_technical") return "Sky Tech";
  return billingStatusLabel(status);
}

export function canTransition(from: string, to: string): boolean {
  return (ALLOWED[from] ?? []).includes(to);
}

export function normalizeBillingStatus(raw: string): BillingStatus | null {
  const s = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  const map: Record<string, BillingStatus> = {
    for_billing: 'for_billing',
    pending_sky_technical: 'pending_sky_technical',
    // legacy alias
    for_approval: 'pending_sky_technical',
    for_payment: 'for_payment',
    pending_payment: 'pending_payment',
    pending_payments: 'pending_payment',
    collected: 'collected',
    paid: 'collected',
  };
  return map[s] ?? null;
}

// Aging for For Payment / Pending Payment (healthy / close_due / overdue)
export type AgingBand = 'healthy' | 'close_due' | 'overdue';

export function agingBand(
  row: { status: string; due_date?: string | null; deleted_at?: string | null },
  today = new Date(),
): { band: AgingBand | null; daysDelayed: number } {
  if (row.status === 'collected' || !row.due_date) return { band: null, daysDelayed: 0 };
  if (!['for_payment', 'pending_payment'].includes(row.status)) return { band: null, daysDelayed: 0 };
  const due = new Date(row.due_date);
  due.setHours(0, 0, 0, 0);
  const t = new Date(today);
  t.setHours(0, 0, 0, 0);
  const diff = Math.floor((t.getTime() - due.getTime()) / 86400000);
  const daysDelayed = diff > 0 ? diff : 0;
  if (diff > 0) return { band: 'overdue', daysDelayed };
  const daysToDue = Math.floor((due.getTime() - t.getTime()) / 86400000);
  if (daysToDue <= 7) return { band: 'close_due', daysDelayed: 0 };
  return { band: 'healthy', daysDelayed: 0 };
}

export function agingBadgeClasses(band: AgingBand | null): string {
  if (band === 'overdue') return 'bg-red-400 text-white border-none dark:bg-red-900/20 dark:text-red-400';
  if (band === 'close_due') return 'bg-amber-400 text-white border-none dark:bg-amber-900/20 dark:text-amber-400';
  if (band === 'healthy') return 'bg-emerald-400 text-white border-none dark:bg-emerald-900/20 dark:text-emerald-400';
  return 'bg-slate-400 text-white border-none dark:bg-slate-800 dark:text-slate-400';
}

export function agingLabel(band: AgingBand | null, daysDelayed: number): string {
  if (band === 'overdue') return `Overdue ${daysDelayed}d`;
  if (band === 'close_due') return 'Close Due';
  if (band === 'healthy') return 'Healthy';
  return '—';
}
