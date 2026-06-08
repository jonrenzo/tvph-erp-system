import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';
import { ArrowLeft, Clock, ExternalLink } from 'lucide-react';
import { Suspense } from 'react';
import { RecordClientPaymentModal } from '@/components/dashboard/client-invoices/record-payment-modal';
import { updateClientInvoiceStatus } from '../actions';

export const unstable_instant = {
  prefetch: 'static',
  samples: [{ params: { id: 'sample-client-invoice-id' }, searchParams: {} }],
};

export default function ClientInvoiceDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  return (
    <Suspense fallback={<Skeleton />}>
      <Content paramsPromise={props.params} />
    </Suspense>
  );
}

async function Content({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) {
  const { id } = await paramsPromise;
  const supabase = await createClient();

  const [{ data: invoice, error }, { data: payments }] = await Promise.all([
    supabase
      .from('client_invoices')
      .select('*, crm_accounts(company_name), client_purchase_orders(id, po_number, amount)')
      .eq('id', id)
      .is('deleted_at', null)
      .single(),
    supabase
      .from('client_payments')
      .select('*')
      .eq('invoice_id', id)
      .is('deleted_at', null)
      .order('payment_date', { ascending: false }),
  ]);

  if (error || !invoice) notFound();

  const totalPaid = (payments || []).reduce((sum, p) => sum + Number(p.amount_paid), 0);
  const remaining = Number(invoice.amount) - totalPaid;

  const statusColor: Record<string, string> = {
    draft: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400',
    sent: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400',
    partially_paid: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400',
    paid: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400',
    cancelled: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400',
  };

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link href="/dashboard/client-invoices" className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors mt-1">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">{invoice.invoice_number}</h1>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${statusColor[invoice.status] || ''}`}>
                {invoice.status.replace(/_/g, ' ').toUpperCase()}
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {(invoice.crm_accounts as any)?.company_name} ·{' '}
              <Link href={`/dashboard/client-pos/${(invoice.client_purchase_orders as any)?.id}`} className="hover:text-primary transition-colors">
                PO: {(invoice.client_purchase_orders as any)?.po_number}
              </Link>{' '}
              · {new Date(invoice.invoice_date).toLocaleDateString()}
            </p>
          </div>
        </div>
        {invoice.file_url && (
          <a
            href={invoice.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <ExternalLink className="h-4 w-4" />
            View Invoice
          </a>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Invoice Amount', value: `${invoice.currency} ${Number(invoice.amount).toLocaleString()}` },
          { label: 'Total Received', value: `${invoice.currency} ${totalPaid.toLocaleString()}` },
          { label: 'Balance Due', value: `${invoice.currency} ${remaining.toLocaleString()}` },
        ].map((card) => (
          <div key={card.label} className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">{card.label}</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Status Actions */}
      {invoice.status === 'draft' && (
        <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-center justify-between gap-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">Mark this invoice as sent to the client</p>
          <form action={async () => {
            'use server';
            await updateClientInvoiceStatus(id, 'sent');
          }}>
            <button type="submit" className="px-4 py-2 rounded-xl text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white transition-colors">
              Mark as Sent
            </button>
          </form>
        </div>
      )}

      {/* Record Payment */}
      {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
        <RecordClientPaymentModal invoiceId={id} currency={invoice.currency} />
      )}

      {/* Payment History */}
      <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50">
          <h2 className="font-semibold text-slate-900 dark:text-white">Payment History</h2>
        </div>
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="px-6 py-3 font-semibold">Date</th>
              <th className="px-6 py-3 font-semibold">Amount</th>
              <th className="px-6 py-3 font-semibold">Type</th>
              <th className="px-6 py-3 font-semibold">Method</th>
              <th className="px-6 py-3 font-semibold">Reference</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {payments?.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">No payments recorded yet.</td></tr>
            ) : (
              payments?.map((p: any) => (
                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/10 transition-colors">
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-1.5 text-xs"><Clock className="h-3.5 w-3.5" />{new Date(p.payment_date).toLocaleDateString()}</div>
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">
                    {invoice.currency} {Number(p.amount_paid).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-400 capitalize">{p.payment_type.replace(/_/g, ' ')}</td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-400 capitalize">{p.payment_method.replace(/_/g, ' ')}</td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{p.reference_number || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Invoice Details */}
      <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Details</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-slate-400">Invoice Date</p>
            <p className="font-medium text-slate-900 dark:text-white mt-0.5">{new Date(invoice.invoice_date).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Due Date</p>
            <p className="font-medium text-slate-900 dark:text-white mt-0.5">{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Currency</p>
            <p className="font-medium text-slate-900 dark:text-white mt-0.5">{invoice.currency}</p>
          </div>
        </div>
        {invoice.notes && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs text-slate-400 mb-1">Notes</p>
            <p className="text-sm text-slate-700 dark:text-slate-300">{invoice.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="p-6 lg:p-8 space-y-6 animate-pulse">
      <div className="h-8 w-64 bg-slate-100 dark:bg-slate-800/50 rounded-lg" />
      <div className="h-48 rounded-2xl bg-slate-100 dark:bg-slate-800/50" />
    </div>
  );
}
