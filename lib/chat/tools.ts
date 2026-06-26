import { google } from "@ai-sdk/google";
import { generateText, tool } from "ai";
import { z } from "zod";
import { getCurrentProfile, requireCapability } from "@/lib/auth/permissions";
import { createClient } from "@/utils/supabase/server";
import { recordAuditLog } from "@/utils/audit";
import { createNotification } from "@/utils/notifications";
import { importVendorsFromFile, importCustomersFromFile } from "@/utils/ai-import-processor";
import { createPurchaseOrderCore } from "@/app/dashboard/purchase-orders/actions";

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

  create_vendor: tool({
    description:
      "Create a new vendor. REQUIRES user confirmation before executing. Present a summary of all vendor data and ask the user to confirm before calling this tool.",
    inputSchema: z.object({
      name: z.string().describe("Vendor company name"),
      address: z.string().optional().describe("Vendor address"),
      tin: z.string().optional().describe("Tax Identification Number"),
      contact_person: z.string().optional().describe("Primary contact person name"),
      contact_email: z.string().optional().describe("Primary contact email"),
      contact_phone: z.string().optional().describe("Primary contact phone"),
    }),
    execute: async (input) => {
      const supabase = await createClient();
      const { user, error: authError } = await requireCapability("vendor.write", supabase);
      if (authError || !user) return { error: authError || "Unauthorized" };

      const { data: vendor, error } = await supabase
        .from("vendors")
        .insert({
          name: input.name,
          address: input.address || null,
          tin: input.tin || null,
          contact_person: input.contact_person || null,
          contact_email: input.contact_email || null,
          contact_phone: input.contact_phone || null,
          created_by: user.id,
          status: "pending",
        })
        .select("id, name")
        .single();

      if (error) return { error: error.message };

      await recordAuditLog({
        entity_type: "vendor",
        entity_id: vendor.id,
        action: "CREATE",
        changes: { after: { name: input.name, tin: input.tin || null, status: "pending" } },
        performed_by: user.id,
      });

      await createNotification({
        type: "vendor",
        title: "Vendor Created",
        message: `${input.name} was added as a vendor.`,
        link: `/dashboard/vendors/${vendor.id}`,
        created_by: user.id,
      });

      return {
        id: vendor.id,
        name: vendor.name,
        url: `/dashboard/vendors/${vendor.id}`,
        message: `Vendor "${input.name}" created successfully.`,
      };
    },
  }),

  update_vendor: tool({
    description:
      "Update an existing vendor's details. REQUIRES user confirmation before executing. Present the changes to the user and ask for confirmation before calling this tool.",
    inputSchema: z.object({
      vendor_id: z.string().describe("UUID of the vendor to update"),
      name: z.string().optional().describe("New vendor company name"),
      address: z.string().optional().describe("New vendor address"),
      tin: z.string().optional().describe("New Tax Identification Number"),
      contact_person: z.string().optional().describe("New primary contact person name"),
      contact_email: z.string().optional().describe("New primary contact email"),
      contact_phone: z.string().optional().describe("New primary contact phone"),
      status: z.enum(["active", "inactive", "pending"]).optional().describe("New vendor status"),
    }),
    execute: async (input) => {
      const supabase = await createClient();
      const { user, error: authError } = await requireCapability("vendor.write", supabase);
      if (authError || !user) return { error: authError || "Unauthorized" };

      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const [key, value] of Object.entries(input)) {
        if (key !== "vendor_id" && value !== undefined) {
          updates[key] = value;
        }
      }

      if (Object.keys(updates).length <= 1) return { error: "No fields to update" };

      const { error } = await supabase.from("vendors").update(updates).eq("id", input.vendor_id);
      if (error) return { error: error.message };

      await recordAuditLog({
        entity_type: "vendor",
        entity_id: input.vendor_id,
        action: "UPDATE",
        changes: { after: updates },
        performed_by: user.id,
      });

      return { message: "Vendor updated successfully." };
    },
  }),

  create_customer: tool({
    description:
      "Create a new CRM customer account. REQUIRES user confirmation before executing. Present a full summary of customer details and ask the user to confirm before calling this tool. At least one primary contact is required.",
    inputSchema: z.object({
      company_name: z.string().describe("Customer company name"),
      registered_address: z.string().optional().describe("Customer registered address"),
      tin: z.string().optional().describe("Tax Identification Number"),
      contact_full_name: z.string().describe("Primary contact full name"),
      contact_email: z.string().optional().describe("Primary contact email"),
      contact_phone: z.string().optional().describe("Primary contact phone"),
      contact_job_title: z.string().optional().describe("Primary contact job title"),
      notes: z.string().optional().describe("General notes about the customer"),
    }),
    execute: async (input) => {
      const supabase = await createClient();
      const { user, error: authError } = await requireCapability("crm.write", supabase);
      if (authError || !user) return { error: authError || "Unauthorized" };

      const { data: account, error: accountError } = await supabase
        .from("crm_accounts")
        .insert({
          company_name: input.company_name,
          registered_address: input.registered_address || null,
          tin: input.tin || null,
          status: "pending",
          company_type: "prospect",
          notes: input.notes || null,
          created_by: user.id,
        })
        .select("id, company_name")
        .single();

      if (accountError || !account) return { error: accountError?.message || "Failed to create customer" };

      const { error: contactError } = await supabase.from("crm_contacts").insert({
        account_id: account.id,
        full_name: input.contact_full_name,
        email: input.contact_email || null,
        phone: input.contact_phone || null,
        job_title: input.contact_job_title || null,
        is_primary: true,
        created_by: user.id,
      });

      if (contactError) {
        await supabase.from("crm_accounts").update({ deleted_at: new Date().toISOString() }).eq("id", account.id);
        return { error: contactError.message };
      }

      await recordAuditLog({
        entity_type: "crm_account",
        entity_id: account.id,
        action: "CREATE",
        changes: { after: { company_name: input.company_name, tin: input.tin || null } },
        performed_by: user.id,
      });

      await createNotification({
        type: "crm",
        title: "Customer Added",
        message: `${input.company_name} was added to customers.`,
        link: `/dashboard/crm/${account.id}`,
        created_by: user.id,
      });

      return {
        id: account.id,
        company_name: account.company_name,
        url: `/dashboard/crm/${account.id}`,
        message: `Customer "${input.company_name}" created successfully.`,
      };
    },
  }),

  update_customer: tool({
    description:
      "Update an existing CRM customer account. REQUIRES user confirmation before executing. Present the changes to the user and ask for confirmation before calling this tool.",
    inputSchema: z.object({
      customer_id: z.string().describe("UUID of the customer account to update"),
      company_name: z.string().optional().describe("New company name"),
      registered_address: z.string().optional().describe("New registered address"),
      tin: z.string().optional().describe("New Tax Identification Number"),
      status: z.enum(["active", "inactive", "pending"]).optional().describe("New customer status"),
      notes: z.string().optional().describe("New notes"),
    }),
    execute: async (input) => {
      const supabase = await createClient();
      const { user, error: authError } = await requireCapability("crm.write", supabase);
      if (authError || !user) return { error: authError || "Unauthorized" };

      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const [key, value] of Object.entries(input)) {
        if (key !== "customer_id" && value !== undefined) {
          updates[key] = value;
        }
      }

      if (Object.keys(updates).length <= 1) return { error: "No fields to update" };

      if (updates.status) {
        const company_type =
          updates.status === "active" ? "active_customer" : updates.status === "inactive" ? "inactive_customer" : "prospect";
        updates.company_type = company_type;
      }

      const { error } = await supabase.from("crm_accounts").update(updates).eq("id", input.customer_id);
      if (error) return { error: error.message };

      await recordAuditLog({
        entity_type: "crm_account",
        entity_id: input.customer_id,
        action: "UPDATE",
        changes: { after: updates },
        performed_by: user.id,
      });

      return { message: "Customer updated successfully." };
    },
  }),

  upload_vendor_document: tool({
    description:
      "Upload a document to a vendor's accreditation folder. Use this when a user uploads a file via chat and confirms the destination as a vendor. REQUIRES user confirmation. Call this only after the user has confirmed the vendor and document type.",
    inputSchema: z.object({
      vendor_id: z.string().describe("UUID of the vendor to attach the document to"),
      doc_type: z.string().describe("Document type e.g. 'philgeps_registration', 'sec_registration'"),
      temp_file_id: z.string().describe("Storage path (id) of the temp file from the user's upload"),
      file_name: z.string().describe("Original file name"),
      file_type: z.string().describe("MIME type of the file"),
      expiry_date: z.string().optional().describe("Document expiry date in ISO format (YYYY-MM-DD)"),
    }),
    execute: async (input) => {
      const supabase = await createClient();
      const { user, error: authError } = await requireCapability("vendor.write", supabase);
      if (authError || !user) return { error: authError || "Unauthorized" };

      const { data: signedUrlData } = await supabase.storage
        .from("chat-uploads")
        .createSignedUrl(input.temp_file_id, 3600);

      if (!signedUrlData?.signedUrl) return { error: "Failed to access uploaded file. It may have expired." };

      const response = await fetch(signedUrlData.signedUrl);
      if (!response.ok) return { error: "Failed to download uploaded file." };

      const blob = await response.blob();
      const file = new File([blob], input.file_name, { type: input.file_type });

      const fileExt = input.file_name.split(".").pop();
      const fileName = `${input.doc_type}_${Date.now()}.${fileExt}`;
      const filePath = `vendors/${input.vendor_id}/${input.doc_type}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("vendor-documents")
        .upload(filePath, file, { contentType: input.file_type, upsert: false });

      if (uploadError) return { error: uploadError.message };

      const { data: { publicUrl } } = supabase.storage.from("vendor-documents").getPublicUrl(filePath);

      const documentPayload = {
        vendor_id: input.vendor_id,
        doc_type: input.doc_type,
        file_url: publicUrl,
        file_name: input.file_name,
        status: "submitted",
        expiry_date: input.expiry_date || null,
        submitted_at: new Date().toISOString(),
        uploaded_by: user.id,
        updated_at: new Date().toISOString(),
      };

      const { data: existing } = await supabase
        .from("vendor_documents")
        .select("id")
        .eq("vendor_id", input.vendor_id)
        .eq("doc_type", input.doc_type)
        .is("archived_at", null)
        .maybeSingle();

      const { error: dbError } = existing
        ? await supabase.from("vendor_documents").update(documentPayload).eq("id", existing.id)
        : await supabase.from("vendor_documents").insert(documentPayload);

      if (dbError) return { error: dbError.message };

      await supabase.storage.from("chat-uploads").remove([input.temp_file_id]);

      await recordAuditLog({
        entity_type: "vendor_document",
        entity_id: input.vendor_id,
        action: "UPDATE",
        changes: { after: { doc_type: input.doc_type, status: "submitted" } },
        performed_by: user.id,
      });

      await createNotification({
        type: "vendor",
        title: "Vendor Document Added",
        message: `A document was uploaded for a vendor.`,
        link: `/dashboard/vendors/${input.vendor_id}`,
        created_by: user.id,
      });

      return { message: `Document "${input.file_name}" uploaded to vendor successfully.` };
    },
  }),

  upload_customer_document: tool({
    description:
      "Upload a document to a CRM customer account folder. Use when a user uploads a file via chat and confirms the destination as a customer. REQUIRES user confirmation after clarifying which customer and document type.",
    inputSchema: z.object({
      customer_id: z.string().describe("UUID of the customer account to attach the document to"),
      doc_type: z.string().describe("Document type e.g. 'contract', 'proposal', 'statement_of_work'"),
      temp_file_id: z.string().describe("Storage path (id) of the temp file from the user's upload"),
      file_name: z.string().describe("Original file name"),
      file_type: z.string().describe("MIME type of the file"),
    }),
    execute: async (input) => {
      const supabase = await createClient();
      const { user, error: authError } = await requireCapability("crm.write", supabase);
      if (authError || !user) return { error: authError || "Unauthorized" };

      const { data: signedUrlData } = await supabase.storage
        .from("chat-uploads")
        .createSignedUrl(input.temp_file_id, 3600);

      if (!signedUrlData?.signedUrl) return { error: "Failed to access uploaded file." };

      const response = await fetch(signedUrlData.signedUrl);
      if (!response.ok) return { error: "Failed to download uploaded file." };

      const blob = await response.blob();
      const file = new File([blob], input.file_name, { type: input.file_type });

      const fileExt = input.file_name.split(".").pop();
      const fileName = `${input.doc_type}_${Date.now()}.${fileExt}`;
      const filePath = `customers/${input.customer_id}/${input.doc_type}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("crm-documents")
        .upload(filePath, file, { contentType: input.file_type, upsert: false });

      if (uploadError) return { error: uploadError.message };

      const { data: { publicUrl } } = supabase.storage.from("crm-documents").getPublicUrl(filePath);

      const { data: logicalDocs } = await supabase
        .from("crm_documents")
        .select("id, version_number")
        .eq("account_id", input.customer_id)
        .eq("doc_type", input.doc_type)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(1);

      const logicalDoc = logicalDocs?.[0] || null;

      if (!logicalDoc) {
        const { data: newDoc, error: insertError } = await supabase
          .from("crm_documents")
          .insert({
            account_id: input.customer_id,
            doc_type: input.doc_type,
            status: "submitted",
            submitted_at: new Date().toISOString(),
            uploaded_by: user.id,
            updated_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (insertError || !newDoc) return { error: insertError?.message || "Failed to create document record" };

        const { data: version, error: versionError } = await supabase
          .from("crm_document_versions")
          .insert({
            document_id: newDoc.id,
            version_number: 1,
            file_url: publicUrl,
            file_name: input.file_name,
            file_size: file.size,
            file_type: input.file_type,
            uploaded_by: user.id,
          })
          .select("id")
          .single();

        if (versionError) return { error: versionError.message };

        await supabase.from("crm_documents").update({
          current_version_id: version.id,
          file_url: publicUrl,
          file_name: input.file_name,
          version_number: 1,
          updated_at: new Date().toISOString(),
        }).eq("id", newDoc.id);
      } else {
        const nextVersion = (logicalDoc.version_number || 0) + 1;

        const { data: version, error: versionError } = await supabase
          .from("crm_document_versions")
          .insert({
            document_id: logicalDoc.id,
            version_number: nextVersion,
            file_url: publicUrl,
            file_name: input.file_name,
            file_size: file.size,
            file_type: input.file_type,
            uploaded_by: user.id,
          })
          .select("id")
          .single();

        if (versionError) return { error: versionError.message };

        await supabase.from("crm_documents").update({
          current_version_id: version.id,
          file_url: publicUrl,
          file_name: input.file_name,
          version_number: nextVersion,
          status: "submitted",
          submitted_at: new Date().toISOString(),
          uploaded_by: user.id,
          updated_at: new Date().toISOString(),
        }).eq("id", logicalDoc.id);
      }

      await supabase.storage.from("chat-uploads").remove([input.temp_file_id]);

      await recordAuditLog({
        entity_type: "crm_document",
        entity_id: input.customer_id,
        action: "UPDATE",
        changes: { after: { doc_type: input.doc_type, status: "submitted" } },
        performed_by: user.id,
      });

      await createNotification({
        type: "crm",
        title: "Customer Document Added",
        message: `A document was uploaded for a customer.`,
        link: `/dashboard/crm/${input.customer_id}`,
        created_by: user.id,
      });

      return { message: `Document "${input.file_name}" uploaded to customer successfully.` };
    },
  }),

  upload_company_document: tool({
    description:
      "Upload a document to the TelcoVantage company document library. Use when a user uploads a file via chat and confirms the destination is the company library. REQUIRES user confirmation.",
    inputSchema: z.object({
      doc_type: z.string().describe("Document type e.g. 'legal', 'hr', 'finance', 'template'"),
      label: z.string().describe("Human-readable label/title for the document"),
      temp_file_id: z.string().describe("Storage path (id) of the temp file from the user's upload"),
      file_name: z.string().describe("Original file name"),
      file_type: z.string().describe("MIME type of the file"),
      expiry_date: z.string().optional().describe("Document expiry date in ISO format (YYYY-MM-DD)"),
      notes: z.string().optional().describe("Additional notes about the document"),
    }),
    execute: async (input) => {
      const supabase = await createClient();
      const { user, error: authError } = await requireCapability("document.write", supabase);
      if (authError || !user) return { error: authError || "Unauthorized" };

      const { data: signedUrlData } = await supabase.storage
        .from("chat-uploads")
        .createSignedUrl(input.temp_file_id, 3600);

      if (!signedUrlData?.signedUrl) return { error: "Failed to access uploaded file." };

      const response = await fetch(signedUrlData.signedUrl);
      if (!response.ok) return { error: "Failed to download uploaded file." };

      const blob = await response.blob();
      const file = new File([blob], input.file_name, { type: input.file_type });

      const fileExt = input.file_name.split(".").pop();
      const safeFileName = `${input.doc_type}_${Date.now()}.${fileExt}`;
      const filePath = `tvph/${input.doc_type}/${safeFileName}`;

      const { error: uploadError } = await supabase.storage
        .from("tvph-documents")
        .upload(filePath, file, { contentType: input.file_type, upsert: false });

      if (uploadError) return { error: uploadError.message };

      const { data: { publicUrl } } = supabase.storage.from("tvph-documents").getPublicUrl(filePath);

      const { error: dbError } = await supabase.from("tvph_documents").insert({
        doc_type: input.doc_type,
        label: input.label || null,
        file_url: publicUrl,
        file_name: input.file_name,
        expiry_date: input.expiry_date || null,
        notes: input.notes || null,
        uploaded_by: user.id,
      });

      if (dbError) {
        await supabase.storage.from("tvph-documents").remove([filePath]);
        return { error: dbError.message };
      }

      await supabase.storage.from("chat-uploads").remove([input.temp_file_id]);

      await recordAuditLog({
        entity_type: "tvph_document",
        entity_id: user.id,
        action: "CREATE",
        changes: { after: { doc_type: input.doc_type, label: input.label, file_name: input.file_name } },
        performed_by: user.id,
      });

      await createNotification({
        type: "document",
        title: "New Document Uploaded",
        message: `${input.file_name} was added to the Company Library.`,
        link: "/dashboard/documents",
        created_by: user.id,
      });

      return { message: `Document "${input.file_name}" uploaded to Company Library successfully.` };
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

      const prompt =
        question ||
        "Please summarize this document concisely for a TelcoVantage team member. Include key dates, parties, and obligations.";

      try {
        const { text } = await generateText({
          model: google("gemini-2.5-flash"),
          messages: [{
            role: "user",
            content: [
              { type: "file", data: new URL(signed.signedUrl), mediaType: "application/pdf" },
              { type: "text", text: prompt },
            ],
          }],
        });

        return {
          file_name: doc.file_name,
          analysis: text,
          note: "The signed URL expires after 1 hour and is not shown to end users.",
        };
      } catch (geminiError) {
        const message = geminiError instanceof Error ? geminiError.message : "Unknown Gemini error";
        return { error: `Failed to analyze document: ${message}` };
      }
    },
  }),

  create_purchase_order: tool({
    description:
      "Create a DRAFT purchase order. REQUIRES user confirmation — present a full summary (vendor name, line items with qty × unit_price, computed total, issued date) and ask the user to confirm before calling. " +
      "Use get_vendors first to resolve the vendor_id. Defaults to today's date if issued_date is omitted. " +
      "If the vendor is not active or lacks an approved Signed NDA, the tool returns a compliance error. " +
      "Only pass waive_requirements: true if the user explicitly asks to waive after being told the reason for the block — waiving requires the po.waive_requirements capability.",
    inputSchema: z.object({
      vendor_id: z.string().describe("UUID of the vendor for this PO"),
      line_items: z.array(z.object({
        item_code: z.string().optional().describe("Item code or SKU"),
        description: z.string().describe("Line item description"),
        qty: z.number().describe("Quantity"),
        uom: z.string().optional().describe("Unit of measure, e.g. 'LOT', 'PCS', 'KM'"),
        unit_price: z.number().describe("Unit price"),
      })).min(1).describe("Line items — at least one required. Total is computed as sum of qty × unit_price."),
      site_details: z.array(z.object({
        region: z.string(),
        area_city: z.string(),
        no_of_nodes: z.number(),
        cable_length_km: z.number(),
      })).optional().describe("Optional telecom site details"),
      description: z.string().optional().describe("Overall PO description or scope of work"),
      issued_date: z.string().optional().describe("Issued date in YYYY-MM-DD format. Defaults to today if omitted."),
      due_date: z.string().optional().describe("Due date in YYYY-MM-DD format"),
      dp_amount: z.number().optional().describe("Down payment amount (defaults to 0)"),
      waive_requirements: z.boolean().optional().describe("Waive NDA/vendor-status compliance gates. Only set true if user explicitly requests it after being informed of the blocker."),
    }),
    execute: async (input) => {
      return createPurchaseOrderCore(input);
    },
  }),

  import_from_file: tool({
    description:
      "Import data from an uploaded CSV or Excel file directly into Vendors or Customers. " +
      "Call this immediately when the user says 'import this to [Vendors|Customers]'. " +
      "The temp_file_id comes from the '[Attached file: ... (ID: ...)]' marker in the user's message. " +
      "Automatically parses the file, maps columns, and inserts the data. " +
      "No user confirmation needed — execute immediately.",
    inputSchema: z.object({
      import_type: z.enum(["Vendors", "Customers"]).describe("Whether to import as Vendors or Customers"),
      temp_file_id: z.string().describe("Storage path (ID) of the uploaded file from the [Attached file:] marker"),
      file_name: z.string().describe("Original filename with extension, e.g. 'data.csv'"),
    }),
    execute: async ({ import_type, temp_file_id, file_name }) => {
      const supabase = await createClient();
      const { user, error: authError } = await requireCapability(
        import_type === "Vendors" ? "vendor.write" : "crm.write",
        supabase,
      );
      if (authError || !user) return { error: authError || "Unauthorized" };

      const isExcel = file_name.endsWith(".xlsx") || file_name.endsWith(".xls");
      const isCsv = file_name.endsWith(".csv");
      if (!isExcel && !isCsv) {
        return { error: "Unsupported file format. Only CSV and Excel (.xlsx, .xls) files are supported." };
      }

      const { data: signedUrlData } = await supabase.storage
        .from("chat-uploads")
        .createSignedUrl(temp_file_id, 3600);

      if (!signedUrlData?.signedUrl) {
        return { error: "Uploaded file not found or has expired. Please re-upload the file." };
      }

      const response = await fetch(signedUrlData.signedUrl);
      if (!response.ok) {
        return { error: "Failed to download uploaded file." };
      }

      const buffer = await response.arrayBuffer();
      const result = import_type === "Vendors"
        ? await importVendorsFromFile(buffer, supabase, user.id)
        : await importCustomersFromFile(buffer, supabase, user.id);

      if (result.errors.length > 0 && result.created === 0 && result.updated === 0) {
        return {
          error: `Import failed with ${result.errors.length} error${result.errors.length > 1 ? "s" : ""}. ${result.errors[0].reason}`,
          details: result,
        };
      }

      await supabase.storage.from("chat-uploads").remove([temp_file_id]);

      return {
        action: "import_complete",
        import_type,
        ...result,
      };
    },
  }),
};
