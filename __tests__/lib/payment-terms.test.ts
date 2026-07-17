import { calculatePaymentDueDate, calculatePenaltyAmount } from "@/lib/payment-terms";

it("uses Manila's submission date", () => {
  expect(calculatePaymentDueDate(new Date("2026-07-14T17:00:00.000Z"), 30)).toBe("2026-08-14");
});

it("prorates monthly penalty daily", () => {
  expect(calculatePenaltyAmount({ amount: 100000, rate: 0.1, type: "monthly", overdueDays: 3 })).toBe(1000);
});

it("applies fixed penalty once", () => {
  expect(calculatePenaltyAmount({ amount: 100000, rate: 0.1, type: "fixed", overdueDays: 12 })).toBe(10000);
});
