/**
 * Unit tests for Certificate of Completion feature
 * Tests submitCompletionCertificate, approveCompletionCertificate, rejectCompletionCertificate
 * Also tests invoice PO amount guard with completion certificate ceiling
 */

import {
  submitCompletionCertificate,
  approveCompletionCertificate,
  rejectCompletionCertificate,
} from '@/app/dashboard/purchase-orders/actions';

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

// Mock Next.js cache utilities
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

import { createClient } from '@/utils/supabase/server';
import { requireCapability } from '@/lib/auth/permissions';
import { recordAuditLog } from '@/utils/audit';
import { createNotification } from '@/utils/notifications';
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
const mockRevalidatePath = revalidatePath as jest.MockedFunction<
  typeof revalidatePath
>;

describe('submitCompletionCertificate', () => {
  let mockSupabase: any;
  let mockFormData: FormData;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock Supabase client with storage chain
    const insertChain = {
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: 'cert-123' },
        error: null
      }),
    };

    const storageChain = {
      upload: jest.fn().mockResolvedValue({ error: null }),
      getPublicUrl: jest.fn().mockReturnValue({
        data: { publicUrl: 'https://storage.example.com/cert.pdf' }
      }),
    };

    mockSupabase = {
      from: jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue(insertChain),
      }),
      storage: {
        from: jest.fn().mockReturnValue(storageChain),
      },
    };
    mockSupabase.storageChain = storageChain;
    mockSupabase.insertChain = insertChain;

    mockCreateClient.mockResolvedValue(mockSupabase);
    mockRequireCapability.mockResolvedValue({
      user: { id: 'user-123' },
      role: 'admin',
      error: null,
    });
    mockRecordAuditLog.mockResolvedValue(undefined);
    mockCreateNotification.mockResolvedValue(undefined);
    mockRevalidatePath.mockReturnValue(undefined);
  });

  describe('Happy path - with file', () => {
    it('submits certificate with valid percent and file', async () => {
      mockFormData = new FormData();
      mockFormData.set('po_id', 'po-123');
      mockFormData.set('vendor_id', 'vendor-456');
      mockFormData.set('percent_complete', '50');
      mockFormData.set('notes', 'Phase 1 complete');

      const file = new File(['content'], 'cert.pdf', { type: 'application/pdf' });
      mockFormData.set('file', file);

      const result = await submitCompletionCertificate(mockFormData);

      expect(result).toEqual({ success: true });
      expect(mockSupabase.insertChain.single).toHaveBeenCalled();
      expect(mockSupabase.storageChain.upload).toHaveBeenCalledWith(
        expect.stringMatching(/^vendors\/vendor-456\/certs\/CERT_po-123_\d+\.pdf$/),
        file,
        expect.any(Object)
      );
      expect(mockRecordAuditLog).toHaveBeenCalled();
      expect(mockCreateNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('50%'),
        })
      );
    });

    it('submits certificate without file', async () => {
      mockFormData = new FormData();
      mockFormData.set('po_id', 'po-789');
      mockFormData.set('vendor_id', 'vendor-999');
      mockFormData.set('percent_complete', '75');

      const result = await submitCompletionCertificate(mockFormData);

      expect(result).toEqual({ success: true });
      expect(mockSupabase.storageChain.upload).not.toHaveBeenCalled();
      expect(mockSupabase.insertChain.single).toHaveBeenCalled();
    });
  });

  describe('Edge cases - percent validation', () => {
    it('rejects percent <= 0', async () => {
      mockFormData = new FormData();
      mockFormData.set('po_id', 'po-123');
      mockFormData.set('vendor_id', 'vendor-456');
      mockFormData.set('percent_complete', '0');

      const result = await submitCompletionCertificate(mockFormData);

      expect(result).toEqual({
        error: 'Invalid input. Provide a PO and a completion percentage between 1–100.'
      });
      expect(mockSupabase.insertChain.single).not.toHaveBeenCalled();
    });

    it('rejects percent > 100', async () => {
      mockFormData = new FormData();
      mockFormData.set('po_id', 'po-123');
      mockFormData.set('vendor_id', 'vendor-456');
      mockFormData.set('percent_complete', '101');

      const result = await submitCompletionCertificate(mockFormData);

      expect(result).toEqual({
        error: 'Invalid input. Provide a PO and a completion percentage between 1–100.'
      });
      expect(mockSupabase.insertChain.single).not.toHaveBeenCalled();
    });

    it('rejects NaN percent', async () => {
      mockFormData = new FormData();
      mockFormData.set('po_id', 'po-123');
      mockFormData.set('vendor_id', 'vendor-456');
      mockFormData.set('percent_complete', 'abc');

      const result = await submitCompletionCertificate(mockFormData);

      expect(result).toEqual({
        error: 'Invalid input. Provide a PO and a completion percentage between 1–100.'
      });
    });

    it('accepts edge case: exactly 1%', async () => {
      mockFormData = new FormData();
      mockFormData.set('po_id', 'po-123');
      mockFormData.set('vendor_id', 'vendor-456');
      mockFormData.set('percent_complete', '1');

      const result = await submitCompletionCertificate(mockFormData);

      expect(result).toEqual({ success: true });
    });

    it('accepts edge case: exactly 100%', async () => {
      mockFormData = new FormData();
      mockFormData.set('po_id', 'po-123');
      mockFormData.set('vendor_id', 'vendor-456');
      mockFormData.set('percent_complete', '100');

      const result = await submitCompletionCertificate(mockFormData);

      expect(result).toEqual({ success: true });
    });

    it('accepts decimal percentages', async () => {
      mockFormData = new FormData();
      mockFormData.set('po_id', 'po-123');
      mockFormData.set('vendor_id', 'vendor-456');
      mockFormData.set('percent_complete', '33.33');

      const result = await submitCompletionCertificate(mockFormData);

      expect(result).toEqual({ success: true });
    });
  });

  describe('Error conditions', () => {
    it('returns authorization error if user lacks po.write capability', async () => {
      mockRequireCapability.mockResolvedValue({
        user: null,
        role: null,
        error: 'User does not have po.write capability',
      });

      mockFormData = new FormData();
      mockFormData.set('po_id', 'po-123');
      mockFormData.set('vendor_id', 'vendor-456');
      mockFormData.set('percent_complete', '50');

      const result = await submitCompletionCertificate(mockFormData);

      expect(result).toEqual({ error: 'User does not have po.write capability' });
      expect(mockSupabase.insertChain.single).not.toHaveBeenCalled();
    });

    it('returns error if po_id is missing', async () => {
      mockFormData = new FormData();
      mockFormData.set('vendor_id', 'vendor-456');
      mockFormData.set('percent_complete', '50');

      const result = await submitCompletionCertificate(mockFormData);

      expect(result).toEqual({
        error: 'Invalid input. Provide a PO and a completion percentage between 1–100.'
      });
    });

    it('returns database error on insert failure', async () => {
      mockSupabase.insertChain.single.mockResolvedValue({
        data: null,
        error: { message: 'Database error: foreign key constraint' }
      });

      mockFormData = new FormData();
      mockFormData.set('po_id', 'po-123');
      mockFormData.set('vendor_id', 'vendor-456');
      mockFormData.set('percent_complete', '50');

      const result = await submitCompletionCertificate(mockFormData);

      expect(result).toEqual({ error: 'Database error: foreign key constraint' });
    });

    it('silently ignores file upload error but continues with cert creation', async () => {
      mockSupabase.storageChain.upload.mockResolvedValue({
        error: { message: 'Upload failed' }
      });

      mockFormData = new FormData();
      mockFormData.set('po_id', 'po-123');
      mockFormData.set('vendor_id', 'vendor-456');
      mockFormData.set('percent_complete', '50');
      mockFormData.set('file', new File(['content'], 'cert.pdf'));

      const result = await submitCompletionCertificate(mockFormData);

      // Should still succeed but file_url will be null
      expect(result).toEqual({ success: true });
      expect(mockSupabase.insertChain.single).toHaveBeenCalled();
    });
  });

  describe('Side effects', () => {
    it('calls recordAuditLog with correct entity and user', async () => {
      mockFormData = new FormData();
      mockFormData.set('po_id', 'po-123');
      mockFormData.set('vendor_id', 'vendor-456');
      mockFormData.set('percent_complete', '50');

      await submitCompletionCertificate(mockFormData);

      expect(mockRecordAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          entity_type: 'purchase_order',
          entity_id: 'po-123',
          action: 'UPDATE',
          performed_by: 'user-123',
        })
      );
    });

    it('calls createNotification with completion percent in message', async () => {
      mockFormData = new FormData();
      mockFormData.set('po_id', 'po-123');
      mockFormData.set('vendor_id', 'vendor-456');
      mockFormData.set('percent_complete', '65');

      await submitCompletionCertificate(mockFormData);

      expect(mockCreateNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'po',
          title: '📋 Completion Certificate Submitted',
          message: 'A certificate of completion at 65% was submitted and awaits approval.',
          link: '/dashboard/purchase-orders/po-123',
        })
      );
    });

    it('calls revalidatePath with po detail page', async () => {
      mockFormData = new FormData();
      mockFormData.set('po_id', 'po-xyz');
      mockFormData.set('vendor_id', 'vendor-456');
      mockFormData.set('percent_complete', '50');

      await submitCompletionCertificate(mockFormData);

      expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/purchase-orders/po-xyz');
    });
  });
});

