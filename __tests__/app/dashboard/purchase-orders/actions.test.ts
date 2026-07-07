/**
 * Unit tests for the updatePOStatus server action.
 *
 * updatePOStatus is a generic status updater. Issuance (-> 'issued') is NOT
 * permitted here: POs can only be issued through the 4-eyes approval flow
 * (submitPOForApproval -> approvePO, which enforces the self-approval and waiver
 * gates). These tests verify that guard, the idempotent already-issued
 * short-circuit, and normal non-issued transitions.
 */

import { updatePOStatus } from '@/app/dashboard/purchase-orders/actions';

// Mock Supabase client
jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

// Mock auth utilities
jest.mock('@/lib/auth/permissions', () => ({
  requireCapability: jest.fn(),
}));

// Mock audit logging
jest.mock('@/utils/audit', () => ({
  recordAuditLog: jest.fn(),
}));

// Mock notifications
jest.mock('@/utils/notifications', () => ({
  createNotification: jest.fn(),
}));

// Mock email sending
jest.mock('@/lib/email/po', () => ({
  sendPoIssuedEmail: jest.fn(),
}));

// Mock Next.js cache utilities
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

import { createClient } from '@/utils/supabase/server';
import { requireCapability } from '@/lib/auth/permissions';
import { recordAuditLog } from '@/utils/audit';
import { createNotification } from '@/utils/notifications';
import { sendPoIssuedEmail } from '@/lib/email/po';
import { revalidatePath } from 'next/cache';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockRequireCapability = requireCapability as jest.MockedFunction<
  typeof requireCapability
>;
const mockRecordAuditLog = recordAuditLog as jest.MockedFunction<
  typeof recordAuditLog
>;
const mockCreateNotification = createNotification as jest.MockedFunction<
  typeof createNotification
>;
const mockSendPoIssuedEmail = sendPoIssuedEmail as jest.MockedFunction<
  typeof sendPoIssuedEmail
>;
const mockRevalidatePath = revalidatePath as jest.MockedFunction<
  typeof revalidatePath
>;

const ISSUE_BLOCKED_ERROR =
  'POs can only be issued through the approval flow. Submit the PO for approval, then have a different admin or superadmin approve it.';

describe('updatePOStatus', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock Supabase client with proper chaining
    const selectChain = {
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    };

    const updateChain = {
      eq: jest.fn().mockResolvedValue({ error: null }),
    };

    mockSupabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue(selectChain),
        update: jest.fn().mockReturnValue(updateChain),
      }),
    };

    // Store references for accessing in tests
    mockSupabase.selectChain = selectChain;
    mockSupabase.updateChain = updateChain;

    mockCreateClient.mockResolvedValue(mockSupabase);
    mockRequireCapability.mockResolvedValue({
      user: { id: 'user-123' },
      role: 'admin',
      error: null,
    });
    mockRecordAuditLog.mockResolvedValue(undefined);
    mockCreateNotification.mockResolvedValue(undefined);
    mockSendPoIssuedEmail.mockResolvedValue({ status: 'sent' });
    mockRevalidatePath.mockReturnValue(undefined);
  });

  describe('Idempotency - already issued PO', () => {
    it('returns { success: true } immediately when PO is already issued', async () => {
      // Setup: PO already has status 'issued'
      mockSupabase.selectChain.single.mockResolvedValue({
        data: { status: 'issued' },
        error: null,
      });

      const result = await updatePOStatus('po-123', 'issued');

      expect(result).toEqual({ success: true });

      // Verify that update() was never called (idempotency guard prevents it)
      const fromCall = mockSupabase.from as jest.Mock;
      expect(fromCall).toHaveBeenCalledWith('purchase_orders');
      // The update chain's eq should never be called
      expect(mockSupabase.updateChain.eq).not.toHaveBeenCalled();
      // Verify side effects were not triggered
      expect(mockRecordAuditLog).not.toHaveBeenCalled();
      expect(mockCreateNotification).not.toHaveBeenCalled();
      expect(mockSendPoIssuedEmail).not.toHaveBeenCalled();
    });

    it('does not call .update(), recordAuditLog, or sendPoIssuedEmail when PO status is already issued', async () => {
      mockSupabase.selectChain.single.mockResolvedValue({
        data: { status: 'issued' },
        error: null,
      });

      await updatePOStatus('po-456', 'issued');

      // Confirm no database updates - update chain's eq method should not be called
      expect(mockSupabase.updateChain.eq).not.toHaveBeenCalled();
      // Confirm no audit log
      expect(mockRecordAuditLog).not.toHaveBeenCalled();
      // Confirm no email sent
      expect(mockSendPoIssuedEmail).not.toHaveBeenCalled();
    });
  });

  describe('Direct issuance is blocked (4-eyes)', () => {
    it('blocks issuing a draft PO directly and does not update, audit, notify, or email', async () => {
      mockSupabase.selectChain.single.mockResolvedValue({
        data: { status: 'draft' },
        error: null,
      });

      const result = await updatePOStatus('po-789', 'issued');

      expect(result).toEqual({ error: ISSUE_BLOCKED_ERROR });
      // The bypass is closed: nothing is issued via this action.
      expect(mockSupabase.updateChain.eq).not.toHaveBeenCalled();
      expect(mockRecordAuditLog).not.toHaveBeenCalled();
      expect(mockCreateNotification).not.toHaveBeenCalled();
      expect(mockSendPoIssuedEmail).not.toHaveBeenCalled();
    });

    it('blocks issuing a pending_approval PO directly (must use approvePO)', async () => {
      mockSupabase.selectChain.single.mockResolvedValue({
        data: { status: 'pending_approval' },
        error: null,
      });

      const result = await updatePOStatus('po-pending', 'issued');

      expect(result).toEqual({ error: ISSUE_BLOCKED_ERROR });
      expect(mockSupabase.updateChain.eq).not.toHaveBeenCalled();
    });
  });

  describe('Error conditions', () => {
    it('returns authorization error if user lacks po.status capability', async () => {
      mockRequireCapability.mockResolvedValue({
        user: null,
        role: null,
        error: 'User does not have po.status capability',
      });

      const result = await updatePOStatus('po-unauthorized', 'issued');

      expect(result).toEqual({ error: 'User does not have po.status capability' });
      expect(mockSupabase.updateChain.eq).not.toHaveBeenCalled();
    });

    it('returns database error if a non-issued status update fails', async () => {
      mockSupabase.updateChain.eq.mockResolvedValue({
        error: new Error('Database connection failed'),
      });

      const result = await updatePOStatus('po-db-error', 'cancelled');

      expect(result).toEqual({ error: 'Database connection failed' });
    });

    it('allows non-issued status changes (e.g. draft -> cancelled)', async () => {
      const result = await updatePOStatus('po-draft-to-cancelled', 'cancelled');

      // Issuance guard only applies to the 'issued' target; other transitions proceed.
      expect(mockSupabase.updateChain.eq).toHaveBeenCalledWith('id', 'po-draft-to-cancelled');
      expect(result).toEqual({ success: true });
    });
  });
});
