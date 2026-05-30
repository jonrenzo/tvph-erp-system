// @ts-nocheck
import { tool } from 'ai';
import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const erpTools = {
  get_vendors: tool({
    description: "List all vendors. Returns id, name, status, and url. Always render the vendor name as a markdown link using url.",
    parameters: z.object({
      status: z.enum(["active", "pending", "inactive"]).optional().describe("Filter vendors by status"),
    }),
    execute: async ({ status }) => {
      const supabase = await createClient();
      let query = supabase.from('vendors').select('id, name, status');
      if (status) query = query.eq('status', status);
      const { data, error } = await query.limit(20);
      if (error) throw new Error(error.message);
      return (data || []).map((vendor) => ({
        id: vendor.id,
        name: vendor.name,
        status: vendor.status,
        url: `/dashboard/vendors/${vendor.id}`,
      }));
    },
  }),
  get_customers: tool({
    description: "List customer CRM accounts. Returns id, company name, status, url, TIN, registered address, and primary contact when available. Always render the customer company name as a markdown link using url.",
    parameters: z.object({
      status: z.enum(["active", "pending", "inactive"]).optional().describe("Filter customers by status"),
      search: z.string().optional().describe("Search customer company names"),
    }),
    execute: async ({ status, search }) => {
      const supabase = await createClient();
      let query = supabase
        .from('crm_accounts')
        .select('id, company_name, registered_address, tin, status, created_at')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (status) query = query.eq('status', status);
      if (search?.trim()) query = query.ilike('company_name', `%${search.trim()}%`);

      const { data: customers, error } = await query.limit(20);
      if (error) throw new Error(error.message);

      const customerIds = (customers || []).map((customer) => customer.id);
      const { data: contacts, error: contactsError } = customerIds.length
        ? await supabase
            .from('crm_contacts')
            .select('account_id, full_name, email, phone')
            .in('account_id', customerIds)
            .eq('is_primary', true)
            .is('deleted_at', null)
        : { data: [], error: null };

      if (contactsError) throw new Error(contactsError.message);

      const primaryContactsByCustomer = new Map(
        (contacts || []).map((contact) => [contact.account_id, contact])
      );

      return (customers || []).map((customer) => ({
        id: customer.id,
        company_name: customer.company_name,
        status: customer.status,
        url: `/dashboard/crm/${customer.id}`,
        tin: customer.tin,
        registered_address: customer.registered_address,
        primary_contact: primaryContactsByCustomer.get(customer.id) || null,
      }));
    },
  }),
  get_purchase_orders: tool({
    description: "List recent purchase orders, optionally filtered by vendor name or status",
    parameters: z.object({
      vendor_name: z.string().optional().describe("Filter POs by vendor name"),
      status: z.enum(["draft", "pending", "approved", "rejected", "closed"]).optional().describe("Filter POs by status"),
    }),
    execute: async ({ status }) => {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user?.id).single();
      const userRole = profile?.role || 'user';
      if (userRole === 'user' || userRole === 'project_manager') {
        return { error: "Unauthorized. Procurement, Finance, or Admin access required for PO data." };
      }
      let query = supabase.from('purchase_orders').select('po_number, amount, status, vendors(name)');
      if (status) query = query.eq('status', status);
      const { data, error } = await query.order('created_at', { ascending: false }).limit(10);
      if (error) throw new Error(error.message);
      return data;
    },
  }),
  get_compliance_summary: tool({
    description: "Get a summary of vendor accreditation status and identify vendors with expired documents",
    parameters: z.object({}),
    execute: async () => {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user?.id).single();
      const userRole = profile?.role || 'user';
      if (userRole === 'user' || userRole === 'project_manager') {
        return { error: "Unauthorized. Procurement or Admin access required for compliance data." };
      }
      const { data, error } = await supabase.from('vendors').select('name, vendor_documents(status, doc_type)');
      if (error) throw new Error(error.message);
      return data?.map(v => ({
        name: v.name,
        missing_docs: Array.isArray(v.vendor_documents) && v.vendor_documents.length < 14,
        expired_docs: Array.isArray(v.vendor_documents) ? v.vendor_documents.filter(d => d.status === 'expired').length : 0
      }));
    },
  }),
  get_financial_totals: tool({
    description: "Calculate total liabilities and pending invoice amounts (Admin/Finance only)",
    parameters: z.object({}),
    execute: async () => {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user?.id).single();
      const userRole = profile?.role || 'user';
      if (userRole !== 'admin' && userRole !== 'finance') {
        return { error: "Unauthorized. Only Admin/Finance can access financial totals." };
      }
      const { data } = await supabase.from('service_invoices').select('amount, status').is('deleted_at', null);
      const totalPending = data?.filter(i => i.status !== 'paid').reduce((sum, i) => sum + Number(i.amount), 0) || 0;
      return { total_pending_liabilities: totalPending };
    },
  }),
  list_company_documents: tool({
    description: "List TelcoVantage company documents (metadata only: name, type, expiry, status). Filters optional.",
    parameters: z.object({
      doc_type: z.string().optional().describe("Filter by document type (e.g., 'policy', 'license')"),
    }),
    execute: async ({ doc_type }) => {
      const supabase = await createClient();
      let query = supabase.from('tvph_documents').select('id, label, doc_type, expiry_date, file_name').is('archived_at', null);
      if (doc_type) query = query.eq('doc_type', doc_type);
      const { data, error } = await query.limit(50);
      if (error) throw new Error(error.message);
      return data;
    },
  }),
  list_vendor_documents: tool({
    description: "List vendor accreditation documents (metadata only: name, type, status, expiry). Filters optional.",
    parameters: z.object({
      vendor_id: z.string().optional().describe("Filter by vendor UUID to see only their documents"),
      status: z.enum(["approved", "submitted", "expired", "not_submitted"]).optional().describe("Filter by status"),
    }),
    execute: async ({ vendor_id, status }) => {
      const supabase = await createClient();
      let query = supabase.from('vendor_documents').select('id, doc_type, status, expiry_date, file_name, vendors!inner(id, name)').is('archived_at', null);
      if (vendor_id) query = query.eq('vendor_id', vendor_id);
      if (status) query = query.eq('status', status);
      const { data, error } = await query.limit(50);
      if (error) throw new Error(error.message);
      return data?.map(doc => ({
        ...doc,
        vendor_name: (doc.vendors as any)?.name,
        vendor_id: (doc.vendors as any)?.id,
      }));
    },
  }),
  analyze_document: tool({
    description: "Analyze a PDF document's content (summarize, answer questions, extract key info). Requires document ID and type.",
    parameters: z.object({
      document_id: z.string().describe("UUID of the document from list tools"),
      document_type: z.enum(["company", "vendor"]).describe("Type of document: 'company' (tvph_documents) or 'vendor' (vendor_documents)"),
      question: z.string().optional().describe("Specific question about the document (e.g., 'Summarize key terms')"),
    }),
    execute: async ({ document_id, document_type, question }) => {
      const supabase = await createClient();
      const table = document_type === 'company' ? 'tvph_documents' : 'vendor_documents';
      const { data: doc, error } = await supabase.from(table).select('file_url, file_name').eq('id', document_id).single();
      if (error || !doc) return { error: `Document not found: ${error?.message}` };

      const bucket = document_type === 'company' ? 'tvph-documents' : 'vendor-documents';
      const pathMatch = doc.file_url?.match(new RegExp(`/public/${bucket}/(.+)`));
      if (!pathMatch) return { error: `Invalid file URL format` };
      
      const path = pathMatch[1];
      const { data: signed, error: signError } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
      if (signError || !signed?.signedUrl) return { error: `Failed to generate document access: ${signError?.message}` };

      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || "");
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const prompt = question || `Please summarize this document concisely for a TelcoVantage team member. Include key dates, parties, and obligations.`;
      
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
      } catch (geminiError: any) {
        return { error: `Failed to analyze document: ${geminiError.message}` };
      }
    },
  }),
  create_draft_po: tool({
    description: "Create a draft purchase order for a vendor. Requires vendor_id, amount, and project_id.",
    parameters: z.object({
      vendor_id: z.string().describe("UUID of the vendor"),
      amount: z.number().describe("Total amount for the PO"),
      project_id: z.string().optional().describe("UUID of the project, optional"),
    }),
    execute: async ({ vendor_id, amount, project_id }) => {
      const supabase = await createClient();
      const po_number = `PO-DRAFT-${Math.floor(Math.random() * 1000000)}`;
      const { data, error } = await supabase.from('purchase_orders').insert({
        vendor_id,
        amount,
        project_id,
        po_number,
        status: 'draft',
      }).select().single();
      
      if (error) return { error: error.message };
      return { success: true, message: `Created draft PO ${po_number}`, po: data };
    },
  }),
  approve_vendor_document: tool({
    description: "Approve a vendor's document.",
    parameters: z.object({
      document_id: z.string().describe("UUID of the document"),
    }),
    execute: async ({ document_id }) => {
      const supabase = await createClient();
      const { data, error } = await supabase.from('vendor_documents').update({ status: 'approved' }).eq('id', document_id).select().single();
      if (error) return { error: error.message };
      return { success: true, message: `Approved document`, document: data };
    },
  }),
  add_crm_opportunity: tool({
    description: "Add a new CRM opportunity/lead.",
    parameters: z.object({
      company_name: z.string().describe("Name of the company/account"),
      title: z.string().describe("Title of the opportunity (e.g. '50 Laptops')"),
      job_type: z.enum(['underground_mining', 'pole_recovery', 'copper_recovery', 'site_survey', 'inspection_only', 'other']).describe("Type of job"),
    }),
    execute: async ({ company_name, title, job_type }) => {
      const supabase = await createClient();
      
      // Look up or create account
      let account_id;
      const { data: existingAccount } = await supabase.from('crm_accounts').select('id').ilike('company_name', company_name).limit(1).single();
      if (existingAccount) {
        account_id = existingAccount.id;
      } else {
        const { data: newAccount, error: accountError } = await supabase.from('crm_accounts').insert({ company_name }).select().single();
        if (accountError) return { error: `Failed to create account: ${accountError.message}` };
        account_id = newAccount.id;
      }

      // Create opportunity
      const { data, error } = await supabase.from('crm_opportunities').insert({
        account_id,
        title,
        job_type,
        stage: 'prospect'
      }).select().single();

      if (error) return { error: error.message };
      return { success: true, message: `Created opportunity for ${company_name}`, opportunity: data };
    },
  }),
};
