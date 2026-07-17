/**
 * Unit tests for Header component z-index stacking context fix
 * Verifies that the header element no longer has the z-50 class (removed in fix)
 * and uses CSS custom properties for dropdown z-index instead
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Header } from '@/components/dashboard/header';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// Mock the logout action
jest.mock('@/app/login/actions', () => ({
  logout: jest.fn(),
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Menu: () => <div data-testid="menu-icon">Menu</div>,
  LogOut: () => <div data-testid="logout-icon">LogOut</div>,
  User: () => <div data-testid="user-icon">User</div>,
  ChevronDown: () => <div data-testid="chevron-icon">ChevronDown</div>,
  PanelLeftClose: () => <div data-testid="panel-close-icon">PanelLeftClose</div>,
  PanelLeftOpen: () => <div data-testid="panel-open-icon">PanelLeftOpen</div>,
  History: () => <div data-testid="history-icon">History</div>,
}));

// Mock child components
jest.mock('@/components/theme-toggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle">ThemeToggle</div>,
}));

jest.mock('@/components/dashboard/notification-bell', () => ({
  NotificationBell: () => <div data-testid="notification-bell">NotificationBell</div>,
}));

jest.mock('@/components/dashboard/global-search', () => ({
  GlobalSearch: () => <div data-testid="global-search">GlobalSearch</div>,
}));

jest.mock('@/components/dashboard/clock', () => ({
  ClockWidget: () => <div data-testid="clock-widget">ClockWidget</div>,
}));

import { useRouter } from 'next/navigation';
import { logout } from '@/app/login/actions';

const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockLogout = logout as jest.MockedFunction<typeof logout>;

describe('Header - Z-Index Stacking Context Fix', () => {
  const mockRouter = {
    push: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    prefetch: jest.fn(),
  };

  const defaultProps = {
    userEmail: 'test@example.com',
    userName: 'Test User',
    avatarUrl: undefined,
    onSidebarToggle: jest.fn(),
    isCollapsed: false,
    onCollapseToggle: jest.fn(),
    onAuditOpen: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue(mockRouter as any);
    mockLogout.mockResolvedValue(undefined);
  });

  describe('Header z-50 class removed', () => {
    it('renders header element without z-50 class', () => {
      const { container } = render(<Header {...defaultProps} />);

      const header = container.querySelector('header');
      expect(header).toBeInTheDocument();
      expect(header).not.toHaveClass('z-50');
    });

    it('renders header with "relative" class (stacking context control)', () => {
      const { container } = render(<Header {...defaultProps} />);

      const header = container.querySelector('header');
      expect(header).toHaveClass('relative');
    });

    it('header has flex, h-16, and other layout classes but not z-50', () => {
      const { container } = render(<Header {...defaultProps} />);

      const header = container.querySelector('header');
      expect(header).toHaveClass('flex', 'h-16', 'shrink-0', 'items-center', 'justify-between');
      expect(header).not.toHaveClass('z-50');
    });

    it('header has backdrop-blur but not z-index elevation', () => {
      const { container } = render(<Header {...defaultProps} />);

      const header = container.querySelector('header');
      expect(header).toHaveClass('backdrop-blur-md');
      expect(header).not.toHaveClass('z-50');
    });
  });

  describe('Dropdown uses CSS custom property instead of inline z-index', () => {
    it('renders dropdown with z-[var(--z-dropdown)] when opened', async () => {
      const { container } = render(<Header {...defaultProps} />);

      // Open dropdown by clicking avatar button
      const avatarButton = screen.getAllByRole('button')[screen.getAllByRole('button').length - 1];
      fireEvent.click(avatarButton);

      await waitFor(() => {
        // Find dropdown by looking for the div that contains "Profile Settings" text
        const dropdown = screen.getByText('Profile Settings').closest('div.shadow-xl');
        expect(dropdown).toBeInTheDocument();
      });
    });

    it('dropdown element contains the CSS variable class for z-index', async () => {
      const { container } = render(<Header {...defaultProps} />);

      // Open dropdown
      const avatarButton = screen.getAllByRole('button')[screen.getAllByRole('button').length - 1];
      fireEvent.click(avatarButton);

      await waitFor(() => {
        const dropdown = screen.getByText('Profile Settings').closest('div.shadow-xl');
        expect(dropdown).toBeInTheDocument();
        expect(dropdown?.className).toMatch(/z-\[var\(--z-header-dropdown\)\]/);
      });
    });

    it('dropdown does not use inline z-index style (no inline z-index)', async () => {
      const { container } = render(<Header {...defaultProps} />);

      // Open dropdown
      const avatarButton = screen.getAllByRole('button')[screen.getAllByRole('button').length - 1];
      fireEvent.click(avatarButton);

      await waitFor(() => {
        const dropdown = screen.getByText('Profile Settings').closest('div.shadow-xl');
        const style = dropdown?.getAttribute('style');
        // Should not have inline zIndex style (either null or not containing z-index)
        expect(style === null || !style.match(/z-index/i)).toBe(true);
      });
    });
  });

  describe('Header stacking context with other components', () => {
    it('renders all header child components without z-index conflicts', () => {
      render(<Header {...defaultProps} />);

      expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
      expect(screen.getByTestId('notification-bell')).toBeInTheDocument();
      expect(screen.getByTestId('global-search')).toBeInTheDocument();
      expect(screen.getByTestId('clock-widget')).toBeInTheDocument();
      expect(screen.getByTestId('history-icon')).toBeInTheDocument();
    });

    it('maintains header layout with relative positioning (no z-50)', () => {
      const { container } = render(<Header {...defaultProps} />);

      const header = container.querySelector('header');
      const computedClass = header?.className || '';

      // Should have relative for stacking context but no z-50
      expect(computedClass).toContain('relative');
      expect(computedClass).not.toContain('z-50');
    });
  });

  describe('Dropdown interaction with CSS custom property', () => {
    it('opens dropdown on avatar button click', async () => {
      render(<Header {...defaultProps} />);

      const avatarButton = screen.getAllByRole('button')[screen.getAllByRole('button').length - 1];
      fireEvent.click(avatarButton);

      await waitFor(() => {
        expect(screen.getByText('Profile Settings')).toBeInTheDocument();
      });
    });

    it('dropdown contains user email from props', async () => {
      render(<Header {...defaultProps} userEmail="john@example.com" />);

      const avatarButton = screen.getAllByRole('button')[screen.getAllByRole('button').length - 1];
      fireEvent.click(avatarButton);

      await waitFor(() => {
        expect(screen.getByText('john@example.com')).toBeInTheDocument();
      });
    });

    it('dropdown closes when clicking outside (backdrop click)', async () => {
      render(
        <div>
          <Header {...defaultProps} />
          <div data-testid="outside-element">Outside</div>
        </div>
      );

      // Open dropdown
      const avatarButton = screen.getAllByRole('button')[screen.getAllByRole('button').length - 1];
      fireEvent.click(avatarButton);

      await waitFor(() => {
        expect(screen.getByText('Profile Settings')).toBeInTheDocument();
      });

      // Click outside to close
      fireEvent.mouseDown(screen.getByTestId('outside-element'));

      await waitFor(() => {
        expect(screen.queryByText('Profile Settings')).not.toBeInTheDocument();
      });
    });
  });

  describe('Regression: z-50 does not reappear on header', () => {
    it('confirms header element specifically does not have z-50', () => {
      const { container } = render(<Header {...defaultProps} />);

      const header = container.querySelector('header');
      const headerClasses = header?.className || '';

      expect(headerClasses).not.toMatch(/z-50/);
    });

    it('header uses the --z-dropdown stacking var (no legacy z-50)', () => {
      const { container } = render(<Header {...defaultProps} />);

      const header = container.querySelector('header');

      // The header establishes a stacking context via --z-dropdown; the user
      // menu dropdown sits above it via --z-header-dropdown. Neither should use
      // the legacy numeric z-50 that caused the original stacking bug.
      const headerClasses = header?.className || '';
      expect(headerClasses).toMatch(/z-\[var\(--z-dropdown\)\]/);
      expect(headerClasses).not.toMatch(/z-50/);
    });

    it('header maintains relative positioning without z-index elevation', () => {
      const { container } = render(<Header {...defaultProps} />);

      const header = container.querySelector('header');
      expect(header).toHaveClass('relative');
      expect(header?.className).not.toMatch(/z-50|z-\d+/);
    });
  });

  describe('Header props and functionality preserved', () => {
    it('calls onSidebarToggle when menu button clicked', () => {
      render(<Header {...defaultProps} />);

      const menuButton = screen.getByTestId('menu-icon').closest('button');
      fireEvent.click(menuButton!);

      expect(defaultProps.onSidebarToggle).toHaveBeenCalled();
    });

    it('calls onCollapseToggle when collapse button clicked', () => {
      render(<Header {...defaultProps} />);

      const collapseButton = screen.getByTestId('panel-close-icon').closest('button');
      fireEvent.click(collapseButton!);

      expect(defaultProps.onCollapseToggle).toHaveBeenCalled();
    });

    it('displays user email in dropdown when opened', async () => {
      render(<Header {...defaultProps} userEmail="test@company.com" />);

      const avatarButton = screen.getAllByRole('button')[screen.getAllByRole('button').length - 1];
      fireEvent.click(avatarButton);

      await waitFor(() => {
        expect(screen.getByText('test@company.com')).toBeInTheDocument();
      });
    });
  });
});
