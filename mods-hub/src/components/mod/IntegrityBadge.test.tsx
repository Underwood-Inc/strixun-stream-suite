/**
 * IntegrityBadge Integration Tests
 * 
 * Tests the integration of shared Tooltip component with IntegrityBadge
 * Following 2026 best practices for integration testing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { IntegrityBadge } from './IntegrityBadge';

// Mock fetch for badge API calls
global.fetch = vi.fn();

describe('IntegrityBadge Integration', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('Tooltip Integration', () => {
    it('should show tooltip with integrity information on hover', async () => {
      // Mock successful badge fetch
      const mockBlob = new Blob(['<svg></svg>'], { type: 'image/svg+xml' });
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      render(
        <IntegrityBadge
          slug="test-mod"
          versionId="v1"
        />
      );

      // Wait for badge to load
      await waitFor(() => {
        const badge = screen.queryByAltText('Strixun Verified');
        expect(badge).toBeInTheDocument();
      });

      // Hover over badge
      const badge = screen.getByAltText('Strixun Verified');
      await user.hover(badge);
      
      // Run all timers to process delay and animations
      await vi.runAllTimersAsync();

      // Tooltip should appear with integrity information
      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
        expect(screen.getByText('File Integrity Status')).toBeInTheDocument();
      }, { timeout: 1000 });
    });

    it('should show detailed badge states in tooltip', async () => {
      const mockBlob = new Blob(['<svg></svg>'], { type: 'image/svg+xml' });
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      render(
        <IntegrityBadge
          slug="test-mod"
          versionId="v1"
        />
      );

      await waitFor(() => {
        expect(screen.getByAltText('Strixun Verified')).toBeInTheDocument();
      });

      const badge = screen.getByAltText('Strixun Verified');
      await user.hover(badge);
      vi.advanceTimersByTime(200);

      await waitFor(() => {
        const tooltip = screen.getByRole('tooltip');
        expect(tooltip).toBeInTheDocument();
        
        // Check for badge state descriptions
        expect(screen.getByText(/Verified \(Green\)/i)).toBeInTheDocument();
        expect(screen.getByText(/Tampered \(Orange\)/i)).toBeInTheDocument();
        expect(screen.getByText(/Unverified \(Red\)/i)).toBeInTheDocument();
      });
    });

    it('should keep tooltip visible when hovering over it (interactive mode)', async () => {
      const mockBlob = new Blob(['<svg></svg>'], { type: 'image/svg+xml' });
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      render(
        <IntegrityBadge
          slug="test-mod"
          versionId="v1"
        />
      );

      await waitFor(() => {
        expect(screen.getByAltText('Strixun Verified')).toBeInTheDocument();
      });

      const badge = screen.getByAltText('Strixun Verified');
      await user.hover(badge);
      vi.advanceTimersByTime(200);

      const tooltip = await screen.findByRole('tooltip');
      
      // Move mouse from badge to tooltip
      await user.unhover(badge);
      await user.hover(tooltip);
      vi.runAllTimers();

      // Tooltip should still be visible
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    it('should hide tooltip when mouse leaves both badge and tooltip', async () => {
      const mockBlob = new Blob(['<svg></svg>'], { type: 'image/svg+xml' });
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      render(
        <IntegrityBadge
          slug="test-mod"
          versionId="v1"
        />
      );

      await waitFor(() => {
        expect(screen.getByAltText('Strixun Verified')).toBeInTheDocument();
      });

      const badge = screen.getByAltText('Strixun Verified');
      await user.hover(badge);
      vi.advanceTimersByTime(200);

      const tooltip = await screen.findByRole('tooltip');
      await user.unhover(badge);
      await user.unhover(tooltip);
      vi.runAllTimers();

      await waitFor(() => {
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      });
    });
  });

  describe('Badge Loading States', () => {
    it('should show loading placeholder while fetching badge', () => {
      // Mock pending fetch
      (global.fetch as any).mockImplementationOnce(() => new Promise(() => {}));

      render(
        <IntegrityBadge
          slug="test-mod"
          versionId="v1"
        />
      );

      // Loading placeholder should be visible
      const placeholder = document.querySelector('[class*="BadgeLoadingPlaceholder"]');
      expect(placeholder).toBeInTheDocument();
    });

    it('should show badge after successful fetch', async () => {
      const mockBlob = new Blob(['<svg></svg>'], { type: 'image/svg+xml' });
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      render(
        <IntegrityBadge
          slug="test-mod"
          versionId="v1"
        />
      );

      await waitFor(() => {
        expect(screen.getByAltText('Strixun Verified')).toBeInTheDocument();
      });
    });

    it('should handle badge fetch error gracefully', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      render(
        <IntegrityBadge
          slug="test-mod"
          versionId="v1"
        />
      );

      // Should not crash and should not show badge
      await waitFor(() => {
        expect(screen.queryByAltText('Strixun Verified')).not.toBeInTheDocument();
      });
    });
  });

  describe('Badge Variants', () => {
    it('should fetch badge with flat style by default', async () => {
      const mockBlob = new Blob(['<svg></svg>'], { type: 'image/svg+xml' });
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      render(
        <IntegrityBadge
          slug="test-mod"
          versionId="v1"
        />
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/badge'),
          expect.any(Object)
        );
      });
    });

    it('should fetch badge with custom style', async () => {
      const mockBlob = new Blob(['<svg></svg>'], { type: 'image/svg+xml' });
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      render(
        <IntegrityBadge
          slug="test-mod"
          versionId="v1"
          style="flat-square"
        />
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('style=flat-square'),
          expect.any(Object)
        );
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper alt text for badge image', async () => {
      const mockBlob = new Blob(['<svg></svg>'], { type: 'image/svg+xml' });
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      render(
        <IntegrityBadge
          slug="test-mod"
          versionId="v1"
        />
      );

      await waitFor(() => {
        const badge = screen.getByAltText('Strixun Verified');
        expect(badge).toBeInTheDocument();
      });
    });

    it('should have proper ARIA attributes on tooltip', async () => {
      const mockBlob = new Blob(['<svg></svg>'], { type: 'image/svg+xml' });
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      render(
        <IntegrityBadge
          slug="test-mod"
          versionId="v1"
        />
      );

      await waitFor(() => {
        expect(screen.getByAltText('Strixun Verified')).toBeInTheDocument();
      });

      const badge = screen.getByAltText('Strixun Verified');
      await user.hover(badge);
      vi.advanceTimersByTime(200);

      await waitFor(() => {
        const tooltip = screen.getByRole('tooltip');
        expect(tooltip).toHaveAttribute('aria-live', 'polite');
      });
    });
  });

  describe('Cleanup', () => {
    it('should cleanup blob URL on unmount', async () => {
      const mockBlob = new Blob(['<svg></svg>'], { type: 'image/svg+xml' });
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL');

      const { unmount } = render(
        <IntegrityBadge
          slug="test-mod"
          versionId="v1"
        />
      );

      await waitFor(() => {
        expect(screen.getByAltText('Strixun Verified')).toBeInTheDocument();
      });

      unmount();

      // Should revoke blob URL
      expect(revokeObjectURLSpy).toHaveBeenCalled();

      revokeObjectURLSpy.mockRestore();
    });
  });
});
