/** @jest-environment node */

/**
 * Unit tests for GET /api/purchase-orders/[id]/pdf route
 * Verifies authentication, PDF generation, and error handling
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/purchase-orders/[id]/pdf/route';
import { renderPoPdf } from '@/lib/pdf/renderPoPdf';
import { getCurrentProfile } from '@/lib/auth/permissions';

jest.mock('@/lib/pdf/renderPoPdf');
jest.mock('@/lib/auth/permissions');

describe('GET /api/purchase-orders/[id]/pdf', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  describe('authentication', () => {
    it('returns 401 Unauthorized when not authenticated', async () => {
      (getCurrentProfile as jest.Mock).mockResolvedValue({
        error: 'Unauthorized',
      });

      const request = new NextRequest('http://localhost:3000/api/purchase-orders/test-id/pdf');
      const params = Promise.resolve({ id: 'test-id' });

      const response = await GET(request, { params });

      expect(response.status).toBe(401);
      expect(await response.text()).toBe('Unauthorized');
    });

    it('returns 401 when getCurrentProfile returns error', async () => {
      (getCurrentProfile as jest.Mock).mockResolvedValue({
        error: 'User profile was not found.',
      });

      const request = new NextRequest('http://localhost:3000/api/purchase-orders/test-id/pdf');
      const params = Promise.resolve({ id: 'test-id' });

      const response = await GET(request, { params });

      expect(response.status).toBe(401);
    });
  });

  describe('successful PDF generation', () => {
    beforeEach(() => {
      (getCurrentProfile as jest.Mock).mockResolvedValue({
        error: null,
        user: { id: 'user-123' },
      });
    });

    it('returns 200 with correct Content-Type header', async () => {
      const mockBuffer = Buffer.from('PDF content');

      (renderPoPdf as jest.Mock).mockResolvedValue({
        buffer: mockBuffer,
        filename: 'PO_ABC123.pdf',
      });

      const request = new NextRequest('http://localhost:3000/api/purchase-orders/test-id/pdf');
      const params = Promise.resolve({ id: 'test-id' });

      const response = await GET(request, { params });

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/pdf');
    });

    it('returns 200 with Content-Disposition inline header', async () => {
      const mockBuffer = Buffer.from('PDF content');
      const filename = 'PO_ABC123.pdf';

      (renderPoPdf as jest.Mock).mockResolvedValue({
        buffer: mockBuffer,
        filename,
      });

      const request = new NextRequest('http://localhost:3000/api/purchase-orders/test-id/pdf');
      const params = Promise.resolve({ id: 'test-id' });

      const response = await GET(request, { params });

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Disposition')).toBe(`inline; filename="${filename}"`);
    });

    it('returns 200 with Content-Length header', async () => {
      const mockBuffer = Buffer.from('PDF content');

      (renderPoPdf as jest.Mock).mockResolvedValue({
        buffer: mockBuffer,
        filename: 'PO_ABC123.pdf',
      });

      const request = new NextRequest('http://localhost:3000/api/purchase-orders/test-id/pdf');
      const params = Promise.resolve({ id: 'test-id' });

      const response = await GET(request, { params });

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Length')).toBe(String(mockBuffer.byteLength));
    });

    it('returns buffer as response body', async () => {
      const mockBuffer = Buffer.from('PDF content');

      (renderPoPdf as jest.Mock).mockResolvedValue({
        buffer: mockBuffer,
        filename: 'PO_ABC123.pdf',
      });

      const request = new NextRequest('http://localhost:3000/api/purchase-orders/test-id/pdf');
      const params = Promise.resolve({ id: 'test-id' });

      const response = await GET(request, { params });

      expect(response.status).toBe(200);
      // Buffer is sent as body
      expect(response.body).toBeDefined();
    });

    it('calls renderPoPdf with correct id from params', async () => {
      const testId = 'specific-po-uuid';
      const mockBuffer = Buffer.from('PDF');

      (renderPoPdf as jest.Mock).mockResolvedValue({
        buffer: mockBuffer,
        filename: 'PO_ABC123.pdf',
      });

      const request = new NextRequest('http://localhost:3000/api/purchase-orders/test-id/pdf');
      const params = Promise.resolve({ id: testId });

      await GET(request, { params });

      expect(renderPoPdf).toHaveBeenCalledWith(testId);
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      (getCurrentProfile as jest.Mock).mockResolvedValue({
        error: null,
        user: { id: 'user-123' },
      });
    });

    it('returns 500 with JSON error when renderPoPdf throws', async () => {
      (renderPoPdf as jest.Mock).mockRejectedValue(
        new Error('Purchase order not found')
      );

      const request = new NextRequest('http://localhost:3000/api/purchase-orders/test-id/pdf');
      const params = Promise.resolve({ id: 'test-id' });

      const response = await GET(request, { params });

      expect(response.status).toBe(500);
      expect(response.headers.get('Content-Type')).toBe('application/json');

      const body = await response.json();
      expect(body).toEqual({ error: 'Purchase order not found' });
    });

    it('returns 500 with default message when error has no message', async () => {
      const errorWithoutMessage = new Error();
      (renderPoPdf as jest.Mock).mockRejectedValue(errorWithoutMessage);

      const request = new NextRequest('http://localhost:3000/api/purchase-orders/test-id/pdf');
      const params = Promise.resolve({ id: 'test-id' });

      const response = await GET(request, { params });

      expect(response.status).toBe(500);

      const body = await response.json();
      expect(body).toEqual({ error: 'Failed to generate PDF' });
    });

    it('returns 500 when renderPoPdf throws with specific error message', async () => {
      (renderPoPdf as jest.Mock).mockRejectedValue(
        new Error('ConvertAPI error 401: Unauthorized')
      );

      const request = new NextRequest('http://localhost:3000/api/purchase-orders/test-id/pdf');
      const params = Promise.resolve({ id: 'test-id' });

      const response = await GET(request, { params });

      expect(response.status).toBe(500);

      const body = await response.json();
      expect(body.error).toContain('ConvertAPI error');
    });

    it('logs error to console when exception occurs', async () => {
      const testError = new Error('Test error message');
      (renderPoPdf as jest.Mock).mockRejectedValue(testError);

      const request = new NextRequest('http://localhost:3000/api/purchase-orders/test-id/pdf');
      const params = Promise.resolve({ id: 'test-id' });

      await GET(request, { params });

      expect(console.error).toHaveBeenCalledWith('PO PDF generation error:', testError);
    });

    it('returns 500 when renderPoPdf throws with non-Error object', async () => {
      // Sometimes thrown objects are not Error instances
      (renderPoPdf as jest.Mock).mockRejectedValue({ custom: 'error' });

      const request = new NextRequest('http://localhost:3000/api/purchase-orders/test-id/pdf');
      const params = Promise.resolve({ id: 'test-id' });

      const response = await GET(request, { params });

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe('Failed to generate PDF');
    });
  });

  describe('integration', () => {
    it('completes full happy path: auth → PDF generation → response', async () => {
      (getCurrentProfile as jest.Mock).mockResolvedValue({
        error: null,
        user: { id: 'user-123' },
      });

      const mockBuffer = Buffer.from('PDF content here');
      (renderPoPdf as jest.Mock).mockResolvedValue({
        buffer: mockBuffer,
        filename: 'PO_ABC123.pdf',
      });

      const request = new NextRequest('http://localhost:3000/api/purchase-orders/test-id/pdf');
      const params = Promise.resolve({ id: 'test-id' });

      const response = await GET(request, { params });

      // All assertions together
      expect(getCurrentProfile).toHaveBeenCalled();
      expect(renderPoPdf).toHaveBeenCalledWith('test-id');
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/pdf');
      expect(response.headers.get('Content-Disposition')).toContain('PO_ABC123.pdf');
    });

    it('stops at auth check and does not call renderPoPdf when unauthenticated', async () => {
      (getCurrentProfile as jest.Mock).mockResolvedValue({
        error: 'Unauthorized',
      });

      const request = new NextRequest('http://localhost:3000/api/purchase-orders/test-id/pdf');
      const params = Promise.resolve({ id: 'test-id' });

      await GET(request, { params });

      expect(renderPoPdf).not.toHaveBeenCalled();
    });

    it('calls getCurrentProfile once per request', async () => {
      (getCurrentProfile as jest.Mock).mockResolvedValue({
        error: null,
        user: { id: 'user-123' },
      });

      const mockBuffer = Buffer.from('PDF');
      (renderPoPdf as jest.Mock).mockResolvedValue({
        buffer: mockBuffer,
        filename: 'PO_ABC123.pdf',
      });

      const request = new NextRequest('http://localhost:3000/api/purchase-orders/test-id/pdf');
      const params = Promise.resolve({ id: 'test-id' });

      await GET(request, { params });

      expect(getCurrentProfile).toHaveBeenCalledTimes(1);
    });
  });
});
