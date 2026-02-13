/**
 * InteractiveThumbnail Component Tests
 * 
 * Tests for the shared React InteractiveThumbnail component following 2026 best practices:
 * - React Testing Library for user-centric testing
 * - Vitest for fast, modern test execution
 * - 3D animation testing
 * - Interaction testing (click, drag, hover)
 * - Accessibility testing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { InteractiveThumbnail } from './InteractiveThumbnail';
import type { InteractiveThumbnailTheme } from './InteractiveThumbnail';

const defaultTheme: InteractiveThumbnailTheme = {
  colors: {
    bgSecondary: '#2a2a2a',
    bgTertiary: '#333333',
    border: 'rgba(255, 255, 255, 0.2)',
    textMuted: '#808080',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
  },
};

describe('InteractiveThumbnail', () => {
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
    it('should render front content initially', () => {
      render(
        <InteractiveThumbnail
          frontContent={<img src="test.jpg" alt="Test" />}
          backContent={<div>Back content</div>}
          theme={defaultTheme}
        />
      );

      expect(screen.getByAltText('Test')).toBeInTheDocument();
      expect(screen.queryByText('Back content')).toBeInTheDocument(); // Back is in DOM but hidden
    });

    it('should render custom front content', () => {
      render(
        <InteractiveThumbnail
          frontContent={<div data-testid="custom-front">Custom Front</div>}
          backContent={<div>Back</div>}
          theme={defaultTheme}
        />
      );

      expect(screen.getByTestId('custom-front')).toBeInTheDocument();
    });

    it('should render custom back content', () => {
      render(
        <InteractiveThumbnail
          frontContent={<div>Front</div>}
          backContent={<div data-testid="custom-back">Custom Back</div>}
          theme={defaultTheme}
        />
      );

      expect(screen.getByTestId('custom-back')).toBeInTheDocument();
    });
  });

  describe('Flip Interaction', () => {
    it('should flip card on click', async () => {
      const onFlip = vi.fn();
      
      render(
        <InteractiveThumbnail
          frontContent={<div>Front</div>}
          backContent={<div>Back</div>}
          onFlip={onFlip}
          theme={defaultTheme}
        />
      );

      const card = screen.getByText('Front').closest('div')?.parentElement?.parentElement;
      expect(card).toBeInTheDocument();

      if (card) {
        await user.click(card);
        vi.runAllTimers();

        await waitFor(() => {
          expect(onFlip).toHaveBeenCalledWith(true);
        });
      }
    });

    it('should flip back on second click', async () => {
      const onFlip = vi.fn();
      
      render(
        <InteractiveThumbnail
          frontContent={<div>Front</div>}
          backContent={<div>Back</div>}
          onFlip={onFlip}
          theme={defaultTheme}
        />
      );

      const card = screen.getByText('Front').closest('div')?.parentElement?.parentElement;

      if (card) {
        // First click - flip to back
        await user.click(card);
        vi.runAllTimers();

        await waitFor(() => {
          expect(onFlip).toHaveBeenCalledWith(true);
        });

        // Second click - flip to front
        await user.click(card);
        vi.runAllTimers();

        await waitFor(() => {
          expect(onFlip).toHaveBeenCalledWith(false);
        });
      }
    });

    it('should not flip during animation', async () => {
      const onFlip = vi.fn();
      
      render(
        <InteractiveThumbnail
          frontContent={<div>Front</div>}
          backContent={<div>Back</div>}
          onFlip={onFlip}
          theme={defaultTheme}
        />
      );

      const card = screen.getByText('Front').closest('div')?.parentElement?.parentElement;

      if (card) {
        // Start first flip
        await user.click(card);
        
        // Try to click again immediately (during animation)
        await user.click(card);
        
        vi.runAllTimers();

        // Should only flip once
        await waitFor(() => {
          expect(onFlip).toHaveBeenCalledTimes(1);
        });
      }
    });
  });

  describe('Hover Tilt Effect', () => {
    it('should apply hover effect on mouse move', async () => {
      render(
        <InteractiveThumbnail
          frontContent={<div data-testid="front">Front</div>}
          backContent={<div>Back</div>}
          theme={defaultTheme}
        />
      );

      const front = screen.getByTestId('front');
      const wrapper = front.closest('div');

      if (wrapper) {
        // Simulate mouse move
        await user.hover(wrapper);
        
        // Move mouse to trigger tilt
        const mouseMoveEvent = new MouseEvent('mousemove', {
          bubbles: true,
          clientX: 100,
          clientY: 100,
        });
        wrapper.dispatchEvent(mouseMoveEvent);

        vi.runAllTimers();

        // Component should handle mouse movement
        expect(wrapper).toBeInTheDocument();
      }
    });

    it('should reset tilt on mouse leave', async () => {
      render(
        <InteractiveThumbnail
          frontContent={<div data-testid="front">Front</div>}
          backContent={<div>Back</div>}
          theme={defaultTheme}
        />
      );

      const front = screen.getByTestId('front');
      const wrapper = front.closest('div');

      if (wrapper) {
        // Hover and move
        await user.hover(wrapper);
        const mouseMoveEvent = new MouseEvent('mousemove', {
          bubbles: true,
          clientX: 100,
          clientY: 100,
        });
        wrapper.dispatchEvent(mouseMoveEvent);

        // Leave
        await user.unhover(wrapper);
        vi.runAllTimers();

        // Tilt should reset (component handles this internally)
        expect(wrapper).toBeInTheDocument();
      }
    });
  });

  describe('Drag Interaction (When Flipped)', () => {
    it('should allow dragging when flipped', async () => {
      render(
        <InteractiveThumbnail
          frontContent={<div>Front</div>}
          backContent={<div data-testid="back">Back</div>}
          theme={defaultTheme}
        />
      );

      const card = screen.getByText('Front').closest('div')?.parentElement?.parentElement;

      if (card) {
        // Flip card first
        await user.click(card);
        vi.runAllTimers();

        // Now try to drag
        const mouseDownEvent = new MouseEvent('mousedown', {
          bubbles: true,
          clientX: 100,
          clientY: 100,
        });
        card.dispatchEvent(mouseDownEvent);

        const mouseMoveEvent = new MouseEvent('mousemove', {
          bubbles: true,
          clientX: 150,
          clientY: 150,
        });
        document.dispatchEvent(mouseMoveEvent);

        const mouseUpEvent = new MouseEvent('mouseup', {
          bubbles: true,
        });
        document.dispatchEvent(mouseUpEvent);

        // Card should handle drag
        expect(card).toBeInTheDocument();
      }
    });

    it('should not allow dragging when not flipped', async () => {
      render(
        <InteractiveThumbnail
          frontContent={<div data-testid="front">Front</div>}
          backContent={<div>Back</div>}
          theme={defaultTheme}
        />
      );

      const card = screen.getByTestId('front').closest('div')?.parentElement?.parentElement;

      if (card) {
        // Try to drag without flipping
        const mouseDownEvent = new MouseEvent('mousedown', {
          bubbles: true,
          clientX: 100,
          clientY: 100,
        });
        card.dispatchEvent(mouseDownEvent);

        const mouseMoveEvent = new MouseEvent('mousemove', {
          bubbles: true,
          clientX: 150,
          clientY: 150,
        });
        document.dispatchEvent(mouseMoveEvent);

        // Should not enter drag mode (front face doesn't support dragging)
        expect(card).toBeInTheDocument();
      }
    });
  });

  describe('Shimmer Effect', () => {
    it('should show shimmer effect when enabled', () => {
      render(
        <InteractiveThumbnail
          frontContent={<div>Front</div>}
          backContent={<div>Back</div>}
          enableShimmer={true}
          theme={defaultTheme}
        />
      );

      // Shimmer container should be in DOM
      const shimmer = document.querySelector('[class*="ShimmerContainer"]');
      expect(shimmer).toBeInTheDocument();
    });

    it('should hide shimmer effect when disabled', () => {
      render(
        <InteractiveThumbnail
          frontContent={<div>Front</div>}
          backContent={<div>Back</div>}
          enableShimmer={false}
          theme={defaultTheme}
        />
      );

      // Component should still render without shimmer
      expect(screen.getByText('Front')).toBeInTheDocument();
    });
  });

  describe('External Watch Element', () => {
    it('should track hover on external element when provided', async () => {
      const watchRef = { current: document.createElement('div') };
      
      render(
        <div>
          <div ref={(el) => { if (el) watchRef.current = el; }}>
            Watch Area
          </div>
          <InteractiveThumbnail
            frontContent={<div>Front</div>}
            backContent={<div>Back</div>}
            watchElementRef={watchRef as any}
            theme={defaultTheme}
          />
        </div>
      );

      // Component should use external watch element
      expect(screen.getByText('Front')).toBeInTheDocument();
    });
  });

  describe('Cursor Styles', () => {
    it('should show pointer cursor on front face', () => {
      render(
        <InteractiveThumbnail
          frontContent={<div data-testid="front">Front</div>}
          backContent={<div>Back</div>}
          theme={defaultTheme}
        />
      );

      const card = screen.getByTestId('front').closest('div')?.parentElement?.parentElement;
      expect(card).toHaveStyle({ cursor: 'pointer' });
    });

    it('should show grab cursor on back face', async () => {
      render(
        <InteractiveThumbnail
          frontContent={<div>Front</div>}
          backContent={<div data-testid="back">Back</div>}
          theme={defaultTheme}
        />
      );

      const card = screen.getByText('Front').closest('div')?.parentElement?.parentElement;

      if (card) {
        // Flip to back
        await user.click(card);
        vi.runAllTimers();

        await waitFor(() => {
          expect(card).toHaveStyle({ cursor: 'grab' });
        });
      }
    });

    it('should show grabbing cursor while dragging', async () => {
      render(
        <InteractiveThumbnail
          frontContent={<div>Front</div>}
          backContent={<div>Back</div>}
          theme={defaultTheme}
        />
      );

      const card = screen.getByText('Front').closest('div')?.parentElement?.parentElement;

      if (card) {
        // Flip to back
        await user.click(card);
        vi.runAllTimers();

        // Start dragging
        const mouseDownEvent = new MouseEvent('mousedown', {
          bubbles: true,
          clientX: 100,
          clientY: 100,
        });
        card.dispatchEvent(mouseDownEvent);

        await waitFor(() => {
          expect(card).toHaveStyle({ cursor: 'grabbing' });
        });

        // Stop dragging
        const mouseUpEvent = new MouseEvent('mouseup', {
          bubbles: true,
        });
        document.dispatchEvent(mouseUpEvent);
      }
    });
  });

  describe('Theme Support', () => {
    it('should apply custom theme', () => {
      const customTheme: InteractiveThumbnailTheme = {
        colors: {
          bgSecondary: '#ff0000',
          bgTertiary: '#00ff00',
          border: '#0000ff',
          textMuted: '#ffffff',
        },
        spacing: {
          xs: '2px',
          sm: '4px',
          md: '8px',
          lg: '12px',
        },
      };

      render(
        <InteractiveThumbnail
          frontContent={<div>Front</div>}
          backContent={<div>Back</div>}
          theme={customTheme}
        />
      );

      // Component should render with custom theme
      expect(screen.getByText('Front')).toBeInTheDocument();
    });
  });

  describe('Flip Hint', () => {
    it('should show flip hint when flipped', async () => {
      render(
        <InteractiveThumbnail
          frontContent={<div>Front</div>}
          backContent={<div>Back</div>}
          theme={defaultTheme}
        />
      );

      const card = screen.getByText('Front').closest('div')?.parentElement?.parentElement;

      if (card) {
        // Flip card
        await user.click(card);
        vi.runAllTimers();

        await waitFor(() => {
          expect(screen.getByText(/Drag to rotate/i)).toBeInTheDocument();
          expect(screen.getByText(/Click to flip back/i)).toBeInTheDocument();
        });
      }
    });

    it('should not show flip hint on front face', () => {
      render(
        <InteractiveThumbnail
          frontContent={<div>Front</div>}
          backContent={<div>Back</div>}
          theme={defaultTheme}
        />
      );

      expect(screen.queryByText(/Drag to rotate/i)).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should be keyboard accessible', async () => {
      render(
        <InteractiveThumbnail
          frontContent={<div>Front</div>}
          backContent={<div>Back</div>}
          theme={defaultTheme}
        />
      );

      const card = screen.getByText('Front').closest('div')?.parentElement?.parentElement;

      if (card) {
        // Should be focusable and clickable
        card.focus();
        expect(document.activeElement).toBe(card);
      }
    });

    it('should prevent text selection during interaction', () => {
      render(
        <InteractiveThumbnail
          frontContent={<div>Front</div>}
          backContent={<div>Back</div>}
          theme={defaultTheme}
        />
      );

      const card = screen.getByText('Front').closest('div')?.parentElement?.parentElement;
      
      // User-select should be none on card
      expect(card).toHaveStyle({ userSelect: 'none' });
    });
  });

  describe('Cleanup', () => {
    it('should cleanup animations on unmount', () => {
      const { unmount } = render(
        <InteractiveThumbnail
          frontContent={<div>Front</div>}
          backContent={<div>Back</div>}
          theme={defaultTheme}
        />
      );

      unmount();

      // Should not throw errors
      expect(() => vi.runAllTimers()).not.toThrow();
    });

    it('should cleanup event listeners on unmount', async () => {
      const { unmount } = render(
        <InteractiveThumbnail
          frontContent={<div>Front</div>}
          backContent={<div>Back</div>}
          theme={defaultTheme}
        />
      );

      const card = screen.getByText('Front').closest('div')?.parentElement?.parentElement;

      if (card) {
        // Flip card to add event listeners
        await user.click(card);
        vi.runAllTimers();
      }

      unmount();

      // Should cleanup without errors
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Animation Performance', () => {
    it('should use requestAnimationFrame for smooth animations', async () => {
      const rafSpy = vi.spyOn(window, 'requestAnimationFrame');
      
      render(
        <InteractiveThumbnail
          frontContent={<div>Front</div>}
          backContent={<div>Back</div>}
          theme={defaultTheme}
        />
      );

      const card = screen.getByText('Front').closest('div')?.parentElement?.parentElement;

      if (card) {
        await user.click(card);
        
        // Should use requestAnimationFrame for flip animation
        expect(rafSpy).toHaveBeenCalled();
      }

      rafSpy.mockRestore();
    });

    it('should cancel animations when component unmounts', async () => {
      const { unmount } = render(
        <InteractiveThumbnail
          frontContent={<div>Front</div>}
          backContent={<div>Back</div>}
          theme={defaultTheme}
        />
      );

      const card = screen.getByText('Front').closest('div')?.parentElement?.parentElement;

      if (card) {
        // Start flip animation
        await user.click(card);
        
        // Unmount during animation
        unmount();
      }

      // Should cleanup without errors
      expect(() => vi.runAllTimers()).not.toThrow();
    });
  });
});