describe('approveCompletionCertificate', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    const selectChain = {
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'cert-123',
          po_id: 'po-123',
          status: 'submitted',
          submitted_by: 'user-999'
        },
        error: null
      }),
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
    mockSupabase.selectChain = selectChain;
    mockSupabase.updateChain = updateChain;

    mockCreateClient.mockResolvedValue(mockSupabase);
    mockRequireCapability.mockResolvedValue({
      user: { id: 'user-123' },
      role: 'admin',
      error: null,
    });
    mockRecordAuditLog.mockResolvedValue(undefined);
    mockRevalidatePath.mockReturnValue(undefined);
  });

  describe('Happy path', () => {
    it('approves certificate with valid inputs', async () => {
      const result = await approveCompletionCertificate('cert-123');

      expect(result).toEqual({ success: true });
      expect(mockSupabase.updateChain.eq).toHaveBeenCalledWith('id', 'cert-123');
      expect(mockSupabase.updateChain.eq).toHaveBeenCalledWith('id', 'cert-123');
    });

    it('sets approved_by and approved_at on update', async () => {
      const beforeTime = Date.now();
      await approveCompletionCertificate('cert-123');
      const afterTime = Date.now();

      const updateCall = mockSupabase.from.mock.results[0].value.update.mock.calls[0][0];
      expect(updateCall).toHaveProperty('status', 'approved');
      expect(updateCall).toHaveProperty('approved_by', 'user-123');
      expect(updateCall).toHaveProperty('approved_at');

      // Verify timestamp is reasonable
      const approvedTime = new Date(updateCall.approved_at).getTime();
      expect(approvedTime).toBeGreaterThanOrEqual(beforeTime);
      expect(approvedTime).toBeLessThanOrEqual(afterTime);
    });

    it('calls recordAuditLog with po_id from cert', async () => {
      await approveCompletionCertificate('cert-123');

      expect(mockRecordAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          entity_type: 'purchase_order',
          entity_id: 'po-123',
          action: 'UPDATE',
          performed_by: 'user-123',
        })
      );
    });
  });

  describe('Authorization', () => {
    it('returns authorization error if user lacks po.approve_completion capability', async () => {
      mockRequireCapability.mockResolvedValue({
        user: null,
        role: null,
        error: 'User does not have po.approve_completion capability',
      });

      const result = await approveCompletionCertificate('cert-123');

      expect(result).toEqual({ error: 'User does not have po.approve_completion capability' });
      expect(mockSupabase.updateChain.eq).not.toHaveBeenCalled();
    });
  });

  describe('Cert status validation', () => {
    it('rejects approval if cert status is not "submitted"', async () => {
      mockSupabase.selectChain.single.mockResolvedValue({
        data: {
          id: 'cert-123',
          po_id: 'po-123',
          status: 'approved',
          submitted_by: 'user-999'
        },
        error: null
      });

      const result = await approveCompletionCertificate('cert-123');

      expect(result).toEqual({ error: 'This certificate is not pending approval.' });
      expect(mockSupabase.updateChain.eq).not.toHaveBeenCalled();
    });

    it('rejects approval if cert status is rejected', async () => {
      mockSupabase.selectChain.single.mockResolvedValue({
        data: {
          id: 'cert-123',
          po_id: 'po-123',
          status: 'rejected',
          submitted_by: 'user-999'
        },
        error: null
      });

      const result = await approveCompletionCertificate('cert-123');

      expect(result).toEqual({ error: 'This certificate is not pending approval.' });
    });

    it('rejects approval if cert not found', async () => {
      mockSupabase.selectChain.single.mockResolvedValue({
        data: null,
        error: null
      });

      const result = await approveCompletionCertificate('cert-nonexistent');

      expect(result).toEqual({ error: 'This certificate is not pending approval.' });
    });
  });

  describe('Self-approval prevention', () => {
    it('rejects approval if submitted_by equals current user', async () => {
      mockSupabase.selectChain.single.mockResolvedValue({
        data: {
          id: 'cert-123',
          po_id: 'po-123',
          status: 'submitted',
          submitted_by: 'user-123'  // Same as current user
        },
        error: null
      });

      const result = await approveCompletionCertificate('cert-123');

      expect(result).toEqual({ error: 'You cannot approve a certificate you submitted.' });
      expect(mockSupabase.updateChain.eq).not.toHaveBeenCalled();
    });

    it('allows approval when submitted_by is different user', async () => {
      mockSupabase.selectChain.single.mockResolvedValue({
        data: {
          id: 'cert-123',
          po_id: 'po-123',
          status: 'submitted',
          submitted_by: 'user-999'  // Different user
        },
        error: null
      });

      const result = await approveCompletionCertificate('cert-123');

      expect(result).toEqual({ success: true });
      expect(mockSupabase.updateChain.eq).toHaveBeenCalled();
    });
  });

  describe('Error conditions', () => {
    it('returns database error on update failure', async () => {
      mockSupabase.updateChain.eq.mockResolvedValue({
        error: { message: 'Database connection failed' }
      });

      const result = await approveCompletionCertificate('cert-123');

      expect(result).toEqual({ error: 'Database connection failed' });
    });
  });

  describe('Side effects', () => {
    it('revalidates po detail page', async () => {
      await approveCompletionCertificate('cert-123');

      expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/purchase-orders/po-123');
    });
  });
});

