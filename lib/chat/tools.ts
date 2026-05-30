import { GoogleGenerativeAI } from "@google/generative-ai";
import { tool } from "ai";
import { z } from "zod";
import { getCurrentProfile, requireCapability } from "@/lib/auth/permissions";
import { createClient } from "@/utils/supabase/server";

const poStatusSchema = z.enum([
  "draft",
  "issued",
  "partially_paid",
  "paid",
  "overpaid",
  "cancelled",
]);

export const erpTools = {
  get_vendors: tool({
    description:
      "List vendors. Returns id, name, status, and url. Always render the vendor name as a markdown link using url.",
    inputSchema: z.object({
      status: z.enum(["active", "pending", "inactive"]).optional().describe("Filter vendors by status"),
    }),
    execute: async ({ status }) => {
      const supabase = await createClient();
      const { error: authError } = await getCurrentProfile(supabase);
      if (authError) return { error: authError };

      let query = supabase.from("vendors").select("id, name, status").is("deleted_at", null);
      if (status) query = query.eq("status", status);

      const { data, error } = await query.order("name", { ascending: true }).limit(20);
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
    description:
      "List customer CRM accounts. Returns id, company name, status, url, TIN, registered address, and primary contact when available. Always render the customer company name as a markdown link using url.",
    inputSchema: z.object({
      status: z.enum(["active", "pending", "inactive"]).optional().describe("Filter customers by status"),
      search: z.string().optional().describe("Search customer company names"),
    }),
    execute: async ({ status, search }) => {
      const supabase = await createClient();
      const { error: authError } = await getCurrentProfile(supabase);
      if (authError) return { error: authError };

      let query = supabase
        .from("crm_accounts")
        .select("id, company_name, registered_address, tin, status, created_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (status) query = query.eq("status", status);
      if (search?.trim()) query = query.ilike("company_name", `%${search.trim()}%`);

      const { data: customers, error } = await query.limit(20);
      if (error) throw new Error(error.message);

      const customerIds = (customers || []).map((customer) => customer.id);
      const { data: contacts, error: contactsError } = customerIds.length
        ? await supabase
            .from("crm_contacts")
            .select("account_id, full_name, email, phone")
            .in("account_id", customerIds)
            .eq("is_primary", true)
            .is("deleted_at", null)
        : { data: [], error: null };

      if (contactsError) throw new Error(contactsError.message);

      const primaryContactsByCustomer = new Map(
        (contacts || []).map((contact) => [contact.account_id, contact]),
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
    description: "List recent purchase orders, optionally filtered by vendor name or status.",
    inputSchema: z.object({
      vendor_name: z.string().optional().describe("Filter POs by vendor name"),
      status: poStatusSchema.optional().describe("Filter POs by status"),
    }),
    execute: async ({ vendor_name, status }) => {
      const supabase = await createClient();
      const { error: authError } = await requireCapability("export.financial", supabase);
      if (authError) return { error: authError };

      let query = supabase
        .from("purchase_orders")
        .select("po_number, amount, currency, status, vendors!inner(name)")
        .is("deleted_at", null);

      if (status) query = query.eq("status", status);
      if (vendor_name?.trim()) query = query.ilike("vendors.name", `%${vendor_name.trim()}%`);

      const { data, error } = await query.order("created_at", { ascending: false }).limit(10);
      if (error) throw new Error(error.message);
      return data;
    },
  }),

  get_compliance_summary: tool({
    description: "Get a summary of vendor accreditation status and identify vendors with expired documents.",
    inputSchema: z.object({}),
    execute: async () => {
      const supabase = await createClient();
      const { error: authError } = await requireCapability("vendor.write", supabase);
      if (authError) return { error: authError };

      const { data, error } = await supabase
        .from("vendors")
        .select("name, vendor_documents(status, doc_type)")
        .is("deleted_at", null);

      if (error) throw new Error(error.message);

      return data?.map((vendor) => {
        const documents = Array.isArray(vendor.vendor_documents) ? vendor.vendor_documents : [];
        return {
          name: vendor.name,
          missing_docs: documents.length < 14,
          expired_docs: documents.filter((document) => document.status === "expired").length,
        };
      });
    },
  }),

  get_financial_totals: tool({
    description: "Calculate total liabilities and pending invoice amounts. Admin/Finance only.",
    inputSchema: z.object({}),
    execute: async () => {
      const supabase = await createClient();
      const { error: authError } = await requireCapability("export.financial", supabase);
      if (authError) return { error: authError };

      const { data, error } = await supabase
        .from("service_invoices")
        .select("amount, status")
        .is("deleted_at", null);

      if (error) throw new Error(error.message);

      const totalPending =
        data?.filter((invoice) => invoice.status !== "paid").reduce((sum, invoice) => sum + Number(invoice.amount), 0) || 0;

      return { total_pending_liabilities: totalPending };
    },
  }),

  list_company_documents: tool({
    description: "List TelcoVantage company documents. Metadata only: name, type, expiry, status.",
    inputSchema: z.object({
      doc_type: z.string().optional().describe("Filter by document type, e.g. legal, hr, finance, template"),
    }),
    execute: async ({ doc_type }) => {
      const supabase = await createClient();
      const { error: authError } = await getCurrentProfile(supabase);
      if (authError) return { error: authError };

      let query = supabase
        .from("tvph_documents")
        .select("id, label, doc_type, expiry_date, file_name")
        .is("archived_at", null);

      if (doc_type) query = query.eq("doc_type", doc_type);

      const { data, error } = await query.limit(50);
      if (error) throw new Error(error.message);
      return data;
    },
  }),

  list_vendor_documents: tool({
    description: "List vendor accreditation documents. Metadata only: name, type, status, expiry.",
    inputSchema: z.object({
      vendor_id: z.string().optional().describe("Filter by vendor UUID to see only their documents"),
      status: z.enum(["approved", "submitted", "expired", "not_submitted"]).optional().describe("Filter by status"),
    }),
    execute: async ({ vendor_id, status }) => {
      const supabase = await createClient();
      const { error: authError } = await getCurrentProfile(supabase);
      if (authError) return { error: authError };

      let query = supabase
        .from("vendor_documents")
        .select("id, doc_type, status, expiry_date, file_name, vendors!inner(id, name)")
        .is("archived_at", null);

      if (vendor_id) query = query.eq("vendor_id", vendor_id);
      if (status) query = query.eq("status", status);

      const { data, error } = await query.limit(50);
      if (error) throw new Error(error.message);

      return data?.map((doc) => {
        const vendor = Array.isArray(doc.vendors) ? doc.vendors[0] : doc.vendors;
        return {
          id: doc.id,
          doc_type: doc.doc_type,
          status: doc.status,
          expiry_date: doc.expiry_date,
          file_name: doc.file_name,
          vendor_name: vendor?.name,
          vendor_id: vendor?.id,
        };
      });
    },
  }),

  analyze_document: tool({
    description: "Analyze a PDF document's content. Read-only; requires document ID and type.",
    inputSchema: z.object({
      document_id: z.string().describe("UUID of the document from list tools"),
      document_type: z.enum(["company", "vendor"]).describe("Document type"),
      question: z.string().optional().describe("Specific question about the document"),
    }),
    execute: async ({ document_id, document_type, question }) => {
      const supabase = await createClient();
      const { error: authError } = await getCurrentProfile(supabase);
      if (authError) return { error: authError };

      const table = document_type === "company" ? "tvph_documents" : "vendor_documents";
      const { data: doc, error } = await supabase
        .from(table)
        .select("file_url, file_name")
        .eq("id", document_id)
        .single();

      if (error || !doc) return { error: `Document not found: ${error?.message}` };

      const bucket = document_type === "company" ? "tvph-documents" : "vendor-documents";
      const pathMatch = doc.file_url?.match(new RegExp(`/public/${bucket}/(.+)`));
      if (!pathMatch) return { error: "Invalid file URL format" };

      const path = pathMatch[1];
      const { data: signed, error: signError } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
      if (signError || !signed?.signedUrl) {
        return { error: `Failed to generate document access: ${signError?.message}` };
      }

      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || "");
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const prompt =
        question ||
        "Please summarize this document concisely for a TelcoVantage team member. Include key dates, parties, and obligations.";

      try {
        const result = await model.generateContent([
          { fileData: { mimeType: "application/pdf", fileUri: signed.signedUrl } },
          { text: prompt },
        ] as any);

        return {
          file_name: doc.file_name,
          analysis: result.response.text(),
          note: "The signed URL expires after 1 hour and is not shown to end users.",
        };
      } catch (geminiError) {
        const message = geminiError instanceof Error ? geminiError.message : "Unknown Gemini error";
        return { error: `Failed to analyze document: ${message}` };
      }
    },
  }),
};
