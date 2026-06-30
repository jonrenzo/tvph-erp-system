import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';
import { ProjectDetailContent } from '@/components/dashboard/projects/project-detail-content';
import { Suspense } from 'react';
import { signDocUrl } from '@/utils/storage';

export const unstable_instant = {
  prefetch: 'static',
  samples: [{
    params: { id: 'sample-project-id' }
  }]
};

export default function ProjectPage(props: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<ProjectDetailSkeleton />}>
      <ProjectDetailLoader paramsPromise={props.params} />
    </Suspense>
  );
}

async function ProjectDetailLoader({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const supabase = await createClient();

  const [{ data: project }, { data: pos }, { data: projectVendors }, { data: allVendors }, { data: allAccounts }] = await Promise.all([
    supabase
      .from('projects')
      .select('*')
      .eq('id', params.id)
      .single(),
    supabase
      .from('purchase_orders')
      .select('*, vendors(id, name, currency)')
      .eq('project_id', params.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('project_vendors')
      .select('vendor_id, vendors(id, name, currency)')
      .eq('project_id', params.id),
    supabase
      .from('vendors')
      .select('id, name')
      .eq('status', 'active')
      .is('deleted_at', null)
      .order('name'),
    supabase
      .from('crm_accounts')
      .select('id, company_name')
      .is('deleted_at', null)
      .order('company_name'),
  ]);

  if (!project) notFound();

  // Derive the linked account from the already-fetched allAccounts list rather than
  // using a PostgREST FK join — the join errors/hangs when account_id is null.
  const crm_accounts = project.account_id
    ? ((allAccounts || []).find((a: any) => a.id === project.account_id) ?? null)
    : null;

  const signedProject = await signDocUrl(supabase, 'crm-documents', { ...project, crm_accounts });

  const linkedVendors = (projectVendors || []).map((pv: any) => pv.vendors).filter(Boolean);
  const linkedVendorIds = linkedVendors.map((v: any) => v.id);
  const availableVendors = (allVendors || []).filter((v: any) => !linkedVendorIds.includes(v.id));

  // Fetch invoices, payments, and completion certs for billing summary
  const poIds = (pos || []).map(p => p.id);

  const { data: invoices } = await supabase
    .from('service_invoices')
    .select('id, amount, po_id')
    .in('po_id', poIds)
    .is('deleted_at', null);

  const invoiceIds = (invoices || []).map(i => i.id);
  const { data: payments } = await supabase
    .from('payments')
    .select('amount_paid, invoice_id')
    .in('invoice_id', invoiceIds)
    .is('deleted_at', null);

  const { data: certs } = await supabase
    .from('po_completion_certificates')
    .select('po_id, percent_complete')
    .eq('status', 'approved')
    .in('po_id', poIds);

  // Aggregate billing summary
  const invoicedByPO = new Map<string, number>();
  for (const inv of invoices ?? []) {
    invoicedByPO.set(inv.po_id, (invoicedByPO.get(inv.po_id) ?? 0) + Number(inv.amount));
  }

  const paidByInvoice = new Map<string, number>();
  for (const pmt of payments ?? []) {
    paidByInvoice.set(pmt.invoice_id, (paidByInvoice.get(pmt.invoice_id) ?? 0) + Number(pmt.amount_paid));
  }

  const paidByPO = new Map<string, number>();
  for (const inv of invoices ?? []) {
    const paid = paidByInvoice.get(inv.id) ?? 0;
    paidByPO.set(inv.po_id, (paidByPO.get(inv.po_id) ?? 0) + paid);
  }

  const completionByPO = new Map<string, number>();
  for (const cert of certs ?? []) {
    const curr = completionByPO.get(cert.po_id) ?? 0;
    completionByPO.set(cert.po_id, Math.max(curr, Number(cert.percent_complete)));
  }

  let totalPOValue = 0, totalDpAmount = 0;
  let totalInvoiced = 0, totalPaid = 0;
  let weightedCompletionSum = 0;

  const poDetails: Array<{
    poId: string;
    poNumber: string;
    vendorName: string;
    amount: number;
    dpAmount: number;
    invoiced: number;
    paid: number;
    billingPct: number;
    completionPct: number;
  }> = [];

  for (const po of pos ?? []) {
    const amount = Number(po.amount);
    const dp = Number((po as any).dp_amount ?? 0);
    const invoiced = invoicedByPO.get(po.id) ?? 0;
    const paid = paidByPO.get(po.id) ?? 0;
    const compPct = completionByPO.get(po.id) ?? 0;

    totalPOValue += amount;
    totalDpAmount += dp;
    totalInvoiced += invoiced;
    totalPaid += paid + dp;
    weightedCompletionSum += amount * compPct;

    poDetails.push({
      poId: po.id,
      poNumber: po.po_number,
      vendorName: (po as any).vendors?.name ?? '',
      amount,
      dpAmount: dp,
      invoiced,
      paid,
      billingPct: amount > 0 ? Math.round(((invoiced + dp) / amount) * 100) : 0,
      completionPct: compPct,
    });
  }

  const billingPct = totalPOValue > 0
    ? Math.round(((totalInvoiced + totalDpAmount) / totalPOValue) * 100)
    : 0;
  const completionPct = (project as any).completion_pct != null
    ? Math.round(Number((project as any).completion_pct))
    : totalPOValue > 0
      ? Math.round(weightedCompletionSum / totalPOValue)
      : 0;
  const variance = completionPct - billingPct;

  const billingSummary = {
    totalPOValue,
    totalInvoiced,
    totalPaid,
    billingPct,
    completionPct,
    variance,
    poDetails,
  };

  return (
    <ProjectDetailContent
      project={signedProject}
      pos={pos || []}
      linkedVendors={linkedVendors}
      availableVendors={availableVendors}
      allAccounts={allAccounts || []}
      billingSummary={billingSummary}
    />
  );
}

function ProjectDetailSkeleton() {
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-pulse">
      <div className="h-10 w-64 bg-slate-100 dark:bg-slate-800/50 rounded-lg" />
      <div className="h-10 w-full border-b border-slate-200 dark:border-slate-800" />
      <div className="h-96 bg-slate-100 dark:bg-slate-800/50 rounded-2xl" />
    </div>
  );
}
