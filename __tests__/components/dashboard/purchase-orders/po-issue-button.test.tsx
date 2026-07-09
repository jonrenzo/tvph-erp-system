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
  Check: () => <div data-testid="check-icon">Check</div>,
  X: () => <div data-testid="x-icon">X</div>,
}));

import { submitPOForApproval } from '@/app/dashboard/purchase-orders/actions';
import { useRouter } from 'next/navigation';

const mockSubmitPOForApproval = submitPOForApproval as jest.MockedFunction<typeof submitPOForApproval>;
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;

const APPROVERS = [
  { id: 'admin-a', full_name: 'Alice Admin', email: 'alice@example.com' },
  { id: 'admin-b', full_name: 'Bob Boss', email: 'bob@example.com' },
];

function openPicker() {
  fireEvent.click(screen.getByRole('button', { name: /submit for approval/i }));
}

describe('PoIssueButton', () => {
  const mockRouter = { refresh: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue(mockRouter as any);
    mockSubmitPOForApproval.mockResolvedValue({ success: true });
  });

  describe('No eligible approvers', () => {
    it('disables submission and explains why when nobody can approve', () => {
      render(<PoIssueButton poId="po-123" eligibleApprovers={[]} />);

      const button = screen.getByRole('button', { name: /submit for approval/i });
      expect(button).toBeDisabled();
      expect(screen.getByText(/no eligible approver/i)).toBeInTheDocument();
    });
  });

  describe('Picker flow', () => {
    it('renders an enabled trigger button initially', () => {
      render(<PoIssueButton poId="po-123" eligibleApprovers={APPROVERS} />);
      const button = screen.getByRole('button', { name: /submit for approval/i });
      expect(button).toBeInTheDocument();
      expect(button).not.toBeDisabled();
    });

    it('opens the picker and lists eligible approvers', () => {
      render(<PoIssueButton poId="po-123" eligibleApprovers={APPROVERS} />);
      openPicker();

      expect(screen.getByText('Alice Admin')).toBeInTheDocument();
      expect(screen.getByText('bob@example.com')).toBeInTheDocument();
    });

    it('keeps the confirm button disabled until an approver is selected', () => {
      render(<PoIssueButton poId="po-123" eligibleApprovers={APPROVERS} />);
      openPicker();

      // With nothing selected the trigger and the confirm share a name; the
      // confirm (inside the panel) is the last one and starts disabled.
      const buttons = screen.getAllByRole('button', { name: /submit for approval/i });
      const confirm = buttons[buttons.length - 1];
      expect(confirm).toBeDisabled();

      fireEvent.click(screen.getByText('Alice Admin'));
      expect(
        screen.getByRole('button', { name: /submit for approval \(1\)/i })
      ).not.toBeDisabled();
    });

    it('submits the selected approver ids', async () => {
      render(<PoIssueButton poId="po-xyz" eligibleApprovers={APPROVERS} />);
      openPicker();

      fireEvent.click(screen.getByText('Alice Admin'));
      fireEvent.click(screen.getByText('Bob Boss'));
      fireEvent.click(screen.getByRole('button', { name: /submit for approval \(2\)/i }));

      await waitFor(() => {
        expect(mockSubmitPOForApproval).toHaveBeenCalledWith('po-xyz', ['admin-a', 'admin-b']);
      });
    });

    it('refreshes the router on success', async () => {
      render(<PoIssueButton poId="po-123" eligibleApprovers={APPROVERS} />);
      openPicker();
      fireEvent.click(screen.getByText('Alice Admin'));
      fireEvent.click(screen.getByRole('button', { name: /submit for approval \(1\)/i }));

      await waitFor(() => {
        expect(mockRouter.refresh).toHaveBeenCalled();
      });
    });
  });

  describe('On error', () => {
    it('displays the error and does not refresh', async () => {
      const errorMsg = 'You cannot select yourself as an approver.';
      mockSubmitPOForApproval.mockResolvedValue({ error: errorMsg });

      render(<PoIssueButton poId="po-123" eligibleApprovers={APPROVERS} />);
      openPicker();
      fireEvent.click(screen.getByText('Alice Admin'));
      fireEvent.click(screen.getByRole('button', { name: /submit for approval \(1\)/i }));

      await waitFor(() => {
        expect(screen.getByText(errorMsg)).toBeInTheDocument();
      });
      expect(mockRouter.refresh).not.toHaveBeenCalled();
    });
  });
});
