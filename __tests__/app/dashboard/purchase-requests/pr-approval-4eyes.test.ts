import {
  submitPRForApproval,
  approvePR,
  approvePRFinance,
  rejectPR,
  cancelPurchaseRequest,
} from '@/app/dashboard/purchase-requests/actions';

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/auth/permissions', () => ({
  requireCapability: jest.fn(),
  getCurrentProfile: jest.fn(),
  hasCapability: jest.fn(),
}));

jest.mock('@/utils/audit', () => ({
  recordAuditLog: jest.fn(),
}));

jest.mock('@/utils/notifications', () => ({
  createNotification: jest.fn(),
}));

jest.mock('@/lib/email/pr-pending-approval', () => ({
  sendPrPendingApprovalEmail: jest.fn(),
}));

jest.mock('@/lib/email/pr-approved', () => ({
  sendPrApprovedEmail: jest.fn(),
}));

jest.mock('@/lib/email/pr-pending-finance', () => ({
  sendPrPendingFinanceEmail: jest.fn(),
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

import { createClient } from '@/utils/supabase/server';
import { requireCapability, getCurrentProfile, hasCapability } from '@/lib/auth/permissions';
import { recordAuditLog } from '@/utils/audit';
import { createNotification } from '@/utils/notifications';
import { sendPrPendingApprovalEmail } from '@/lib/email/pr-pending-approval';
import { sendPrApprovedEmail } from '@/lib/email/pr-approved';
import { sendPrPendingFinanceEmail } from '@/lib/email/pr-pending-finance';
import { revalidatePath } from 'next/cache';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockRequireCapability = requireCapability as jest.MockedFunction<typeof requireCapability>;
const mockGetCurrentProfile = getCurrentProfile as jest.MockedFunction<typeof getCurrentProfile>;
const mockHasCapability = hasCapability as jest.MockedFunction<typeof hasCapability>;
const mockRecordAuditLog = recordAuditLog as jest.MockedFunction<typeof recordAuditLog>;
const mockCreateNotification = createNotification as jest.MockedFunction<typeof createNotification>;
const mockSendPrPendingApprovalEmail = sendPrPendingApprovalEmail as jest.MockedFunction<typeof sendPrPendingApprovalEmail>;
const mockSendPrApprovedEmail = sendPrApprovedEmail as jest.MockedFunction<typeof sendPrApprovedEmail>;
const mockSendPrPendingFinanceEmail = sendPrPendingFinanceEmail as jest.MockedFunction<typeof sendPrPendingFinanceEmail>;
const mockRevalidatePath = revalidatePath as jest.MockedFunction<typeof revalidatePath>;

function makeMockSupabase() {
  const selectChain = {
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockResolvedValue({ data: [], error: null }),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
  };

  const updateChain = {
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockResolvedValue({ error: null, count: 1 }),
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

describe('submitPRForApproval — 4-eyes', () => {
  let mockSupabase: ReturnType<typeof makeMockSupabase>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = makeMockSupabase();

    mockCreateClient.mockResolvedValue(mockSupabase as any);
    mockRequireCapability.mockResolvedValue({
      user: { id: 'requester-1' },
      role: 'operations',
      error: null,
    });
    mockRecordAuditLog.mockResolvedValue(undefined);
    mockCreateNotification.mockResolvedValue(undefined);
    mockSendPrPendingApprovalEmail.mockResolvedValue({ status: 'sent' });
    mockRevalidatePath.mockReturnValue(undefined);

    mockSupabase.selectChain.single.mockResolvedValue({
      data: { status: 'draft' },
      error: null,
    });
    mockSupabase.selectChain.in.mockResolvedValue({
      data: [{ id: 'approver-1', role: 'admin' }],
      error: null,
    });
  });

  it('submits a draft PR for approval', async () => {
    const result = await submitPRForApproval('pr-123', ['approver-1']);
    expect(result).toEqual({ success: true });

    const updateFn = mockSupabase.from('purchase_requests').update;
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'pending_approval',
        submitted_for_approval_by: 'requester-1',
        approval_requested_from: ['approver-1'],
        rejection_reason: null,
      }),
      { count: 'exact' }
    );
  });

  it('blocks submitting a non-draft PR', async () => {
    mockSupabase.selectChain.single.mockResolvedValue({
      data: { status: 'approved' },
      error: null,
    });

    const result = await submitPRForApproval('pr-x', ['approver-1']);
    expect(result).toEqual({ error: 'Only draft PRs can be submitted for approval.' });
    expect(mockSupabase.updateChain.eq).not.toHaveBeenCalled();
  });

  it('requires at least one approver', async () => {
    const result = await submitPRForApproval('pr-x', []);
    expect(result).toEqual({ error: 'Select at least one admin or superadmin to approve this PR.' });
  });

  it('blocks selecting yourself as approver', async () => {
    const result = await submitPRForApproval('pr-x', ['requester-1']);
    expect(result).toEqual({ error: 'You cannot select yourself as an approver.' });
  });

  it('rejects non-admin approvers', async () => {
    mockSupabase.selectChain.in.mockResolvedValue({
      data: [{ id: 'approver-1', role: 'operations' }],
      error: null,
    });

    const result = await submitPRForApproval('pr-x', ['approver-1']);
    expect(result).toEqual({ error: 'Every selected approver must be an admin or superadmin.' });
  });

  it('returns auth error when user lacks pr.status capability', async () => {
    mockRequireCapability.mockResolvedValue({
      user: null,
      role: null,
      error: 'User does not have pr.status capability',
    });

    const result = await submitPRForApproval('pr-noauth', ['approver-1']);
    expect(result).toEqual({ error: 'User does not have pr.status capability' });
  });

  it('still succeeds when the approver email fails', async () => {
    mockSendPrPendingApprovalEmail.mockResolvedValue({ status: 'failed', error: 'SMTP down' });

    const result = await submitPRForApproval('pr-email', ['approver-1']);
    expect(result).toEqual({ success: true });
  });
});

