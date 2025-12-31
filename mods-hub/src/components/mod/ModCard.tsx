/**
 * Mod card component
 * Displays mod preview in grid
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { colors, spacing } from '../../theme';
import type { ModMetadata } from '../../types/mod';
import { getButtonStyles } from '../../utils/buttonStyles';
import { getCardStyles } from '../../utils/sharedStyles';

const CardContainer = styled.div`
  ${getCardStyles('hover')}
  position: relative;
  overflow: hidden;
`;

const Card = styled(Link)`
  padding: ${spacing.lg};
  display: flex;
  flex-direction: column;
  gap: ${spacing.md};
  text-decoration: none;
  color: inherit;
`;

const DeleteButton = styled.button`
  ${getButtonStyles('danger')}
  position: absolute;
  top: ${spacing.sm};
  right: ${spacing.sm};
  font-size: 0.75rem;
  padding: ${spacing.xs} ${spacing.sm};
  opacity: 0;
  transition: opacity 0.2s ease;
  z-index: 10;
  
  ${CardContainer}:hover & {
    opacity: 1;
  }
`;

const Thumbnail = styled.img`
  width: 100%;
  aspect-ratio: 16/9;
  object-fit: cover;
  border-radius: 4px;
  background: ${colors.bgTertiary};
`;

const ThumbnailError = styled.div`
  width: 100%;
  aspect-ratio: 16/9;
  border-radius: 4px;
  background: ${colors.bgTertiary};
  border: 2px dashed ${colors.warning || colors.accent}40;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${spacing.md};
  text-align: center;
  color: ${colors.textSecondary};
`;

const ErrorIcon = styled.div`
  font-size: 2rem;
  margin-bottom: ${spacing.xs};
  opacity: 0.7;
`;

const ErrorMessage = styled.div`
  font-size: 0.75rem;
  font-weight: 500;
  color: ${colors.warning || colors.accent};
  margin-bottom: ${spacing.xs};
`;

const ErrorDetail = styled.div`
  font-size: 0.625rem;
  color: ${colors.textMuted};
  line-height: 1.4;
`;

const Title = styled.h3`
  font-size: 1.25rem;
  font-weight: 600;
  color: ${colors.text};
  margin: 0;
`;

const Description = styled.p`
  color: ${colors.textSecondary};
  font-size: 0.875rem;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const Meta = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  color: ${colors.textMuted};
  margin-top: auto;
`;

const Category = styled.span`
  background: ${colors.accent}20;
  color: ${colors.accent};
  padding: ${spacing.xs} ${spacing.sm};
  border-radius: 4px;
  font-weight: 500;
`;

interface ModCardProps {
    mod: ModMetadata;
    onDelete?: (mod: ModMetadata) => void;
    showDelete?: boolean;
}

export function ModCard({ mod, onDelete, showDelete = false }: ModCardProps) {
    const [thumbnailError, setThumbnailError] = useState(false);

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (onDelete) {
            onDelete(mod);
        }
    };

    const handleThumbnailError = () => {
        setThumbnailError(true);
    };

    return (
        <CardContainer>
            {showDelete && onDelete && (
                <DeleteButton onClick={handleDeleteClick} title="Delete mod">
                    Delete
                </DeleteButton>
            )}
            <Card to={`/${mod.slug}`}>
                {mod.thumbnailUrl ? (
                    thumbnailError ? (
                        <ThumbnailError>
                            <ErrorIcon>⚠</ErrorIcon>
                            <ErrorMessage>Thumbnail unavailable</ErrorMessage>
                            <ErrorDetail>Image failed to load</ErrorDetail>
                        </ThumbnailError>
                    ) : (
                        <Thumbnail 
                            src={mod.thumbnailUrl} 
                            alt={mod.title}
                            onError={handleThumbnailError}
                        />
                    )
                ) : null}
                <Title>{mod.title}</Title>
                <Description>{mod.description || 'No description'}</Description>
                <Meta>
                    <span>{mod.downloadCount} downloads</span>
                    <Category>{mod.category}</Category>
                </Meta>
            </Card>
        </CardContainer>
    );
}

