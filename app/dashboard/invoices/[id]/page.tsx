import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { ArrowLeft, Building2, Calendar, FileText, CreditCard, Clock, ExternalLink, History, Plus, AlertCircle } from 'lucide-react';
import { notFound } from 'next/navigation';
import { RecordPaymentModal } from '@/components/dashboard/invoices/record-payment-modal';

export default async function InvoiceDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();

  const { data: invoice, error } = await supabase
    .from('service_invoices')
    .select(`
      *,
      vendors (name),
      purchase_orders (po_number, amount)
    `)
    .eq('id', params.id)
    .single();

  if (error || !invoice) {
    notFound();
  }

  // Fetch payments
  const { data: payments } = await supabase
    .from('payments')
    .select('*')
    .eq('invoice_id', invoice.id)
    .order('payment_date', { ascending: false });

  const totalPaid = payments?.reduce((sum, p) => sum + Number(p.amount_paid), 0) || 0;
  const balance = Number(invoice.amount) - totalPaid;
  const isOverpaid = totalPaid > Number(invoice.amount);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Overpayment Warning */}
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
          {invoice.file_url && (
            <a 
              href={invoice.file_url} 
              target="_blank" 
              className="inline-flex items-center gap-2 bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm"
            >
              <ExternalLink className="h-4 w-4" />
              View Original
            </a>
          )}
          {balance > 0 && (
            <RecordPaymentModal invoiceId={invoice.id} remainingBalance={balance} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Invoice Summary Card */}
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
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center justify-between">
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {payments?.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">
                        No payments recorded yet for this invoice.
                      </td>
                    </tr>
                  ) : (
                    payments?.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                        <td className="px-6 py-4 text-slate-900 dark:text-white font-medium">
                          {new Date(p.payment_date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 capitalize text-slate-600 dark:text-slate-400">
                          {p.payment_type.replace('_', ' ')}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-slate-500">
                          {p.reference_number || 'N/A'}
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                          ₱{Number(p.amount_paid).toLocaleString()}
                        </td>
                      </tr>
                    ))
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

          {invoice.notes && (
            <div className="bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30 rounded-2xl p-6">
              <h3 className="text-[10px] font-bold text-amber-800 dark:text-amber-500 uppercase mb-2 tracking-widest">Internal Notes</h3>
              <p className="text-xs text-amber-900/70 dark:text-amber-200/70 leading-relaxed italic">
                "{invoice.notes}"
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
