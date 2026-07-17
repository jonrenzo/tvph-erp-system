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
import { redirect } from "next/navigation";

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockRequireCapability = requireCapability as jest.MockedFunction<typeof requireCapability>;
const mockRedirect = redirect as jest.MockedFunction<typeof redirect>;

function invoiceFormData(poId = "") {
  const form = new FormData();
  form.set("vendor_id", "vendor-1");
  form.set("po_id", poId);
  form.set("invoice_number", "INV-1");
  form.set("amount", "100");
  form.set("invoice_date", "2026-07-01");
  form.set("due_date", "2000-01-01");
  return form;
}

describe("invoice payment due dates", () => {
  let invoiceInsert: jest.Mock;
  let purchaseOrderResult: { data: any; error?: any };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date("2026-07-14T17:00:00.000Z"));
    invoiceInsert = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: { id: "invoice-1" }, error: null }) }),
    });
    purchaseOrderResult = { data: { amount: 1000, expense_category: "materials", net_days: 45 } };
    const duplicateQuery = {
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null }),
    };
    const existingInvoicesQuery = {
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockResolvedValue({ data: [] }),
    };
    const certificateQuery = {
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null }),
    };
    let serviceInvoiceSelects = 0;
    mockCreateClient.mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === "service_invoices") {
          return {
            select: jest.fn(() => ++serviceInvoiceSelects === 1 ? duplicateQuery : existingInvoicesQuery),
            insert: invoiceInsert,
          };
        }
        if (table === "purchase_orders") {
          return { select: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ single: jest.fn().mockImplementation(() => Promise.resolve(purchaseOrderResult)) }) }) };
        }
        return { select: jest.fn().mockReturnValue(certificateQuery) };
      }),
    } as any);
    mockRequireCapability.mockResolvedValue({ user: { id: "user-1" }, error: null } as any);
    mockRedirect.mockImplementation(() => undefined as never);
  });

  afterEach(() => jest.useRealTimers());

  it("uses the linked PO's net days from the server submission date", async () => {
    await createInvoice(null, invoiceFormData("po-1"));

    expect(invoiceInsert).toHaveBeenCalledWith(expect.objectContaining({ due_date: "2026-08-29" }));
  });

  it("rejects a linked invoice when its PO is missing", async () => {
    purchaseOrderResult = { data: null };

    await expect(createInvoice(null, invoiceFormData("po-missing"))).resolves.toEqual({
      error: "Linked purchase order could not be loaded.",
    });
    expect(invoiceInsert).not.toHaveBeenCalled();
  });

  it("rejects a linked invoice when its PO query fails", async () => {
    purchaseOrderResult = { data: null, error: { message: "database unavailable" } };

    await expect(createInvoice(null, invoiceFormData("po-error"))).resolves.toEqual({
      error: "Linked purchase order could not be loaded.",
    });
    expect(invoiceInsert).not.toHaveBeenCalled();
  });

  it("retains an unlinked manual due date", async () => {
    await createInvoice(null, invoiceFormData());

    expect(invoiceInsert).toHaveBeenCalledWith(expect.objectContaining({ due_date: "2000-01-01" }));
  });
});
