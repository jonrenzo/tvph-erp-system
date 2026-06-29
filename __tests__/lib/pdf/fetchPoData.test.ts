/**
 * Unit tests for fetchPoData
 * Verifies data fetching, FK hint, and error handling
 */

import { fetchPoData } from '@/lib/pdf/fetchPoData';
import { createClient } from '@/utils/supabase/server';

jest.mock('@/utils/supabase/server');
jest.mock('server-only', () => ({}));

describe('fetchPoData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('FK hint verification', () => {
    it('uses correct FK hint: profiles!created_by', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          }),
        }),
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      await fetchPoData('test-id');

      const selectCall = mockSupabase.from().select.mock.calls[0]?.[0];
      expect(selectCall).toContain('profiles!created_by');
    });

    it('does not use old FK hint: purchase_orders_created_by_fkey', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          }),
        }),
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      await fetchPoData('test-id');

      const selectCall = mockSupabase.from().select.mock.calls[0]?.[0];
      expect(selectCall).not.toContain('purchase_orders_created_by_fkey');
    });
  });

  describe('happy path', () => {
    it('returns PoData object when Supabase returns valid data', async () => {
      const mockPo = {
        id: 'po-123',
        po_number: 'PO-2024001',
        issued_date: '2024-01-15T10:00:00Z',
        created_at: '2024-01-15T10:00:00Z',
        vendors: {
          id: 'vendor-1',
          name: 'Test Vendor',
          contact_person: 'John Doe',
          address: '123 Main St',
          contact_phone: '555-1234',
          contact_fax: '555-5678',
          payment_terms: 'Net 30',
        },
        projects: {
          name: 'Test Project',
        },
        po_line_items: [
          {
            line_no: 1,
            item_code: 'ITEM001',
            description: 'Test Item',
            qty: 10,
            uom: 'PC',
            unit_price: 100,
            amount: 1000,
          },
        ],
        po_site_details: [
          {
            sn: 1,
            region: 'Metro Manila',
            area_city: 'Manila',
            no_of_nodes: 5,
            cable_length_km: 10,
          },
        ],
        profiles: {
          full_name: 'Jane Smith',
        },
        currency: 'PHP',
        terms_and_conditions: 'Test T&C',
        mobilization_date: '2024-02-01T00:00:00Z',
        delivery_date: '2024-03-01T00:00:00Z',
        pr_number: 'PR-2024001',
        requisitioner: 'John Requisitioner',
        dp_amount: 5000,
        agreement_ref_no: 'AGR-001',
        approved_by: ['user1', 'user2'],
      };

      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockPo,
                error: null,
              }),
            }),
          }),
        }),
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const result = await fetchPoData('po-123');

      expect(result).not.toBeNull();
      expect(result?.po_number).toBe('PO-2024001');
      expect(result?.vendor_name).toBe('Test Vendor');
      expect(result?.requisitioner).toBe('Jane Smith'); // From profiles, not requisitioner field
    });

    it('uses profiles.full_name as requisitioner when available', async () => {
      const mockPo = {
        id: 'po-123',
        po_number: 'PO-2024001',
        issued_date: '2024-01-15T10:00:00Z',
        created_at: '2024-01-15T10:00:00Z',
        vendors: { id: 'v1', name: 'Vendor' },
        projects: { name: 'Project' },
        po_line_items: [],
        po_site_details: [],
        profiles: { full_name: 'Profile Full Name' },
        requisitioner: 'Field Requisitioner',
        currency: 'PHP',
        terms_and_conditions: '',
        mobilization_date: null,
        delivery_date: null,
        pr_number: '',
        dp_amount: 0,
        agreement_ref_no: '',
        approved_by: null,
      };

      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockPo,
                error: null,
              }),
            }),
          }),
        }),
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const result = await fetchPoData('po-123');

      expect(result?.requisitioner).toBe('Profile Full Name');
    });

    it('falls back to requisitioner field when profiles.full_name is missing', async () => {
      const mockPo = {
        id: 'po-123',
        po_number: 'PO-2024001',
        issued_date: '2024-01-15T10:00:00Z',
        created_at: '2024-01-15T10:00:00Z',
        vendors: { id: 'v1', name: 'Vendor' },
        projects: { name: 'Project' },
        po_line_items: [],
        po_site_details: [],
        profiles: null,
        requisitioner: 'Field Requisitioner',
        currency: 'PHP',
        terms_and_conditions: '',
        mobilization_date: null,
        delivery_date: null,
        pr_number: '',
        dp_amount: 0,
        agreement_ref_no: '',
        approved_by: null,
      };

      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockPo,
                error: null,
              }),
            }),
          }),
        }),
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const result = await fetchPoData('po-123');

      expect(result?.requisitioner).toBe('Field Requisitioner');
    });
  });

  describe('error handling', () => {
    it('returns null when Supabase returns an error', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Some error' },
              }),
            }),
          }),
        }),
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const result = await fetchPoData('test-id');

      expect(result).toBeNull();
    });

    it('returns null when Supabase returns no data', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          }),
        }),
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const result = await fetchPoData('test-id');

      expect(result).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('handles missing line items gracefully', async () => {
      const mockPo = {
        id: 'po-123',
        po_number: 'PO-2024001',
        issued_date: '2024-01-15T10:00:00Z',
        created_at: '2024-01-15T10:00:00Z',
        vendors: { id: 'v1', name: 'Vendor' },
        projects: { name: 'Project' },
        po_line_items: null,
        po_site_details: null,
        profiles: { full_name: 'User' },
        currency: 'PHP',
        terms_and_conditions: '',
        mobilization_date: null,
        delivery_date: null,
        pr_number: '',
        dp_amount: 0,
        agreement_ref_no: '',
        approved_by: null,
      };

      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockPo,
                error: null,
              }),
            }),
          }),
        }),
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const result = await fetchPoData('po-123');

      expect(result).not.toBeNull();
      expect(result?.line_items).toEqual([]);
    });

    it('handles missing vendor gracefully', async () => {
      const mockPo = {
        id: 'po-123',
        po_number: 'PO-2024001',
        issued_date: '2024-01-15T10:00:00Z',
        created_at: '2024-01-15T10:00:00Z',
        vendors: null,
        projects: { name: 'Project' },
        po_line_items: [],
        po_site_details: [],
        profiles: { full_name: 'User' },
        currency: 'PHP',
        terms_and_conditions: '',
        mobilization_date: null,
        delivery_date: null,
        pr_number: '',
        dp_amount: 0,
        agreement_ref_no: '',
        approved_by: null,
      };

      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockPo,
                error: null,
              }),
            }),
          }),
        }),
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const result = await fetchPoData('po-123');

      expect(result).not.toBeNull();
      expect(result?.vendor_name).toBe('');
    });

    it('handles approved_by as string or array', async () => {
      // Test with array
      let mockPo = {
        id: 'po-123',
        po_number: 'PO-2024001',
        issued_date: '2024-01-15T10:00:00Z',
        created_at: '2024-01-15T10:00:00Z',
        vendors: { id: 'v1', name: 'Vendor' },
        projects: { name: 'Project' },
        po_line_items: [],
        po_site_details: [],
        profiles: { full_name: 'User' },
        currency: 'PHP',
        terms_and_conditions: '',
        mobilization_date: null,
        delivery_date: null,
        pr_number: '',
        dp_amount: 0,
        agreement_ref_no: '',
        approved_by: ['user1', 'user2'],
      };

      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockPo,
                error: null,
              }),
            }),
          }),
        }),
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      let result = await fetchPoData('po-123');
      expect(result?.approved_by).toEqual(['user1', 'user2']);

      // Test with non-array (should return empty array)
      mockPo.approved_by = 'not-an-array' as any;
      (mockSupabase.from().select().eq().single as jest.Mock).mockResolvedValue({
        data: mockPo,
        error: null,
      });

      result = await fetchPoData('po-123');
      expect(result?.approved_by).toEqual([]);
    });
  });

  describe('query parameters', () => {
    it('calls from("purchase_orders")', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          }),
        }),
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      await fetchPoData('test-id');

      expect(mockSupabase.from).toHaveBeenCalledWith('purchase_orders');
    });

    it('filters by id with eq()', async () => {
      const testId = 'specific-po-id';
      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          }),
        }),
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      await fetchPoData(testId);

      expect(mockSupabase.from().select().eq).toHaveBeenCalledWith('id', testId);
    });

    it('uses single() to return one record', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          }),
        }),
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      await fetchPoData('test-id');

      expect(mockSupabase.from().select().eq().single).toHaveBeenCalled();
    });
  });
});
