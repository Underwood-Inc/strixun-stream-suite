/**
 * Mod card component
 * Displays mod preview in grid
 * Reusable component used in both "My Mods" and "Browse Mods" pages
 */

import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { colors, spacing } from '../../theme';
import type { ModMetadata } from '../../types/mod';
import { getButtonStyles } from '../../utils/buttonStyles';
import { getCardStyles } from '../../utils/sharedStyles';
import { InteractiveThumbnail } from './InteractiveThumbnail';

const CardContainer = styled.div`
  ${getCardStyles('hover')}
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const Card = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.md};
  flex: 1;
  min-height: 0;
`;

const ThumbnailWrapper = styled.div`
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 4px;
  flex-shrink: 0;
`;

const CardContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.sm};
  flex: 1;
  min-height: calc(1.6em * 4 + 4rem);
  max-height: calc(1.6em * 4 + 4rem);
  overflow-y: auto;
  overflow-x: hidden;
  
  &::-webkit-scrollbar {
    width: 4px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: ${colors.border};
    border-radius: 2px;
  }
  
  &::-webkit-scrollbar-track {
    background: transparent;
  }
`;

const CardLink = styled(Link)`
  text-decoration: none;
  color: inherit;
  display: flex;
  flex-direction: column;
  gap: ${spacing.xs};
  
  &:hover {
    text-decoration: none;
  }
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
  line-height: 1.6;
  margin: 0;
`;

const Meta = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  color: ${colors.textMuted};
  margin-top: ${spacing.xs};
`;

const Category = styled.span`
  background: ${colors.accent}20;
  color: ${colors.accent};
  padding: ${spacing.xs} ${spacing.sm};
  border-radius: 4px;
  font-weight: 500;
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

const ViewModLink = styled.span`
  align-self: flex-end;
  margin-top: ${spacing.xs};
  color: ${colors.accent};
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  white-space: nowrap;
  position: relative;
  pointer-events: none;
  
  &::after {
    content: '';
    position: absolute;
    bottom: -2px;
    left: 0;
    width: 0;
    height: 2px;
    background: ${colors.accent};
    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  ${CardContent}:hover & {
    color: ${colors.accentHover};
    transform: translateX(2px);
    
    &::after {
      width: 100%;
    }
  }
  
  ${CardContainer}:hover ${CardContent}:active & {
    transform: translateX(4px);
  }
`;

interface ModCardProps {
    mod: ModMetadata;
    onDelete?: (mod: ModMetadata) => void;
    showDelete?: boolean;
}

export function ModCard({ mod, onDelete, showDelete = false }: ModCardProps) {
    const handleDeleteClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (onDelete) {
            onDelete(mod);
        }
    };

    const handleThumbnailError = () => {
        // Error handler for thumbnail loading failures
    };

    return (
        <CardContainer>
            {showDelete && onDelete && (
                <DeleteButton onClick={handleDeleteClick} title="Delete mod">
                    Delete
                </DeleteButton>
            )}
            <Card>
                <ThumbnailWrapper>
                    <InteractiveThumbnail 
                        mod={mod}
                        onError={handleThumbnailError}
                        onNavigate={() => {
                            // Navigation disabled - use View Mod link instead
                        }}
                    />
                </ThumbnailWrapper>
                <CardContent to={`/${mod.slug}`}>
                    <CardLink>
                        <Title>{mod.title}</Title>
                        <Description>{mod.description || 'No description'}</Description>
                    </CardLink>
                    <Meta>
                        <span>{mod.downloadCount} downloads</span>
                        <Category>{mod.category}</Category>
                    </Meta>
                    <ViewModLink>
                        View Mod
                    </ViewModLink>
                </CardContent>
            </Card>
        </CardContainer>
    );
}
