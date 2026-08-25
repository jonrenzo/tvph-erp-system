/**
 * Tests for the PR → PO conversion path in createPurchaseOrderCore
 */

import { createPurchaseOrderCore } from '@/app/dashboard/purchase-orders/actions';

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/auth/permissions', () => ({
  requireCapability: jest.fn(),
  hasCapability: jest.fn(),
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

import { createClient } from '@/utils/supabase/server';
import { requireCapability, hasCapability } from '@/lib/auth/permissions';
import { recordAuditLog } from '@/utils/audit';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockRequireCapability = requireCapability as jest.MockedFunction<typeof requireCapability>;
const mockHasCapability = hasCapability as jest.MockedFunction<typeof hasCapability>;
const mockRecordAuditLog = recordAuditLog as jest.MockedFunction<typeof recordAuditLog>;

const BASE_INPUT = {
  vendor_id: 'vendor-1',
  line_items: [{ description: 'Item 1', qty: 1, unit_price: 100 }],
};

describe('createPurchaseOrderCore — PR conversion', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

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
        data: { id: 'po-1', po_number: 'PO-2026000001' },
        error: null,
      }),
    };
    const poInsertMock = jest.fn().mockReturnValue(poInsertChain);

    // PR lookup (conversion validation) — approved by default
    const prSelectChain = {
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: 'pr-1', pr_number: 'PR-2026000001', status: 'approved' },
        error: null,
      }),
    };

    // PR status flip (mark converted): update().eq().eq()
    const prUpdateSecondEq = jest.fn().mockResolvedValue({ error: null });
    const prUpdateFirstEq = jest.fn().mockReturnValue({ eq: prUpdateSecondEq });
    const prUpdateMock = jest.fn().mockReturnValue({ eq: prUpdateFirstEq });

    const liInsertMock = jest.fn().mockResolvedValue({ error: null });

    mockSupabase = {
      from: jest.fn((tableName: string) => {
        if (tableName === 'vendor_documents') return { select: jest.fn().mockReturnValue(ndaSelectChain) };
        if (tableName === 'vendors') return { select: jest.fn().mockReturnValue(vendorSelectChain) };
        if (tableName === 'internal_entities') return { select: jest.fn().mockReturnValue(entitySelectChain) };
        if (tableName === 'purchase_orders') return { insert: poInsertMock };
        if (tableName === 'purchase_requests') return { select: jest.fn().mockReturnValue(prSelectChain), update: prUpdateMock };
        if (tableName === 'po_line_items') return { insert: liInsertMock };
        if (tableName === 'po_site_details') return { insert: jest.fn().mockResolvedValue({ error: null }) };
        return { select: jest.fn().mockReturnValue({}), insert: jest.fn().mockResolvedValue({ error: null }) };
      }),
    };

    mockSupabase.poInsertChain = poInsertChain;
    mockSupabase.poInsertMock = poInsertMock;
    mockSupabase.prSelectChain = prSelectChain;
    mockSupabase.prUpdateMock = prUpdateMock;
    mockSupabase.prUpdateFirstEq = prUpdateFirstEq;
    mockSupabase.prUpdateSecondEq = prUpdateSecondEq;

    mockCreateClient.mockResolvedValue(mockSupabase);
    mockRequireCapability.mockResolvedValue({
      user: { id: 'user-1' },
      role: 'admin',
      error: null,
    });
    mockHasCapability.mockReturnValue(true);
    mockRecordAuditLog.mockResolvedValue(undefined);
  });

  it('links the PO to the PR, copies pr_number, and marks the PR converted', async () => {
    const result = await createPurchaseOrderCore({
      ...BASE_INPUT,
      purchase_request_id: 'pr-1',
    });

    expect(result).toHaveProperty('id', 'po-1');

    const insertedData = mockSupabase.poInsertMock.mock.calls[0][0];

    expect(insertedData).toMatchObject({
      purchase_request_id: 'pr-1',
      pr_number: 'PR-2026000001',
    });

    // PR marked converted, guarded on status='approved'
    expect(mockSupabase.prUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'converted' })
    );
    expect(mockSupabase.prUpdateFirstEq).toHaveBeenCalledWith('id', 'pr-1');
    expect(mockSupabase.prUpdateSecondEq).toHaveBeenCalledWith('status', 'approved');
  });

  it('records the PR link in the audit log', async () => {
    await createPurchaseOrderCore({ ...BASE_INPUT, purchase_request_id: 'pr-1' });

    const auditCall = mockRecordAuditLog.mock.calls[0][0];
    expect(auditCall.changes.after).toMatchObject({
      purchase_request_id: 'pr-1',
      pr_number: 'PR-2026000001',
    });
  });

  it('rejects conversion when the PR is still pending approval', async () => {
    mockSupabase.prSelectChain.single.mockResolvedValue({
      data: { id: 'pr-1', pr_number: 'PR-2026000001', status: 'pending_approval' },
      error: null,
    });

    const result = await createPurchaseOrderCore({ ...BASE_INPUT, purchase_request_id: 'pr-1' });
    expect(result).toEqual({ error: 'Only approved purchase requests can be converted to a PO.' });
  });

  it('rejects conversion of an already-converted PR with a clear message', async () => {
    mockSupabase.prSelectChain.single.mockResolvedValue({
      data: { id: 'pr-1', pr_number: 'PR-2026000001', status: 'converted' },
      error: null,
    });

    const result = await createPurchaseOrderCore({ ...BASE_INPUT, purchase_request_id: 'pr-1' });
    expect(result).toEqual({ error: 'This purchase request has already been converted to a PO.' });
  });

  it('returns not-found when the PR does not exist', async () => {
    mockSupabase.prSelectChain.single.mockResolvedValue({ data: null, error: null });

    const result = await createPurchaseOrderCore({ ...BASE_INPUT, purchase_request_id: 'pr-missing' });
    expect(result).toEqual({ error: 'Purchase request not found.' });
  });

  it('maps a unique-violation on conversion to the double-conversion message', async () => {
    mockSupabase.poInsertChain.single.mockResolvedValue({
      data: null,
      error: { message: 'duplicate key value violates unique constraint', code: '23505' },
    });

    const result = await createPurchaseOrderCore({ ...BASE_INPUT, purchase_request_id: 'pr-1' });
    expect(result).toEqual({ error: 'This purchase request has already been converted to a PO.' });
  });

  it('still creates unlinked POs when no purchase_request_id is given (chat-tool path)', async () => {
    const result = await createPurchaseOrderCore(BASE_INPUT);

    expect(result).toHaveProperty('id', 'po-1');
    const insertedData = mockSupabase.poInsertMock.mock.calls[0][0];
    expect(insertedData).not.toHaveProperty('purchase_request_id');
    expect(insertedData).not.toHaveProperty('pr_number');
    expect(mockSupabase.prUpdateMock).not.toHaveBeenCalled();
  });
});
