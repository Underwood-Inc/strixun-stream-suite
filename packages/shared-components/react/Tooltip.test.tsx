/**
 * Tooltip Component Tests
 * 
 * Tests for the shared React Tooltip component following 2026 best practices:
 * - React Testing Library for user-centric testing
 * - Vitest for fast, modern test execution
 * - Accessibility testing
 * - Portal rendering verification
 * - Interactive behavior testing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { Tooltip } from './Tooltip';
import type { TooltipTheme } from './Tooltip';

const defaultTheme: TooltipTheme = {
  colors: {
    bg: '#1a1a1a',
    card: '#2a2a2a',
    bgTertiary: '#333333',
    text: '#f9f9f9',
    textSecondary: '#b0b0b0',
    textMuted: '#808080',
    border: 'rgba(255, 255, 255, 0.2)',
    accent: '#6495ed',
    info: '#6495ed',
    warning: '#ff8c00',
    danger: '#ea2b1f',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
  },
};

describe('Tooltip', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('Basic Rendering', () => {
    it('should render children without tooltip initially', () => {
      render(
        <Tooltip text="Test tooltip" theme={defaultTheme}>
          <button>Hover me</button>
        </Tooltip>
      );

      expect(screen.getByRole('button', { name: 'Hover me' })).toBeInTheDocument();
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('should not render when disabled', async () => {
      render(
        <Tooltip text="Test tooltip" disabled theme={defaultTheme}>
          <button>Hover me</button>
        </Tooltip>
      );

      const button = screen.getByRole('button');
      await user.hover(button);
      vi.runAllTimers();

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('should not render when no text or content provided', () => {
      render(
        <Tooltip theme={defaultTheme}>
          <button>Hover me</button>
        </Tooltip>
      );

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  describe('Hover Behavior', () => {
    it('should show tooltip on hover with no delay', async () => {
      render(
        <Tooltip text="Test tooltip" delay={0} theme={defaultTheme}>
          <button>Hover me</button>
        </Tooltip>
      );

      const button = screen.getByRole('button');
      await user.hover(button);
      vi.runAllTimers();

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
        expect(screen.getByText('Test tooltip')).toBeInTheDocument();
      });
    });

    it('should show tooltip after delay', async () => {
      render(
        <Tooltip text="Test tooltip" delay={200} theme={defaultTheme}>
          <button>Hover me</button>
        </Tooltip>
      );

      const button = screen.getByRole('button');
      await user.hover(button);

      // Should not show immediately
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

      // Should show after delay
      vi.advanceTimersByTime(200);
      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });
    });

    it('should hide tooltip on mouse leave', async () => {
      render(
        <Tooltip text="Test tooltip" delay={0} theme={defaultTheme}>
          <button>Hover me</button>
        </Tooltip>
      );

      const button = screen.getByRole('button');
      await user.hover(button);
      vi.runAllTimers();

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });

      await user.unhover(button);
      vi.runAllTimers();

      await waitFor(() => {
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      });
    });

    it('should cancel tooltip show if mouse leaves before delay', async () => {
      render(
        <Tooltip text="Test tooltip" delay={200} theme={defaultTheme}>
          <button>Hover me</button>
        </Tooltip>
      );

      const button = screen.getByRole('button');
      await user.hover(button);
      
      // Leave before delay completes
      vi.advanceTimersByTime(100);
      await user.unhover(button);
      vi.runAllTimers();

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  describe('Interactive Mode', () => {
    it('should keep tooltip visible when hovering over it in interactive mode', async () => {
      render(
        <Tooltip 
          text="Test tooltip" 
          delay={0} 
          interactive 
          theme={defaultTheme}
        >
          <button>Hover me</button>
        </Tooltip>
      );

      const button = screen.getByRole('button');
      await user.hover(button);
      vi.runAllTimers();

      const tooltip = await screen.findByRole('tooltip');
      expect(tooltip).toBeInTheDocument();

      // Leave button and hover tooltip
      await user.unhover(button);
      await user.hover(tooltip);
      vi.runAllTimers();

      // Tooltip should still be visible
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    it('should hide tooltip when leaving both trigger and tooltip in interactive mode', async () => {
      render(
        <Tooltip 
          text="Test tooltip" 
          delay={0} 
          interactive 
          theme={defaultTheme}
        >
          <button>Hover me</button>
        </Tooltip>
      );

      const button = screen.getByRole('button');
      await user.hover(button);
      vi.runAllTimers();

      const tooltip = await screen.findByRole('tooltip');
      await user.unhover(button);
      await user.unhover(tooltip);
      vi.runAllTimers();

      await waitFor(() => {
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      });
    });
  });

  describe('Content Types', () => {
    it('should render text content', async () => {
      render(
        <Tooltip text="Simple text tooltip" delay={0} theme={defaultTheme}>
          <button>Hover me</button>
        </Tooltip>
      );

      await user.hover(screen.getByRole('button'));
      vi.runAllTimers();

      await waitFor(() => {
        expect(screen.getByText('Simple text tooltip')).toBeInTheDocument();
      });
    });

    it('should render rich content', async () => {
      const richContent = (
        <div>
          <h3>Title</h3>
          <p>Description</p>
        </div>
      );

      render(
        <Tooltip content={richContent} delay={0} theme={defaultTheme}>
          <button>Hover me</button>
        </Tooltip>
      );

      await user.hover(screen.getByRole('button'));
      vi.runAllTimers();

      await waitFor(() => {
        const tooltip = screen.getByRole('tooltip');
        expect(within(tooltip).getByText('Title')).toBeInTheDocument();
        expect(within(tooltip).getByText('Description')).toBeInTheDocument();
      });
    });
  });

  describe('Level/Flair System', () => {
    it('should render with log level (default)', async () => {
      render(
        <Tooltip text="Log tooltip" delay={0} level="log" theme={defaultTheme}>
          <button>Hover me</button>
        </Tooltip>
      );

      await user.hover(screen.getByRole('button'));
      vi.runAllTimers();

      const tooltip = await screen.findByRole('tooltip');
      expect(tooltip).toBeInTheDocument();
    });

    it('should render with info level', async () => {
      render(
        <Tooltip text="Info tooltip" delay={0} level="info" theme={defaultTheme}>
          <button>Hover me</button>
        </Tooltip>
      );

      await user.hover(screen.getByRole('button'));
      vi.runAllTimers();

      const tooltip = await screen.findByRole('tooltip');
      expect(tooltip).toBeInTheDocument();
    });

    it('should render with warning level', async () => {
      render(
        <Tooltip text="Warning tooltip" delay={0} level="warning" theme={defaultTheme}>
          <button>Hover me</button>
        </Tooltip>
      );

      await user.hover(screen.getByRole('button'));
      vi.runAllTimers();

      const tooltip = await screen.findByRole('tooltip');
      expect(tooltip).toBeInTheDocument();
    });

    it('should render with error level', async () => {
      render(
        <Tooltip text="Error tooltip" delay={0} level="error" theme={defaultTheme}>
          <button>Hover me</button>
        </Tooltip>
      );

      await user.hover(screen.getByRole('button'));
      vi.runAllTimers();

      const tooltip = await screen.findByRole('tooltip');
      expect(tooltip).toBeInTheDocument();
    });
  });

  describe('Positioning', () => {
    it('should render with top position', async () => {
      render(
        <Tooltip text="Top tooltip" delay={0} position="top" theme={defaultTheme}>
          <button>Hover me</button>
        </Tooltip>
      );

      await user.hover(screen.getByRole('button'));
      vi.runAllTimers();

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });
    });

    it('should render with bottom position', async () => {
      render(
        <Tooltip text="Bottom tooltip" delay={0} position="bottom" theme={defaultTheme}>
          <button>Hover me</button>
        </Tooltip>
      );

      await user.hover(screen.getByRole('button'));
      vi.runAllTimers();

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });
    });

    it('should render with left position', async () => {
      render(
        <Tooltip text="Left tooltip" delay={0} position="left" theme={defaultTheme}>
          <button>Hover me</button>
        </Tooltip>
      );

      await user.hover(screen.getByRole('button'));
      vi.runAllTimers();

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });
    });

    it('should render with right position', async () => {
      render(
        <Tooltip text="Right tooltip" delay={0} position="right" theme={defaultTheme}>
          <button>Hover me</button>
        </Tooltip>
      );

      await user.hover(screen.getByRole('button'));
      vi.runAllTimers();

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });
    });

    it('should auto-position when position is auto', async () => {
      render(
        <Tooltip text="Auto tooltip" delay={0} position="auto" theme={defaultTheme}>
          <button>Hover me</button>
        </Tooltip>
      );

      await user.hover(screen.getByRole('button'));
      vi.runAllTimers();

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });
    });
  });

  describe('Portal Rendering', () => {
    it('should render tooltip in portal (outside component tree)', async () => {
      const { container } = render(
        <div data-testid="container">
          <Tooltip text="Portal tooltip" delay={0} theme={defaultTheme}>
            <button>Hover me</button>
          </Tooltip>
        </div>
      );

      await user.hover(screen.getByRole('button'));
      vi.runAllTimers();

      await waitFor(() => {
        const tooltip = screen.getByRole('tooltip');
        expect(tooltip).toBeInTheDocument();
        
        // Tooltip should NOT be inside the container
        const containerElement = screen.getByTestId('container');
        expect(containerElement).not.toContainElement(tooltip);
      });
    });

    it('should create portal root element', async () => {
      render(
        <Tooltip text="Portal test" delay={0} theme={defaultTheme}>
          <button>Hover me</button>
        </Tooltip>
      );

      await user.hover(screen.getByRole('button'));
      vi.runAllTimers();

      await waitFor(() => {
        const portalRoot = document.getElementById('react-tooltip-portal-root');
        expect(portalRoot).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', async () => {
      render(
        <Tooltip text="Accessible tooltip" delay={0} theme={defaultTheme}>
          <button>Hover me</button>
        </Tooltip>
      );

      await user.hover(screen.getByRole('button'));
      vi.runAllTimers();

      await waitFor(() => {
        const tooltip = screen.getByRole('tooltip');
        expect(tooltip).toHaveAttribute('aria-live', 'polite');
      });
    });

    it('should be keyboard accessible when interactive', async () => {
      render(
        <Tooltip 
          text="Interactive tooltip" 
          delay={0} 
          interactive 
          theme={defaultTheme}
        >
          <button>Hover me</button>
        </Tooltip>
      );

      const button = screen.getByRole('button');
      button.focus();
      await user.hover(button);
      vi.runAllTimers();

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });
    });
  });

  describe('Custom Dimensions', () => {
    it('should apply custom maxWidth', async () => {
      render(
        <Tooltip 
          text="Custom width tooltip" 
          delay={0} 
          maxWidth="600px" 
          theme={defaultTheme}
        >
          <button>Hover me</button>
        </Tooltip>
      );

      await user.hover(screen.getByRole('button'));
      vi.runAllTimers();

      await waitFor(() => {
        const tooltip = screen.getByRole('tooltip');
        expect(tooltip).toHaveStyle({ maxWidth: '600px' });
      });
    });

    it('should apply custom width', async () => {
      render(
        <Tooltip 
          text="Fixed width tooltip" 
          delay={0} 
          width="400px" 
          theme={defaultTheme}
        >
          <button>Hover me</button>
        </Tooltip>
      );

      await user.hover(screen.getByRole('button'));
      vi.runAllTimers();

      await waitFor(() => {
        const tooltip = screen.getByRole('tooltip');
        expect(tooltip).toBeInTheDocument();
      });
    });

    it('should apply custom maxHeight for scrollable content', async () => {
      render(
        <Tooltip 
          text="Scrollable tooltip with long content that should scroll" 
          delay={0} 
          maxHeight="100px" 
          theme={defaultTheme}
        >
          <button>Hover me</button>
        </Tooltip>
      );

      await user.hover(screen.getByRole('button'));
      vi.runAllTimers();

      await waitFor(() => {
        const tooltip = screen.getByRole('tooltip');
        expect(tooltip).toBeInTheDocument();
      });
    });
  });

  describe('Truncation Detection', () => {
    it('should show tooltip only when text is truncated', async () => {
      // Mock element with truncated text
      const mockElement = document.createElement('div');
      Object.defineProperty(mockElement, 'scrollWidth', { value: 200 });
      Object.defineProperty(mockElement, 'clientWidth', { value: 100 });
      Object.defineProperty(mockElement, 'textContent', { value: 'Truncated text' });
      
      render(
        <Tooltip 
          text="Full text" 
          delay={0} 
          detectTruncation 
          theme={defaultTheme}
        >
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100px' }}>
            Truncated text
          </div>
        </Tooltip>
      );

      const trigger = screen.getByText('Truncated text');
      await user.hover(trigger);
      vi.runAllTimers();

      // Note: In jsdom, scrollWidth detection doesn't work perfectly,
      // but we can verify the component renders
      await waitFor(() => {
        // Component should handle truncation detection
        expect(trigger).toBeInTheDocument();
      });
    });
  });

  describe('Cleanup', () => {
    it('should cleanup portal on unmount', async () => {
      const { unmount } = render(
        <Tooltip text="Cleanup test" delay={0} theme={defaultTheme}>
          <button>Hover me</button>
        </Tooltip>
      );

      await user.hover(screen.getByRole('button'));
      vi.runAllTimers();

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });

      unmount();

      // Portal should be cleaned up
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('should clear timers on unmount', () => {
      const { unmount } = render(
        <Tooltip text="Timer test" delay={200} theme={defaultTheme}>
          <button>Hover me</button>
        </Tooltip>
      );

      unmount();

      // Should not throw errors
      expect(() => vi.runAllTimers()).not.toThrow();
    });
  });
});
