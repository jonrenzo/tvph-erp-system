/**
 * Unit tests for PoIssueButton client component
 * Tests UI state management during async action and error handling
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PoIssueButton } from '@/components/dashboard/purchase-orders/po-issue-button';

// Mock server actions
jest.mock('@/app/dashboard/purchase-orders/actions', () => ({
  updatePOStatus: jest.fn(),
  submitPOForApproval: jest.fn(),
}));

// Mock useRouter
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Send: () => <div data-testid="send-icon">Send</div>,
  Loader2: () => <div data-testid="loader-icon">Loader</div>,
  Clock: () => <div data-testid="clock-icon">Clock</div>,
}));

import { updatePOStatus } from '@/app/dashboard/purchase-orders/actions';
import { useRouter } from 'next/navigation';

const mockUpdatePOStatus = updatePOStatus as jest.MockedFunction<typeof updatePOStatus>;
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;

describe('PoIssueButton', () => {
  const mockRouter = {
    refresh: jest.fn(),
    push: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    prefetch: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue(mockRouter as any);
    mockUpdatePOStatus.mockResolvedValue({ success: true });
  });

  describe('Initial render', () => {
    it('renders button with "Issue PO" text initially', () => {
      render(<PoIssueButton isAdmin={true} poId="po-123" />);

      const button = screen.getByRole('button', { name: /issue po/i });
      expect(button).toBeInTheDocument();
      expect(button).not.toBeDisabled();
    });

    it('renders Send icon initially, not Loader', () => {
      render(<PoIssueButton isAdmin={true} poId="po-123" />);

      expect(screen.getByTestId('send-icon')).toBeInTheDocument();
      expect(screen.queryByTestId('loader-icon')).not.toBeInTheDocument();
    });

    it('does not show error message initially', () => {
      render(<PoIssueButton isAdmin={true} poId="po-123" />);

      const errorSpans = screen.queryAllByText(/text-red-600|text-red-400/);
      expect(errorSpans).toHaveLength(0);
    });
  });

  describe('On click - pending state', () => {
    it('disables button while action is pending', async () => {
      mockUpdatePOStatus.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ success: true }), 100)
          )
      );

      render(<PoIssueButton isAdmin={true} poId="po-123" />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      // Button should be disabled immediately
      await waitFor(() => {
        expect(button).toBeDisabled();
      });

      // Text should change to "Issuing…"
      expect(screen.getByText('Issuing…')).toBeInTheDocument();
    });

    it('shows Loader2 spinner while pending', async () => {
      mockUpdatePOStatus.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ success: true }), 100)
          )
      );

      render(<PoIssueButton isAdmin={true} poId="po-123" />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
      });
    });
  });

  describe('On success', () => {
    it('calls updatePOStatus with correct poId and "issued" status', async () => {
      render(<PoIssueButton isAdmin={true} poId="po-xyz" />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockUpdatePOStatus).toHaveBeenCalledWith('po-xyz', 'issued');
      });
    });

    it('calls router.refresh() on successful action', async () => {
      render(<PoIssueButton isAdmin={true} poId="po-123" />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockRouter.refresh).toHaveBeenCalled();
      });
    });

    it('re-enables button after successful action', async () => {
      render(<PoIssueButton isAdmin={true} poId="po-123" />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(button).not.toBeDisabled();
      });
    });

    it('returns to Send icon and "Issue PO" text after success', async () => {
      render(<PoIssueButton isAdmin={true} poId="po-123" />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.queryByTestId('loader-icon')).not.toBeInTheDocument();
        expect(screen.getByTestId('send-icon')).toBeInTheDocument();
        expect(screen.getByText('Issue PO')).toBeInTheDocument();
      });
    });

    it('does not display error message on success', async () => {
      render(<PoIssueButton isAdmin={true} poId="po-123" />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        // Check for the error span with red text color classes
        const errorSpan = screen.queryAllByText(
          (content, element) =>
            element?.className.includes('text-red-600') ||
            element?.className.includes('text-red-400')
        );
        expect(errorSpan).toHaveLength(0);
      });
    });
  });

  describe('On error', () => {
    it('displays error message when action returns error', async () => {
      const errorMsg = 'Cannot issue: vendor is not active';
      mockUpdatePOStatus.mockResolvedValue({ error: errorMsg });

      render(<PoIssueButton isAdmin={true} poId="po-123" />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText(errorMsg)).toBeInTheDocument();
      });
    });

    it('displays error in red span element', async () => {
      const errorMsg = 'Waiver pending approval';
      mockUpdatePOStatus.mockResolvedValue({ error: errorMsg });

      render(<PoIssueButton isAdmin={true} poId="po-123" />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        const errorSpan = screen.getByText(errorMsg).closest('span');
        expect(errorSpan).toHaveClass('text-red-600');
      });
    });

    it('does not call router.refresh() on error', async () => {
      mockUpdatePOStatus.mockResolvedValue({ error: 'Some error' });

      render(<PoIssueButton isAdmin={true} poId="po-123" />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockRouter.refresh).not.toHaveBeenCalled();
      });
    });

    it('re-enables button after error so user can retry', async () => {
      mockUpdatePOStatus.mockResolvedValue({ error: 'Try again' });

      render(<PoIssueButton isAdmin={true} poId="po-123" />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(button).not.toBeDisabled();
      });
    });

    it('allows retry by clicking button again after error', async () => {
      mockUpdatePOStatus.mockResolvedValueOnce({ error: 'First attempt failed' });
      mockUpdatePOStatus.mockResolvedValueOnce({ success: true });

      render(<PoIssueButton isAdmin={true} poId="po-123" />);

      const button = screen.getByRole('button');

      // First click - fails
      fireEvent.click(button);
      await waitFor(() => {
        expect(screen.getByText('First attempt failed')).toBeInTheDocument();
      });

      // Second click - succeeds
      fireEvent.click(button);
      await waitFor(() => {
        expect(screen.queryByText('First attempt failed')).not.toBeInTheDocument();
        expect(mockRouter.refresh).toHaveBeenCalled();
      });
    });
  });

  describe('Error state clearing', () => {
    it('clears error message when button is clicked again', async () => {
      mockUpdatePOStatus
        .mockResolvedValueOnce({ error: 'Previous error' })
        .mockResolvedValueOnce({ success: true });

      render(<PoIssueButton isAdmin={true} poId="po-123" />);

      const button = screen.getByRole('button');

      // First click - shows error
      fireEvent.click(button);
      await waitFor(() => {
        expect(screen.getByText('Previous error')).toBeInTheDocument();
      });

      // Second click - clears error, calls action
      fireEvent.click(button);
      await waitFor(() => {
        expect(screen.queryByText('Previous error')).not.toBeInTheDocument();
      });
    });
  });

  describe('Multiple POs', () => {
    it('maintains separate state for different PO instances', async () => {
      const { rerender } = render(<PoIssueButton isAdmin={true} poId="po-1" />);

      const button1 = screen.getByRole('button');
      fireEvent.click(button1);

      await waitFor(() => {
        expect(mockUpdatePOStatus).toHaveBeenCalledWith('po-1', 'issued');
      });

      jest.clearAllMocks();
      mockUpdatePOStatus.mockResolvedValue({ success: true });

      rerender(<PoIssueButton isAdmin={true} poId="po-2" />);

      const button2 = screen.getByRole('button');
      fireEvent.click(button2);

      await waitFor(() => {
        expect(mockUpdatePOStatus).toHaveBeenCalledWith('po-2', 'issued');
      });
    });
  });

  describe('Edge cases', () => {
    it('handles null error response gracefully', async () => {
      mockUpdatePOStatus.mockResolvedValue({ success: true, error: null });

      render(<PoIssueButton isAdmin={true} poId="po-123" />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockRouter.refresh).toHaveBeenCalled();
        expect(screen.queryAllByText(/error|Error/)).toHaveLength(0);
      });
    });

    it('handles undefined result from updatePOStatus', async () => {
      mockUpdatePOStatus.mockResolvedValue(undefined as any);

      render(<PoIssueButton isAdmin={true} poId="po-123" />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      // Should not crash and should refresh
      await waitFor(() => {
        expect(mockRouter.refresh).toHaveBeenCalled();
      });
    });

    it('displays long error messages without truncation', async () => {
      const longError =
        'Cannot issue: this PO has multiple compliance issues including pending waiver approval and vendor status verification. Please contact administrator.';
      mockUpdatePOStatus.mockResolvedValue({ error: longError });

      render(<PoIssueButton isAdmin={true} poId="po-123" />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText(longError)).toBeInTheDocument();
      });
    });
  });
});
