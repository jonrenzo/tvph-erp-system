// Vendor (AP) invoice status vocabulary. Approval was removed, so an invoice moves
// straight from pending_payment -> partially_paid -> paid.

export const INVOICE_STATUSES = ['pending_payment', 'partially_paid', 'paid'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

const LABELS: Record<string, string> = {
  pending_payment: 'Pending Payment',
  partially_paid: 'Partially Paid',
  paid: 'Paid',
};

export function invoiceStatusLabel(status: string): string {
  return LABELS[status] ?? status.replace(/_/g, ' ');
}

export function invoiceStatusBadgeClasses(status: string): string {
  switch (status) {
    case 'paid':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50';
    case 'partially_paid':
      return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/50';
    case 'pending_payment':
    default:
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/50';
  }
}
