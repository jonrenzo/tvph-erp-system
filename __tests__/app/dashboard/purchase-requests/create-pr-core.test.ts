/**
 * Unit tests for createPurchaseRequestCore server action
 */

import { createPurchaseRequestCore } from '@/app/dashboard/purchase-requests/actions';

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/auth/permissions', () => ({
  requireCapability: jest.fn(),
}));

jest.mock('@/utils/audit', () => ({
  recordAuditLog: jest.fn(),
}));

jest.mock('@/utils/notifications', () => ({ createNotification: jest.fn(), createNotificationForRoles: jest.fn(),
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(), refresh: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

jest.mock('@/lib/email/pr-pending-approval', () => ({
  sendPrPendingApprovalEmail: jest.fn(),
}));

jest.mock('@/lib/email/pr-approved', () => ({
  sendPrApprovedEmail: jest.fn(),
}));

import { createClient } from '@/utils/supabase/server';
import { requireCapability } from '@/lib/auth/permissions';
import { recordAuditLog } from '@/utils/audit';
import { revalidatePath } from 'next/cache';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockRequireCapability = requireCapability as jest.MockedFunction<typeof requireCapability>;
const mockRecordAuditLog = recordAuditLog as jest.MockedFunction<typeof recordAuditLog>;
const mockRevalidatePath = revalidatePath as jest.MockedFunction<typeof revalidatePath>;

describe('createPurchaseRequestCore', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    const entitySelectChain = {
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: 'entity-1' }, error: null }),
    };

    const prInsertChain = {
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: 'pr-1', pr_number: 'PR-2026000001' },
        error: null,
      }),
    };

    const liInsertMock = jest.fn().mockResolvedValue({ error: null });
    const entitySelectMock = jest.fn().mockReturnValue(entitySelectChain);
    const prInsertMock = jest.fn().mockReturnValue(prInsertChain);

    mockSupabase = {
      from: jest.fn((tableName: string) => {
        if (tableName === 'internal_entities') {
          return { select: entitySelectMock };
        }
        if (tableName === 'purchase_requests') {
          return { insert: prInsertMock };
        }
        if (tableName === 'pr_line_items') {
          return { insert: liInsertMock };
        }
        return {
          select: jest.fn().mockReturnValue({}),
          insert: jest.fn().mockResolvedValue({ error: null }),
        };
      }),
    };

    mockSupabase.entitySelectChain = entitySelectChain;
    mockSupabase.prInsertChain = prInsertChain;
    mockSupabase.prInsertMock = prInsertMock;
    mockSupabase.liInsertMock = liInsertMock;

    mockCreateClient.mockResolvedValue(mockSupabase);
    mockRequireCapability.mockResolvedValue({
      user: { id: 'user-1' },
      role: 'operations',
      error: null,
    });
    mockRecordAuditLog.mockResolvedValue(undefined);
    mockRevalidatePath.mockReturnValue(undefined);
  });

  describe('Auth & validation', () => {
    it('returns auth error when user lacks pr.create capability', async () => {
      mockRequireCapability.mockResolvedValue({
        user: null,
        role: null,
        error: 'User does not have pr.create capability',
      });

      const result = await createPurchaseRequestCore({
        line_items: [{ description: 'Item 1', qty: 1, unit_price: 100 }],
      });

      expect(result).toEqual({ error: 'User does not have pr.create capability' });
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('returns error when total amount is zero', async () => {
      const result = await createPurchaseRequestCore({
        line_items: [{ description: 'Item 1', qty: 0, unit_price: 100 }],
      });

      expect(result).toEqual({
        error: 'Total amount must be greater than zero. Add at least one line item with a price.',
      });
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('returns error when downpayment exceeds the total amount', async () => {
      const result = await createPurchaseRequestCore({
        line_items: [{ description: 'Item 1', qty: 1, unit_price: 100 }],
        dp_amount: 200,
      });

      expect(result).toEqual({
        error: 'Downpayment cannot exceed the estimated total.',
      });
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('returns error when downpayment percent is above 100', async () => {
      const result = await createPurchaseRequestCore({
        line_items: [{ description: 'Item 1', qty: 1, unit_price: 100 }],
        dp_percent: 120,
      });

      expect(result).toEqual({
        error: 'Downpayment percent must be between 0 and 100.',
      });
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('returns error when downpayment percent is negative', async () => {
      const result = await createPurchaseRequestCore({
        line_items: [{ description: 'Item 1', qty: 1, unit_price: 100 }],
        dp_percent: -5,
      });

      expect(result).toEqual({
        error: 'Downpayment percent must be between 0 and 100.',
      });
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });
  });

  describe('Happy path', () => {
    it('creates PR with correct fields and returns the response object', async () => {
      const result = await createPurchaseRequestCore({
        project_id: 'proj-1',
        description: 'Fiber for Cebu',
        line_items: [
          { description: 'Cable', qty: 2, unit_price: 500 },
          { description: 'Splice kits', qty: 1, unit_price: 1000 },
        ],
      });

      expect(result).toEqual({
        id: 'pr-1',
        pr_number: 'PR-2026000001',
        url: '/dashboard/purchase-requests/pr-1',
        message: 'Draft PR PR-2026000001 created successfully.',
      });

      const insertedData = mockSupabase.prInsertMock.mock.calls[0][0];
      expect(insertedData).toMatchObject({
        project_id: 'proj-1',
        description: 'Fiber for Cebu',
        amount: 2000,
        dp_amount: 0,
        status: 'draft',
        internal_entity_id: 'entity-1',
        created_by: 'user-1',
      });
    });

    it('persists the downpayment amount when provided', async () => {
      await createPurchaseRequestCore({
        description: 'Cable + DP',
        line_items: [
          { description: 'Cable', qty: 2, unit_price: 500 },
          { description: 'Splice kits', qty: 1, unit_price: 1000 },
        ],
        dp_amount: 750.5,
      });

const insertedData = mockSupabase.prInsertMock.mock.calls[0][0];
      expect(insertedData).toMatchObject({
        amount: 2000,
        dp_amount: 750.5,
      });
    });

    it('computes the peso downpayment from the percent input', async () => {
      await createPurchaseRequestCore({
        description: 'Cable + 30% DP',
        line_items: [
          { description: 'Cable', qty: 2, unit_price: 500 },
          { description: 'Splice kits', qty: 1, unit_price: 1000 },
        ],
        dp_percent: 30,
      });

      const insertedData = mockSupabase.prInsertMock.mock.calls[0][0];
      expect(insertedData).toMatchObject({
        amount: 2000,
        dp_amount: 600,
        dp_percent: 30,
      });
    });

    it('derives the percent when only a legacy peso amount is provided', async () => {
      await createPurchaseRequestCore({
        line_items: [
          { description: 'Cable', qty: 2, unit_price: 500 },
        ],
        dp_amount: 400,
      });

      const insertedData = mockSupabase.prInsertMock.mock.calls[0][0];
      expect(insertedData).toMatchObject({
        amount: 1000,
        dp_amount: 400,
        dp_percent: 40,
      });
    });

    it('persists the nominated vendor id', async () => {
      await createPurchaseRequestCore({
        description: 'Cable for Cebu',
        vendor_id: 'vendor-1',
        line_items: [{ description: 'Cable', qty: 1, unit_price: 500 }],
      });

      const insertedData = mockSupabase.prInsertMock.mock.calls[0][0];
      expect(insertedData).toMatchObject({
        vendor_id: 'vendor-1',
      });
    });

    it('stores a null vendor when none is nominated', async () => {
      await createPurchaseRequestCore({
        line_items: [{ description: 'Cable', qty: 1, unit_price: 500 }],
      });

      const insertedData = mockSupabase.prInsertMock.mock.calls[0][0];
      expect(insertedData).toMatchObject({ vendor_id: null });
    });

    it('inserts line items with sequential line numbers and defaults', async () => {
      await createPurchaseRequestCore({
        line_items: [
          { item_code: 'SKU-1', description: 'Cable', qty: 2, uom: 'LM', unit_price: 100 },
          { description: 'Kits', qty: 3, unit_price: 50 },
        ],
      });

      const insertedLineItems = mockSupabase.liInsertMock.mock.calls[0][0];

      expect(insertedLineItems).toHaveLength(2);
      expect(insertedLineItems[0]).toMatchObject({
        pr_id: 'pr-1',
        line_no: 1,
        item_code: 'SKU-1',
        qty: 2,
        uom: 'LM',
        unit_price: 100,
        amount: 200,
      });
      expect(insertedLineItems[1]).toMatchObject({
        pr_id: 'pr-1',
        line_no: 2,
        item_code: '',
        uom: 'LOT',
        amount: 150,
      });
    });

    it('records audit log and revalidates the list path', async () => {
      await createPurchaseRequestCore({
        line_items: [{ description: 'Item 1', qty: 1, unit_price: 100 }],
      });

      expect(mockRecordAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          entity_type: 'purchase_request',
          entity_id: 'pr-1',
          action: 'CREATE',
          performed_by: 'user-1',
        })
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/purchase-requests');
    });

    it('returns the insert error message when PR insert fails', async () => {
      mockSupabase.prInsertChain.single.mockResolvedValue({
        data: null,
        error: { message: 'DB exploded' },
      });

      const result = await createPurchaseRequestCore({
        line_items: [{ description: 'Item 1', qty: 1, unit_price: 100 }],
      });

      expect(result).toEqual({ error: 'DB exploded' });
    });
  });
});
