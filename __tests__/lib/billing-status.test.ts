import { BILLING_STATUSES, billingStatusLabel, canTransition, normalizeBillingStatus, agingBand } from "@/lib/billing/status";

it("exposes expected statuses", () => {
  expect(BILLING_STATUSES).toEqual(["for_billing","pending_sky_technical","for_payment","pending_payment","collected"]);
});

it("labels statuses", () => {
  expect(billingStatusLabel("for_billing")).toBe("For Billing");
  expect(billingStatusLabel("pending_sky_technical")).toBe("Submitted to Sky Technical");
  expect(billingStatusLabel("collected")).toBe("Collected");
});

it("enforces transition rules (including rejection loop)", () => {
  expect(canTransition("for_billing","pending_sky_technical")).toBe(true);
  expect(canTransition("pending_sky_technical","for_billing")).toBe(true); // rejected -> resubmit
  expect(canTransition("pending_sky_technical","for_payment")).toBe(true);
  expect(canTransition("for_payment","pending_payment")).toBe(true);
  expect(canTransition("pending_payment","collected")).toBe(true);
  expect(canTransition("for_billing","collected")).toBe(false);
  expect(canTransition("collected","for_billing")).toBe(false);
});

it("normalizes Excel STATUS casing", () => {
  expect(normalizeBillingStatus("FOR PAYMENT")).toBe("for_payment");
  expect(normalizeBillingStatus("For Approval")).toBe("pending_sky_technical");
  expect(normalizeBillingStatus("Pending Sky Technical")).toBe("pending_sky_technical");
  // legacy alias
  expect(normalizeBillingStatus("for_approval")).toBe("pending_sky_technical");
  expect(normalizeBillingStatus("Collected")).toBe("collected");
  expect(normalizeBillingStatus("Pending Payment")).toBe("pending_payment");
  expect(normalizeBillingStatus("paid")).toBe("collected");
});

it("computes aging bands from due_date", () => {
  const today = new Date("2026-08-26T00:00:00.000Z");
  // healthy: due far out
  expect(agingBand({ status: "pending_payment", due_date: "2026-09-10" }, today).band).toBe("healthy");
  // close due: within 7 days
  expect(agingBand({ status: "pending_payment", due_date: "2026-08-28" }, today).band).toBe("close_due");
  expect(agingBand({ status: "for_payment", due_date: "2026-08-26" }, today).band).toBe("close_due");
  // overdue
  const o = agingBand({ status: "pending_payment", due_date: "2026-08-05" }, today);
  expect(o.band).toBe("overdue");
  expect(o.daysDelayed).toBe(21);
  // non-payment phases have no band
  expect(agingBand({ status: "for_billing", due_date: "2026-08-05" }, today).band).toBe(null);
  expect(agingBand({ status: "collected", due_date: "2026-08-05" }, today).band).toBe(null);
  expect(agingBand({ status: "pending_payment", due_date: null }, today).band).toBe(null);
});
