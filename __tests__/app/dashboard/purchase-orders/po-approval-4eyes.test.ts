import {
  submitPOForApproval,
  approvePO,
  rejectPO,
} from '@/app/dashboard/purchase-orders/actions';

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

jest.mock('@/lib/email/po', () => ({
  sendPoIssuedEmail: jest.fn(),
}));

jest.mock('@/lib/email/po-pending-approval', () => ({
  sendPoPendingApprovalEmail: jest.fn(),
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

import { createClient } from '@/utils/supabase/server';
import { requireCapability } from '@/lib/auth/permissions';
import { recordAuditLog } from '@/utils/audit';
import { createNotification } from '@/utils/notifications';
import { sendPoIssuedEmail } from '@/lib/email/po';
import { sendPoPendingApprovalEmail } from '@/lib/email/po-pending-approval';
import { revalidatePath } from 'next/cache';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockRequireCapability = requireCapability as jest.MockedFunction<typeof requireCapability>;
const mockRecordAuditLog = recordAuditLog as jest.MockedFunction<typeof recordAuditLog>;
const mockCreateNotification = createNotification as jest.MockedFunction<typeof createNotification>;
const mockSendPoIssuedEmail = sendPoIssuedEmail as jest.MockedFunction<typeof sendPoIssuedEmail>;
const mockSendPoPendingApprovalEmail = sendPoPendingApprovalEmail as jest.MockedFunction<typeof sendPoPendingApprovalEmail>;
const mockRevalidatePath = revalidatePath as jest.MockedFunction<typeof revalidatePath>;

function makeMockSupabase() {
  const selectChain = {
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockResolvedValue({ data: [], error: null }),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
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

describe('submitPOForApproval — 4-eyes', () => {
  let mockSupabase: ReturnType<typeof makeMockSupabase>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = makeMockSupabase();

    mockCreateClient.mockResolvedValue(mockSupabase as any);
    mockRequireCapability.mockResolvedValue({
      user: { id: 'admin-user-1' },
      role: 'admin',
      error: null,
    });
    mockRecordAuditLog.mockResolvedValue(undefined);
    mockCreateNotification.mockResolvedValue(undefined);
    mockSendPoPendingApprovalEmail.mockResolvedValue({ status: 'sent' });
    mockRevalidatePath.mockReturnValue(undefined);

    mockSupabase.selectChain.single.mockResolvedValue({
      data: { status: 'draft' },
      error: null,
    });
    // Approver-validation query (profiles.select('id, role').in('id', ids)).
    mockSupabase.selectChain.in.mockResolvedValue({
      data: [{ id: 'approver-1', role: 'admin' }],
      error: null,
    });
  });

  it('allows admin to submit a draft PO for approval', async () => {
    const result = await submitPOForApproval('po-123', ['approver-1']);
    expect(result).toEqual({ success: true });

    const updateCall = mockSupabase.from.mock.calls.find(
      (c: unknown[]) => c[0] === 'purchase_orders'
    );
    expect(updateCall).toBeDefined();

    const updateFn = mockSupabase.from('purchase_orders').update;
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'pending_approval',
        submitted_for_approval_by: 'admin-user-1',
        submitted_for_approval_at: expect.any(String),
        approval_requested_from: ['approver-1'],
        rejection_reason: null,
      })
    );
  });

  it('allows operations/finance to submit a draft PO for approval', async () => {
    mockRequireCapability.mockResolvedValue({
      user: { id: 'ops-user-1' },
      role: 'operations',
      error: null,
    });

    const result = await submitPOForApproval('po-ops', ['approver-1']);
    expect(result).toEqual({ success: true });
  });

  it('rejects submission when PO is not in draft status', async () => {
    mockSupabase.selectChain.single.mockResolvedValue({
      data: { status: 'issued' },
      error: null,
    });

    const result = await submitPOForApproval('po-issued', ['approver-1']);
    expect(result).toEqual({ error: 'Only draft POs can be submitted for approval.' });
    expect(mockSupabase.updateChain.eq).not.toHaveBeenCalled();
  });

  it('returns auth error when user lacks po.status capability', async () => {
    mockRequireCapability.mockResolvedValue({
      user: null,
      role: null,
      error: 'User does not have po.status capability',
    });

    const result = await submitPOForApproval('po-noauth', ['approver-1']);
    expect(result).toEqual({ error: 'User does not have po.status capability' });
    expect(mockSupabase.updateChain.eq).not.toHaveBeenCalled();
  });

  it('logs audit and sends notification on successful submission', async () => {
    await submitPOForApproval('po-audit', ['approver-1']);

    expect(mockRecordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_type: 'purchase_order',
        entity_id: 'po-audit',
        action: 'UPDATE',
        performed_by: 'admin-user-1',
      })
    );

    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'po',
        title: expect.stringContaining('PO Awaiting Approval'),
      })
    );
  });
});

