import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink, FileText, Clock3, BadgeCheck, Banknote, Hourglass, CheckCircle2, User } from 'lucide-react';
import { Suspense } from 'react';
import { billingStatusLabel, billingStatusBadgeClasses, billingStatusShortLabel, agingBand, agingBadgeClasses, agingLabel } from '@/lib/billing/status';
import { TransitionPanel } from '@/components/dashboard/client-invoices/transition-panel';
import { BillingDetailEditor } from '@/components/dashboard/client-invoices/billing-detail-editor';
import { Timeline, type TimelineItem } from '@/components/ui/timeline';

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

  const [{ data: row, error }, { data: timeline }, { data: nodes }, { data: projects }] = await Promise.all([
    supabase.from('client_billing').select('*, crm_accounts(company_name), projects(id, name)').eq('id', id).is('deleted_at', null).single(),
    supabase.from('client_billing_timeline').select('id, from_status, to_status, changed_at, note, profiles!changed_by(full_name, email)').eq('billing_id', id).order('changed_at', { ascending: true }),
    supabase.from('client_billing_nodes').select('*').eq('billing_id', id).order('sn', { ascending: true }),
    supabase.from('projects').select('id, name').is('deleted_at', null).order('name').limit(100),
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
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">{row.invoice_number || `Billing #${String(row.id).slice(0, 8)}`}</h1>
              <span title={row.status === "pending_sky_technical" ? "Submitted to Sky Technical" : undefined} className={`inline-flex items-center rounded-full font-bold border whitespace-nowrap ${row.status === "pending_sky_technical" ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1"} ${billingStatusBadgeClasses(row.status)}`}>{billingStatusShortLabel(row.status).toUpperCase()}</span>
              {ag.band && <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${agingBadgeClasses(ag.band)}`}>{agingLabel(ag.band, ag.daysDelayed).toUpperCase()}</span>}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {(row.crm_accounts as any)?.company_name} · {(row.projects as any)?.name || (row as any).project_name_free || 'No project'} · {row.invoice_batch ? `Batch ${row.invoice_batch}` : 'No batch'}
            </p>
          </div>
        </div>
        {row.file_url && (
          <a href={row.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50">
            <ExternalLink className="h-4 w-4" /> RTD Document
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">VAT-ex</p>
          <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">₱ {Number(row.amount_vat_ex || 0).toLocaleString()}</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">VAT-inc</p>
          <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">₱ {Number(row.amount_vat_inc || 0).toLocaleString()}</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Aging</p>
          <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">{ag.band ? `${agingLabel(ag.band, ag.daysDelayed)}${ag.band==='overdue' ? ` (${ag.daysDelayed}d)` : ''}` : '—'}</p>
        </div>
      </div>

      <TransitionPanel billingId={row.id} status={row.status} invoiceNumber={row.invoice_number} invoiceBatch={row.invoice_batch} />

      <BillingDetailEditor
        billingId={row.id}
        row={row as any}
        initialNodes={(nodes as any[]) || []}
        projects={(projects as any[]) || []}
      />

      {(() => {
        const tl = (timeline as any[]) ?? [];
        const iconFor = (status: string) => {
          switch (status) {
            case "for_billing": return <FileText className="h-3 w-3" />;
            case "pending_sky_technical": return <Clock3 className="h-3 w-3" />;
            case "for_payment": return <Banknote className="h-3 w-3" />;
            case "pending_payment": return <Hourglass className="h-3 w-3" />;
            case "collected": return <BadgeCheck className="h-3 w-3" />;
            default: return <CheckCircle2 className="h-3 w-3" />;
          }
        };
        const items: TimelineItem[] = tl.map((t: any, idx: number) => {
          const isLast = idx === tl.length - 1;
          const state: TimelineItem["status"] = isLast && row.status !== "collected" ? "active" : "completed";
          const actor = (t.profiles as any)?.full_name || (t.profiles as any)?.email || "System";
          return {
            id: t.id,
            title: t.from_status ? `${billingStatusLabel(t.from_status)} → ${billingStatusLabel(t.to_status)}` : billingStatusLabel(t.to_status),
            description: t.note || undefined,
            timestamp: t.changed_at ? new Date(t.changed_at) : undefined,
            status: state,
            icon: iconFor(t.to_status),
            content: (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <User className="h-3 w-3" /> {actor}
              </span>
            ),
          };
        });
        return (
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-white/10">
              <h2 className="font-semibold tracking-tight text-slate-900 dark:text-white">Timeline</h2>
              <p className="text-xs text-slate-500 mt-0.5">All status changes + fixed dates. Fixed dates below are snapshots; the log above is the source of truth.</p>
            </div>
            <div className="p-6">
              {items.length === 0 ? (
                <p className="text-center text-sm text-slate-500 py-8">No transitions yet.</p>
              ) : (
                <Timeline items={items} showTimestamps timestampPosition="top" />
              )}
            </div>
            <div className="px-6 py-4 bg-slate-50/50 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div><span className="text-slate-400">Issued</span><p className="font-medium text-slate-700 dark:text-slate-300">{row.date_issued ? new Date(row.date_issued).toLocaleDateString() : '—'}</p></div>
              <div><span className="text-slate-400">Endorsed</span><p className="font-medium text-slate-700 dark:text-slate-300">{row.date_endorsed ? new Date(row.date_endorsed).toLocaleDateString() : '—'}</p></div>
              <div><span className="text-slate-400">Due</span><p className="font-medium text-slate-700 dark:text-slate-300">{row.due_date ? new Date(row.due_date).toLocaleDateString() : '—'}</p></div>
              <div><span className="text-slate-400">Est Pay</span><p className="font-medium text-slate-700 dark:text-slate-300">{row.est_payment_date ? new Date(row.est_payment_date).toLocaleDateString() : '—'}</p></div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function Skeleton() {
  return <div className="p-6 lg:p-8 space-y-6 animate-pulse"><div className="h-8 w-64 bg-slate-100 dark:bg-slate-800/50 rounded-lg" /><div className="h-48 rounded-2xl bg-slate-100 dark:bg-slate-800/50" /></div>;
}
