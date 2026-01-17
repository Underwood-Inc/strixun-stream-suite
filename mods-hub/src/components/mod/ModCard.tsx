/**
 * Mod card component
 * Displays mod preview in grid
 * Reusable component used in both "My Mods" and "Browse Mods" pages
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { colors, spacing, media } from '../../theme';
import type { ModMetadata } from '../../types/mod';
import { getButtonStyles } from '../../utils/buttonStyles';
import { getCardStyles } from '../../utils/sharedStyles';
import { InteractiveThumbnail } from './InteractiveThumbnail';
import { MarkdownContent } from '../common/MarkdownContent';

const CardContainer = styled.div`
  ${getCardStyles('hover')}
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  overflow: visible;
  contain: layout style;
  box-sizing: border-box;
  
  /* Override hover transform to prevent breaking grid layout */
  &:hover {
    transform: translateY(-2px);
    z-index: 1;
  }
`;

const Card = styled.div`
  display: flex;
  flex-direction: row;
  gap: ${spacing.md};
  width: 100%;
  align-items: flex-start;
  
  ${media.mobile} {
    flex-direction: column;
    gap: ${spacing.sm};
  }
`;

const ThumbnailWrapper = styled.div`
  width: 150px;
  min-width: 150px;
  aspect-ratio: 1;
  overflow: visible;
  border-radius: 4px;
  flex-shrink: 0;
  position: relative;
  z-index: 1;
  
  ${media.mobile} {
    width: 100%;
    min-width: 100%;
    max-width: 300px;
    margin: 0 auto;
  }
`;

const ThumbnailSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.sm};
  flex-shrink: 0;
  
  ${media.mobile} {
    width: 100%;
    align-items: center;
  }
`;

const CardContent = styled(Link)`
  display: flex;
  flex-direction: column;
  gap: ${spacing.sm};
  flex: 1;
  min-height: 0;
  min-width: 0;
  text-decoration: none;
  color: inherit;
  cursor: pointer;
  
  &:hover {
    text-decoration: none;
    color: inherit;
  }
`;

const CardLink = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.xs};
`;

const Title = styled.h3`
  font-size: clamp(1rem, 3vw, 1.25rem);
  font-weight: 600;
  color: ${colors.text};
  margin: 0;
`;

const Description = styled.div`
  color: ${colors.textSecondary};
  font-size: 0.875rem;
  line-height: 1.6;
  margin: 0;
  word-wrap: break-word;
  overflow-wrap: break-word;
  max-height: 300px;
  overflow: hidden;
  
  ${media.mobile} {
    font-size: 0.8125rem;
  }
`;

const Meta = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  color: ${colors.textMuted};
  margin-top: ${spacing.xs};
  gap: ${spacing.sm};
  flex-wrap: wrap;
`;

const Category = styled.span`
  background: ${colors.accent}20;
  color: ${colors.accent};
  padding: ${spacing.xs} ${spacing.sm};
  border-radius: 4px;
  font-weight: 500;
  white-space: nowrap;
`;

const DeleteButton = styled.button`
  ${getButtonStyles('danger')}
  position: absolute;
  top: ${spacing.sm};
  left: ${spacing.sm};
  font-size: 0.75rem;
  padding: ${spacing.xs} ${spacing.sm};
  opacity: 0;
  transition: opacity 0.2s ease;
  z-index: 10;
  min-height: 36px;
  
  ${CardContainer}:hover & {
    opacity: 1;
  }
  
  ${media.mobile} {
    opacity: 0.9;
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

const ZoomButton = styled.button`
  ${getButtonStyles('secondary')}
  width: 100%;
  padding: ${spacing.sm};
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${spacing.xs};
  min-height: 44px;
  
  &:hover:not(:disabled) {
    background: ${colors.accentHover};
    border-color: ${colors.accentActive};
    box-shadow: 0 6px 0 ${colors.accentActive};
    color: #000;
    transform: translateY(-2px);
  }
  
  &:active:not(:disabled) {
    transform: translateY(2px);
    box-shadow: 0 2px 0 ${colors.accentActive};
  }
  
  ${media.mobile} {
    max-width: 300px;
    font-size: 0.8125rem;
  }
`;

const ZoomModal = styled.div<{ $isVisible: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${spacing.xl};
  cursor: pointer;
  opacity: ${props => props.$isVisible ? 1 : 0};
  transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: ${props => props.$isVisible ? 'auto' : 'none'};
`;

