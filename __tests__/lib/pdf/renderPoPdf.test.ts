/**
 * Unit tests for renderPoPdf
 * Verifies PDF rendering, filename transformation, and error propagation
 */

import { renderPoPdf } from '@/lib/pdf/renderPoPdf';
import { resolvePoDocx } from '@/lib/docx/resolvePoDocx';
import { convertDocxToPdf } from '@/lib/pdf/convertDocxToPdf';

// Mock dependencies
jest.mock('@/lib/docx/resolvePoDocx');
jest.mock('@/lib/pdf/convertDocxToPdf');
jest.mock('server-only', () => ({}));

describe('renderPoPdf', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('happy path', () => {
    it('returns buffer and filename when both dependencies succeed', async () => {
      const mockDocxBuffer = Buffer.from('mock docx content');
      const mockPdfBuffer = Buffer.from('mock pdf content');

      (resolvePoDocx as jest.Mock).mockResolvedValue({
        buffer: mockDocxBuffer,
        filename: 'PO_ABC123.docx',
      });

      (convertDocxToPdf as jest.Mock).mockResolvedValue(mockPdfBuffer);

      const result = await renderPoPdf('test-po-id');

      expect(result).toEqual({
        buffer: mockPdfBuffer,
        filename: 'PO_ABC123.pdf',
      });
    });

    it('transforms filename from .docx to .pdf', async () => {
      const mockDocxBuffer = Buffer.from('docx');
      const mockPdfBuffer = Buffer.from('pdf');

      (resolvePoDocx as jest.Mock).mockResolvedValue({
        buffer: mockDocxBuffer,
        filename: 'PO_XYZ789.docx',
      });

      (convertDocxToPdf as jest.Mock).mockResolvedValue(mockPdfBuffer);

      const result = await renderPoPdf('test-id');

      expect(result.filename).toBe('PO_XYZ789.pdf');
    });

    it('handles case-insensitive .docx extension', async () => {
      const mockDocxBuffer = Buffer.from('docx');
      const mockPdfBuffer = Buffer.from('pdf');

      (resolvePoDocx as jest.Mock).mockResolvedValue({
        buffer: mockDocxBuffer,
        filename: 'PO_TEST.DOCX', // uppercase
      });

      (convertDocxToPdf as jest.Mock).mockResolvedValue(mockPdfBuffer);

      const result = await renderPoPdf('test-id');

      expect(result.filename).toBe('PO_TEST.pdf');
    });
  });

  describe('error propagation from resolvePoDocx', () => {
    it('propagates error when resolvePoDocx throws', async () => {
      const testError = new Error('Failed to download stored DOCX');

      (resolvePoDocx as jest.Mock).mockRejectedValue(testError);

      await expect(renderPoPdf('test-id')).rejects.toThrow('Failed to download stored DOCX');
    });

    it('does not catch error from resolvePoDocx', async () => {
      const testError = new Error('Custom resolve error');

      (resolvePoDocx as jest.Mock).mockRejectedValue(testError);

      await expect(renderPoPdf('test-id')).rejects.toBe(testError);
    });
  });

  describe('error propagation from convertDocxToPdf', () => {
    it('propagates error when convertDocxToPdf throws', async () => {
      const mockDocxBuffer = Buffer.from('docx');
      const testError = new Error('ConvertAPI error 401: Unauthorized');

      (resolvePoDocx as jest.Mock).mockResolvedValue({
        buffer: mockDocxBuffer,
        filename: 'PO_ABC.docx',
      });

      (convertDocxToPdf as jest.Mock).mockRejectedValue(testError);

      await expect(renderPoPdf('test-id')).rejects.toThrow('ConvertAPI error 401: Unauthorized');
    });

    it('does not catch error from convertDocxToPdf', async () => {
      const mockDocxBuffer = Buffer.from('docx');
      const testError = new Error('Custom conversion error');

      (resolvePoDocx as jest.Mock).mockResolvedValue({
        buffer: mockDocxBuffer,
        filename: 'PO_ABC.docx',
      });

      (convertDocxToPdf as jest.Mock).mockRejectedValue(testError);

      await expect(renderPoPdf('test-id')).rejects.toBe(testError);
    });
  });

  describe('integration with dependencies', () => {
    it('calls resolvePoDocx with correct poId', async () => {
      const poId = 'po-uuid-12345';
      const mockDocxBuffer = Buffer.from('docx');
      const mockPdfBuffer = Buffer.from('pdf');

      (resolvePoDocx as jest.Mock).mockResolvedValue({
        buffer: mockDocxBuffer,
        filename: 'PO_ABC.docx',
      });

      (convertDocxToPdf as jest.Mock).mockResolvedValue(mockPdfBuffer);

      await renderPoPdf(poId);

      expect(resolvePoDocx).toHaveBeenCalledWith(poId);
    });

    it('calls convertDocxToPdf with buffer and filename from resolvePoDocx', async () => {
      const mockDocxBuffer = Buffer.from('docx content');
      const mockPdfBuffer = Buffer.from('pdf content');
      const docxFilename = 'PO_ABC.docx';

      (resolvePoDocx as jest.Mock).mockResolvedValue({
        buffer: mockDocxBuffer,
        filename: docxFilename,
      });

      (convertDocxToPdf as jest.Mock).mockResolvedValue(mockPdfBuffer);

      await renderPoPdf('test-id');

      expect(convertDocxToPdf).toHaveBeenCalledWith(mockDocxBuffer, docxFilename);
    });
  });
});