describe('approvePR — 4-eyes', () => {
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
    mockSendPrApprovedEmail.mockResolvedValue({ status: 'sent' });
    mockSendPrPendingFinanceEmail.mockResolvedValue({ status: 'sent' });
    mockRevalidatePath.mockReturnValue(undefined);

    mockSupabase.selectChain.single.mockResolvedValue({
      data: {
        status: 'pending_approval',
        submitted_for_approval_by: 'submitter-user',
      },
      error: null,
    });
  });

  it('allows a different admin to approve and move the PR to finance', async () => {
    const result = await approvePR('pr-123');
    expect(result).toEqual({ success: true });

    const updateFn = mockSupabase.from('purchase_requests').update;
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'pending_finance',
        approved_by_user_id: 'approver-user',
        approved_at: expect.any(String),
      }),
      { count: 'exact' }
    );
    expect(mockRecordAuditLog).toHaveBeenCalled();
    expect(mockSendPrPendingFinanceEmail).toHaveBeenCalledWith('pr-123', { actorId: 'approver-user' });
    expect(mockSendPrApprovedEmail).not.toHaveBeenCalled();
  });

  it('blocks self-approval', async () => {
    mockSupabase.selectChain.single.mockResolvedValue({
      data: {
        status: 'pending_approval',
        submitted_for_approval_by: 'approver-user',
      },
      error: null,
    });

    const result = await approvePR('pr-self');
    expect(result).toEqual({
      error: 'You cannot approve a PR you submitted for approval. Another admin or superadmin must approve it.',
    });
    expect(mockSupabase.updateChain.eq).not.toHaveBeenCalled();
  });

  it('rejects approval when PR is not pending_approval', async () => {
    mockSupabase.selectChain.single.mockResolvedValue({
      data: { status: 'draft', submitted_for_approval_by: 'submitter-user' },
      error: null,
    });

    const result = await approvePR('pr-draft');
    expect(result).toEqual({ error: 'This PR is not pending the admin approval.' });
  });

  it('returns auth error when user lacks pr.approve capability', async () => {
    mockRequireCapability.mockResolvedValue({
      user: null,
      role: null,
      error: 'User does not have pr.approve capability',
    });

    const result = await approvePR('pr-noauth');
    expect(result).toEqual({ error: 'User does not have pr.approve capability' });
  });

  it('still succeeds when the finance email fails', async () => {
    mockSendPrPendingFinanceEmail.mockResolvedValue({ status: 'failed', error: 'SMTP down' });

    const result = await approvePR('pr-email');
    expect(result).toEqual({ success: true, emailWarning: 'SMTP down' });
  });
});