describe('approvePO — 4-eyes', () => {
  let mockSupabase: ReturnType<typeof makeMockSupabase>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = makeMockSupabase();

    mockCreateClient.mockResolvedValue(mockSupabase as any);
    mockRequireCapability.mockResolvedValue({
      user: { id: 'approver-user' },
      role: 'admin',
      error: null,
    });
    mockRecordAuditLog.mockResolvedValue(undefined);
    mockCreateNotification.mockResolvedValue(undefined);
    mockSendPoIssuedEmail.mockResolvedValue({ status: 'sent' });
    mockRevalidatePath.mockReturnValue(undefined);

    mockSupabase.selectChain.single.mockResolvedValue({
      data: {
        status: 'pending_approval',
        requirements_waived: false,
        waiver_approved: false,
        submitted_for_approval_by: 'submitter-user', // different from approver-user
      },
      error: null,
    });
  });

  it('allows a different admin to approve and issue the PO', async () => {
    const result = await approvePO('po-123');
    expect(result).toEqual({ success: true });

    const updateCall = mockSupabase.from('purchase_orders').update;
    expect(updateCall).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'issued',
        approved_by_user_id: 'approver-user',
        approved_at: expect.any(String),
        updated_at: expect.any(String),
      })
    );
    expect(mockSupabase.updateChain.eq).toHaveBeenCalledWith('id', 'po-123');
    expect(mockRecordAuditLog).toHaveBeenCalled();
    expect(mockSendPoIssuedEmail).toHaveBeenCalledWith('po-123', { actorId: 'approver-user' });
  });

  it('allows superadmin to approve an admin-submitted PO', async () => {
    mockRequireCapability.mockResolvedValue({
      user: { id: 'super-approver' },
      role: 'superadmin',
      error: null,
    });

    const result = await approvePO('po-super');
    expect(result).toEqual({ success: true });
  });

  it('blocks self-approval when approver === submitted_for_approval_by', async () => {
    mockSupabase.selectChain.single.mockResolvedValue({
      data: {
        status: 'pending_approval',
        requirements_waived: false,
        waiver_approved: false,
        submitted_for_approval_by: 'approver-user', // same as the current user
      },
      error: null,
    });

    const result = await approvePO('po-self');
    expect(result).toEqual({
      error: 'You cannot approve a PO you submitted for approval. Another admin or superadmin must approve it.',
    });
    expect(mockSupabase.updateChain.eq).not.toHaveBeenCalled();
  });

  it('rejects approval when PO is not pending_approval', async () => {
    mockSupabase.selectChain.single.mockResolvedValue({
      data: {
        status: 'draft',
        requirements_waived: false,
        waiver_approved: false,
        submitted_for_approval_by: 'submitter-user',
      },
      error: null,
    });

    const result = await approvePO('po-draft');
    expect(result).toEqual({ error: 'This PO is not pending approval.' });
    expect(mockSupabase.updateChain.eq).not.toHaveBeenCalled();
  });

  it('rejects approval when waived requirements are not yet approved', async () => {
    mockSupabase.selectChain.single.mockResolvedValue({
      data: {
        status: 'pending_approval',
        requirements_waived: true,
        waiver_approved: false,
        submitted_for_approval_by: 'submitter-user',
      },
      error: null,
    });

    const result = await approvePO('po-waiver');
    expect(result).toEqual({
      error: 'Cannot issue: this PO has waived requirements pending executive approval.',
    });
    expect(mockSupabase.updateChain.eq).not.toHaveBeenCalled();
  });

  it('returns auth error when user lacks po.approve capability', async () => {
    mockRequireCapability.mockResolvedValue({
      user: null,
      role: null,
      error: 'User does not have po.approve capability',
    });

    const result = await approvePO('po-noauth');
    expect(result).toEqual({ error: 'User does not have po.approve capability' });
    expect(mockSupabase.updateChain.eq).not.toHaveBeenCalled();
  });

  it('logs audit and sends notification on successful approval', async () => {
    await approvePO('po-audit');

    expect(mockRecordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_type: 'purchase_order',
        entity_id: 'po-audit',
        action: 'UPDATE',
        performed_by: 'approver-user',
      })
    );
  });
});

describe('rejectPO — 4-eyes', () => {
  let mockSupabase: ReturnType<typeof makeMockSupabase>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = makeMockSupabase();

    mockCreateClient.mockResolvedValue(mockSupabase as any);
    mockRequireCapability.mockResolvedValue({
      user: { id: 'approver-user' },
      role: 'admin',
      error: null,
    });
    mockRecordAuditLog.mockResolvedValue(undefined);
    mockCreateNotification.mockResolvedValue(undefined);
    mockRevalidatePath.mockReturnValue(undefined);

    mockSupabase.selectChain.single.mockResolvedValue({
      data: { status: 'pending_approval' },
      error: null,
    });
  });

  it('sends a pending_approval PO back to draft with the rejection reason', async () => {
    const result = await rejectPO('po-123', 'Missing supporting docs');
    expect(result).toEqual({ success: true });

    const updateFn = mockSupabase.from('purchase_orders').update;
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'draft',
        rejection_reason: 'Missing supporting docs',
      })
    );
    expect(mockSupabase.updateChain.eq).toHaveBeenCalledWith('id', 'po-123');
    expect(mockRecordAuditLog).toHaveBeenCalled();
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'po' })
    );
  });

  it('trims the rejection reason before storing it', async () => {
    await rejectPO('po-trim', '   needs revision   ');

    const updateFn = mockSupabase.from('purchase_orders').update;
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ rejection_reason: 'needs revision' })
    );
  });

  it('requires a non-empty rejection reason', async () => {
    const result = await rejectPO('po-noreason', '   ');
    expect(result).toEqual({ error: 'A rejection reason is required.' });
    expect(mockSupabase.updateChain.eq).not.toHaveBeenCalled();
  });

  it('rejects when the PO is not pending_approval', async () => {
    mockSupabase.selectChain.single.mockResolvedValue({
      data: { status: 'issued' },
      error: null,
    });

    const result = await rejectPO('po-issued', 'too late');
    expect(result).toEqual({ error: 'This PO is not pending approval.' });
    expect(mockSupabase.updateChain.eq).not.toHaveBeenCalled();
  });

  it('returns auth error when user lacks po.approve capability', async () => {
    mockRequireCapability.mockResolvedValue({
      user: null,
      role: null,
      error: 'User does not have po.approve capability',
    });

    const result = await rejectPO('po-noauth', 'reason');
    expect(result).toEqual({ error: 'User does not have po.approve capability' });
    expect(mockSupabase.updateChain.eq).not.toHaveBeenCalled();
  });
});