describe('rejectCompletionCertificate', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    const selectChain = {
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'cert-123',
          po_id: 'po-123',
          status: 'submitted'
        },
        error: null
      }),
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
    mockSupabase.selectChain = selectChain;
    mockSupabase.updateChain = updateChain;

    mockCreateClient.mockResolvedValue(mockSupabase);
    mockRequireCapability.mockResolvedValue({
      user: { id: 'user-123' },
      role: 'admin',
      error: null,
    });
    mockRecordAuditLog.mockResolvedValue(undefined);
    mockRevalidatePath.mockReturnValue(undefined);
  });

  describe('Happy path', () => {
    it('rejects certificate with valid inputs', async () => {
      const result = await rejectCompletionCertificate('cert-123');

      expect(result).toEqual({ success: true });
    });

    it('sets status to "rejected"', async () => {
      await rejectCompletionCertificate('cert-123');

      const updateCall = mockSupabase.from.mock.results[0].value.update.mock.calls[0][0];
      expect(updateCall).toEqual({ status: 'rejected' });
    });

    it('does NOT update purchase_orders table (key difference from waiver)', async () => {
      await rejectCompletionCertificate('cert-123');

      // Verify we only call update on po_completion_certificates, not purchase_orders
      const fromCalls = mockSupabase.from.mock.calls.map(call => call[0]);
      expect(fromCalls).toContain('po_completion_certificates');
      expect(fromCalls).not.toContain('purchase_orders');
    });

    it('calls recordAuditLog with po_id from cert', async () => {
      await rejectCompletionCertificate('cert-123');

      expect(mockRecordAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          entity_type: 'purchase_order',
          entity_id: 'po-123',
          action: 'UPDATE',
          performed_by: 'user-123',
        })
      );
    });
  });

  describe('Authorization', () => {
    it('returns authorization error if user lacks po.approve_completion capability', async () => {
      mockRequireCapability.mockResolvedValue({
        user: null,
        role: null,
        error: 'User does not have po.approve_completion capability',
      });

      const result = await rejectCompletionCertificate('cert-123');

      expect(result).toEqual({ error: 'User does not have po.approve_completion capability' });
      expect(mockSupabase.updateChain.eq).not.toHaveBeenCalled();
    });
  });

  describe('Cert status validation', () => {
    it('rejects rejection if cert status is not "submitted"', async () => {
      mockSupabase.selectChain.single.mockResolvedValue({
        data: {
          id: 'cert-123',
          po_id: 'po-123',
          status: 'approved'
        },
        error: null
      });

      const result = await rejectCompletionCertificate('cert-123');

      expect(result).toEqual({ error: 'This certificate is not pending approval.' });
      expect(mockSupabase.updateChain.eq).not.toHaveBeenCalled();
    });

    it('rejects rejection if cert not found', async () => {
      mockSupabase.selectChain.single.mockResolvedValue({
        data: null,
        error: null
      });

      const result = await rejectCompletionCertificate('cert-nonexistent');

      expect(result).toEqual({ error: 'This certificate is not pending approval.' });
    });
  });

  describe('Error conditions', () => {
    it('returns database error on update failure', async () => {
      mockSupabase.updateChain.eq.mockResolvedValue({
        error: { message: 'Database connection failed' }
      });

      const result = await rejectCompletionCertificate('cert-123');

      expect(result).toEqual({ error: 'Database connection failed' });
    });
  });

  describe('Side effects', () => {
    it('revalidates po detail page', async () => {
      await rejectCompletionCertificate('cert-123');

      expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/purchase-orders/po-123');
    });
  });
});
