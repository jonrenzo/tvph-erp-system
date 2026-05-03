import { createClient } from '@/utils/supabase/server';
import { ToolName } from './tools';
import { GoogleGenerativeAI } from "@google/generative-ai";

// TODO: Future role-based access - uncomment and modify when roles are implemented
// const canAccessDocuments = (role: string) => {
//   return ['admin', 'procurement', 'finance'].includes(role);
// };

export async function executeTool(name: ToolName, args: Record<string, unknown>) {
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
      if (userRole === 'user' || userRole === 'project_manager') {
        return "ERROR: Unauthorized. Procurement, Finance, or Admin access required for PO data.";
      }
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
      if (userRole === 'user' || userRole === 'project_manager') {
        return "ERROR: Unauthorized. Procurement or Admin access required for compliance data.";
      }
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
        expired_docs: v.vendor_documents?.filter((d: Record<string, unknown>) => d.status === 'expired').length || 0
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
      
      const totalPending = data?.filter(i => i.status !== 'paid').reduce((sum, i) => sum + Number(i.amount),0) || 0;
      return { total_pending_liabilities: totalPending };
    }

    case 'list_company_documents': {
      let query = supabase.from('tvph_documents').select('id, label, doc_type, expiry_date, file_name').is('archived_at', null);
      if (args.doc_type) query = query.eq('doc_type', args.doc_type);
      const { data, error } = await query.limit(50);
      if (error) {
        console.error("Supabase Tool Error (list_company_documents):", error);
        return `ERROR: ${error.message}`;
      }
      return data;
    }

    case 'list_vendor_documents': {
      let query = supabase.from('vendor_documents').select(`
        id, doc_type, status, expiry_date, file_name,
        vendors!inner(id, name)
      `).is('archived_at', null);

      if (args.vendor_id) query = query.eq('vendor_id', args.vendor_id);
      if (args.status) query = query.eq('status', args.status);

      const { data, error } = await query.limit(50);
      if (error) {
        console.error("Supabase Tool Error (list_vendor_documents):", error);
        return `ERROR: ${error.message}`;
      }
      return data?.map((doc: Record<string, unknown>) => ({
        ...doc,
        vendor_name: (doc.vendors as Record<string, unknown>)?.name,
        vendor_id: (doc.vendors as Record<string, unknown>)?.id,
      }));
    }

    case 'analyze_document': {
      // 1. Get document metadata from DB
      const table = args.document_type === 'company' ? 'tvph_documents' : 'vendor_documents';
      const { data: doc, error } = await supabase
        .from(table)
        .select('file_url, file_name')
        .eq('id', args.document_id)
        .single();

      if (error || !doc) {
        console.error("Document fetch error:", error);
        return `ERROR: Document not found: ${error?.message}`;
      }

      // 2. Generate signed URL (server-side, 1-hour expiry)
      const bucket = args.document_type === 'company' ? 'tvph-documents' : 'vendor-documents';
      const pathMatch = doc.file_url?.match(`/public/${bucket}/(.+)`);
      if (!pathMatch) return `ERROR: Invalid file URL format`;

      const path = pathMatch[1];
      const { data: signed, error: signError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 3600);

      if (signError || !signed?.signedUrl) {
        console.error("Signed URL error:", signError);
        return `ERROR: Failed to generate document access: ${signError?.message}`;
      }

      // 3. Call Gemini 2.5 Flash directly for PDF analysis
      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || "");
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const prompt = typeof args.question === 'string' 
        ? args.question 
        : `Please summarize this document concisely for a TelcoVantage team member. Include key dates, parties, and obligations.`;

      try {
        const result = await model.generateContent([
          { fileData: { mimeType: "application/pdf", fileUri: signed.signedUrl } },
          { text: prompt },
        ]);

        return {
          file_name: doc.file_name,
          analysis: result.response.text(),
          note: "URL expired after 1 hour, not accessible to end users",
        };
       } catch (geminiError: unknown) {
        console.error("Gemini analysis error:", geminiError);
        return `ERROR: Failed to analyze document: ${geminiError instanceof Error ? geminiError.message : String(geminiError)}`;
      }
    }

    default:
      return `Unknown tool: ${name}`;
  }
}
