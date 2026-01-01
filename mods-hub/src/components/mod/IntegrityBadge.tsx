/**
 * Integrity badge component
 * Displays Strixun file integrity verification badge
 */

import { useState } from 'react';
import styled from 'styled-components';
import { colors, spacing } from '../../theme';
import { API_BASE_URL } from '../../services/api';
import { Tooltip } from '../common/Tooltip';

const BadgeContainer = styled.div`
  display: inline-flex;
  align-items: center;
`;

const BadgeImage = styled.img`
  height: 20px;
  width: auto;
  display: block;
`;

const TooltipContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.sm};
  max-width: 400px;
  text-align: left;
`;

const TooltipTitle = styled.div`
  font-weight: 600;
  font-size: 0.95rem;
  color: ${colors.success};
  display: flex;
  align-items: center;
  gap: ${spacing.xs};
  
  &::before {
    content: '✓';
    font-size: 1.1rem;
    font-weight: 700;
  }
`;

const TooltipDescription = styled.p`
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--text-secondary, ${colors.textSecondary});
`;

const TooltipSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.xs};
  margin-top: ${spacing.xs};
`;

const TooltipSectionTitle = styled.div`
  font-weight: 600;
  font-size: 0.8rem;
  color: var(--text, ${colors.text});
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: ${spacing.xs};
`;

const TooltipList = styled.ul`
  margin: 0;
  padding-left: ${spacing.md};
  font-size: 0.85rem;
  line-height: 1.6;
  color: var(--text-secondary, ${colors.textSecondary});
  
  li {
    margin-bottom: ${spacing.xs};
    
    &:last-child {
      margin-bottom: 0;
    }
  }
`;

interface IntegrityBadgeProps {
    modId?: string; // Legacy support - prefer slug
    slug?: string; // Preferred - more reliable for public badges
    versionId: string;
    style?: 'flat' | 'flat-square' | 'plastic';
}

export function IntegrityBadge({ modId, slug, versionId, style = 'flat' }: IntegrityBadgeProps) {
    const [imageError, setImageError] = useState(false);
    
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

    // Don't render if image failed to load
    if (imageError) {
        return null;
    }
    
    const tooltipContent = (
        <TooltipContent>
            <TooltipTitle>File Integrity Status</TooltipTitle>
            <TooltipDescription>
                This badge shows the real-time integrity verification status of the file. The file is 
                cryptographically verified using HMAC-SHA256 hashing to ensure it matches what was uploaded.
            </TooltipDescription>
            
            <TooltipSection>
                <TooltipSectionTitle>Badge States</TooltipSectionTitle>
                <TooltipList>
                    <li><strong>Verified (Green):</strong> File hash matches stored hash - file is authentic and unchanged</li>
                    <li><strong>Tampered (Orange):</strong> File hash doesn't match - file may have been modified or corrupted</li>
                    <li><strong>Unverified (Red):</strong> No hash available - file was uploaded before integrity system or hash calculation failed</li>
                </TooltipList>
            </TooltipSection>
            
            <TooltipSection>
                <TooltipSectionTitle>What Verification Means</TooltipSectionTitle>
                <TooltipList>
                    <li>The file matches exactly what was uploaded (no corruption)</li>
                    <li>No tampering has been detected since upload</li>
                    <li>The file can be independently verified using its hash</li>
                    <li>Safe to download and use with confidence (when verified)</li>
                    <li>The domain name confirms where verification was performed</li>
                </TooltipList>
            </TooltipSection>
            
            <TooltipSection>
                <TooltipSectionTitle>Technical Details</TooltipSectionTitle>
                <TooltipDescription style={{ fontSize: '0.8rem', marginTop: 0 }}>
                    The hash is calculated on the original, decrypted file content using HMAC-SHA256 
                    with a secret keyphrase. Verification happens in real-time by comparing the 
                    current file hash with the stored hash. This ensures the hash represents the 
                    actual file content and cannot be forged without the secret key.
                </TooltipDescription>
            </TooltipSection>
        </TooltipContent>
    );
    
    return (
        <BadgeContainer>
            <Tooltip 
                content={tooltipContent}
                position="auto" 
                delay={200}
                maxWidth="450px"
                interactive={true}
            >
                <BadgeImage 
                    src={badgeUrl} 
                    alt="Strixun Verified" 
                    onError={handleImageError}
                />
            </Tooltip>
        </BadgeContainer>
    );
}

