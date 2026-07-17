import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { ArrowLeft, Building2, FileText, CreditCard, History, ExternalLink, AlertCircle, Clock, Paperclip, Tag, Send } from 'lucide-react';
import { notFound } from 'next/navigation';
import { RecordPaymentModal } from '@/components/dashboard/invoices/record-payment-modal';
import { AttachPaymentDocModal } from '@/components/dashboard/invoices/attach-payment-doc-modal';
import { InvoiceStatusActions } from '@/components/dashboard/invoices/invoice-status-actions';
import { Suspense } from 'react';
import { getCurrentProfile, hasCapability } from '@/lib/auth/permissions';
import { signDocUrls } from '@/utils/storage';

export const unstable_instant = {
  prefetch: 'static',
  samples: [{ params: { id: 'sample-id' } }]
};

export default function InvoiceDetailPage(props: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<InvoiceDetailSkeleton />}>
      <InvoiceDetailContent paramsPromise={props.params} />
    </Suspense>
  );
}

async function InvoiceDetailContent({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const supabase = await createClient();

  const [
    { data: invoice, error },
    { data: payments },
    { role },
  ] = await Promise.all([
    supabase
      .from('service_invoices')
      .select(`*, vendors (name), purchase_orders (po_number, amount)`)
      .eq('id', params.id)
      .single(),
    supabase
      .from('payments')
      .select(`
        id, payment_date, payment_type, reference_number, amount_paid,
        payment_documents (id, doc_type, label, file_url, file_name)
      `)
      .eq('invoice_id', params.id)
      .order('payment_date', { ascending: false }),
    getCurrentProfile(supabase),
  ]);

  if (error || !invoice) notFound();

  const { data: paymentRequest } = invoice.payment_request_id
    ? await supabase
        .from('payment_requests')
        .select('id, request_number, amount, status')
        .eq('id', invoice.payment_request_id)
        .single()
    : { data: null };

  const canPay = role ? hasCapability(role, 'invoice.pay') : false;

  // Sign all payment document URLs in parallel
  const paymentsWithSignedDocs = await Promise.all(
    (payments ?? []).map(async (p: any) => {
      const liveDocs = (p.payment_documents ?? []).filter((d: any) => !d.deleted_at);
      const signedDocs = await signDocUrls(supabase, 'vendor-documents', liveDocs);
      return { ...p, payment_documents: signedDocs };
    })
  );

  const totalPaid = paymentsWithSignedDocs.reduce((sum, p) => sum + Number(p.amount_paid), 0);
  const balance = Number(invoice.amount) - totalPaid;
  const isOverpaid = totalPaid > Number(invoice.amount);

  // Sign the invoice's original file URL if present
  const [signedInvoiceRecord] = await signDocUrls(supabase, 'vendor-documents', invoice.file_url ? [{ file_url: invoice.file_url as string }] : []);
  const invoiceFileUrl = signedInvoiceRecord?.file_url ?? invoice.file_url;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {isOverpaid && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 flex items-center gap-3 text-red-700 dark:text-red-400">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-bold">Overpayment Detected</p>
            <p className="text-sm">This invoice has been overpaid by ₱{(totalPaid - Number(invoice.amount)).toLocaleString()}.</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link
            href="/dashboard/invoices"
            className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors mt-1"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">
                {invoice.invoice_number}
              </h1>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                invoice.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50' :
                invoice.status === 'approved' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/50' :
                invoice.status === 'disputed' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50' :
                'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/50'
              }`}>
                {invoice.status.toUpperCase()}
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Vendor: <span className="font-medium text-slate-700 dark:text-slate-300">{invoice.vendors?.name}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 md:ml-auto">
          {invoiceFileUrl && (
            <a
              href={invoiceFileUrl}
              target="_blank"
              className="inline-flex items-center gap-2 bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm"
            >
              <ExternalLink className="h-4 w-4" />
              View Original
            </a>
          )}
          <InvoiceStatusActions
            invoiceId={invoice.id}
            currentStatus={invoice.status}
            hasPaymentRequest={!!paymentRequest}
            canOverride={hasCapability(role, 'invoice.override')}
          />
          {balance > 0 && canPay && (
            <RecordPaymentModal invoiceId={invoice.id} remainingBalance={balance} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Invoice Summary + Payment History */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-slate-800/50">
              <div className="p-6">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Invoice Amount</label>
                <div className="mt-1 text-xl font-bold text-slate-900 dark:text-white">₱{Number(invoice.amount).toLocaleString()}</div>
              </div>
              <div className="p-6">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Paid</label>
                <div className="mt-1 text-xl font-bold text-emerald-600 dark:text-emerald-400">₱{totalPaid.toLocaleString()}</div>
              </div>
              <div className="p-6 bg-slate-50/50 dark:bg-slate-800/10">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Balance Due</label>
                <div className={`mt-1 text-xl font-bold ${balance > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                  ₱{balance.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Payment History */}
          <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center">
              <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <History className="h-5 w-5 text-primary" /> Payment History
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[10px] text-slate-500 uppercase bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Date</th>
                    <th className="px-6 py-3 font-semibold">Type</th>
                    <th className="px-6 py-3 font-semibold">Reference</th>
                    <th className="px-6 py-3 font-semibold">Amount</th>
                    <th className="px-6 py-3 font-semibold">Documents</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paymentsWithSignedDocs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                        No payments recorded yet for this invoice.
                      </td>
                    </tr>
                  ) : (
                    paymentsWithSignedDocs.map((p: any) => {
                      const hasOR = p.payment_documents?.some((d: any) => d.doc_type === 'official_receipt');
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                          <td className="px-6 py-4 text-slate-900 dark:text-white font-medium whitespace-nowrap">
                            {new Date(p.payment_date).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 capitalize text-slate-600 dark:text-slate-400">
                            {p.payment_type.replace('_', ' ')}
                          </td>
                          <td className="px-6 py-4 font-mono text-xs text-slate-500">
                            {p.reference_number || 'N/A'}
                          </td>
                          <td className="px-6 py-4 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                            ₱{Number(p.amount_paid).toLocaleString()}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {p.payment_documents?.map((doc: any) => (
                                <a
                                  key={doc.id}
                                  href={doc.file_url}
                                  target="_blank"
                                  title={doc.label || doc.doc_type.replace(/_/g, ' ')}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-primary/10 hover:text-primary transition-colors"
                                >
                                  <Paperclip className="h-2.5 w-2.5" />
                                  {doc.doc_type === 'payment_voucher' ? 'PV' :
                                   doc.doc_type === 'proof_of_payment' ? 'Proof' :
                                   doc.doc_type === 'official_receipt' ? 'OR' :
                                   doc.label ?? 'Doc'}
                                </a>
                              ))}
                              {!hasOR && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
                                  <Clock className="h-2.5 w-2.5" />
                                  Awaiting OR
                                </span>
                              )}
                              {!hasOR && canPay && (
                                <AttachPaymentDocModal paymentId={p.id} />
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-8">
          <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" /> Linking Info
            </h3>
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Purchase Order</label>
                {invoice.po_id ? (
                  <Link href={`/dashboard/purchase-orders/${invoice.po_id}`} className="block mt-1 font-bold text-primary hover:underline">
                    {invoice.purchase_orders?.po_number}
                  </Link>
                ) : (
                  <div className="mt-1 text-slate-400 text-sm">Standalone Invoice</div>
                )}
              </div>

              {paymentRequest && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Payment Request</label>
                  <Link
                    href={`/dashboard/purchase-orders/${invoice.po_id}`}
                    className="block mt-1 font-bold text-primary hover:underline"
                  >
                    {paymentRequest.request_number}
                  </Link>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-500">₱{Number(paymentRequest.amount).toLocaleString()} approved</span>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${
                      paymentRequest.status === 'fully_invoiced'
                        ? 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
                        : paymentRequest.status === 'approved'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400'
                        : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400'
                    }`}>
                      {paymentRequest.status === 'fully_invoiced' ? 'FULLY INVOICED' : paymentRequest.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              )}

              {invoice.carry_forward_amount != null && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/50">
                  <label className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                    {invoice.carry_forward_amount >= 0 ? 'Carry-Forward' : 'Overage'}
                  </label>
                  <p className="mt-1 font-bold text-emerald-700 dark:text-emerald-400">
                    {invoice.carry_forward_amount >= 0
                      ? `₱${Number(invoice.carry_forward_amount).toLocaleString()}`
                      : `₱${Math.abs(Number(invoice.carry_forward_amount)).toLocaleString()} over approved balance`}
                  </p>
                  {paymentRequest && invoice.carry_forward_amount >= 0 && (
                    <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/60 mt-0.5">
                      Remaining on {paymentRequest.request_number}
                    </p>
                  )}
                </div>
              )}

              {invoice.override_reason && (
                <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800/50">
                  <label className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase">Override</label>
                  <p className="mt-1 text-xs text-orange-700 dark:text-orange-300">{invoice.override_reason}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Inv. Date</label>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{new Date(invoice.invoice_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Due Date</label>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>

          {invoice.payment_method && (
            <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" /> Mode of Payment
              </h3>
              <p className="text-sm font-medium text-slate-900 dark:text-white capitalize">
                {invoice.payment_method.replace(/_/g, ' ')}
              </p>
            </div>
          )}

          {(invoice.expense_category || invoice.notes) && (
            <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Tag className="h-4 w-4 text-primary" /> What For
              </h3>
              <div className="space-y-3">
                {invoice.expense_category && (
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Category</label>
                    <p className="text-sm font-medium text-slate-900 dark:text-white mt-1 capitalize">
                      {invoice.expense_category.replace(/_/g, ' ')}
                    </p>
                  </div>
                )}
                {invoice.notes && (
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Notes</label>
                    <p className="text-sm text-slate-700 dark:text-slate-300 mt-1 whitespace-pre-wrap">
                      {invoice.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {invoice.submitted_at && (
            <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Send className="h-4 w-4 text-primary" /> Submission
              </h3>
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                {new Date(invoice.submitted_at).toLocaleDateString(undefined, {
                  year: 'numeric', month: 'long', day: 'numeric'
                })}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InvoiceDetailSkeleton() {
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-pulse">
      <div className="h-10 w-64 bg-slate-100 dark:bg-slate-800/50 rounded-lg" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 h-64 bg-slate-100 dark:bg-slate-800/50 rounded-2xl" />
        <div className="h-64 bg-slate-100 dark:bg-slate-800/50 rounded-2xl" />
      </div>
    </div>
  );
}
