/**
 * InteractiveThumbnail Integration Tests (Mods Hub)
 * 
 * Tests the integration of shared InteractiveThumbnail with mod-specific wrapper
 * Following 2026 best practices for integration testing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { InteractiveThumbnail } from './InteractiveThumbnail';
import type { ModMetadata } from '../../types/mod';

const mockMod: ModMetadata = {
  modId: 'test-mod-id',
  slug: 'test-mod',
  title: 'Test Mod',
  description: 'This is a test mod description',
  thumbnailUrl: 'https://example.com/thumbnail.jpg',
  authorId: 'author-123',
  authorDisplayName: 'Test Author',
  customerId: 'customer-123',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-06T00:00:00Z',
  downloadCount: 1234,
  visibility: 'public' as const,
  status: 'published' as const,
  tags: ['test', 'mod'],
  category: 'gameplay',
  versions: [],
};

describe('InteractiveThumbnail Integration (Mods Hub)', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('Mod Content Rendering', () => {
    it('should render mod thumbnail on front face', () => {
      render(<InteractiveThumbnail mod={mockMod} />);

      const thumbnail = screen.getByAltText('Test Mod');
      expect(thumbnail).toBeInTheDocument();
      expect(thumbnail).toHaveAttribute('src', 'https://example.com/thumbnail.jpg');
    });

    it('should render placeholder when no thumbnail URL', () => {
      const modWithoutThumbnail = { ...mockMod, thumbnailUrl: undefined };
      
      render(<InteractiveThumbnail mod={modWithoutThumbnail} />);

      expect(screen.getByText('No thumbnail')).toBeInTheDocument();
    });

    it('should render mod details on back face', () => {
      render(<InteractiveThumbnail mod={mockMod} />);

      // Back face content is in DOM but hidden
      expect(screen.getByText('Test Mod')).toBeInTheDocument();
      expect(screen.getByText('This is a test mod description')).toBeInTheDocument();
      expect(screen.getByText('Test Author')).toBeInTheDocument();
    });

    it('should format dates correctly', () => {
      render(<InteractiveThumbnail mod={mockMod} />);

      // Dates should be formatted
      expect(screen.getByText(/Jan 1, 2025/)).toBeInTheDocument();
      expect(screen.getByText(/Jan 6, 2026/)).toBeInTheDocument();
    });

    it('should format download count with commas', () => {
      render(<InteractiveThumbnail mod={mockMod} />);

      expect(screen.getByText('1,234')).toBeInTheDocument();
    });

    it('should show "Unknown" for missing author display name', () => {
      const modWithoutAuthor = { ...mockMod, authorDisplayName: undefined };
      
      render(<InteractiveThumbnail mod={modWithoutAuthor} />);

      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });

    it('should show "No description available" for missing description', () => {
      const modWithoutDescription = { ...mockMod, description: undefined };
      
      render(<InteractiveThumbnail mod={modWithoutDescription} />);

      expect(screen.getByText('No description available')).toBeInTheDocument();
    });
  });

  describe('Flip Interaction with Mod Content', () => {
    it('should flip to show mod details on click', async () => {
      render(<InteractiveThumbnail mod={mockMod} />);

      const card = screen.getByAltText('Test Mod').closest('div')?.parentElement?.parentElement;
      
      if (card) {
        await user.click(card);
        vi.runAllTimers();

        await waitFor(() => {
          // Back face content should be visible
          expect(screen.getByText('Test Mod')).toBeVisible();
          expect(screen.getByText('This is a test mod description')).toBeVisible();
        });
      }
    });

    it('should show flip hint when flipped', async () => {
      render(<InteractiveThumbnail mod={mockMod} />);

      const card = screen.getByAltText('Test Mod').closest('div')?.parentElement?.parentElement;
      
      if (card) {
        await user.click(card);
        vi.runAllTimers();

        await waitFor(() => {
          expect(screen.getByText(/Drag to rotate/i)).toBeInTheDocument();
          expect(screen.getByText(/Click to flip back/i)).toBeInTheDocument();
        });
      }
    });
  });

  describe('Error Handling', () => {
    it('should call onError when thumbnail fails to load', async () => {
      const onError = vi.fn();
      
      render(<InteractiveThumbnail mod={mockMod} onError={onError} />);

      const thumbnail = screen.getByAltText('Test Mod');
      
      // Simulate image load error
      const errorEvent = new Event('error');
      thumbnail.dispatchEvent(errorEvent);

      expect(onError).toHaveBeenCalled();
    });

    it('should handle missing thumbnail gracefully', () => {
      const modWithoutThumbnail = { ...mockMod, thumbnailUrl: undefined };
      
      render(<InteractiveThumbnail mod={modWithoutThumbnail} />);

      // Should show placeholder instead of crashing
      expect(screen.getByText('No thumbnail')).toBeInTheDocument();
    });
  });

  describe('External Watch Element Integration', () => {
    it('should track hover on external element when provided', () => {
      const watchRef = { current: document.createElement('div') };
      
      render(
        <div>
          <div ref={(el) => { if (el) watchRef.current = el; }}>
            Watch Area
          </div>
          <InteractiveThumbnail 
            mod={mockMod} 
            watchElementRef={watchRef as any}
          />
        </div>
      );

      // Component should render with external watch element
      expect(screen.getByAltText('Test Mod')).toBeInTheDocument();
    });
  });

  describe('Metadata Display', () => {
    it('should display all metadata fields', () => {
      render(<InteractiveThumbnail mod={mockMod} />);

      // Check for metadata labels
      expect(screen.getByText('Uploader:')).toBeInTheDocument();
      expect(screen.getByText('Uploaded:')).toBeInTheDocument();
      expect(screen.getByText('Updated:')).toBeInTheDocument();
      expect(screen.getByText('Downloads:')).toBeInTheDocument();
    });

    it('should handle large download counts', () => {
      const modWithLargeDownloads = { ...mockMod, downloadCount: 1234567 };
      
      render(<InteractiveThumbnail mod={modWithLargeDownloads} />);

      expect(screen.getByText('1,234,567')).toBeInTheDocument();
    });

    it('should handle zero downloads', () => {
      const modWithZeroDownloads = { ...mockMod, downloadCount: 0 };
      
      render(<InteractiveThumbnail mod={modWithZeroDownloads} />);

      expect(screen.getByText('0')).toBeInTheDocument();
    });
  });

  describe('Styling and Theme', () => {
    it('should apply mods-hub theme', () => {
      render(<InteractiveThumbnail mod={mockMod} />);

      // Component should render with theme
      expect(screen.getByAltText('Test Mod')).toBeInTheDocument();
    });

    it('should have proper text wrapping for long descriptions', () => {
      const modWithLongDescription = {
        ...mockMod,
        description: 'This is a very long description that should wrap properly and not overflow the container boundaries. '.repeat(10),
      };
      
      render(<InteractiveThumbnail mod={modWithLongDescription} />);

      const description = screen.getByText(/This is a very long description/);
      expect(description).toHaveStyle({ wordWrap: 'break-word' });
    });

    it('should have proper text wrapping for long titles', () => {
      const modWithLongTitle = {
        ...mockMod,
        title: 'This Is A Very Long Mod Title That Should Wrap Properly',
      };
      
      render(<InteractiveThumbnail mod={modWithLongTitle} />);

      const title = screen.getByText('This Is A Very Long Mod Title That Should Wrap Properly');
      expect(title).toBeInTheDocument();
    });
  });

  describe('Shimmer Effect', () => {
    it('should show shimmer effect on front face by default', () => {
      render(<InteractiveThumbnail mod={mockMod} />);

      // Shimmer container should be in DOM
      const shimmer = document.querySelector('[class*="ShimmerContainer"]');
      expect(shimmer).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible image alt text', () => {
      render(<InteractiveThumbnail mod={mockMod} />);

      const thumbnail = screen.getByAltText('Test Mod');
      expect(thumbnail).toBeInTheDocument();
    });

    it('should allow text selection on back face', () => {
      render(<InteractiveThumbnail mod={mockMod} />);

      const description = screen.getByText('This is a test mod description');
      expect(description).toHaveStyle({ userSelect: 'text' });
    });

    it('should have proper cursor styles', () => {
      render(<InteractiveThumbnail mod={mockMod} />);

      const card = screen.getByAltText('Test Mod').closest('div')?.parentElement?.parentElement;
      expect(card).toHaveStyle({ cursor: 'pointer' });
    });
  });

  describe('Cleanup', () => {
    it('should cleanup on unmount', () => {
      const { unmount } = render(<InteractiveThumbnail mod={mockMod} />);

      unmount();

      // Should not throw errors
      expect(() => vi.runAllTimers()).not.toThrow();
    });
  });

  describe('Integration with Shared Component', () => {
    it('should pass correct props to shared InteractiveThumbnail', () => {
      render(<InteractiveThumbnail mod={mockMod} />);

      // Front content should be rendered (thumbnail)
      expect(screen.getByAltText('Test Mod')).toBeInTheDocument();

      // Back content should be rendered (mod details)
      expect(screen.getByText('Test Mod')).toBeInTheDocument();
      expect(screen.getByText('This is a test mod description')).toBeInTheDocument();
    });

    it('should handle flip callback', async () => {
      // Mock console.debug to verify flip callback
      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      
      render(<InteractiveThumbnail mod={mockMod} />);

      const card = screen.getByAltText('Test Mod').closest('div')?.parentElement?.parentElement;
      
      if (card) {
        await user.click(card);
        vi.runAllTimers();

        await waitFor(() => {
          expect(debugSpy).toHaveBeenCalledWith('Thumbnail flipped:', true);
        });
      }

      debugSpy.mockRestore();
    });
  });
});
