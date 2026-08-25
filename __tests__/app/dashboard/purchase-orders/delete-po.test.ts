import { deletePurchaseOrder } from '@/app/dashboard/purchase-orders/actions';

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
jest.mock('@/lib/email/po', () => ({
  sendPoIssuedEmail: jest.fn(),
}));
jest.mock('@/lib/email/po-pending-approval', () => ({
  sendPoPendingApprovalEmail: jest.fn(),
}));
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(), refresh: jest.fn(),
}));

import { createClient } from '@/utils/supabase/server';
import { requireCapability } from '@/lib/auth/permissions';
import { recordAuditLog } from '@/utils/audit';
import { revalidatePath } from 'next/cache';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockRequireCapability = requireCapability as jest.MockedFunction<typeof requireCapability>;
const mockRecordAuditLog = recordAuditLog as jest.MockedFunction<typeof recordAuditLog>;
const mockRevalidatePath = revalidatePath as jest.MockedFunction<typeof revalidatePath>;

const CASCADE_TABLES = [
  'payment_requests',
  'po_completion_certificates',
  'po_line_items',
  'po_site_details',
  'purchase_order_artifacts',
  'payment_reservations',
  'po_penalties',
];

/** Build a supabase mock that tracks the order of delete() calls per table. */
function setupSupabaseMock(opts: { invoices?: any[]; payments?: any[]; failOn?: string } = {}) {
  const deleteOrder: string[] = [];
  const recordDelete = (table: string) => {
    deleteOrder.push(table);
    return table === opts.failOn ? { error: { message: `delete failed on ${table}` } } : { error: null };
  };
  const from = jest.fn((table: string) => ({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({
        data: table === 'service_invoices' ? (opts.invoices ?? []) : [],
        error: null,
      }),
      in: jest.fn().mockResolvedValue({
        data: table === 'payments' ? (opts.payments ?? []) : [],
        error: null,
      }),
    }),
    delete: jest.fn().mockReturnValue({
      eq: jest.fn(() => recordDelete(table)),
      in: jest.fn(() => recordDelete(table)),
    }),
  }));
  return { from, deleteOrder };
}

describe('deletePurchaseOrder', () => {
  let mock: { from: jest.Mock; deleteOrder: string[] };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireCapability.mockResolvedValue({ user: { id: 'user-1' }, error: null } as any);
    mockRecordAuditLog.mockResolvedValue(undefined);
    mockRevalidatePath.mockReturnValue(undefined);
  });

  it('deletes the non-cascaded invoice chain in FK-safe order, then the PO', async () => {
    mock = setupSupabaseMock({
      invoices: [{ id: 'inv-1' }, { id: 'inv-2' }],
      payments: [{ id: 'pay-1' }],
    });
    mockCreateClient.mockResolvedValue({ from: mock.from } as any);

    const result = await deletePurchaseOrder('po-1');

    expect(result).toEqual({ success: true });
    // payment_documents -> payments -> service_invoices -> purchase_orders
    expect(mock.deleteOrder.indexOf('payment_documents')).toBeLessThan(mock.deleteOrder.indexOf('payments'));
    expect(mock.deleteOrder.indexOf('payments')).toBeLessThan(mock.deleteOrder.indexOf('service_invoices'));
    expect(mock.deleteOrder.indexOf('service_invoices')).toBeLessThan(mock.deleteOrder.indexOf('purchase_orders'));
    // tables with ON DELETE CASCADE are left for the DB to clean up
    for (const t of CASCADE_TABLES) {
      expect(mock.deleteOrder).not.toContain(t);
    }
    expect(mockRecordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ entity_type: 'purchase_order', entity_id: 'po-1', action: 'DELETE' }),
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/purchase-orders');
  });

  it('skips payment/invoice cleanup when the PO has no invoices', async () => {
    mock = setupSupabaseMock();
    mockCreateClient.mockResolvedValue({ from: mock.from } as any);

    const result = await deletePurchaseOrder('po-2');

    expect(result).toEqual({ success: true });
    expect(mock.deleteOrder).not.toContain('payments');
    expect(mock.deleteOrder).not.toContain('payment_documents');
    expect(mock.deleteOrder).not.toContain('service_invoices');
    expect(mock.deleteOrder).toEqual(['purchase_orders']);
  });

  it('stops and returns the error when a dependent delete fails, without touching the PO', async () => {
    mock = setupSupabaseMock({
      invoices: [{ id: 'inv-1' }],
      failOn: 'service_invoices',
    });
    mockCreateClient.mockResolvedValue({ from: mock.from } as any);

    const result = await deletePurchaseOrder('po-3');

    expect(result).toEqual({ error: 'delete failed on service_invoices' });
    expect(mock.deleteOrder).not.toContain('purchase_orders');
    expect(mockRecordAuditLog).not.toHaveBeenCalled();
  });

  it('returns the error if deleting the PO itself fails', async () => {
    mock = setupSupabaseMock({ failOn: 'purchase_orders' });
    mockCreateClient.mockResolvedValue({ from: mock.from } as any);

    const result = await deletePurchaseOrder('po-4');

    expect(result).toEqual({ error: 'delete failed on purchase_orders' });
    expect(mockRecordAuditLog).not.toHaveBeenCalled();
  });

  it('returns an error when the caller lacks po.delete capability', async () => {
    mockRequireCapability.mockResolvedValue({ user: null, error: 'Forbidden.' } as any);
    mockCreateClient.mockResolvedValue({ from: mock.from } as any);

    const result = await deletePurchaseOrder('po-5');

    expect(result).toEqual({ error: 'Forbidden.' });
    expect(mockRecordAuditLog).not.toHaveBeenCalled();
  });
});
