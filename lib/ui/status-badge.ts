export const STATUS_BADGE: Record<string, string> = {
  slate: 'bg-slate-400 text-white border-none dark:bg-slate-800 dark:text-slate-400',
  amber: 'bg-amber-400 text-white border-none dark:bg-amber-900/20 dark:text-amber-400',
  blue: 'bg-blue-400 text-white border-none dark:bg-blue-900/20 dark:text-blue-400',
  emerald: 'bg-emerald-400 text-white border-none dark:bg-emerald-900/20 dark:text-emerald-400',
  red: 'bg-red-400 text-white border-none dark:bg-red-900/20 dark:text-red-400',
  violet: 'bg-violet-400 text-white border-none dark:bg-violet-900/20 dark:text-violet-400',
  cyan: 'bg-cyan-400 text-white border-none dark:bg-cyan-900/20 dark:text-cyan-400',
};

export function statusBadgeClasses(status?: string | null): string {
  const s = (status ?? '').toLowerCase();
  if (s === 'draft' || s === 'archived' || s === 'unsubmitted' || s === 'not_submitted' || s === 'planned' || s === 'inactive') return STATUS_BADGE.slate;
  if (s === 'cancelled' || s === 'expired' || s === 'terminated' || s === 'overdue' || s === 'failed' || s === 'bounced' || s === 'voided') return STATUS_BADGE.red;
  if (s === 'approved' || s === 'issued' || s === 'sent' || s === 'received' || s === 'confirmed') return STATUS_BADGE.blue;
  if (s === 'paid' || s === 'active' || s === 'completed' || s === 'converted' || s === 'fully_billed' || s === 'fulfilled' || s === 'delivered' || s === 'opened' || s === 'signed') return STATUS_BADGE.emerald;
  if (s === 'signed_received') return STATUS_BADGE.cyan;
  if (s === 'pending' || s === 'pending_approval' || s === 'pending_payment' || s === 'in_progress' || s === 'on_hold' || s === 'partially_paid' || s === 'partially_billed' || s === 'submitted' || s === 'pending_signature') return STATUS_BADGE.amber;
  if (s === 'pending_finance') return STATUS_BADGE.violet;
  if (s === 'pending_exec_approval') return STATUS_BADGE.violet;
  return STATUS_BADGE.slate;
}
