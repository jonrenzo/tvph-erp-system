import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';
import { ArrowLeft, FileText, Clock, ExternalLink } from 'lucide-react';
import { Suspense } from 'react';
import { updateClientPOStatus } from '../actions';

export const unstable_instant = {
  prefetch: 'static',
  samples: [{ params: { id: 'sample-client-po-id' }, searchParams: {} }],
};

export default function ClientPODetailPage(props: {
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

  const [{ data: po, error }, { data: invoices }] = await Promise.all([
    supabase
      .from('client_purchase_orders')
      .select('*, crm_accounts(id, company_name)')
      .eq('id', id)
      .is('deleted_at', null)
      .single(),
    supabase
      .from('client_invoices')
      .select('id, invoice_number, amount, currency, invoice_date, status')
      .eq('client_po_id', id)
      .is('deleted_at', null)
      .order('invoice_date', { ascending: false }),
  ]);

  if (error || !po) notFound();

  const totalBilled = (invoices || [])
    .filter((i) => i.status !== 'cancelled')
    .reduce((sum, i) => sum + Number(i.amount), 0);
  const remaining = Number(po.amount) - totalBilled;

  const statusColor: Record<string, string> = {
    received: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400',
    partially_billed: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400',
    fully_billed: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400',
    cancelled: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400',
  };

  const invStatusColor: Record<string, string> = {
    draft: 'bg-slate-50 text-slate-700 border-slate-200',
    sent: 'bg-blue-50 text-blue-700 border-blue-200',
    partially_paid: 'bg-amber-50 text-amber-700 border-amber-200',
    paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    cancelled: 'bg-red-50 text-red-700 border-red-200',
  };

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link href="/dashboard/client-pos" className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors mt-1">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">{po.po_number}</h1>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${statusColor[po.status] || ''}`}>
                {po.status.replace(/_/g, ' ').toUpperCase()}
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {(po.crm_accounts as any)?.company_name} · Received {new Date(po.received_date).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {po.file_url && (
            <a href={po.file_url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <ExternalLink className="h-4 w-4" />
              View Document
            </a>
          )}
          <Link
            href={`/dashboard/client-invoices/new?client_po_id=${po.id}&account_id=${(po.crm_accounts as any)?.id}`}
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95"
          >
            + New Invoice
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'PO Amount', value: `${po.currency} ${Number(po.amount).toLocaleString()}`, sub: '' },
          { label: 'Total Billed', value: `${po.currency} ${totalBilled.toLocaleString()}`, sub: `${Math.round((totalBilled / Number(po.amount)) * 100)}% of PO` },
          { label: 'Remaining', value: `${po.currency} ${remaining.toLocaleString()}`, sub: remaining < 0 ? 'Overbilled' : 'Available' },
        ].map((card) => (
          <div key={card.label} className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">{card.label}</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">{card.value}</p>
            {card.sub && <p className="text-xs text-slate-400 mt-0.5">{card.sub}</p>}
          </div>
        ))}
      </div>

      {/* Status Update */}
      {po.status !== 'cancelled' && po.status !== 'fully_billed' && (
        <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-center justify-between gap-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">Update PO status manually</p>
          <div className="flex items-center gap-2">
            {po.status !== 'cancelled' && (
              <form action={async () => {
                'use server';
                await updateClientPOStatus(id, 'cancelled');
              }}>
                <button type="submit" className="px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                  Cancel PO
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Invoices */}
      <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 dark:text-white">Invoices Against This PO</h2>
          <Link
            href={`/dashboard/client-invoices/new?client_po_id=${po.id}&account_id=${(po.crm_accounts as any)?.id}`}
            className="text-xs font-bold text-primary hover:underline"
          >
            + New Invoice
          </Link>
        </div>
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="px-6 py-3 font-semibold">Invoice No.</th>
              <th className="px-6 py-3 font-semibold">Date</th>
              <th className="px-6 py-3 font-semibold">Amount</th>
              <th className="px-6 py-3 font-semibold">Status</th>
              <th className="px-6 py-3 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {invoices?.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">No invoices yet.</td></tr>
            ) : (
              invoices?.map((inv: any) => (
                <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/10 transition-colors">
                  <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">{inv.invoice_number}</td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-1.5 text-xs"><Clock className="h-3.5 w-3.5" />{new Date(inv.invoice_date).toLocaleDateString()}</div>
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">
                    {inv.currency} {Number(inv.amount).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${invStatusColor[inv.status] || ''}`}>
                      {inv.status.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link href={`/dashboard/client-invoices/${inv.id}`} className="text-primary hover:underline font-medium text-xs">View</Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {po.notes && (
        <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">Notes</p>
          <p className="text-sm text-slate-700 dark:text-slate-300">{po.notes}</p>
        </div>
      )}
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