const ZoomContent = styled.div<{ $isVisible: boolean }>`
  width: min(85vw, calc(85vh - 100px));
  height: min(85vw, calc(85vh - 100px));
  max-width: 700px;
  max-height: 700px;
  position: relative;
  cursor: default;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 60px; /* Account for header */
  transform: ${props => props.$isVisible ? 'scale(1)' : 'scale(0.9)'};
  opacity: ${props => props.$isVisible ? 1 : 0};
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
`;

const ZoomCardContainer = styled.div`
  width: 100%;
  height: 100%;
  aspect-ratio: 1;
  perspective: 1200px;
  position: relative;
  pointer-events: auto;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  will-change: transform;
`;

const CloseButton = styled.button`
  position: absolute;
  top: -${spacing.xl};
  right: 0;
  padding: ${spacing.sm} ${spacing.md};
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid ${colors.border};
  border-radius: 4px;
  color: ${colors.text};
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  z-index: 10001;
  
  &:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: scale(1.05);
  }
  
  &:active {
    transform: scale(0.95);
  }
`;

interface ModCardProps {
    mod: ModMetadata;
    onDelete?: (mod: ModMetadata) => void;
    showDelete?: boolean;
}

export function ModCard({ mod, onDelete, showDelete = false }: ModCardProps) {
    const [isZoomed, setIsZoomed] = useState(false);
    const [shouldRenderModal, setShouldRenderModal] = useState(false);
    const cardContainerRef = useRef<HTMLDivElement>(null);
    const zoomModalRef = useRef<HTMLDivElement>(null);

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

    const handleZoom = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setShouldRenderModal(true);
        // Trigger animation after render
        requestAnimationFrame(() => {
            setIsZoomed(true);
        });
    }, []);

    const handleCloseZoom = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.target === e.currentTarget) {
            setIsZoomed(false);
            // Remove from DOM after animation completes
            setTimeout(() => {
                setShouldRenderModal(false);
            }, 300); // Match transition duration
        }
    }, []);

    // Handle ESC key to close zoom
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isZoomed) {
                setIsZoomed(false);
                // Remove from DOM after animation completes
                setTimeout(() => {
                    setShouldRenderModal(false);
                }, 300); // Match transition duration
            }
        };
        
        if (shouldRenderModal) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }
        
        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = '';
        };
    }, [isZoomed, shouldRenderModal]);

    return (
        <>
            <CardContainer ref={cardContainerRef}>
                {showDelete && onDelete && (
                    <DeleteButton onClick={handleDeleteClick} title="Delete mod">
                        Delete
                    </DeleteButton>
                )}
                <Card>
                    <ThumbnailSection>
                        <ThumbnailWrapper
                            key="thumbnail"
                            onClick={(e) => {
                                // Stop click propagation so thumbnail clicks don't trigger card navigation
                                e.stopPropagation();
                            }}
                        >
                            <InteractiveThumbnail 
                                mod={mod}
                                onError={handleThumbnailError}
                                watchElementRef={cardContainerRef}
                            />
                        </ThumbnailWrapper>
                        <ZoomButton
                            onClick={handleZoom}
                            title="View in fullscreen"
                        >
                            • ZOOM
                        </ZoomButton>
                    </ThumbnailSection>
                    <CardContent key="content" to={`/${mod.slug}`}>
                        <CardLink>
                            <Title>{mod.title}</Title>
                            <Description>
                                <MarkdownContent content={mod.description || 'No description'} />
                            </Description>
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
            
            {shouldRenderModal && (
                <ZoomModal 
                    ref={zoomModalRef} 
                    $isVisible={isZoomed} 
                    onClick={handleCloseZoom}
                >
                    <ZoomContent $isVisible={isZoomed} onClick={(e) => e.stopPropagation()}>
                        <CloseButton onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsZoomed(false);
                            setTimeout(() => {
                                setShouldRenderModal(false);
                            }, 300);
                        }}>✕ Close</CloseButton>
                        <ZoomCardContainer>
                            <InteractiveThumbnail
                                mod={mod}
                                onError={handleThumbnailError}
                                watchElementRef={zoomModalRef}
                            />
                        </ZoomCardContainer>
                    </ZoomContent>
                </ZoomModal>
            )}
        </>
    );
}
