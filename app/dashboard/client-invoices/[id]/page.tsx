import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';
import { ArrowLeft, Clock, ExternalLink } from 'lucide-react';
import { Suspense } from 'react';
import { billingStatusLabel, billingStatusBadgeClasses, agingBand, agingBadgeClasses, agingLabel } from '@/lib/billing/status';
import { TransitionPanel } from '@/components/dashboard/client-invoices/transition-panel';

export default function BillingDetailPage(props: {
  params: Promise<{ id: string }>;
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

  const [{ data: row, error }, { data: timeline }] = await Promise.all([
    supabase.from('client_billing').select('*, crm_accounts(company_name), projects(id, name)').eq('id', id).is('deleted_at', null).single(),
    supabase.from('client_billing_timeline').select('id, from_status, to_status, changed_at, note, profiles!changed_by(full_name, email)').eq('billing_id', id).order('changed_at', { ascending: true }),
  ]);

  if (error || !row) notFound();
  const ag = agingBand(row);

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link href="/dashboard/client-invoices" className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 mt-1"><ArrowLeft className="h-5 w-5" /></Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">{row.invoice_number}</h1>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${billingStatusBadgeClasses(row.status)}`}>{billingStatusLabel(row.status).toUpperCase()}</span>
              {ag.band && <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${agingBadgeClasses(ag.band)}`}>{agingLabel(ag.band, ag.daysDelayed).toUpperCase()}</span>}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {(row.crm_accounts as any)?.company_name} · {(row.projects as any)?.name || 'No project'} · {row.invoice_batch ? `Batch ${row.invoice_batch}` : 'No batch'}
            </p>
          </div>
        </div>
        {row.file_url && (
          <a href={row.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50">
            <ExternalLink className="h-4 w-4" /> View Doc
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">VAT-ex</p>
          <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">₱ {Number(row.amount_vat_ex || 0).toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">VAT-inc</p>
          <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">₱ {Number(row.amount_vat_inc || 0).toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Aging</p>
          <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">{ag.band ? `${agingLabel(ag.band, ag.daysDelayed)}${ag.band==='overdue' ? ` (${ag.daysDelayed}d)` : ''}` : '—'}</p>
        </div>
      </div>

      <TransitionPanel billingId={row.id} status={row.status} />

      <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Details</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div><p className="text-xs text-slate-400">Region</p><p className="font-medium text-slate-900 dark:text-white mt-0.5">{row.region || '—'}</p></div>
          <div><p className="text-xs text-slate-400"># Nodes</p><p className="font-medium text-slate-900 dark:text-white mt-0.5">{row.num_nodes ?? '—'}</p></div>
          <div><p className="text-xs text-slate-400">Date Issued</p><p className="font-medium text-slate-900 dark:text-white mt-0.5">{row.date_issued ? new Date(row.date_issued).toLocaleDateString() : '—'}</p></div>
          <div><p className="text-xs text-slate-400">Date Endorsed</p><p className="font-medium text-slate-900 dark:text-white mt-0.5">{row.date_endorsed ? new Date(row.date_endorsed).toLocaleDateString() : '—'}</p></div>
          <div><p className="text-xs text-slate-400">Due Date</p><p className="font-medium text-slate-900 dark:text-white mt-0.5">{row.due_date ? new Date(row.due_date).toLocaleDateString() : '—'}</p></div>
          <div><p className="text-xs text-slate-400">Est. Payment</p><p className="font-medium text-slate-900 dark:text-white mt-0.5">{row.est_payment_date ? new Date(row.est_payment_date).toLocaleDateString() : '—'}</p></div>
          <div><p className="text-xs text-slate-400">Collected At</p><p className="font-medium text-slate-900 dark:text-white mt-0.5">{row.collected_at ? new Date(row.collected_at).toLocaleDateString() : '—'}</p></div>
        </div>
        {row.notes && <div className="pt-2 border-t border-slate-100 dark:border-slate-800"><p className="text-xs text-slate-400 mb-1">Notes</p><p className="text-sm text-slate-700 dark:text-slate-300">{row.notes}</p></div>}
      </div>

      <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50">
          <h2 className="font-semibold text-slate-900 dark:text-white">Timeline</h2>
          <p className="text-xs text-slate-500 mt-0.5">All status changes + fixed dates. Fixed dates below are snapshots; the log above is the source of truth.</p>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {(timeline as any[])?.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-slate-500">No transitions yet.</p>
          ) : (
            (timeline as any[])?.map((t: any) => (
              <div key={t.id} className="px-6 py-4 flex items-start gap-3">
                <div className="h-2 w-2 rounded-full bg-primary mt-2 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {t.from_status ? `${billingStatusLabel(t.from_status)} → ` : ''}{billingStatusLabel(t.to_status)}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(t.changed_at).toLocaleString()} · {(t.profiles as any)?.full_name || (t.profiles as any)?.email || 'System'}</p>
                  {t.note && <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 italic">{t.note}</p>}
                </div>
              </div>
            ))
          )}
        </div>
        <div className="px-6 py-4 bg-slate-50/50 dark:bg-[#0a0a0a]/50 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div><span className="text-slate-400">Issued</span><p className="font-medium text-slate-700 dark:text-slate-300">{row.date_issued ? new Date(row.date_issued).toLocaleDateString() : '—'}</p></div>
          <div><span className="text-slate-400">Endorsed</span><p className="font-medium text-slate-700 dark:text-slate-300">{row.date_endorsed ? new Date(row.date_endorsed).toLocaleDateString() : '—'}</p></div>
          <div><span className="text-slate-400">Due</span><p className="font-medium text-slate-700 dark:text-slate-300">{row.due_date ? new Date(row.due_date).toLocaleDateString() : '—'}</p></div>
          <div><span className="text-slate-400">Est Pay</span><p className="font-medium text-slate-700 dark:text-slate-300">{row.est_payment_date ? new Date(row.est_payment_date).toLocaleDateString() : '—'}</p></div>
        </div>
      </div>
    </div>
  );
}

function Skeleton() {
  return <div className="p-6 lg:p-8 space-y-6 animate-pulse"><div className="h-8 w-64 bg-slate-100 dark:bg-slate-800/50 rounded-lg" /><div className="h-48 rounded-2xl bg-slate-100 dark:bg-slate-800/50" /></div>;
}
