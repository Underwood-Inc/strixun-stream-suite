/**
 * Integrity badge component
 * Displays Strixun file integrity verification badge
 */

import { useState } from 'react';
import styled from 'styled-components';
import { colors, spacing } from '../../theme';
import { API_BASE_URL } from '../../services/api';

const BadgeContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing.sm};
`;

const BadgeImage = styled.img`
  height: 20px;
  width: auto;
  display: block;
`;

const CopyButton = styled.button`
  padding: ${spacing.xs} ${spacing.sm};
  background: ${colors.bgSecondary};
  border: 1px solid ${colors.border};
  border-radius: 4px;
  color: ${colors.text};
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${colors.bgTertiary};
    border-color: ${colors.accent};
  }
  
  &:active {
    transform: scale(0.98);
  }
`;

const CopySuccess = styled.span`
  color: ${colors.success};
  font-size: 0.75rem;
  font-weight: 500;
`;

interface IntegrityBadgeProps {
    modId?: string; // Legacy support - prefer slug
    slug?: string; // Preferred - more reliable for public badges
    versionId: string;
    showCopyButton?: boolean;
    style?: 'flat' | 'flat-square' | 'plastic';
}

export function IntegrityBadge({ modId, slug, versionId, showCopyButton = false, style = 'flat' }: IntegrityBadgeProps) {
    const [copied, setCopied] = useState(false);
    const [imageError, setImageError] = useState(false);
    // Use the same API base URL as the rest of the app (uses Vite proxy in dev)
    
    // Validate inputs - both slug/modId and versionId are required
    const identifier = slug || modId;
    if (!identifier) {
        console.error('[IntegrityBadge] Missing identifier (both slug and modId are undefined):', { slug, modId, versionId });
        return null; // Don't render badge if we can't construct a valid URL
    }
    
    if (!versionId) {
        console.error('[IntegrityBadge] Missing versionId:', { slug, modId, versionId });
        return null; // Don't render badge if versionId is missing
    }
    
    const badgeUrl = `${API_BASE_URL}/mods/${identifier}/versions/${versionId}/badge${style !== 'flat' ? `?style=${style}` : ''}`;
    const markdownUrl = `![Strixun Verified](${badgeUrl})`;
    
    // Debug logging in development
    if (import.meta.env.DEV) {
        console.log('[IntegrityBadge] Badge URL constructed:', { 
            slug, 
            modId, 
            identifier, 
            versionId, 
            badgeUrl,
            API_BASE_URL 
        });
    }
    
    const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
        console.error('[IntegrityBadge] Image failed to load:', {
            badgeUrl,
            identifier,
            versionId,
            error: e,
            target: e.currentTarget.src
        });
        setImageError(true);
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(markdownUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Failed to copy badge URL:', error);
        }
    };

    // Don't render if image failed to load
    if (imageError) {
        return null;
    }
    
    return (
        <BadgeContainer>
            <BadgeImage 
                src={badgeUrl} 
                alt="Strixun Verified" 
                title="Strixun file integrity verified"
                onError={handleImageError}
            />
            {showCopyButton && (
                <>
                    {copied ? (
                        <CopySuccess>Copied!</CopySuccess>
                    ) : (
                        <CopyButton onClick={handleCopy}>
                            Copy Badge
                        </CopyButton>
                    )}
                </>
            )}
        </BadgeContainer>
    );
}

