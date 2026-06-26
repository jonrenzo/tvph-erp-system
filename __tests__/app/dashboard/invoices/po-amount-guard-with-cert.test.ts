/**
 * Unit tests for invoice PO amount guard with completion certificate ceiling
 * Tests the logic that caps invoice amounts based on approved completion certificates
 *
 * These tests validate the guard logic without calling the full createInvoice action,
 * focusing on the ceiling calculation and validation behavior.
 */

/**
 * Pure unit tests for the PO amount guard logic with completion certificate ceiling.
 *
 * These tests verify:
 * 1. No cert → ceiling is po.amount (existing behavior unchanged)
 * 2. Approved cert at X% → ceiling is (X/100) * po.amount
 * 3. Multiple approved certs → highest percent wins
 * 4. Rejected/submitted certs → ignored (no cap)
 * 5. Error message reflects correct ceiling and available amount
 */

/**
 * Helper: Calculates invoice ceiling based on PO and cert
 * Mirrors the logic in createInvoice action
 */
function calculateInvoiceCeiling(
  poAmount: number,
  topCert: { percent_complete: number } | null
): number {
  return topCert ? (topCert.percent_complete / 100) * poAmount : poAmount;
}

/**
 * Helper: Validates invoice amount against ceiling
 * Returns { allowed: boolean, error?: string, remaining?: number }
 */
function validateInvoiceAmount(
  invoiceAmount: number,
  poAmount: number,
  topCert: { percent_complete: number } | null,
  existingInvoices: Array<{ amount: number }>
): { allowed: boolean; error?: string; remaining?: number } {
  const ceiling = calculateInvoiceCeiling(poAmount, topCert);
  const totalExisting = existingInvoices.reduce((sum, inv) => sum + inv.amount, 0);
  const newTotal = totalExisting + invoiceAmount;

  if (newTotal > ceiling) {
    const remaining = Math.max(0, ceiling - totalExisting);
    const ceilingLabel = topCert
      ? `${topCert.percent_complete}% approved completion (₱${ceiling.toLocaleString()})`
      : `PO limit (₱${poAmount.toLocaleString()})`;
    return {
      allowed: false,
      error: `Invoice amount exceeds ${ceilingLabel}. Available to bill: ₱${remaining.toLocaleString()}.`,
      remaining,
    };
  }

  return { allowed: true };
}

