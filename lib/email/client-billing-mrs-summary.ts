import "server-only";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { sendEmail, type SendEmailResult } from "./send";
import { ClientBillingMrsSummaryEmail } from "./templates/client-billing-mrs-summary";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://erp.telcovantage.com";

export async function sendBillingMrsSummaryEmail(
  billingId: string,
  nodes: { node_id: string; has_mrs: boolean }[],
  opts: { actorId?: string | null } = {},
): Promise<SendEmailResult> {
  const supabase = createServiceRoleClient();

  const { data: billing } = await supabase.from("client_billing").select("invoice_number, invoice_batch, amount_vat_inc, crm_accounts(company_name)").eq("id", billingId).single();
  if (!billing) return { status: "failed", error: "Billing not found." };

  // to: operations, cc: finance + admins
  const { data: profiles } = await supabase.from("profiles").select("email, role").in("role", ["operations", "finance", "admin", "superadmin"]).not("email", "is", null);
  const to = (profiles || []).filter((p: any) => p.role === "operations" && p.email).map((p: any) => p.email as string);
  const cc = (profiles || []).filter((p: any) => ["finance", "admin", "superadmin"].includes(p.role) && p.email).map((p: any) => p.email as string);

  if (to.length === 0) return { status: "failed", error: "No operations recipients." };

  const clientName = (billing.crm_accounts as any)?.company_name || "Unknown client";
  const amountLabel = `₱ ${Number((billing as any).amount_vat_inc || 0).toLocaleString()}`;

  return sendEmail({
    kind: "client_billing_mrs_summary" as any,
    refId: billingId,
    to,
    cc,
    subject: `New Billing — ${clientName} — MRS ${nodes.filter(n => n.has_mrs).length}/${nodes.length}`,
    react: ClientBillingMrsSummaryEmail({
      invoiceNumber: (billing as any).invoice_number,
      invoiceBatch: (billing as any).invoice_batch,
      clientName,
      amountLabel,
      billingUrl: `${BASE_URL}/dashboard/client-invoices/${billingId}`,
      nodes,
    }),
    createdBy: opts.actorId ?? null,
  });
}
