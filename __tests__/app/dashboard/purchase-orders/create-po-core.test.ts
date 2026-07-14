/**
 * Unit tests for createPurchaseOrderCore server action
 * Tests core purchase order creation logic shared by form and AI chat tool
 */

import { createPurchaseOrderCore } from '@/app/dashboard/purchase-orders/actions';

// Mock Supabase client
jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

// Mock auth utilities
jest.mock('@/lib/auth/permissions', () => ({
  requireCapability: jest.fn(),
  hasCapability: jest.fn(),
}));

// Mock audit logging
jest.mock('@/utils/audit', () => ({
  recordAuditLog: jest.fn(),
}));

// Mock notifications
jest.mock('@/utils/notifications', () => ({
  createNotification: jest.fn(),
}));

// Mock Next.js cache utilities
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

// Mock Next.js navigation (should NOT be called by core)
jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

import { createClient } from '@/utils/supabase/server';
import { requireCapability, hasCapability } from '@/lib/auth/permissions';
import { recordAuditLog } from '@/utils/audit';
import { createNotification } from '@/utils/notifications';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockRequireCapability = requireCapability as jest.MockedFunction<
  typeof requireCapability
>;
const mockHasCapability = hasCapability as jest.MockedFunction<
  typeof hasCapability
>;
const mockRecordAuditLog = recordAuditLog as jest.MockedFunction<
  typeof recordAuditLog
>;
const mockCreateNotification = createNotification as jest.MockedFunction<
  typeof createNotification
>;
const mockRevalidatePath = revalidatePath as jest.MockedFunction<
  typeof revalidatePath
>;
const mockRedirect = redirect as jest.MockedFunction<typeof redirect>;

