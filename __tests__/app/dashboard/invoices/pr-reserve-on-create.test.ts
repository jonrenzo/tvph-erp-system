/**
 * Approval was removed from vendor invoices: creating an invoice now RESERVES the linked
 * payment request's balance immediately (a pending_payment invoice consumes it). This test
 * proves the over-billing window is closed — a second invoice cannot be created against a PR
 * whose balance is already fully reserved by an existing pending_payment invoice.
 */
import { createInvoice } from "@/app/dashboard/invoices/actions";

jest.mock("@/utils/supabase/server", () => ({ createClient: jest.fn() }));
jest.mock("@/lib/auth/permissions", () => ({ requireCapability: jest.fn() }));
jest.mock("@/utils/audit", () => ({ recordAuditLog: jest.fn() }));
jest.mock("@/utils/notifications", () => ({ createNotification: jest.fn() }));
jest.mock("@/app/actions/ocr", () => ({ extractDocumentMetadata: jest.fn() }));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("next/navigation", () => ({ redirect: jest.fn() }));

import { createClient } from "@/utils/supabase/server";
import { requireCapability } from "@/lib/auth/permissions";

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockRequireCapability = requireCapability as jest.MockedFunction<typeof requireCapability>;

function invoiceFormData() {
  const form = new FormData();
  form.set("vendor_id", "vendor-1");
  form.set("po_id", "po-1");
  form.set("payment_request_id", "pr-1");
  form.set("invoice_number", "INV-2");
  form.set("amount", "100");
  form.set("invoice_date", "2026-07-01");
  return form;
}

describe("payment request reserve-on-create", () => {
  let invoiceInsert: jest.Mock;
  let prConsumingStatuses: string[] | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    prConsumingStatuses = undefined;
    invoiceInsert = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: { id: "invoice-2" }, error: null }) }),
    });

    // 1st service_invoices select: duplicate-number check
    const duplicateQuery = {
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null }),
    };
    // 2nd service_invoices select: existing invoices for the PO amount guard
    const existingForPoQuery = {
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockResolvedValue({ data: [{ amount: 100 }] }),
    };
    // 3rd service_invoices select: consuming invoices for the PR balance
    // A single pending_payment invoice already reserves the full ₱100 PR balance.
    const prConsumingQuery = {
      eq: jest.fn().mockReturnThis(),
      in: jest.fn((_col: string, statuses: string[]) => {
        prConsumingStatuses = statuses;
        return prConsumingQuery;
      }),
      is: jest.fn().mockResolvedValue({ data: [{ amount: 100 }] }),
    };

    let serviceInvoiceSelects = 0;
    mockCreateClient.mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === "service_invoices") {
          serviceInvoiceSelects += 1;
          const which = serviceInvoiceSelects;
          return {
            select: jest.fn(() => (which === 1 ? duplicateQuery : which === 2 ? existingForPoQuery : prConsumingQuery)),
            insert: invoiceInsert,
          };
        }
        if (table === "purchase_orders") {
          return { select: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: { amount: 10000, expense_category: "materials", net_days: 30 } }) }) }) };
        }
        if (table === "payment_requests") {
          return { select: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: { id: "pr-1", request_number: "PR-1", amount: 100, vendor_id: "vendor-1", status: "approved", po_id: "po-1" } }) }) }) };
        }
        // po_completion_certificates: no approved cert
        return { select: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: null }) }) };
      }),
    } as any);

    mockRequireCapability.mockResolvedValue({ user: { id: "user-1" }, error: null } as any);
  });

  it("counts pending_payment invoices when computing reserved PR balance", async () => {
    await createInvoice(null, invoiceFormData());
    expect(prConsumingStatuses).toEqual(["pending_payment", "partially_paid", "paid"]);
  });

  it("blocks a second invoice that exceeds the already-reserved PR balance", async () => {
    const result = await createInvoice(null, invoiceFormData());

    expect(result).toEqual(expect.objectContaining({ overage: true }));
    expect(invoiceInsert).not.toHaveBeenCalled();
  });
});
