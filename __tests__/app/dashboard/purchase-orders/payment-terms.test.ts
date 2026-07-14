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
});
