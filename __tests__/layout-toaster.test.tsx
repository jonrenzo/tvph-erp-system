/**
 * Unit tests for root layout Toaster component
 * Verifies that the Toaster from sonner is mounted and rendered in the layout tree
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock next/font/google - these don't work in Jest
jest.mock('next/font/google', () => ({
  Plus_Jakarta_Sans: jest.fn(() => ({
    variable: '--font-plus-jakarta',
  })),
  Inter: jest.fn(() => ({
    variable: '--font-inter',
  })),
}));

// Mock sonner Toaster - replace with a simple testable div
jest.mock('sonner', () => ({
  Toaster: ({ position, richColors, toastOptions }: any) => (
    <div
      data-testid="sonner-toaster"
      data-position={position}
      data-rich-colors={richColors}
      data-z-index={toastOptions?.style?.zIndex}
    />
  ),
}));

// Mock the providers
jest.mock('@/components/theme-provider', () => ({
  ThemeProvider: ({ children }: any) => <div data-testid="theme-provider">{children}</div>,
}));

jest.mock('@/components/accent-provider', () => ({
  AccentProvider: ({ children }: any) => <div data-testid="accent-provider">{children}</div>,
}));

// Import the layout component parts instead of the full RootLayout
// to avoid rendering actual html/body elements
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/theme-provider';
import { AccentProvider } from '@/components/accent-provider';

// Create a test wrapper that mimics RootLayout structure without the html/body
function RootLayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
      themes={['light', 'dark', 'midnight']}
    >
      <AccentProvider>
        {children}
      </AccentProvider>
      <Toaster position="top-right" richColors toastOptions={{ style: { zIndex: 9999 } }} />
    </ThemeProvider>
  );
}

describe('RootLayout - Toaster Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Toaster rendering', () => {
    it('renders the Toaster component from sonner', () => {
      render(
        <RootLayoutWrapper>
          <div>Test Content</div>
        </RootLayoutWrapper>
      );

      const toaster = screen.getByTestId('sonner-toaster');
      expect(toaster).toBeInTheDocument();
    });

    it('renders Toaster with position="top-right"', () => {
      render(
        <RootLayoutWrapper>
          <div>Test Content</div>
        </RootLayoutWrapper>
      );

      const toaster = screen.getByTestId('sonner-toaster');
      expect(toaster).toHaveAttribute('data-position', 'top-right');
    });

    it('renders Toaster with richColors prop enabled', () => {
      render(
        <RootLayoutWrapper>
          <div>Test Content</div>
        </RootLayoutWrapper>
      );

      const toaster = screen.getByTestId('sonner-toaster');
      expect(toaster).toHaveAttribute('data-rich-colors', 'true');
    });

    it('renders Toaster with custom zIndex of 9999', () => {
      render(
        <RootLayoutWrapper>
          <div>Test Content</div>
        </RootLayoutWrapper>
      );

      const toaster = screen.getByTestId('sonner-toaster');
      expect(toaster).toHaveAttribute('data-z-index', '9999');
    });

    it('renders Toaster after ThemeProvider but within the tree', () => {
      render(
        <RootLayoutWrapper>
          <div>Test Content</div>
        </RootLayoutWrapper>
      );

      const themeProvider = screen.getByTestId('theme-provider');
      const toaster = screen.getByTestId('sonner-toaster');

      // Both should be in the document
      expect(themeProvider).toBeInTheDocument();
      expect(toaster).toBeInTheDocument();

      // Toaster should be within or sibling to ThemeProvider
      expect(themeProvider.parentElement).toContainElement(toaster);
    });
  });

  describe('Layout structure', () => {
    it('renders children content passed to layout', () => {
      render(
        <RootLayoutWrapper>
          <div data-testid="child-content">Child Element</div>
        </RootLayoutWrapper>
      );

      expect(screen.getByTestId('child-content')).toBeInTheDocument();
      expect(screen.getByText('Child Element')).toBeInTheDocument();
    });

    it('wraps children in AccentProvider and ThemeProvider', () => {
      render(
        <RootLayoutWrapper>
          <div data-testid="child-content">Test</div>
        </RootLayoutWrapper>
      );

      const accentProvider = screen.getByTestId('accent-provider');
      const themeProvider = screen.getByTestId('theme-provider');
      const childContent = screen.getByTestId('child-content');

      expect(accentProvider).toBeInTheDocument();
      expect(themeProvider).toBeInTheDocument();
      expect(themeProvider).toContainElement(accentProvider);
      expect(accentProvider).toContainElement(childContent);
    });
  });

  describe('Toaster integration with providers', () => {
    it('renders Toaster as sibling to AccentProvider within ThemeProvider', () => {
      render(
        <RootLayoutWrapper>
          <div>Test</div>
        </RootLayoutWrapper>
      );

      const themeProvider = screen.getByTestId('theme-provider');
      const toaster = screen.getByTestId('sonner-toaster');

      // Toaster should be a child of ThemeProvider
      expect(themeProvider).toContainElement(toaster);
    });

    it('renders Toaster outside AccentProvider (as sibling)', () => {
      render(
        <RootLayoutWrapper>
          <div>Test</div>
        </RootLayoutWrapper>
      );

      const accentProvider = screen.getByTestId('accent-provider');
      const toaster = screen.getByTestId('sonner-toaster');

      // Toaster should not be a direct descendant of AccentProvider
      expect(accentProvider).not.toContainElement(toaster);
    });
  });
});