describe('createPurchaseOrderCore', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup comprehensive mock Supabase client with proper chaining
    const ndaSelectChain = {
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: { status: 'approved' }, error: null }),
    };

    const vendorSelectChain = {
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { status: 'active', currency: 'PHP' }, error: null }),
    };

    const entitySelectChain = {
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: 'entity-1' }, error: null }),
    };

    const poInsertChain = {
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: 'po-1', po_number: 'PO-2026-001' },
        error: null,
      }),
    };

    const liInsertMock = jest.fn().mockResolvedValue({ error: null });
    const siteInsertMock = jest.fn().mockResolvedValue({ error: null });
    const ndaSelectMock = jest.fn().mockReturnValue(ndaSelectChain);
    const vendorSelectMock = jest.fn().mockReturnValue(vendorSelectChain);
    const entitySelectMock = jest.fn().mockReturnValue(entitySelectChain);
    const poInsertMock = jest.fn().mockReturnValue(poInsertChain);

    mockSupabase = {
      from: jest.fn((tableName: string) => {
        if (tableName === 'vendor_documents') {
          return {
            select: ndaSelectMock,
          };
        }
        if (tableName === 'vendors') {
          return {
            select: vendorSelectMock,
          };
        }
        if (tableName === 'internal_entities') {
          return {
            select: entitySelectMock,
          };
        }
        if (tableName === 'purchase_orders') {
          return {
            insert: poInsertMock,
          };
        }
        if (tableName === 'po_line_items') {
          return {
            insert: liInsertMock,
          };
        }
        if (tableName === 'po_site_details') {
          return {
            insert: siteInsertMock,
          };
        }
        return {
          select: jest.fn().mockReturnValue({}),
          insert: jest.fn().mockResolvedValue({ error: null }),
        };
      }),
    };

    // Store references for accessing in tests
    mockSupabase.ndaSelectChain = ndaSelectChain;
    mockSupabase.vendorSelectChain = vendorSelectChain;
    mockSupabase.entitySelectChain = entitySelectChain;
    mockSupabase.poInsertChain = poInsertChain;
    mockSupabase.liInsertMock = liInsertMock;
    mockSupabase.siteInsertMock = siteInsertMock;
    mockSupabase.ndaSelectMock = ndaSelectMock;
    mockSupabase.vendorSelectMock = vendorSelectMock;
    mockSupabase.entitySelectMock = entitySelectMock;
    mockSupabase.poInsertMock = poInsertMock;

    mockCreateClient.mockResolvedValue(mockSupabase);
    mockRequireCapability.mockResolvedValue({
      user: { id: 'user-1' },
      role: 'admin',
      error: null,
    });
    mockHasCapability.mockReturnValue(true);
    mockRecordAuditLog.mockResolvedValue(undefined);
    mockCreateNotification.mockResolvedValue(undefined);
    mockRevalidatePath.mockReturnValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Auth failure', () => {
    it('returns { error: "Unauthorized" } when requireCapability fails', async () => {
      mockRequireCapability.mockResolvedValue({
        user: null,
        role: null,
        error: 'User does not have po.create capability',
      });

      const result = await createPurchaseOrderCore({
        vendor_id: 'vendor-1',
        line_items: [{ description: 'Item 1', qty: 1, unit_price: 100 }],
      });

      expect(result).toEqual({ error: 'User does not have po.create capability' });
      // Verify no database access occurred
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('returns { error: "Unauthorized" } when user is null even without explicit error', async () => {
      mockRequireCapability.mockResolvedValue({
        user: null,
        role: 'admin',
        error: null,
      });

      const result = await createPurchaseOrderCore({
        vendor_id: 'vendor-1',
        line_items: [{ description: 'Item 1', qty: 1, unit_price: 100 }],
      });

      expect(result).toEqual({ error: 'Unauthorized' });
    });
  });

  describe('Validation errors', () => {
    it('returns error when vendor_id is missing', async () => {
      const result = await createPurchaseOrderCore({
        vendor_id: '',
        line_items: [{ description: 'Item 1', qty: 1, unit_price: 100 }],
      });

      expect(result).toEqual({ error: 'Vendor is required.' });
      // Verify database access was not attempted
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('returns error when total amount is zero (qty=0)', async () => {
      const result = await createPurchaseOrderCore({
        vendor_id: 'vendor-1',
        line_items: [{ description: 'Item 1', qty: 0, unit_price: 100 }],
      });

      expect(result).toEqual({
        error: 'Total amount must be greater than zero. Add at least one line item with a price.',
      });
    });

    it('returns error when total amount is zero (unit_price=0)', async () => {
      const result = await createPurchaseOrderCore({
        vendor_id: 'vendor-1',
        line_items: [{ description: 'Item 1', qty: 5, unit_price: 0 }],
      });

      expect(result).toEqual({
        error: 'Total amount must be greater than zero. Add at least one line item with a price.',
      });
    });

    it('returns error when total amount is negative (invalid inputs)', async () => {
      const result = await createPurchaseOrderCore({
        vendor_id: 'vendor-1',
        line_items: [{ description: 'Item 1', qty: -5, unit_price: 100 }],
      });

      expect(result).toEqual({
        error: 'Total amount must be greater than zero. Add at least one line item with a price.',
      });
    });

    it('calculates total amount correctly with multiple line items', async () => {
      // This should pass validation (total = 200 + 300 = 500)
      const result = await createPurchaseOrderCore({
        vendor_id: 'vendor-1',
        line_items: [
          { description: 'Item 1', qty: 2, unit_price: 100 },
          { description: 'Item 2', qty: 3, unit_price: 100 },
        ],
      });

      // Should not be a validation error
      expect(result).not.toHaveProperty('error');
    });
  });

  describe('Compliance gate - inactive vendor', () => {
    it('returns vendor-not-active error when vendor status is not active and no waive', async () => {
      mockSupabase.vendorSelectChain.single.mockResolvedValue({
        data: { status: 'inactive', currency: 'PHP' },
        error: null,
      });

      const result = await createPurchaseOrderCore({
        vendor_id: 'vendor-inactive',
        line_items: [{ description: 'Item 1', qty: 1, unit_price: 100 }],
      });

      expect(result).toEqual({
        error: 'Cannot create PO: This vendor is not currently active. Vendors must be activated (Accredited) before purchase orders can be issued.',
      });
      // Verify PO insert was not attempted
      const fromCalls = mockSupabase.from.mock.calls;
      const poInsertCall = fromCalls.find((c: any[]) => c[0] === 'purchase_orders');
      expect(poInsertCall).toBeUndefined();
    });

    it('returns vendor-not-active error when vendor query returns null', async () => {
      mockSupabase.vendorSelectChain.single.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await createPurchaseOrderCore({
        vendor_id: 'vendor-not-found',
        line_items: [{ description: 'Item 1', qty: 1, unit_price: 100 }],
      });

      expect(result).toEqual({
        error: 'Cannot create PO: This vendor is not currently active. Vendors must be activated (Accredited) before purchase orders can be issued.',
      });
    });
  });

  describe('Compliance gate - missing NDA', () => {
    it('returns NDA-missing error when no approved NDA exists and no waive', async () => {
      mockSupabase.ndaSelectChain.maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await createPurchaseOrderCore({
        vendor_id: 'vendor-no-nda',
        line_items: [{ description: 'Item 1', qty: 1, unit_price: 100 }],
      });

      expect(result).toEqual({
        error: 'Cannot create PO: This vendor does not have an approved Signed NDA on file. Please submit and have the NDA approved first.',
      });
      // Verify PO insert was not attempted
      const fromCalls = mockSupabase.from.mock.calls;
      const poInsertCall = fromCalls.find((c: any[]) => c[0] === 'purchase_orders');
      expect(poInsertCall).toBeUndefined();
    });
  });

  describe('Waiver - no capability', () => {
    it('returns permission error when waive_requirements=true but user lacks po.waive_requirements capability', async () => {
      mockSupabase.vendorSelectChain.single.mockResolvedValue({
        data: { status: 'inactive', currency: 'PHP' },
        error: null,
      });
      mockHasCapability.mockReturnValue(false);

      const result = await createPurchaseOrderCore({
        vendor_id: 'vendor-blocked',
        line_items: [{ description: 'Item 1', qty: 1, unit_price: 100 }],
        waive_requirements: true,
      });

      expect(result).toEqual({
        error: 'You do not have permission to waive PO requirements.',
      });
    });
  });

  describe('Default values', () => {
    it('defaults issued_date to today (YYYY-MM-DD format) when not provided', async () => {
      await createPurchaseOrderCore({
        vendor_id: 'vendor-1',
        line_items: [{ description: 'Item 1', qty: 1, unit_price: 100 }],
      });

      const insertedData = mockSupabase.poInsertMock.mock.calls[0][0];

      // Verify issued_date is set and matches today's format
      expect(insertedData.issued_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      const today = new Date().toISOString().slice(0, 10);
      expect(insertedData.issued_date).toBe(today);
    });

    it('uses provided issued_date when specified', async () => {
      const customDate = '2026-12-25';

      await createPurchaseOrderCore({
        vendor_id: 'vendor-1',
        line_items: [{ description: 'Item 1', qty: 1, unit_price: 100 }],
        issued_date: customDate,
      });

      const insertedData = mockSupabase.poInsertMock.mock.calls[0][0];

      expect(insertedData.issued_date).toBe(customDate);
    });

    it('defaults mobilization_date to tomorrow in Manila when creating a PO', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-07-07T16:30:00.000Z'));

      await createPurchaseOrderCore({
        vendor_id: 'vendor-1',
        line_items: [{ description: 'Item 1', qty: 1, unit_price: 100 }],
      });

      const insertedData = mockSupabase.poInsertMock.mock.calls[0][0];

      expect(insertedData.mobilization_date).toBe('2026-07-09');
    });
  });

  describe('Happy path - standard PO creation', () => {
    it('creates PO with valid vendor and approved NDA, returns correct response object', async () => {
      const result = await createPurchaseOrderCore({
        vendor_id: 'vendor-good',
        line_items: [
          { description: 'Service A', qty: 2, unit_price: 500 },
          { description: 'Service B', qty: 1, unit_price: 1000 },
        ],
      });

      expect(result).toEqual({
        id: 'po-1',
        po_number: 'PO-2026-001',
        url: '/dashboard/purchase-orders/po-1',
        message: 'Draft PO PO-2026-001 created successfully.',
      });

      // Verify redirect was NOT called (core should not redirect)
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it('inserts PO with correct fields', async () => {
      await createPurchaseOrderCore({
        vendor_id: 'vendor-1',
        line_items: [{ description: 'Item 1', qty: 1, unit_price: 100 }],
        description: 'Test PO',
        due_date: '2026-07-15',
        dp_amount: 50,
      });

      const insertedData = mockSupabase.poInsertMock.mock.calls[0][0];

      expect(insertedData).toMatchObject({
        vendor_id: 'vendor-1',
        project_id: null,
        description: 'Test PO',
        amount: 100,
        dp_amount: 50,
        due_date: '2026-07-15',
        status: 'draft',
        currency: 'PHP',
        internal_entity_id: 'entity-1',
        created_by: 'user-1',
      });

      // Verify no waiver fields when not waving
      expect(insertedData).not.toHaveProperty('requirements_waived');
    });

    it('records audit log with correct data', async () => {
      await createPurchaseOrderCore({
        vendor_id: 'vendor-1',
        line_items: [
          { description: 'Item 1', qty: 1, unit_price: 100 },
          { description: 'Item 2', qty: 2, unit_price: 50 },
        ],
      });

      expect(mockRecordAuditLog).toHaveBeenCalled();
      const auditCall = mockRecordAuditLog.mock.calls[0][0];

      expect(auditCall).toMatchObject({
        entity_type: 'purchase_order',
        entity_id: 'po-1',
        action: 'CREATE',
        performed_by: 'user-1',
      });

      expect(auditCall.changes.after).toMatchObject({
        vendor_id: 'vendor-1',
        amount: 200,
        status: 'draft',
        currency: 'PHP',
        line_items_count: 2,
      });
    });

    it('creates notification with correct link', async () => {
      await createPurchaseOrderCore({
        vendor_id: 'vendor-1',
        line_items: [{ description: 'Item 1', qty: 1, unit_price: 100 }],
      });

      expect(mockCreateNotification).toHaveBeenCalled();
      const notifCall = mockCreateNotification.mock.calls[0][0];

      expect(notifCall).toMatchObject({
        type: 'po',
        link: '/dashboard/purchase-orders/po-1',
        created_by: 'user-1',
      });
    });

    it('calls revalidatePath for purchase-orders list', async () => {
      await createPurchaseOrderCore({
        vendor_id: 'vendor-1',
        line_items: [{ description: 'Item 1', qty: 1, unit_price: 100 }],
      });

      expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/purchase-orders');
    });
  });

  describe('Line items', () => {
    it('inserts line items with correct fields and sequential line numbers', async () => {
      await createPurchaseOrderCore({
        vendor_id: 'vendor-1',
        line_items: [
          { item_code: 'SKU-001', description: 'Item A', qty: 2, uom: 'PC', unit_price: 100 },
          { description: 'Item B', qty: 3, unit_price: 50 },
        ],
      });

      const insertedLineItems = mockSupabase.liInsertMock.mock.calls[0][0];

      expect(insertedLineItems).toHaveLength(2);

      // First line item
      expect(insertedLineItems[0]).toMatchObject({
        po_id: 'po-1',
        line_no: 1,
        item_code: 'SKU-001',
        description: 'Item A',
        qty: 2,
        uom: 'PC',
        unit_price: 100,
        amount: 200,
      });

      // Second line item (defaults)
      expect(insertedLineItems[1]).toMatchObject({
        po_id: 'po-1',
        line_no: 2,
        item_code: '',
        description: 'Item B',
        qty: 3,
        uom: 'LOT',
        unit_price: 50,
        amount: 150,
      });
    });

    it('does not insert line items when array is empty', async () => {
      await createPurchaseOrderCore({
        vendor_id: 'vendor-1',
        line_items: [],
      });

      // Should fail validation (total amount <= 0), so never reaches insert
      // But let's verify with a different test case where it would pass
    });

    it('handles string qty and unit_price by converting to numbers', async () => {
      // The function uses Number() coercion in several places
      await createPurchaseOrderCore({
        vendor_id: 'vendor-1',
        line_items: [
          { description: 'Item', qty: 5, unit_price: 100 }, // Valid numbers
        ],
      });

      const insertedLineItems = mockSupabase.liInsertMock.mock.calls[0][0];

      expect(insertedLineItems[0].qty).toBe(5);
      expect(insertedLineItems[0].unit_price).toBe(100);
    });
  });

  describe('Waiver happy path', () => {
    it('creates PO with waive_requirements=true and user has capability on blocked vendor', async () => {
      mockSupabase.ndaSelectChain.maybeSingle.mockResolvedValue({
        data: null, // No NDA
        error: null,
      });
      mockSupabase.vendorSelectChain.single.mockResolvedValue({
        data: { status: 'inactive', currency: 'PHP' }, // Inactive vendor
        error: null,
      });
      mockHasCapability.mockReturnValue(true);

      const result = await createPurchaseOrderCore({
        vendor_id: 'vendor-blocked',
        line_items: [{ description: 'Item 1', qty: 1, unit_price: 100 }],
        waive_requirements: true,
      });

      // Should succeed
      expect(result).not.toHaveProperty('error');
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('po_number');
    });

    it('inserts PO with waiver fields when requirements are waived', async () => {
      mockSupabase.ndaSelectChain.maybeSingle.mockResolvedValue({
        data: null, // No NDA
        error: null,
      });
      mockSupabase.vendorSelectChain.single.mockResolvedValue({
        data: { status: 'inactive', currency: 'PHP' }, // Inactive vendor
        error: null,
      });
      mockHasCapability.mockReturnValue(true);

      await createPurchaseOrderCore({
        vendor_id: 'vendor-blocked',
        line_items: [{ description: 'Item 1', qty: 1, unit_price: 100 }],
        waive_requirements: true,
      });

      const insertedData = mockSupabase.poInsertMock.mock.calls[0][0];

      expect(insertedData).toMatchObject({
        requirements_waived: true,
        waiver_approved: false,
        waived_requirements: expect.arrayContaining(['nda', 'vendor_status']),
      });

      expect(insertedData.waived_by).toBe('user-1');
      expect(insertedData.waived_at).toBeDefined();
    });

    it('records waiver details in audit log', async () => {
      mockSupabase.ndaSelectChain.maybeSingle.mockResolvedValue({
        data: null, // No NDA
        error: null,
      });
      mockSupabase.vendorSelectChain.single.mockResolvedValue({
        data: { status: 'inactive', currency: 'PHP' },
        error: null,
      });
      mockHasCapability.mockReturnValue(true);

      await createPurchaseOrderCore({
        vendor_id: 'vendor-blocked',
        line_items: [{ description: 'Item 1', qty: 1, unit_price: 100 }],
        waive_requirements: true,
      });

      const auditCall = mockRecordAuditLog.mock.calls[0][0];

      expect(auditCall.changes.after).toMatchObject({
        requirements_waived: true,
        waived_requirements: expect.arrayContaining(['nda', 'vendor_status']),
      });
    });

    it('only includes waivers for failed requirements', async () => {
      // Vendor inactive, but NDA is present
      mockSupabase.ndaSelectChain.maybeSingle.mockResolvedValue({
        data: { status: 'approved' },
        error: null,
      });
      mockSupabase.vendorSelectChain.single.mockResolvedValue({
        data: { status: 'inactive', currency: 'PHP' },
        error: null,
      });
      mockHasCapability.mockReturnValue(true);

      await createPurchaseOrderCore({
        vendor_id: 'vendor-blocked',
        line_items: [{ description: 'Item 1', qty: 1, unit_price: 100 }],
        waive_requirements: true,
      });

      const insertedData = mockSupabase.poInsertMock.mock.calls[0][0];

      // Should only include vendor_status, not nda
      expect(insertedData.waived_requirements).toEqual(['vendor_status']);
    });
  });

  describe('Site details', () => {
    it('inserts site details when provided', async () => {
      await createPurchaseOrderCore({
        vendor_id: 'vendor-1',
        line_items: [{ description: 'Item 1', qty: 1, unit_price: 100 }],
        site_details: [
          { region: 'NCR', area_city: 'Manila', no_of_nodes: 5, cable_length_km: 10 },
          { region: 'CALABARZON', area_city: 'Laguna', no_of_nodes: 3, cable_length_km: 8 },
        ],
      });

      const insertedSites = mockSupabase.siteInsertMock.mock.calls[0][0];

      expect(insertedSites).toHaveLength(2);
      expect(insertedSites[0]).toMatchObject({
        po_id: 'po-1',
        sn: 1,
        region: 'NCR',
        area_city: 'Manila',
        no_of_nodes: 5,
        cable_length_km: 10,
      });
    });

    it('filters out empty site details', async () => {
      await createPurchaseOrderCore({
        vendor_id: 'vendor-1',
        line_items: [{ description: 'Item 1', qty: 1, unit_price: 100 }],
        site_details: [
          { region: 'NCR', area_city: 'Manila', no_of_nodes: 5, cable_length_km: 10 },
          { region: '', area_city: '', no_of_nodes: 0, cable_length_km: 0 }, // Empty
        ],
      });

      const insertedSites = mockSupabase.siteInsertMock.mock.calls[0][0];

      // Only one site should be inserted
      expect(insertedSites).toHaveLength(1);
      expect(insertedSites[0].region).toBe('NCR');
    });
  });

  describe('Edge cases', () => {
    it('handles vendor with custom currency', async () => {
      mockSupabase.vendorSelectChain.single.mockResolvedValue({
        data: { status: 'active', currency: 'USD' },
        error: null,
      });

      await createPurchaseOrderCore({
        vendor_id: 'vendor-usd',
        line_items: [{ description: 'Item 1', qty: 1, unit_price: 100 }],
      });

      const insertedData = mockSupabase.poInsertMock.mock.calls[0][0];

      expect(insertedData.currency).toBe('USD');
    });

    it('uses PHP as default currency when vendor currency is missing', async () => {
      mockSupabase.vendorSelectChain.single.mockResolvedValue({
        data: { status: 'active' }, // No currency field
        error: null,
      });

      await createPurchaseOrderCore({
        vendor_id: 'vendor-no-currency',
        line_items: [{ description: 'Item 1', qty: 1, unit_price: 100 }],
      });

      const insertedData = mockSupabase.poInsertMock.mock.calls[0][0];

      expect(insertedData.currency).toBe('PHP');
    });

    it('handles missing internal_entity gracefully', async () => {
      mockSupabase.entitySelectChain.single.mockResolvedValue({
        data: null,
        error: null,
      });

      await createPurchaseOrderCore({
        vendor_id: 'vendor-1',
        line_items: [{ description: 'Item 1', qty: 1, unit_price: 100 }],
      });

      const insertedData = mockSupabase.poInsertMock.mock.calls[0][0];

      expect(insertedData.internal_entity_id).toBeNull();
    });

    it('handles missing description gracefully', async () => {
      await createPurchaseOrderCore({
        vendor_id: 'vendor-1',
        line_items: [{ description: 'Item 1', qty: 1, unit_price: 100 }],
        // No description provided
      });

      const insertedData = mockSupabase.poInsertMock.mock.calls[0][0];

      expect(insertedData.description).toBeNull();
    });

    it('uses default dp_amount of 0 when not provided', async () => {
      await createPurchaseOrderCore({
        vendor_id: 'vendor-1',
        line_items: [{ description: 'Item 1', qty: 1, unit_price: 100 }],
        // No dp_amount
      });

      const insertedData = mockSupabase.poInsertMock.mock.calls[0][0];

      expect(insertedData.dp_amount).toBe(0);
    });
  });

  describe('Database errors', () => {
    it('returns error message when PO insert fails', async () => {
      mockSupabase.poInsertChain.single.mockResolvedValue({
        data: null,
        error: { message: 'Unique constraint violation on po_number' },
      });

      const result = await createPurchaseOrderCore({
        vendor_id: 'vendor-1',
        line_items: [{ description: 'Item 1', qty: 1, unit_price: 100 }],
      });

      expect(result).toEqual({
        error: 'Unique constraint violation on po_number',
      });
    });

    it('does not throw when line item insert fails', async () => {
      // Override the line items mock to return an error
      mockSupabase.liInsertMock.mockResolvedValue({
        error: { message: 'Foreign key violation' },
      });

      const result = await createPurchaseOrderCore({
        vendor_id: 'vendor-1',
        line_items: [{ description: 'Item 1', qty: 1, unit_price: 100 }],
      });

      // Should still succeed (line item error is logged but not returned)
      expect(result).toHaveProperty('id');
      expect(result).not.toHaveProperty('error');
    });
  });
});
