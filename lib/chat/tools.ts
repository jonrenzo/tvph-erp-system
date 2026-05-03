// Tool definitions for the TelcoVantage ERP Assistant
// These define what functions the AI can call to get real-time data

export interface ToolParameter {
  type: "string" | "number" | "boolean";
  description: string;
  optional?: boolean;
  enum?: string[];
}

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, ToolParameter>;
}

export const tools: Tool[] = [
  {
    name: "get_vendors",
    description: "List all vendors. Returns 'id', 'name', and 'status'. Always use the 'id' for markdown links.",
    parameters: {
      status: {
        type: "string",
        description: "Filter vendors by status",
        optional: true,
        enum: ["active", "pending", "inactive"]
      }
    }
  },
  {
    name: "get_purchase_orders",
    description: "List recent purchase orders, optionally filtered by vendor name or status",
    parameters: {
      vendor_name: {
        type: "string",
        description: "Filter POs by vendor name",
        optional: true
      },
      status: {
        type: "string",
        description: "Filter POs by status",
        optional: true,
        enum: ["draft", "pending", "approved", "rejected", "closed"]
      }
    }
  },
  {
    name: "get_compliance_summary",
    description: "Get a summary of vendor accreditation status and identify vendors with expired documents",
    parameters: {}
  },
  {
    name: "get_financial_totals",
    description: "Calculate total liabilities and pending invoice amounts (Admin/Finance only)",
    parameters: {}
  },
  {
    name: "list_company_documents",
    description: "List TelcoVantage company documents (metadata only: name, type, expiry, status). Filters optional.",
    parameters: {
      doc_type: {
        type: "string",
        description: "Filter by document type (e.g., 'policy', 'license')",
        optional: true,
      },
    }
  },
  {
    name: "list_vendor_documents",
    description: "List vendor accreditation documents (metadata only: name, type, status, expiry). Filters optional.",
    parameters: {
      vendor_id: {
        type: "string",
        description: "Filter by vendor UUID to see only their documents",
        optional: true,
      },
      status: {
        type: "string",
        description: "Filter by status (approved/submitted/expired/not_submitted)",
        optional: true,
        enum: ["approved", "submitted", "expired", "not_submitted"],
      },
    }
  },
  {
    name: "analyze_document",
    description: "Analyze a PDF document's content (summarize, answer questions, extract key info). Requires document ID and type.",
    parameters: {
      document_id: {
        type: "string",
        description: "UUID of the document from list tools",
      },
      document_type: {
        type: "string",
        description: "Type of document: 'company' (tvph_documents) or 'vendor' (vendor_documents)",
        enum: ["company", "vendor"],
      },
      question: {
        type: "string",
        description: "Specific question about the document (e.g., 'Summarize key terms')",
        optional: true,
      },
    }
  }
];

export type ToolName = (typeof tools)[number]["name"];

export interface ToolCallResult {
  name: string;
  args: Record<string, unknown>;
  result: unknown;
}
