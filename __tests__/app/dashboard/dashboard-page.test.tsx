import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { DashboardContent } from "@/app/dashboard/page";

jest.mock("@/utils/supabase/server", () => ({
  createClient: jest.fn(),
}));

jest.mock("@/lib/auth/permissions", () => ({
  getCurrentProfile: jest.fn(),
  hasCapability: jest.fn(),
}));

jest.mock("@/lib/reports/compliance", () => ({
  computeComplianceSummary: jest.fn(),
}));

jest.mock("@/lib/dashboard/queries", () => {
  const EMPTY_DASHBOARD_FINANCIALS = {
    totalPOCommitment: 0,
    totalPaid: 0,
    totalInvoiced: 0,
    apPaidThisMonth: 0,
    apOverdue: 0,
    arCollectedThisMonth: 0,
    arOutstanding: 0,
    arOverdue: 0,
    clientTotalPaid: 0,
    monthlyTrends: [],
  };
  return {
    EMPTY_DASHBOARD_FINANCIALS,
    getDashboardFinancials: jest.fn().mockResolvedValue(EMPTY_DASHBOARD_FINANCIALS),
    getProjectProgress: jest.fn().mockResolvedValue([]),
    getMonthlyTrends: jest.fn().mockResolvedValue([]),
  };
});

jest.mock("next/link", () => {
  return ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  );
});

import { createClient } from "@/utils/supabase/server";
import { getCurrentProfile, hasCapability } from "@/lib/auth/permissions";
import { computeComplianceSummary } from "@/lib/reports/compliance";

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockGetCurrentProfile = getCurrentProfile as jest.MockedFunction<typeof getCurrentProfile>;
const mockHasCapability = hasCapability as jest.MockedFunction<typeof hasCapability>;
const mockComputeComplianceSummary = computeComplianceSummary as jest.MockedFunction<typeof computeComplianceSummary>;

function mockQuery(data: any) {
  const promise = Promise.resolve({ data, error: null });
  const builder: Record<string, any> = {};
  builder.select = jest.fn(() => builder);
  builder.neq = jest.fn(() => builder);
  builder.is = jest.fn(() => builder);
  builder.in = jest.fn(() => builder);
  builder.gte = jest.fn(() => builder);
  builder.lte = jest.fn(() => builder);
  builder.lt = jest.fn(() => builder);
  builder.order = jest.fn(() => builder);
  builder.limit = jest.fn(() => builder);
  builder.eq = jest.fn(() => builder);
  builder.not = jest.fn(() => builder);
  builder.throwOnError = jest.fn(() => builder);
  builder.then = promise.then.bind(promise);
  builder.catch = promise.catch.bind(promise);
  builder.finally = promise.finally.bind(promise);
  return builder;
}

function makeSupabase(mockData: Record<string, any[]>) {
  return {
    from: jest.fn().mockImplementation((table: string) => {
      const data = mockData[table];
      return mockQuery(data ?? []);
    }),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCurrentProfile.mockResolvedValue({ role: "superadmin" });
  mockHasCapability.mockReturnValue(true);
  mockComputeComplianceSummary.mockReturnValue({
    totalVendors: 0,
    overallPercentage: 100,
    nonCompliant: 0,
    pendingReviews: 0,
  });
});

describe("DashboardPage — 14-day window and subtitles", () => {
  it("renders 'Within 14 days' subtitle for the near-due sections", async () => {
    mockCreateClient.mockResolvedValue(makeSupabase({}) as any);
    render(await DashboardContent());
    const subtitles = screen.getAllByText("Within 14 days");
    expect(subtitles.length).toBeGreaterThanOrEqual(2);
  });

  it("renders 'No invoices due within 14 days' empty state when no data", async () => {
    mockCreateClient.mockResolvedValue(makeSupabase({}) as any);
    render(await DashboardContent());
    expect(screen.getByText("No invoices due within 14 days.")).toBeInTheDocument();
  });

  it("renders 'No purchase orders due within 14 days' empty state when no data", async () => {
    mockCreateClient.mockResolvedValue(makeSupabase({}) as any);
    render(await DashboardContent());
    expect(
      screen.getByText("No purchase orders due within 14 days.")
    ).toBeInTheDocument();
  });
});

describe("DashboardPage — navigation URLs", () => {
  const mockData = {
    service_invoices: [
      { id: "inv-001", amount: 15000, due_date: "2026-07-18", vendors: { name: "Alpha Corp" } },
      { id: "inv-002", amount: 28000, due_date: "2026-07-22", vendors: { name: "Beta Inc" } },
    ],
    purchase_orders: [
      { id: "po-001", po_number: "PO-100", amount: 55000, due_date: "2026-07-19", vendors: { name: "Gamma Ltd" } },
      { id: "po-002", po_number: "PO-101", amount: 82000, due_date: "2026-07-28", vendors: { name: "Delta Co" } },
    ],
  };

  beforeEach(() => {
    mockCreateClient.mockResolvedValue(makeSupabase(mockData) as any);
  });

  it("invoice rows link to /dashboard/invoices/{id}", async () => {
    render(await DashboardContent());
    const link = screen.getByRole("link", { name: /Alpha Corp/ });
    expect(link).toHaveAttribute("href", "/dashboard/invoices/inv-001");
  });

  it("all invoice rows link to correct detail pages", async () => {
    render(await DashboardContent());
    const link1 = screen.getByRole("link", { name: /Alpha Corp/ });
    const link2 = screen.getByRole("link", { name: /Beta Inc/ });
    expect(link1).toHaveAttribute("href", "/dashboard/invoices/inv-001");
    expect(link2).toHaveAttribute("href", "/dashboard/invoices/inv-002");
  });

  it("PO rows link to /dashboard/purchase-orders/{id}", async () => {
    render(await DashboardContent());
    const link = screen.getByRole("link", { name: /Gamma Ltd/ });
    expect(link).toHaveAttribute("href", "/dashboard/purchase-orders/po-001");
  });

  it("all PO rows link to correct detail pages", async () => {
    render(await DashboardContent());
    const link1 = screen.getByRole("link", { name: /Gamma Ltd/ });
    const link2 = screen.getByRole("link", { name: /Delta Co/ });
    expect(link1).toHaveAttribute("href", "/dashboard/purchase-orders/po-001");
    expect(link2).toHaveAttribute("href", "/dashboard/purchase-orders/po-002");
  });
});
