/**
 * Unit tests for the finance-pool notification email templates.
 */

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PoPendingFinanceEmail } from "@/lib/email/templates/po-pending-finance";
import { PrPendingFinanceEmail } from "@/lib/email/templates/pr-pending-finance";

describe("PoPendingFinanceEmail", () => {
  const baseProps = {
    poNumber: "PO-1001",
    vendorName: "Acme Supplies",
    reviewUrl: "https://erp.telcovantage.com/dashboard/purchase-orders/1",
  };

  it("renders downpayment line when set, and omits it when null", () => {
    const withDp = renderToStaticMarkup(
      <PoPendingFinanceEmail {...baseProps} amountLabel="₱500,000.00" downpaymentLabel="₱150,000.00 (30%)" />,
    );
    expect(withDp).toContain("Downpayment:");
    expect(withDp).toContain("₱150,000.00 (30%)");

    const withoutDp = renderToStaticMarkup(<PoPendingFinanceEmail {...baseProps} />);
    expect(withoutDp).not.toContain("Downpayment:");
  });
});

describe("PrPendingFinanceEmail", () => {
  const baseProps = {
    prNumber: "PR-2001",
    vendorName: "Acme Supplies",
    purpose: "Network equipment",
    reviewUrl: "https://erp.telcovantage.com/dashboard/purchase-requests/1",
  };

  it("renders downpayment details and defaults to None when absent", () => {
    const withDp = renderToStaticMarkup(
      <PrPendingFinanceEmail {...baseProps} amountLabel="₱500,000.00" downpaymentLabel="₱150,000.00" downpaymentPercent={30} />,
    );
    expect(withDp).toContain("30%");
    expect(withDp).toContain("₱150,000.00");

    const withoutDp = renderToStaticMarkup(<PrPendingFinanceEmail {...baseProps} />);
    expect(withoutDp).toContain("Downpayment: None");
  });
});
