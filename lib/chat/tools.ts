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
  }
];

export type ToolName = (typeof tools)[number]["name"];