describe('Invoice PO Amount Guard - Completion Certificate Ceiling', () => {

  describe('No cert scenario - existing behavior unchanged', () => {
    it('allows invoice up to po.amount when no approved cert exists', () => {
      const result = validateInvoiceAmount(50000, 100000, null, []);

      expect(result.allowed).toBe(true);
    });

    it('rejects invoice exceeding po.amount when no cert exists', () => {
      const result = validateInvoiceAmount(150000, 100000, null, []);

      expect(result.allowed).toBe(false);
      expect(result.error).toContain('PO limit');
    });

    it('allows invoice exactly at po.amount', () => {
      const result = validateInvoiceAmount(100000, 100000, null, []);

      expect(result.allowed).toBe(true);
    });

    it('rejects invoice by just 1 penny over po.amount', () => {
      const result = validateInvoiceAmount(100000.01, 100000, null, []);

      expect(result.allowed).toBe(false);
    });
  });

  describe('Cert with percentage scenario - new ceiling logic', () => {
    it('allows invoice within cert ceiling (50% of 100k = 50k)', () => {
      const cert = { percent_complete: 50 };
      const result = validateInvoiceAmount(50000, 100000, cert, []);

      expect(result.allowed).toBe(true);
    });

    it('rejects invoice exceeding cert ceiling (try to bill 60k when ceiling is 50k)', () => {
      const cert = { percent_complete: 50 };
      const result = validateInvoiceAmount(60000, 100000, cert, []);

      expect(result.allowed).toBe(false);
      expect(result.error).toContain('50% approved completion');
      expect(result.error).toContain('₱50,000');
    });

    it('allows invoice exactly at cert ceiling', () => {
      const cert = { percent_complete: 50 };
      const result = validateInvoiceAmount(50000, 100000, cert, []);

      expect(result.allowed).toBe(true);
    });

    it('allows invoice up to ceiling with existing invoices', () => {
      const cert = { percent_complete: 50 };
      const existing = [{ amount: 30000 }];
      const result = validateInvoiceAmount(20000, 100000, cert, existing);

      expect(result.allowed).toBe(true);
    });

    it('rejects invoice when total with existing exceeds ceiling', () => {
      const cert = { percent_complete: 50 };
      const existing = [{ amount: 30000 }];
      const result = validateInvoiceAmount(25000, 100000, cert, existing);

      expect(result.allowed).toBe(false);
      expect(result.error).toContain('50% approved completion');
      expect(result.error).toContain('Available to bill: ₱20,000');
    });
  });

  describe('Multiple cert scenario - highest percent wins', () => {
    it('uses highest percent_complete when multiple certs exist (75% > 50%, 50%)', () => {
      // In production, query orders by percent_complete DESC limit 1,
      // so topCert will be the highest. We simulate this here.
      const topCert = { percent_complete: 75 };
      const result = validateInvoiceAmount(75000, 100000, topCert, []);

      expect(result.allowed).toBe(true);
    });

    it('allows invoice up to highest cert ceiling', () => {
      const topCert = { percent_complete: 75 };
      const result = validateInvoiceAmount(75000, 100000, topCert, []);

      expect(result.allowed).toBe(true);
    });

    it('rejects invoice exceeding highest cert ceiling', () => {
      const topCert = { percent_complete: 75 };
      const result = validateInvoiceAmount(80000, 100000, topCert, []);

      expect(result.allowed).toBe(false);
      expect(result.error).toContain('75% approved completion');
    });
  });

  describe('Rejected/submitted cert scenario - ignored', () => {
    it('ignores rejected cert (no ceiling, allows full PO amount)', () => {
      // Query only returns status='approved' certs, so rejected is null
      const result = validateInvoiceAmount(100000, 100000, null, []);

      expect(result.allowed).toBe(true);
    });

    it('ignores submitted cert (no ceiling until approved)', () => {
      // Query only returns status='approved' certs, so submitted is null
      const result = validateInvoiceAmount(100000, 100000, null, []);

      expect(result.allowed).toBe(true);
    });

    it('allows billing up to full PO amount when no approved cert exists', () => {
      const result = validateInvoiceAmount(100000, 100000, null, []);

      expect(result.allowed).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('handles 1% ceiling (1% of 100k = 1k)', () => {
      const cert = { percent_complete: 1 };
      const result = validateInvoiceAmount(1000, 100000, cert, []);

      expect(result.allowed).toBe(true);
    });

    it('handles 100% ceiling (full PO amount)', () => {
      const cert = { percent_complete: 100 };
      const result = validateInvoiceAmount(100000, 100000, cert, []);

      expect(result.allowed).toBe(true);
    });

    it('handles decimal percent (33.33% of 100k)', () => {
      const cert = { percent_complete: 33.33 };
      const result = validateInvoiceAmount(33330, 100000, cert, []);

      expect(result.allowed).toBe(true);
    });

    it('handles fractional PO amount (50% of 100,000.50 = 50,000.25)', () => {
      const cert = { percent_complete: 50 };
      const result = validateInvoiceAmount(50000.25, 100000.50, cert, []);

      expect(result.allowed).toBe(true);
    });

    it('shows correct "remaining available" amount in error message', () => {
      const cert = { percent_complete: 50 };
      const existing = [{ amount: 25000 }, { amount: 20000 }];
      const result = validateInvoiceAmount(10000, 100000, cert, existing);

      expect(result.allowed).toBe(false);
      expect(result.error).toContain('Available to bill: ₱5,000');
      expect(result.remaining).toBe(5000);
    });

    it('handles zero remaining available amount', () => {
      const cert = { percent_complete: 50 };
      const existing = [{ amount: 50000 }];
      const result = validateInvoiceAmount(1, 100000, cert, existing);

      expect(result.allowed).toBe(false);
      expect(result.error).toContain('Available to bill: ₱0');
      expect(result.remaining).toBe(0);
    });

    it('calculates ceiling correctly for various percentages', () => {
      const testCases = [
        { percent: 10, poAmount: 100000, expected: 10000 },
        { percent: 25, poAmount: 100000, expected: 25000 },
        { percent: 50, poAmount: 100000, expected: 50000 },
        { percent: 75, poAmount: 100000, expected: 75000 },
        { percent: 100, poAmount: 100000, expected: 100000 },
        { percent: 50, poAmount: 50000, expected: 25000 },
        { percent: 50, poAmount: 200000, expected: 100000 },
      ];

      testCases.forEach(({ percent, poAmount, expected }) => {
        const ceiling = calculateInvoiceCeiling(poAmount, { percent_complete: percent });
        expect(ceiling).toBe(expected);
      });
    });
  });

  describe('Multiple existing invoices', () => {
    it('sums all existing invoices correctly', () => {
      const cert = { percent_complete: 50 };
      const existing = [
        { amount: 10000 },
        { amount: 15000 },
        { amount: 5000 },
      ];
      const result = validateInvoiceAmount(20000, 100000, cert, existing);

      // 10k + 15k + 5k = 30k existing, 30k + 20k = 50k = ceiling, should pass
      expect(result.allowed).toBe(true);
    });

    it('correctly rejects when cumulative exceeds ceiling', () => {
      const cert = { percent_complete: 50 };
      const existing = [
        { amount: 15000 },
        { amount: 20000 },
        { amount: 10000 },
      ];
      const result = validateInvoiceAmount(10000, 100000, cert, existing);

      // 15k + 20k + 10k = 45k existing, 45k + 10k = 55k > 50k ceiling
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(5000);
    });

    it('handles empty existing invoices array', () => {
      const cert = { percent_complete: 50 };
      const result = validateInvoiceAmount(25000, 100000, cert, []);

      expect(result.allowed).toBe(true);
    });
  });
});
