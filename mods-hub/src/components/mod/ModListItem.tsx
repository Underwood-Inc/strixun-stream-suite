/**
 * Mod list item component
 * Displays mod in a horizontal list layout with proper aspect ratio
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { colors, spacing, media } from '../../theme';
import type { ModMetadata } from '../../types/mod';
import { MarkdownContent } from '../common/MarkdownContent';

const ListItemContainer = styled(Link)`
  display: flex;
  align-items: flex-start;
  gap: ${spacing.lg};
  padding: ${spacing.lg};
  text-decoration: none;
  color: inherit;
  border-bottom: 1px solid ${colors.border};
  transition: background 0.2s ease;
  background: ${colors.bgSecondary};
  
  &:hover {
    background: ${colors.bgTertiary};
  }
  
  &:last-child {
    border-bottom: none;
  }
  
  @media (max-width: 1024px) {
    gap: ${spacing.md};
    padding: ${spacing.md};
  }
  
  ${media.mobile} {
    flex-direction: column;
    align-items: stretch;
    gap: ${spacing.md};
    padding: ${spacing.md};
  }
`;

const ThumbnailContainer = styled.div`
  flex-shrink: 0;
  width: 140px;
  height: 105px;
  position: relative;
  border-radius: 6px;
  overflow: hidden;
  background: ${colors.bgTertiary};
  border: 1px solid ${colors.border};
  
  @media (max-width: 1024px) {
    width: 120px;
    height: 90px;
  }
  
  ${media.mobile} {
    width: 100%;
    height: auto;
    aspect-ratio: 4 / 3;
    max-width: 100%;
    align-self: center;
  }
`;

const Thumbnail = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center;
`;

const ThumbnailError = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: ${colors.textSecondary};
  font-size: 0.75rem;
  padding: ${spacing.xs};
  border: 2px dashed ${colors.border};
`;

const ErrorIcon = styled.div`
  font-size: 1.5rem;
  margin-bottom: ${spacing.xs};
  opacity: 0.7;
`;

const Content = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: ${spacing.sm};
  min-width: 0;
  
  ${media.mobile} {
    width: 100%;
    gap: ${spacing.sm};
    min-width: auto;
  }
`;

const Title = styled.h3`
  font-size: clamp(1rem, 2.5vw, 1.125rem);
  font-weight: 600;
  color: ${colors.text};
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  
  ${media.mobile} {
    font-size: clamp(1.125rem, 3vw, 1.25rem);
    white-space: normal;
    overflow: visible;
    text-overflow: unset;
  }
`;

const Author = styled.div`
  font-size: 0.8125rem;
  color: ${colors.textMuted};
  margin: 0;
  display: flex;
  align-items: center;
  gap: ${spacing.xs};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  
  @media (max-width: 1024px) {
    font-size: 0.75rem;
  }
  
  ${media.mobile} {
    font-size: 0.875rem;
    white-space: normal;
    overflow: visible;
  }
`;

const AuthorLabel = styled.span`
  font-weight: 500;
  color: ${colors.textSecondary};
`;

const Description = styled.div`
  color: ${colors.textSecondary};
  font-size: 0.875rem;
  line-height: 1.5;
  margin: 0;
  max-height: 120px;
  overflow-y: auto;
  word-break: break-word;
  
  /* Scrollbar styling */
  &::-webkit-scrollbar {
    width: 4px;
  }
  
  &::-webkit-scrollbar-track {
    background: ${colors.bgTertiary};
    border-radius: 2px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: ${colors.border};
    border-radius: 2px;
    
    &:hover {
      background: ${colors.textMuted};
    }
  }
  
  @media (max-width: 1024px) {
    font-size: 0.8125rem;
    max-height: 100px;
  }
  
  ${media.mobile} {
    font-size: 0.875rem;
    line-height: 1.6;
    max-height: 150px;
  }
`;

const Meta = styled.div`
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: ${spacing.xs};
  min-width: 120px;
  justify-content: center;
  
  @media (max-width: 1024px) {
    min-width: 100px;
    font-size: 0.8125rem;
  }
  
  ${media.mobile} {
    flex-direction: row;
    width: 100%;
    justify-content: space-between;
    align-items: center;
    min-width: 0;
    margin-top: 0;
    flex-wrap: wrap;
    gap: ${spacing.sm};
  }
`;

const Category = styled.span`
  background: ${colors.accent}20;
  color: ${colors.accent};
  padding: ${spacing.xs} ${spacing.sm};
  border-radius: 4px;
  font-weight: 500;
  font-size: 0.75rem;
  white-space: nowrap;
  
  ${media.mobile} {
    font-size: 0.8125rem;
    padding: ${spacing.sm} ${spacing.md};
  }
`;

const DownloadCount = styled.span`
  font-size: 0.875rem;
  color: ${colors.textMuted};
  
  ${media.mobile} {
    font-size: 0.8125rem;
  }
`;

interface ModListItemProps {
    slug: string;
    thumbnailUrl?: string;
    title: string;
    authorDisplayName?: string;
    description?: string;
    category: string;
    downloadCount: number;
}

/**
 * Maps a ModMetadata object to ModListItemProps
 * Centralizes the prop extraction logic for easier maintenance
 */
export function mapModToListItemProps(mod: ModMetadata): ModListItemProps {
    return {
        slug: mod.slug,
        thumbnailUrl: mod.thumbnailUrl ?? undefined,
        title: mod.title,
        authorDisplayName: mod.authorDisplayName ?? undefined,
        description: mod.description ?? undefined,
        category: mod.category,
        downloadCount: mod.downloadCount,
    };
}

export function ModListItem({ 
    slug,
    thumbnailUrl,
    title,
    authorDisplayName,
    description,
    category,
    downloadCount
}: ModListItemProps) {
    const [thumbnailError, setThumbnailError] = useState(false);

    const handleThumbnailError = () => {
        setThumbnailError(true);
    };

    return (
        <ListItemContainer to={`/${slug}`}>
            <ThumbnailContainer>
                {thumbnailUrl ? (
                    thumbnailError ? (
                        <ThumbnailError>
                            <ErrorIcon>⚠</ErrorIcon>
                            <div>No thumbnail</div>
                        </ThumbnailError>
                    ) : (
                        <Thumbnail 
                            src={thumbnailUrl} 
                            alt={title}
                            onError={handleThumbnailError}
                        />
                    )
                ) : (
                    <ThumbnailError>
                        <ErrorIcon>▣</ErrorIcon>
                        <div>No thumbnail</div>
                    </ThumbnailError>
                )}
            </ThumbnailContainer>
            <Content>
                <Title>{title}</Title>
                <Author>
                    <AuthorLabel>by</AuthorLabel>
                    <span>{authorDisplayName || 'Unknown Author'}</span>
                </Author>
                <Description>
                    <MarkdownContent content={description || 'No description available'} />
                </Description>
            </Content>
            <Meta>
                <Category>{category}</Category>
                <DownloadCount>{downloadCount} downloads</DownloadCount>
            </Meta>
        </ListItemContainer>
    );
}
