/**
 * Interactive 3D Thumbnail Card Component - Mods Hub Wrapper
 * 
 * Mod-specific wrapper around shared InteractiveThumbnail component.
 * Handles mod metadata formatting and content rendering.
 */

import React from 'react';
import styled from 'styled-components';
import { InteractiveThumbnail as SharedInteractiveThumbnail } from '@strixun/shared-components/react';
import type { InteractiveThumbnailTheme } from '@strixun/shared-components/react';
import { colors, spacing } from '../../theme';
import type { ModMetadata } from '../../types/mod';

const ThumbnailImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  pointer-events: none;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  -webkit-user-drag: none;
`;

const PlaceholderImage = styled.div`
  width: 100%;
  height: 100%;
  background: ${colors.bgTertiary};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${colors.textMuted};
  font-size: 0.75rem;
`;

const BackTitle = styled.h3`
  font-size: clamp(0.85rem, 5vw, 1rem);
  font-weight: 600;
  color: ${colors.text};
  margin: 0;
  line-height: 1.3;
  flex-shrink: 0;
  user-select: text;
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
`;

const BackDescription = styled.p`
  font-size: clamp(0.7rem, 3.5vw, 0.75rem);
  color: ${colors.textSecondary};
  line-height: 1.6;
  flex: 1;
  margin: 0;
  min-height: 0;
  user-select: text;
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
  word-wrap: break-word;
  overflow-wrap: break-word;
`;

const BackMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.xs};
  font-size: clamp(0.65rem, 3vw, 0.7rem);
  color: ${colors.textMuted};
  flex-shrink: 0;
  padding-top: ${spacing.sm};
  margin-top: ${spacing.xs};
  border-top: 1px solid ${colors.border};
  user-select: text;
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
`;

const MetaRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing.xs};
  user-select: text;
`;

const MetaLabel = styled.span`
  font-weight: 500;
  color: ${colors.textSecondary};
  min-width: 70px;
`;

interface InteractiveThumbnailProps {
  mod: ModMetadata;
  onError?: () => void;
  watchElementRef?: React.RefObject<HTMLDivElement | null>;
}

// Theme configuration for shared InteractiveThumbnail component
const thumbnailTheme: InteractiveThumbnailTheme = {
  colors: {
    bgSecondary: colors.bgSecondary,
    bgTertiary: colors.bgTertiary,
    border: colors.border,
    textMuted: colors.textMuted,
  },
  spacing: {
    xs: spacing.xs,
    sm: spacing.sm,
    md: spacing.md,
    lg: spacing.lg,
  },
};

export function InteractiveThumbnail({ mod, onError, watchElementRef }: InteractiveThumbnailProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Front face content - thumbnail image
  const frontContent = mod.thumbnailUrl ? (
    <ThumbnailImage
      src={mod.thumbnailUrl}
      alt={mod.title}
      onError={onError}
    />
  ) : (
    <PlaceholderImage>
      No thumbnail
    </PlaceholderImage>
  );

  // Back face content - mod details
  const backContent = (
    <>
      <BackTitle>{mod.title}</BackTitle>
      <BackDescription>
        {mod.description || 'No description available'}
      </BackDescription>
      <BackMeta>
        <MetaRow>
          <MetaLabel>Uploader:</MetaLabel>
          <span>{mod.authorDisplayName || 'Unknown'}</span>
        </MetaRow>
        <MetaRow>
          <MetaLabel>Uploaded:</MetaLabel>
          <span>{formatDate(mod.createdAt)}</span>
        </MetaRow>
        <MetaRow>
          <MetaLabel>Updated:</MetaLabel>
          <span>{formatDate(mod.updatedAt)}</span>
        </MetaRow>
        <MetaRow>
          <MetaLabel>Downloads:</MetaLabel>
          <span>{mod.downloadCount.toLocaleString()}</span>
        </MetaRow>
      </BackMeta>
    </>
  );

  return (
    <SharedInteractiveThumbnail
      frontContent={frontContent}
      backContent={backContent}
      thumbnailUrl={mod.thumbnailUrl}
      watchElementRef={watchElementRef}
      onFlip={(isFlipped) => {
        // Could add analytics or other side effects here if needed
        console.debug('Thumbnail flipped:', isFlipped);
      }}
      theme={thumbnailTheme}
      enableShimmer={true}
    />
  );
}
