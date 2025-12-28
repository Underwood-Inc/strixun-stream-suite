/**
 * Mod card component
 * Displays mod preview in grid
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { colors, spacing } from '../../theme';
import type { ModMetadata } from '../../types/mod';

const CardContainer = styled.div`
  position: relative;
  background: ${colors.bgSecondary};
  border: 1px solid ${colors.border};
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: ${colors.accent};
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }
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
  position: absolute;
  top: ${spacing.sm};
  right: ${spacing.sm};
  padding: ${spacing.xs} ${spacing.sm};
  background: ${colors.danger};
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s ease;
  z-index: 10;
  
  ${CardContainer}:hover & {
    opacity: 1;
  }
  
  &:hover {
    background: ${colors.danger}dd;
  }
`;

const Thumbnail = styled.img`
  width: 100%;
  aspect-ratio: 16/9;
  object-fit: cover;
  border-radius: 4px;
  background: ${colors.bgTertiary};
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
                {mod.thumbnailUrl && !thumbnailError && (
                    <Thumbnail 
                        src={mod.thumbnailUrl} 
                        alt={mod.title}
                        onError={handleThumbnailError}
                    />
                )}
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

