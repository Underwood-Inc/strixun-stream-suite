/**
 * Mod list item component
 * Displays mod in a horizontal list layout with proper aspect ratio
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { colors, spacing, media } from '../../theme';
import type { ModMetadata } from '../../types/mod';

const ListItemContainer = styled(Link)`
  display: flex;
  align-items: center;
  gap: ${spacing.md};
  padding: ${spacing.md} ${spacing.lg};
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
  
  ${media.mobile} {
    flex-direction: column;
    align-items: flex-start;
    gap: ${spacing.sm};
    padding: ${spacing.md};
  }
`;

const ThumbnailContainer = styled.div`
  flex-shrink: 0;
  width: 120px;
  height: 90px;
  position: relative;
  border-radius: 4px;
  overflow: hidden;
  background: ${colors.bgTertiary};
  border: 1px solid ${colors.border};
  
  ${media.mobile} {
    width: 100%;
    height: auto;
    aspect-ratio: 4 / 3;
    max-width: 200px;
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
  gap: ${spacing.xs};
  min-width: 0;
  
  ${media.mobile} {
    width: 100%;
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
`;

const Author = styled.div`
  font-size: 0.8125rem;
  color: ${colors.textMuted};
  margin: 0;
  display: flex;
  align-items: center;
  gap: ${spacing.xs};
  
  ${media.mobile} {
    font-size: 0.75rem;
  }
`;

const AuthorLabel = styled.span`
  font-weight: 500;
  color: ${colors.textSecondary};
`;

const Description = styled.p`
  color: ${colors.textSecondary};
  font-size: 0.875rem;
  line-height: 1.5;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  
  ${media.mobile} {
    font-size: 0.8125rem;
    -webkit-line-clamp: 3;
  }
`;

const Meta = styled.div`
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: ${spacing.xs};
  min-width: 120px;
  
  ${media.mobile} {
    flex-direction: row;
    width: 100%;
    justify-content: space-between;
    align-items: center;
    min-width: 0;
    margin-top: ${spacing.xs};
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
`;

const DownloadCount = styled.span`
  font-size: 0.875rem;
  color: ${colors.textMuted};
  
  ${media.mobile} {
    font-size: 0.75rem;
  }
`;

interface ModListItemProps {
    mod: ModMetadata;
}

export function ModListItem({ mod }: ModListItemProps) {
    const [thumbnailError, setThumbnailError] = useState(false);

    const handleThumbnailError = () => {
        setThumbnailError(true);
    };

    return (
        <ListItemContainer to={`/${mod.slug}`}>
            <ThumbnailContainer>
                {mod.thumbnailUrl ? (
                    thumbnailError ? (
                        <ThumbnailError>
                            <ErrorIcon>⚠</ErrorIcon>
                            <div>No thumbnail</div>
                        </ThumbnailError>
                    ) : (
                        <Thumbnail 
                            src={mod.thumbnailUrl} 
                            alt={mod.title}
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
                <Title>{mod.title}</Title>
                <Author>
                    <AuthorLabel>by</AuthorLabel>
                    <span>{mod.authorDisplayName || 'Unknown Author'}</span>
                </Author>
                <Description>{mod.description || 'No description available'}</Description>
            </Content>
            <Meta>
                <Category>{mod.category}</Category>
                <DownloadCount>{mod.downloadCount} downloads</DownloadCount>
            </Meta>
        </ListItemContainer>
    );
}
