/**
 * Unit tests for updatePOStatus server action
 * Tests idempotency guard that prevents double-click issues on "Issue PO" button
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

describe('updatePOStatus - Idempotency Guard', () => {
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
        data: { status: 'issued', requirements_waived: false, waiver_approved: false },
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
        data: { status: 'issued', requirements_waived: false, waiver_approved: false },
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

  describe('Happy path - transitioning to issued', () => {
    it('updates PO status, logs audit, sends notification and email when transitioning from draft to issued', async () => {
      mockSupabase.selectChain.single.mockResolvedValue({
        data: { status: 'draft', requirements_waived: false, waiver_approved: false },
        error: null,
      });

      const result = await updatePOStatus('po-789', 'issued');

      expect(result).toEqual({ success: true });
      // Verify update was called
      expect(mockSupabase.updateChain.eq).toHaveBeenCalledWith('id', 'po-789');
      // Verify audit log was recorded
      expect(mockRecordAuditLog).toHaveBeenCalled();
      // Verify notification was created
      expect(mockCreateNotification).toHaveBeenCalled();
      // Verify email was sent
      expect(mockSendPoIssuedEmail).toHaveBeenCalledWith('po-789', { actorId: 'user-123' });
    });

    it('returns success with emailWarning if email send fails but PO is issued', async () => {
      mockSupabase.selectChain.single.mockResolvedValue({
        data: { status: 'draft', requirements_waived: false, waiver_approved: false },
        error: null,
      });
      mockSendPoIssuedEmail.mockResolvedValue({
        status: 'failed',
        error: 'Email service unavailable',
      });

      const result = await updatePOStatus('po-email-fail', 'issued');

      expect(result.success).toBe(true);
      expect(result.emailWarning).toBe('Email service unavailable');
      // PO should still be updated
      expect(mockSupabase.updateChain.eq).toHaveBeenCalled();
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

    it('returns error when PO has waived requirements but waiver is not approved', async () => {
      mockSupabase.selectChain.single.mockResolvedValue({
        data: {
          status: 'draft',
          requirements_waived: true,
          waiver_approved: false,
        },
        error: null,
      });

      const result = await updatePOStatus('po-waiver-pending', 'issued');

      expect(result).toEqual({
        error: 'Cannot issue: this PO has waived requirements pending executive approval.',
      });
      // Should not proceed to update
      expect(mockSupabase.updateChain.eq).not.toHaveBeenCalled();
    });

    it('returns database error if update fails', async () => {
      mockSupabase.selectChain.single.mockResolvedValue({
        data: { status: 'draft', requirements_waived: false, waiver_approved: false },
        error: null,
      });
      mockSupabase.updateChain.eq.mockResolvedValue({
        error: new Error('Database connection failed'),
      });

      const result = await updatePOStatus('po-db-error', 'issued');

      expect(result).toEqual({ error: 'Database connection failed' });
    });

    it('allows non-issued status changes without idempotency check', async () => {
      mockSupabase.selectChain.single.mockResolvedValue({
        data: { status: 'draft', requirements_waived: false, waiver_approved: false },
        error: null,
      });

      const result = await updatePOStatus('po-draft-to-cancelled', 'cancelled');

      // Idempotency guard only applies to 'issued' status
      expect(mockSupabase.updateChain.eq).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });
  });

  describe('Regression - double-click scenario', () => {
    it('handles two rapid issue calls on the same PO (simulating double-click)', async () => {
      let callCount = 0;

      mockSupabase.selectChain.single.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call: PO is draft
          return Promise.resolve({
            data: { status: 'draft', requirements_waived: false, waiver_approved: false },
            error: null,
          });
        } else {
          // Second call: PO is now issued (from first call's update)
          return Promise.resolve({
            data: { status: 'issued', requirements_waived: false, waiver_approved: false },
            error: null,
          });
        }
      });

      // First click - transitions to issued
      const result1 = await updatePOStatus('po-double-click', 'issued');
      expect(result1).toEqual({ success: true });
      expect(mockSupabase.updateChain.eq).toHaveBeenCalledTimes(1);
      expect(mockRecordAuditLog).toHaveBeenCalledTimes(1);

      // Reset mock counts for second call
      jest.clearAllMocks();
      mockSupabase.updateChain.eq.mockClear();
      mockRecordAuditLog.mockClear();

      // Re-setup the mock to return issued status
      mockSupabase.selectChain.single.mockResolvedValue({
        data: { status: 'issued', requirements_waived: false, waiver_approved: false },
        error: null,
      });

      // Second click - idempotency guard prevents duplicate action
      const result2 = await updatePOStatus('po-double-click', 'issued');
      expect(result2).toEqual({ success: true });
      // No update call on second click
      expect(mockSupabase.updateChain.eq).not.toHaveBeenCalled();
      // No audit log on second click
      expect(mockRecordAuditLog).not.toHaveBeenCalled();
    });
  });
});
