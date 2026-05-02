import { createClient } from '@/utils/supabase/server';
import { ToolName } from './tools';

export async function executeTool(name: ToolName, args: any) {
  const supabase = await createClient();
  
  // Security check: Get user role
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user?.id)
    .single();
  const userRole = profile?.role || 'user';

  console.log(`Executing tool: ${name}`, args);

  switch (name) {
    case 'get_vendors': {
      let query = supabase.from('vendors').select('id, name, status');
      if (args.status) query = query.eq('status', args.status);
      const { data, error } = await query.limit(20);
      if (error) {
        console.error("Supabase Tool Error (get_vendors):", error);
        return `ERROR: ${error.message}`;
      }
      return data;
    }

    case 'get_purchase_orders': {
      let query = supabase.from('purchase_orders').select(`
        po_number, 
        amount, 
        status, 
        vendors(name)
      `);
      
      if (args.status) query = query.eq('status', args.status);
      const { data, error } = await query.order('created_at', { ascending: false }).limit(10);
      if (error) {
        console.error("Supabase Tool Error (get_purchase_orders):", error);
        return `ERROR: ${error.message}`;
      }
      return data;
    }

    case 'get_compliance_summary': {
      const { data, error } = await supabase
        .from('vendors')
        .select(`
          name,
          vendor_documents(status, doc_type)
        `);

      if (error) {
        console.error("Supabase Tool Error (get_compliance_summary):", error);
        return `ERROR: ${error.message}`;
      }

      return data?.map(v => ({
        name: v.name,
        missing_docs: v.vendor_documents?.length < 14,
        expired_docs: v.vendor_documents?.filter((d: any) => d.status === 'expired').length || 0
      }));
    }

    case 'get_financial_totals': {
      if (userRole !== 'admin' && userRole !== 'finance') {
        return "ERROR: Unauthorized. Only Admin/Finance can access financial totals.";
      }
      
      const { data } = await supabase
        .from('service_invoices')
        .select('amount, status')
        .is('deleted_at', null);
      
      const totalPending = data?.filter(i => i.status !== 'paid').reduce((sum, i) => sum + Number(i.amount), 0) || 0;
      return { total_pending_liabilities: totalPending };
    }

    default:
      return `Unknown tool: ${name}`;
  }
}
