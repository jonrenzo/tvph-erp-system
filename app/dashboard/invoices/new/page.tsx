import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { ArrowLeft } from 'lucide-react';
import { CreateInvoiceForm } from '@/components/dashboard/invoices/create-invoice-form';

export default async function NewInvoicePage() {
  const supabase = await createClient();
  
  // Fetch vendors for the dropdown
  const { data: vendors } = await supabase
    .from('vendors')
    .select('id, name')
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('name');

  // Fetch all issued POs to allow linking
  const { data: pos } = await supabase
    .from('purchase_orders')
    .select('id, po_number, vendor_id, amount, net_days')
    .in('status', ['issued', 'partially_paid'])
    .is('deleted_at', null)
    .order('po_number');

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/invoices"
          className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">
            Record Vendor Invoice
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Enter billing details and link it to an existing Purchase Order.
          </p>
        </div>
      </div>

      <CreateInvoiceForm vendors={vendors || []} pos={pos || []} />
    </div>
  );
}
