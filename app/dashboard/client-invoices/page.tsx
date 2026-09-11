import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { Plus, Upload } from 'lucide-react';
import { Suspense } from 'react';
import { ClientBillingClient } from '@/components/dashboard/client-invoices/client-billing-client';

export default function ClientInvoicesPage(props: {
  searchParams?: Promise<{ q?: string; status?: string; aging?: string; page?: string }>;
}) {
  return (
    <Suspense fallback={<Skeleton />}>
      <Content searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams: searchParamsPromise }: { searchParams?: Promise<any> }) {
  const supabase = await createClient();

  // blazing fast: load all rows once (89 now, 10k later still <1MB) and filter client side, no per keystroke roundtrip
  const [{ data: allRows }, { data: accountOpts }, { data: projectOpts }, { data: batchRows }, { data: regionRows }, { data: allNodes }] = await Promise.all([
    supabase.from('client_billing').select('id, invoice_number, invoice_batch, region, num_nodes, date_issued, date_endorsed, due_date, est_payment_date, collected_at, amount_vat_ex, amount_vat_inc, status, project_name_free, account_id, project_id, crm_accounts(company_name), projects(name)').is('deleted_at', null).order('date_issued', { ascending: false }).limit(10000),
    supabase.from('crm_accounts').select('id, company_name').is('deleted_at', null).order('company_name').limit(100),
    supabase.from('projects').select('id, name').is('deleted_at', null).order('name').limit(100),
    supabase.from('client_billing').select('invoice_batch').is('deleted_at', null).not('invoice_batch', 'is', null).limit(200),
    supabase.from('client_billing').select('region').is('deleted_at', null).not('region', 'is', null).limit(200),
    supabase.from('client_billing_nodes').select('billing_id, has_mrs').limit(5000),
  ]);
  const rows = (allRows as any[]) || [];
  const batches = Array.from(new Set((batchRows as any[] || []).map(r=>r.invoice_batch).filter(Boolean))).sort();
  const regions = Array.from(new Set((regionRows as any[] || []).map(r=>r.region).filter(Boolean))).sort();
  const mrsMap = new Map<string, { total: number; withMrs: number }>();
  for (const n of (allNodes as any[]) || []) {
    const cur = mrsMap.get(n.billing_id) || { total: 0, withMrs: 0 };
    cur.total += 1;
    if (n.has_mrs) cur.withMrs += 1;
    mrsMap.set(n.billing_id, cur);
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">Client Billing</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Excel billing tracker — For Billing → Submitted to Sky Technical → For Payment → Pending Payment → Collected.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/client-invoices/import" className="inline-flex items-center gap-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            <Upload className="h-4 w-4" /> Import
          </Link>
          <Link href="/dashboard/client-invoices/new" className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl font-medium transition-all hover:shadow-lg hover:shadow-primary/20 active:scale-95">
            <Plus className="h-5 w-5" /> New Invoice
          </Link>
        </div>
      </div>

      <ClientBillingClient
        initialRows={rows as any}
        mrsMap={mrsMap}
        accounts={(accountOpts as any[] || []).map(a=>({ id: a.id, name: a.company_name }))}
        projects={(projectOpts as any[] || []).map(p=>({ id: p.id, name: p.name }))}
        regions={regions}
        batches={batches}
      />
    </div>
  );
}

function Skeleton() {
  return <div className="p-6 lg:p-8 space-y-8 animate-pulse"><div className="h-10 w-64 bg-slate-100 dark:bg-slate-800/50 rounded-lg" /><div className="h-96 rounded-2xl bg-slate-100 dark:bg-slate-800/50" /></div>;
}
