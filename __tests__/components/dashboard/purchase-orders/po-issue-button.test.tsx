import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PoIssueButton } from '@/components/dashboard/purchase-orders/po-issue-button';

jest.mock('@/app/dashboard/purchase-orders/actions', () => ({
  submitPOForApproval: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('lucide-react', () => ({
  Clock: () => <div data-testid="clock-icon">Clock</div>,
  Loader2: () => <div data-testid="loader-icon">Loader</div>,
}));

import { submitPOForApproval } from '@/app/dashboard/purchase-orders/actions';
import { useRouter } from 'next/navigation';

const mockSubmitPOForApproval = submitPOForApproval as jest.MockedFunction<typeof submitPOForApproval>;
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;

describe('PoIssueButton', () => {
  const mockRouter = {
    refresh: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue(mockRouter as any);
    mockSubmitPOForApproval.mockResolvedValue({ success: true });
  });

  describe('Initial render', () => {
    it('renders button with "Submit for Approval" text', () => {
      render(<PoIssueButton poId="po-123" />);

      const button = screen.getByRole('button', { name: /submit for approval/i });
      expect(button).toBeInTheDocument();
      expect(button).not.toBeDisabled();
    });

    it('renders Clock icon initially, not Loader', () => {
      render(<PoIssueButton poId="po-123" />);

      expect(screen.getByTestId('clock-icon')).toBeInTheDocument();
      expect(screen.queryByTestId('loader-icon')).not.toBeInTheDocument();
    });

    it('does not show error message initially', () => {
      render(<PoIssueButton poId="po-123" />);

      const errorSpans = screen.queryAllByText(/text-red-600|text-red-400/);
      expect(errorSpans).toHaveLength(0);
    });
  });

  describe('On click - pending state', () => {
    it('disables button while action is pending', async () => {
      mockSubmitPOForApproval.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ success: true }), 100)
          )
      );

      render(<PoIssueButton poId="po-123" />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(button).toBeDisabled();
      });

      expect(screen.getByText('Submitting…')).toBeInTheDocument();
    });

    it('shows Loader2 spinner while pending', async () => {
      mockSubmitPOForApproval.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ success: true }), 100)
          )
      );

      render(<PoIssueButton poId="po-123" />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
      });
    });
  });

  describe('On success', () => {
    it('calls submitPOForApproval with correct poId', async () => {
      render(<PoIssueButton poId="po-xyz" />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockSubmitPOForApproval).toHaveBeenCalledWith('po-xyz');
      });
    });

    it('calls router.refresh() on successful action', async () => {
      render(<PoIssueButton poId="po-123" />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockRouter.refresh).toHaveBeenCalled();
      });
    });

    it('re-enables button after successful action', async () => {
      render(<PoIssueButton poId="po-123" />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(button).not.toBeDisabled();
      });
    });

    it('returns to Clock icon and "Submit for Approval" text after success', async () => {
      render(<PoIssueButton poId="po-123" />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.queryByTestId('loader-icon')).not.toBeInTheDocument();
        expect(screen.getByTestId('clock-icon')).toBeInTheDocument();
        expect(screen.getByText('Submit for Approval')).toBeInTheDocument();
      });
    });

    it('does not display error message on success', async () => {
      render(<PoIssueButton poId="po-123" />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
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
      const errorMsg = 'Only draft POs can be submitted for approval.';
      mockSubmitPOForApproval.mockResolvedValue({ error: errorMsg });

      render(<PoIssueButton poId="po-123" />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText(errorMsg)).toBeInTheDocument();
      });
    });

    it('displays error in red span element', async () => {
      const errorMsg = 'Waiver pending approval';
      mockSubmitPOForApproval.mockResolvedValue({ error: errorMsg });

      render(<PoIssueButton poId="po-123" />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        const errorSpan = screen.getByText(errorMsg).closest('span');
        expect(errorSpan).toHaveClass('text-red-600');
      });
    });

    it('does not call router.refresh() on error', async () => {
      mockSubmitPOForApproval.mockResolvedValue({ error: 'Some error' });

      render(<PoIssueButton poId="po-123" />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockRouter.refresh).not.toHaveBeenCalled();
      });
    });

    it('re-enables button after error so user can retry', async () => {
      mockSubmitPOForApproval.mockResolvedValue({ error: 'Try again' });

      render(<PoIssueButton poId="po-123" />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(button).not.toBeDisabled();
      });
    });

    it('allows retry by clicking button again after error', async () => {
      mockSubmitPOForApproval.mockResolvedValueOnce({ error: 'First attempt failed' });
      mockSubmitPOForApproval.mockResolvedValueOnce({ success: true });

      render(<PoIssueButton poId="po-123" />);

      const button = screen.getByRole('button');

      fireEvent.click(button);
      await waitFor(() => {
        expect(screen.getByText('First attempt failed')).toBeInTheDocument();
      });

      fireEvent.click(button);
      await waitFor(() => {
        expect(screen.queryByText('First attempt failed')).not.toBeInTheDocument();
        expect(mockRouter.refresh).toHaveBeenCalled();
      });
    });
  });

  describe('Error state clearing', () => {
    it('clears error message when button is clicked again', async () => {
      mockSubmitPOForApproval
        .mockResolvedValueOnce({ error: 'Previous error' })
        .mockResolvedValueOnce({ success: true });

      render(<PoIssueButton poId="po-123" />);

      const button = screen.getByRole('button');

      fireEvent.click(button);
      await waitFor(() => {
        expect(screen.getByText('Previous error')).toBeInTheDocument();
      });

      fireEvent.click(button);
      await waitFor(() => {
        expect(screen.queryByText('Previous error')).not.toBeInTheDocument();
      });
    });
  });

  describe('Multiple POs', () => {
    it('maintains separate state for different PO instances', async () => {
      const { rerender } = render(<PoIssueButton poId="po-1" />);

      const button1 = screen.getByRole('button');
      fireEvent.click(button1);

      await waitFor(() => {
        expect(mockSubmitPOForApproval).toHaveBeenCalledWith('po-1');
      });

      jest.clearAllMocks();
      mockSubmitPOForApproval.mockResolvedValue({ success: true });

      rerender(<PoIssueButton poId="po-2" />);

      const button2 = screen.getByRole('button');
      fireEvent.click(button2);

      await waitFor(() => {
        expect(mockSubmitPOForApproval).toHaveBeenCalledWith('po-2');
      });
    });
  });

  describe('Edge cases', () => {
    it('handles null error response gracefully', async () => {
      mockSubmitPOForApproval.mockResolvedValue({ success: true, error: null });

      render(<PoIssueButton poId="po-123" />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockRouter.refresh).toHaveBeenCalled();
        expect(screen.queryAllByText(/error|Error/)).toHaveLength(0);
      });
    });

    it('handles undefined result from submitPOForApproval', async () => {
      mockSubmitPOForApproval.mockResolvedValue(undefined as any);

      render(<PoIssueButton poId="po-123" />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockRouter.refresh).toHaveBeenCalled();
      });
    });

    it('displays long error messages without truncation', async () => {
      const longError =
        'Cannot submit: this PO has multiple compliance issues including pending waiver approval and vendor status verification. Please contact administrator.';
      mockSubmitPOForApproval.mockResolvedValue({ error: longError });

      render(<PoIssueButton poId="po-123" />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText(longError)).toBeInTheDocument();
      });
    });
  });
});
