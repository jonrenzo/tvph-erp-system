import { submitPOForApproval } from '@/app/dashboard/purchase-orders/actions';

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/auth/permissions', () => ({
  requireCapability: jest.fn(),
}));

jest.mock('@/utils/audit', () => ({
  recordAuditLog: jest.fn(),
}));

jest.mock('@/utils/notifications', () => ({
  createNotification: jest.fn(),
}));

jest.mock('@/lib/email/po-pending-approval', () => ({
  sendPoPendingApprovalEmail: jest.fn(),
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

import { createClient } from '@/utils/supabase/server';
import { requireCapability } from '@/lib/auth/permissions';
import { createNotification } from '@/utils/notifications';
import { sendPoPendingApprovalEmail } from '@/lib/email/po-pending-approval';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockRequireCapability = requireCapability as jest.MockedFunction<typeof requireCapability>;
const mockCreateNotification = createNotification as jest.MockedFunction<typeof createNotification>;
const mockSendPoPendingApprovalEmail = sendPoPendingApprovalEmail as jest.MockedFunction<
  typeof sendPoPendingApprovalEmail
>;

function makeMockSupabase() {
  const selectChain = {
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockResolvedValue({ data: [], error: null }),
    single: jest.fn().mockResolvedValue({ data: { status: 'draft' }, error: null }),
  };

  const updateChain = {
    eq: jest.fn().mockResolvedValue({ error: null }),
  };

  return {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue(selectChain),
      update: jest.fn().mockReturnValue(updateChain),
    }),
    selectChain,
    updateChain,
  };
}

describe('submitPOForApproval — approver selection', () => {
  let mockSupabase: ReturnType<typeof makeMockSupabase>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = makeMockSupabase();

    mockCreateClient.mockResolvedValue(mockSupabase as any);
    mockRequireCapability.mockResolvedValue({
      user: { id: 'submitter-1' },
      role: 'operations',
      error: null,
    });
    mockCreateNotification.mockResolvedValue(undefined);
    mockSendPoPendingApprovalEmail.mockResolvedValue({ status: 'sent' });

    // Default: the requested ids resolve to genuine admins.
    mockSupabase.selectChain.in.mockResolvedValue({
      data: [
        { id: 'admin-a', role: 'admin' },
        { id: 'admin-b', role: 'superadmin' },
      ],
      error: null,
    });
  });

  it('requires at least one approver', async () => {
    const result = await submitPOForApproval('po-1', []);
    expect(result).toEqual({
      error: 'Select at least one admin or superadmin to approve this PO.',
    });
    expect(mockSupabase.updateChain.eq).not.toHaveBeenCalled();
  });

  it('rejects when the submitter selects themselves', async () => {
    const result = await submitPOForApproval('po-1', ['submitter-1', 'admin-a']);
    expect(result).toEqual({ error: 'You cannot select yourself as an approver.' });
    expect(mockSupabase.updateChain.eq).not.toHaveBeenCalled();
  });

  it('rejects when a selected id is not an admin/superadmin', async () => {
    mockSupabase.selectChain.in.mockResolvedValue({
      data: [
        { id: 'admin-a', role: 'admin' },
        { id: 'viewer-x', role: 'viewer' },
      ],
      error: null,
    });

    const result = await submitPOForApproval('po-1', ['admin-a', 'viewer-x']);
    expect(result).toEqual({
      error: 'Every selected approver must be an admin or superadmin.',
    });
    expect(mockSupabase.updateChain.eq).not.toHaveBeenCalled();
  });

  it('rejects when a selected id does not resolve to any profile', async () => {
    // Only one of the two requested ids comes back — a bogus id was injected.
    mockSupabase.selectChain.in.mockResolvedValue({
      data: [{ id: 'admin-a', role: 'admin' }],
      error: null,
    });

    const result = await submitPOForApproval('po-1', ['admin-a', 'ghost-id']);
    expect(result).toEqual({
      error: 'Every selected approver must be an admin or superadmin.',
    });
    expect(mockSupabase.updateChain.eq).not.toHaveBeenCalled();
  });

  it('deduplicates ids and stores the chosen approvers on success', async () => {
    const result = await submitPOForApproval('po-1', ['admin-a', 'admin-a', 'admin-b']);
    expect(result).toEqual({ success: true });

    const updateFn = mockSupabase.from('purchase_orders').update;
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'pending_approval',
        submitted_for_approval_by: 'submitter-1',
        approval_requested_from: ['admin-a', 'admin-b'],
      })
    );
    expect(mockSendPoPendingApprovalEmail).toHaveBeenCalledWith('po-1', {
      actorId: 'submitter-1',
    });
  });

  it('still succeeds but warns when the approval email fails to send', async () => {
    mockSupabase.selectChain.in.mockResolvedValue({
      data: [{ id: 'admin-a', role: 'admin' }],
      error: null,
    });
    mockSendPoPendingApprovalEmail.mockResolvedValue({
      status: 'failed',
      error: 'RESEND_API_KEY is not configured.',
    });

    const result = await submitPOForApproval('po-1', ['admin-a']);
    expect(result).toEqual({ success: true });

    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'po',
        title: expect.stringContaining('Approval email not sent'),
      })
    );
  });
});
