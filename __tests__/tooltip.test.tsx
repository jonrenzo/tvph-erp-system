/**
 * Unit tests for Tooltip component
 * Verifies portal-based tooltip behavior with position calculation,
 * event handling, and CSS class application
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Tooltip } from '@/components/ui/tooltip';

describe('Tooltip Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Default rendering', () => {
    it('should not render tooltip content in DOM on initial render', () => {
      render(
        <Tooltip content="Tooltip text">
          <button>Hover me</button>
        </Tooltip>
      );

      // Content should not be present on initial render
      expect(screen.queryByText('Tooltip text')).not.toBeInTheDocument();
    });

    it('should render children on initial render', () => {
      render(
        <Tooltip content="Tooltip text">
          <button>Hover me</button>
        </Tooltip>
      );

      expect(screen.getByRole('button', { name: 'Hover me' })).toBeInTheDocument();
    });

    it('should apply inline-flex class to wrapper div', () => {
      const { container } = render(
        <Tooltip content="Tooltip text">
          <button>Hover me</button>
        </Tooltip>
      );

      const wrapper = container.querySelector('.inline-flex');
      expect(wrapper).toBeInTheDocument();
    });
  });

  describe('Show on mouseenter', () => {
    it('should render tooltip content after mouseenter event', () => {
      render(
        <Tooltip content="Tooltip text">
          <button>Hover me</button>
        </Tooltip>
      );

      const button = screen.getByRole('button', { name: 'Hover me' });
      fireEvent.mouseEnter(button.parentElement!);

      expect(screen.getByText('Tooltip text')).toBeInTheDocument();
    });

    it('should render tooltip in document.body (portal)', () => {
      render(
        <Tooltip content="Tooltip text">
          <button>Hover me</button>
        </Tooltip>
      );

      const button = screen.getByRole('button', { name: 'Hover me' });
      fireEvent.mouseEnter(button.parentElement!);

      const tooltip = screen.getByText('Tooltip text') as HTMLElement;
      // The tooltip should be a direct child of document.body
      expect(tooltip.parentElement).toBe(document.body);
    });

    it('should calculate position based on ref bounding rect', () => {
      const { container } = render(
        <Tooltip content="Tooltip text">
          <button>Hover me</button>
        </Tooltip>
      );

      const wrapper = container.querySelector('.inline-flex') as HTMLElement;
      // Mock getBoundingClientRect
      wrapper.getBoundingClientRect = jest.fn(() => ({
        top: 100,
        left: 200,
        width: 80,
        height: 30,
        right: 280,
        bottom: 130,
        x: 200,
        y: 100,
        toJSON: () => {},
      }));

      fireEvent.mouseEnter(wrapper);

      const tooltip = screen.getByText('Tooltip text') as HTMLElement;
      // Position should be: top: 100 - 8 = 92, left: 200 + 80/2 = 240
      expect(tooltip).toHaveStyle({ top: '92px', left: '240px' });
    });
  });

  describe('Hide on mouseleave', () => {
    it('should remove tooltip content after mouseleave event', () => {
      render(
        <Tooltip content="Tooltip text">
          <button>Hover me</button>
        </Tooltip>
      );

      const button = screen.getByRole('button', { name: 'Hover me' });
      const wrapper = button.parentElement!;

      // Show tooltip
      fireEvent.mouseEnter(wrapper);
      expect(screen.getByText('Tooltip text')).toBeInTheDocument();

      // Hide tooltip
      fireEvent.mouseLeave(wrapper);
      expect(screen.queryByText('Tooltip text')).not.toBeInTheDocument();
    });

    it('should show and hide tooltip multiple times', () => {
      render(
        <Tooltip content="Tooltip text">
          <button>Hover me</button>
        </Tooltip>
      );

      const button = screen.getByRole('button', { name: 'Hover me' });
      const wrapper = button.parentElement!;

      // First show/hide cycle
      fireEvent.mouseEnter(wrapper);
      expect(screen.getByText('Tooltip text')).toBeInTheDocument();
      fireEvent.mouseLeave(wrapper);
      expect(screen.queryByText('Tooltip text')).not.toBeInTheDocument();

      // Second show/hide cycle
      fireEvent.mouseEnter(wrapper);
      expect(screen.getByText('Tooltip text')).toBeInTheDocument();
      fireEvent.mouseLeave(wrapper);
      expect(screen.queryByText('Tooltip text')).not.toBeInTheDocument();
    });
  });

  describe('Content rendering', () => {
    it('should accept string content', () => {
      render(
        <Tooltip content="String tooltip">
          <button>Hover me</button>
        </Tooltip>
      );

      const button = screen.getByRole('button', { name: 'Hover me' });
      fireEvent.mouseEnter(button.parentElement!);

      expect(screen.getByText('String tooltip')).toBeInTheDocument();
    });

    it('should accept JSX content', () => {
      render(
        <Tooltip
          content={
            <div>
              <span>JSX</span> Content
            </div>
          }
        >
          <button>Hover me</button>
        </Tooltip>
      );

      const button = screen.getByRole('button', { name: 'Hover me' });
      fireEvent.mouseEnter(button.parentElement!);

      expect(screen.getByText('JSX')).toBeInTheDocument();
      expect(screen.getByText(/Content/)).toBeInTheDocument();
    });

    it('should accept ReactNode children', () => {
      render(
        <Tooltip content="Tooltip">
          <span>Child content</span>
        </Tooltip>
      );

      expect(screen.getByText('Child content')).toBeInTheDocument();
    });
  });

  describe('CSS styling', () => {
    it('should apply fixed positioning class', () => {
      const { container } = render(
        <Tooltip content="Tooltip text">
          <button>Hover me</button>
        </Tooltip>
      );

      const wrapper = container.querySelector('.inline-flex') as HTMLElement;
      fireEvent.mouseEnter(wrapper);

      const tooltip = screen.getByText('Tooltip text') as HTMLElement;
      expect(tooltip).toHaveClass('fixed');
    });

    it('should apply pointer-events-none class', () => {
      const { container } = render(
        <Tooltip content="Tooltip text">
          <button>Hover me</button>
        </Tooltip>
      );

      const wrapper = container.querySelector('.inline-flex') as HTMLElement;
      fireEvent.mouseEnter(wrapper);

      const tooltip = screen.getByText('Tooltip text') as HTMLElement;
      expect(tooltip).toHaveClass('pointer-events-none');
    });

    it('should apply translate(-50%, -100%) transform', () => {
      const { container } = render(
        <Tooltip content="Tooltip text">
          <button>Hover me</button>
        </Tooltip>
      );

      const wrapper = container.querySelector('.inline-flex') as HTMLElement;
      fireEvent.mouseEnter(wrapper);

      const tooltip = screen.getByText('Tooltip text') as HTMLElement;
      expect(tooltip).toHaveStyle({ transform: 'translate(-50%, -100%)' });
    });

    it('should apply styling classes for appearance', () => {
      const { container } = render(
        <Tooltip content="Tooltip text">
          <button>Hover me</button>
        </Tooltip>
      );

      const wrapper = container.querySelector('.inline-flex') as HTMLElement;
      fireEvent.mouseEnter(wrapper);

      const tooltip = screen.getByText('Tooltip text') as HTMLElement;
      expect(tooltip).toHaveClass('px-3');
      expect(tooltip).toHaveClass('py-1.5');
      expect(tooltip).toHaveClass('rounded-lg');
      expect(tooltip).toHaveClass('bg-slate-900');
      expect(tooltip).toHaveClass('text-white');
      expect(tooltip).toHaveClass('text-xs');
      expect(tooltip).toHaveClass('whitespace-nowrap');
      expect(tooltip).toHaveClass('shadow-lg');
    });

    it('should apply z-index CSS variable', () => {
      const { container } = render(
        <Tooltip content="Tooltip text">
          <button>Hover me</button>
        </Tooltip>
      );

      const wrapper = container.querySelector('.inline-flex') as HTMLElement;
      fireEvent.mouseEnter(wrapper);

      const tooltip = screen.getByText('Tooltip text') as HTMLElement;
      expect(tooltip).toHaveClass('z-[var(--z-dropdown)]');
    });
  });

  describe('Portal behavior', () => {
    it('should render tooltip outside of wrapper div in portal', () => {
      const { container } = render(
        <Tooltip content="Tooltip text">
          <button>Hover me</button>
        </Tooltip>
      );

      const wrapper = container.querySelector('.inline-flex') as HTMLElement;
      fireEvent.mouseEnter(wrapper);

      const tooltip = screen.getByText('Tooltip text') as HTMLElement;
      // Tooltip should be in document.body, not in the wrapper
      expect(wrapper).not.toContainElement(tooltip);
      expect(document.body).toContainElement(tooltip);
    });

    it('should cleanup portal on unmount', () => {
      const { container, unmount } = render(
        <Tooltip content="Tooltip text">
          <button>Hover me</button>
        </Tooltip>
      );

      const wrapper = container.querySelector('.inline-flex') as HTMLElement;
      fireEvent.mouseEnter(wrapper);

      expect(screen.getByText('Tooltip text')).toBeInTheDocument();

      unmount();
      expect(screen.queryByText('Tooltip text')).not.toBeInTheDocument();
    });
  });

  describe('Position calculation edge cases', () => {
    it('should handle zero width element', () => {
      const { container } = render(
        <Tooltip content="Tooltip text">
          <button>Hover me</button>
        </Tooltip>
      );

      const wrapper = container.querySelector('.inline-flex') as HTMLElement;
      wrapper.getBoundingClientRect = jest.fn(() => ({
        top: 50,
        left: 100,
        width: 0,
        height: 20,
        right: 100,
        bottom: 70,
        x: 100,
        y: 50,
        toJSON: () => {},
      }));

      fireEvent.mouseEnter(wrapper);

      const tooltip = screen.getByText('Tooltip text') as HTMLElement;
      // left should be: 100 + 0/2 = 100
      expect(tooltip).toHaveStyle({ top: '42px', left: '100px' });
    });

    it('should handle large element', () => {
      const { container } = render(
        <Tooltip content="Tooltip text">
          <button>Hover me</button>
        </Tooltip>
      );

      const wrapper = container.querySelector('.inline-flex') as HTMLElement;
      wrapper.getBoundingClientRect = jest.fn(() => ({
        top: 200,
        left: 500,
        width: 200,
        height: 100,
        right: 700,
        bottom: 300,
        x: 500,
        y: 200,
        toJSON: () => {},
      }));

      fireEvent.mouseEnter(wrapper);

      const tooltip = screen.getByText('Tooltip text') as HTMLElement;
      // left should be: 500 + 200/2 = 600
      expect(tooltip).toHaveStyle({ top: '192px', left: '600px' });
    });
  });

  describe('Event handling', () => {
    it('should attach onMouseEnter handler to wrapper', () => {
      const { container } = render(
        <Tooltip content="Tooltip text">
          <button>Hover me</button>
        </Tooltip>
      );

      const wrapper = container.querySelector('.inline-flex') as HTMLElement;
      expect(wrapper).toHaveProperty('onmouseenter');
    });

    it('should attach onMouseLeave handler to wrapper', () => {
      const { container } = render(
        <Tooltip content="Tooltip text">
          <button>Hover me</button>
        </Tooltip>
      );

      const wrapper = container.querySelector('.inline-flex') as HTMLElement;
      expect(wrapper).toHaveProperty('onmouseleave');
    });

    it('should get bounding rect from ref element on show', () => {
      const { container } = render(
        <Tooltip content="Tooltip text">
          <button>Hover me</button>
        </Tooltip>
      );

      const wrapper = container.querySelector('.inline-flex') as HTMLElement;
      const getBoundingClientRectSpy = jest.spyOn(wrapper, 'getBoundingClientRect');

      fireEvent.mouseEnter(wrapper);

      expect(getBoundingClientRectSpy).toHaveBeenCalled();
      getBoundingClientRectSpy.mockRestore();
    });
  });
});