describe('approvePRFinance', () => {
  let mockSupabase: ReturnType<typeof makeMockSupabase>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = makeMockSupabase();

    mockCreateClient.mockResolvedValue(mockSupabase as any);
    mockRequireCapability.mockResolvedValue({
      user: { id: 'finance-user' },
      role: 'finance',
      error: null,
    });
    mockRecordAuditLog.mockResolvedValue(undefined);
    mockCreateNotification.mockResolvedValue(undefined);
    mockSendPrApprovedEmail.mockResolvedValue({ status: 'sent' });
    mockRevalidatePath.mockReturnValue(undefined);

    mockSupabase.selectChain.single.mockResolvedValue({
      data: { status: 'pending_finance', approved_by_user_id: 'admin-user' },
      error: null,
    });
  });

  it('approves a pending_finance PR when the finance user did not approve at the admin stage', async () => {
    const result = await approvePRFinance('pr-123');
    expect(result).toEqual({ success: true });

    const updateFn = mockSupabase.from('purchase_requests').update;
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'approved',
        finance_approved_by_user_id: 'finance-user',
        finance_approved_at: expect.any(String),
      }),
      { count: 'exact' }
    );
    expect(mockRecordAuditLog).toHaveBeenCalled();
    expect(mockSendPrApprovedEmail).toHaveBeenCalledWith('pr-123', { actorId: 'finance-user' });
  });

  it('blocks the admin-stage approver from doing the finance check (4-eyes across stages)', async () => {
    mockSupabase.selectChain.single.mockResolvedValue({
      data: { status: 'pending_finance', approved_by_user_id: 'finance-user' },
      error: null,
    });

    const result = await approvePRFinance('pr-self');
    expect(result).toEqual({
      error: 'You cannot approve a PR you approved at the admin stage. Another finance or superadmin user must do the budget check.',
    });
    expect(mockSupabase.updateChain.eq).not.toHaveBeenCalled();
  });

  it('rejects when the PR is not pending_finance', async () => {
    mockSupabase.selectChain.single.mockResolvedValue({
      data: { status: 'draft', approved_by_user_id: 'admin-user' },
      error: null,
    });

    const result = await approvePRFinance('pr-draft');
    expect(result).toEqual({ error: 'This PR is not pending the finance approval.' });
    expect(mockSupabase.updateChain.eq).not.toHaveBeenCalled();
  });
});

describe('rejectPR', () => {
  let mockSupabase: ReturnType<typeof makeMockSupabase>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = makeMockSupabase();

    mockCreateClient.mockResolvedValue(mockSupabase as any);
    mockGetCurrentProfile.mockResolvedValue({
      user: { id: 'approver-user' },
      role: 'admin',
      error: null,
    } as any);
    mockHasCapability.mockReturnValue(true);
    mockRecordAuditLog.mockResolvedValue(undefined);
    mockCreateNotification.mockResolvedValue(undefined);
    mockRevalidatePath.mockReturnValue(undefined);

    mockSupabase.selectChain.single.mockResolvedValue({
      data: { status: 'pending_approval' },
      error: null,
    });
  });

  it('sends a pending PR back to draft with the trimmed reason', async () => {
    const result = await rejectPR('pr-123', '  needs revision  ');
    expect(result).toEqual({ success: true });

    const updateFn = mockSupabase.from('purchase_requests').update;
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'draft',
        rejection_reason: 'needs revision',
      }),
      { count: 'exact' }
    );
  });

  it('requires a non-empty rejection reason', async () => {
    const result = await rejectPR('pr-x', '   ');
    expect(result).toEqual({ error: 'A rejection reason is required.' });
    expect(mockSupabase.updateChain.eq).not.toHaveBeenCalled();
  });

  it('rejects when the PR is not pending_approval', async () => {
    mockSupabase.selectChain.single.mockResolvedValue({
      data: { status: 'converted' },
      error: null,
    });

    const result = await rejectPR('pr-converted', 'too late');
    expect(result).toEqual({ error: 'This PR is not pending approval.' });
  });

  it('returns auth error when the user lacks stage capability', async () => {
    mockHasCapability.mockReturnValue(false);

    const result = await rejectPR('pr-noauth', 'reason');
    expect(result).toEqual({ error: 'This PR is not pending approval.' });
    expect(mockSupabase.updateChain.eq).not.toHaveBeenCalled();
  });
});

describe('cancelPurchaseRequest', () => {
  let mockSupabase: ReturnType<typeof makeMockSupabase>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = makeMockSupabase();

    mockCreateClient.mockResolvedValue(mockSupabase as any);
    mockRequireCapability.mockResolvedValue({
      user: { id: 'requester-1' },
      role: 'operations',
      error: null,
    });
    mockRecordAuditLog.mockResolvedValue(undefined);
    mockRevalidatePath.mockReturnValue(undefined);

    mockSupabase.selectChain.single.mockResolvedValue({
      data: { status: 'approved', created_by: 'requester-1' },
      error: null,
    });
  });

  it('lets the requester cancel an unconverted PR', async () => {
    const result = await cancelPurchaseRequest('pr-123');
    expect(result).toEqual({ success: true });

    const updateFn = mockSupabase.from('purchase_requests').update;
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'cancelled' }),
      { count: 'exact' }
    );
  });

  it('blocks cancelling a converted PR', async () => {
    mockSupabase.selectChain.single.mockResolvedValue({
      data: { status: 'converted', created_by: 'requester-1' },
      error: null,
    });

    const result = await cancelPurchaseRequest('pr-converted');
    expect(result).toEqual({ error: 'A converted PR cannot be cancelled.' });
  });

  it('blocks cancelling someone else’s PR', async () => {
    mockSupabase.selectChain.single.mockResolvedValue({
      data: { status: 'draft', created_by: 'someone-else' },
      error: null,
    });

    const result = await cancelPurchaseRequest('pr-other');
    expect(result).toEqual({ error: 'Only the requester can cancel this PR.' });
  });
});
