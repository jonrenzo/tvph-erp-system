import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { ArrowLeft, Save, FileText, Building2, Calendar, CircleDollarSign } from 'lucide-react';
import { createPurchaseOrder } from '../actions';
import { CreatePOForm } from '@/components/dashboard/purchase-orders/create-po-form';

export default async function NewPurchaseOrderPage() {
  const supabase = await createClient();
  
  // Fetch vendors for the dropdown
  const { data: vendors } = await supabase
    .from('vendors')
    .select('id, name')
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('name');

  // Fetch projects for the dropdown
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, vendor_id')
    .is('deleted_at', null)
    .order('name');

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/purchase-orders"
          className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">
            Create Purchase Order
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Generate a new PO for an active vendor.
          </p>
        </div>
      </div>

      <CreatePOForm vendors={vendors || []} projects={projects || []} />
    </div>
  );
}
