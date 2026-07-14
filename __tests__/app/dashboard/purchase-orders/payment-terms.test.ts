import {
  overridePurchaseOrderPenalty,
  updatePurchaseOrderTerms,
} from "@/app/dashboard/purchase-orders/actions";

jest.mock("@/utils/supabase/server", () => ({ createClient: jest.fn() }));
jest.mock("@/lib/auth/permissions", () => ({
  requireCapability: jest.fn(),
  getCurrentProfile: jest.fn(),
  hasCapability: jest.fn(),
}));
jest.mock("@/utils/audit", () => ({ recordAuditLog: jest.fn() }));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

import { createClient } from "@/utils/supabase/server";
import { getCurrentProfile, requireCapability } from "@/lib/auth/permissions";

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockRequireCapability = requireCapability as jest.MockedFunction<typeof requireCapability>;
const mockGetCurrentProfile = getCurrentProfile as jest.MockedFunction<typeof getCurrentProfile>;

describe("purchase order payment terms", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateClient.mockResolvedValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: { status: "draft" } }) }),
        }),
      }),
    } as any);
    mockRequireCapability.mockResolvedValue({ user: { id: "user-1" }, role: "admin", error: null } as any);
    mockGetCurrentProfile.mockResolvedValue({ user: { id: "user-1" }, role: "admin", error: null } as any);
  });

  it("rejects a rate outside 0..1", async () => {
    const form = new FormData();
    form.set("net_days", "30");
    form.set("penalty_rate", "1.1");

    await expect(updatePurchaseOrderTerms("po-1", form)).resolves.toEqual({
      error: "Penalty rate must be between 0 and 1.",
    });
  });

  it("requires a reason for a peso override", async () => {
    const form = new FormData();
    form.set("override_amount", "2500");

    await expect(overridePurchaseOrderPenalty("po-1", form)).resolves.toEqual({
      error: "Provide a reason for the penalty override.",
    });
  });

  it("creates a manual-only penalty row for a first override", async () => {
    const upsert = jest.fn().mockResolvedValue({ error: null });
    mockCreateClient.mockResolvedValue({ from: jest.fn().mockReturnValue({ upsert }) } as any);
    const form = new FormData();
    form.set("override_amount", "2500");
    form.set("override_reason", "Approved settlement");

    await expect(overridePurchaseOrderPenalty("po-1", form)).resolves.toEqual({ success: true });
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      po_id: "po-1",
      override_amount: 2500,
      override_reason: "Approved settlement",
      overridden_by: "user-1",
    }), { onConflict: "po_id" });
  });

  it("reports a PO that left draft status before the guarded terms update", async () => {
    const guardedUpdate = { eq: jest.fn().mockReturnThis() };
    guardedUpdate.eq.mockReturnValueOnce(guardedUpdate).mockResolvedValueOnce({ error: null, count: 0 });
    const select = { eq: jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: { status: "draft" } }) }) };
    mockCreateClient.mockResolvedValue({ from: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue(select), update: jest.fn().mockReturnValue(guardedUpdate) }) } as any);
    const form = new FormData();
    form.set("net_days", "30");
    form.set("dp_due_days", "");
    form.set("penalty_rate", "");
    form.set("penalty_type", "monthly");

    await expect(updatePurchaseOrderTerms("po-1", form)).resolves.toEqual({ error: "Terms can only be edited while the PO is a draft." });
    expect(guardedUpdate.eq).toHaveBeenCalledWith("status", "draft");
  });
});
