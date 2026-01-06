/**
 * Integrity badge component
 * Displays Strixun file integrity verification badge
 * 
 * CRITICAL: Uses fetch with auth headers instead of <img> tag to enable verification
 * Badge verification requires JWT token to decrypt and verify the file hash
 */

import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { colors, spacing } from '../../theme';
import { API_BASE_URL } from '../../services/api';
import { Tooltip } from '@strixun/shared-components/react';
import type { TooltipTheme } from '@strixun/shared-components/react';
import { getAuthToken } from '../../services/api';

// Theme configuration for shared Tooltip component
const tooltipTheme: TooltipTheme = {
  colors: {
    bg: colors.bg,
    card: colors.card,
    bgTertiary: colors.bgTertiary,
    text: colors.text,
    textSecondary: colors.textSecondary,
    textMuted: colors.textMuted,
    border: colors.border,
    accent: colors.accent,
    info: colors.info,
    warning: colors.warning,
    danger: colors.danger,
  },
  spacing: {
    xs: spacing.xs,
    sm: spacing.sm,
    md: spacing.md,
    lg: spacing.lg,
  },
};

const BadgeContainer = styled.div`
  display: inline-flex;
  align-items: center;
`;

const BadgeImage = styled.img`
  height: 20px;
  width: auto;
  display: block;
`;

const BadgeLoadingPlaceholder = styled.div`
  height: 20px;
  min-width: 80px;
  background: ${colors.bgTertiary};
  border-radius: 3px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  
  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent,
      ${colors.border}40,
      transparent
    );
    animation: shimmer 1.5s infinite;
  }
  
  @keyframes shimmer {
    0% {
      left: -100%;
    }
    100% {
      left: 100%;
    }
  }
`;

const LoadingSpinner = styled.div`
  width: 12px;
  height: 12px;
  border: 2px solid ${colors.border};
  border-top-color: ${colors.accent};
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

const TooltipContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.sm};
  max-width: 400px;
  max-height: 60vh;
  overflow-y: auto;
  overflow-x: hidden;
  text-align: left;
  
  /* Custom scrollbar styling for better UX */
  &::-webkit-scrollbar {
    width: 8px;
  }
  
  &::-webkit-scrollbar-track {
    background: var(--bg-tertiary, ${colors.bgTertiary});
    border-radius: 4px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: var(--border, ${colors.border});
    border-radius: 4px;
    
    &:hover {
      background: var(--text-secondary, ${colors.textSecondary});
    }
  }
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
    const [badgeUrl, setBadgeUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    
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
    
    // Fetch badge - works without auth (public API)
    // Optionally includes auth token for enhanced verification if available
    useEffect(() => {
        let cancelled = false;
        
        const fetchBadge = async () => {
            try {
                setIsLoading(true);
                setImageError(false);
                
                const badgeEndpoint = `${API_BASE_URL}/mods/${identifier}/versions/${versionId}/badge${style !== 'flat' ? `?style=${style}` : ''}`;
                
                // PUBLIC API: Badge endpoint works without auth
                // Optionally include auth token for enhanced verification (if available)
                // But badge will work fine without it for public access and social media embeds
                const token = await getAuthToken();
                
                // Build headers - badge works without auth, but include token if available for verification
                const headers: HeadersInit = {
                    'Accept': 'image/svg+xml',
                };
                
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }
                
                // Fetch badge - always returns unencrypted SVG (public API)
                const response = await fetch(badgeEndpoint, {
                    method: 'GET',
                    headers,
                    credentials: 'include',
                });
                
                if (!response.ok) {
                    throw new Error(`Badge fetch failed: ${response.status} ${response.statusText}`);
                }
                
                if (cancelled) return;
                
                // PUBLIC API: Badge responses are always unencrypted SVG
                // This allows badges to work for unauthenticated users and social media embeds
                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);
                
                if (cancelled) {
                    URL.revokeObjectURL(blobUrl);
                    return;
                }
                
                setBadgeUrl(blobUrl);
                setIsLoading(false);
            } catch (error) {
                console.error('[IntegrityBadge] Failed to fetch badge:', {
                    identifier,
                    versionId,
                    error,
                });
                if (!cancelled) {
                    setImageError(true);
                    setIsLoading(false);
                }
            }
        };
        
        fetchBadge();
        
        // Cleanup: revoke blob URL when component unmounts or dependencies change
        return () => {
            cancelled = true;
            // Note: We can't revoke the blob URL here because it's stored in state
            // The blob URL will be revoked when the component unmounts and state is cleared
            // or when a new badge is fetched (old blob URL is replaced)
        };
    }, [identifier, versionId, style, slug, modId]);
    
    // Cleanup blob URL when badgeUrl changes or component unmounts
    useEffect(() => {
        return () => {
            if (badgeUrl) {
                URL.revokeObjectURL(badgeUrl);
            }
        };
    }, [badgeUrl]);
    
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

    // Show error state (don't render anything on error)
    if (imageError) {
        return null;
    }
    
    // Show loading state while fetching badge
    if (isLoading || !badgeUrl) {
        return (
            <BadgeContainer>
                <BadgeLoadingPlaceholder>
                    <LoadingSpinner />
                </BadgeLoadingPlaceholder>
            </BadgeContainer>
        );
    }
    
    const tooltipContent = (
        <TooltipContent>
            <TooltipTitle>File Integrity Status</TooltipTitle>
            <TooltipDescription>
                This badge shows the integrity verification status of the file. Files with integrity tracking 
                enabled have a cryptographic hash (HMAC-SHA256) calculated at upload time. The badge indicates 
                whether integrity tracking is enabled and, for authenticated users, whether the file matches 
                the stored hash.
            </TooltipDescription>
            
            <TooltipSection>
                <TooltipSectionTitle>Badge States</TooltipSectionTitle>
                <TooltipList>
                    <li><strong>Verified (Green):</strong> File has integrity tracking enabled (hash exists). For authenticated users, this also means the file hash matches the stored hash - file is authentic and unchanged.</li>
                    <li><strong>Tampered (Orange):</strong> File hash doesn't match stored hash - file may have been modified or corrupted. Only shown to authenticated users who can verify the file.</li>
                    <li><strong>Unverified (Red):</strong> No hash available - file was uploaded before integrity system or hash calculation failed.</li>
                </TooltipList>
            </TooltipSection>
            
            <TooltipSection>
                <TooltipSectionTitle>What Verification Means</TooltipSectionTitle>
                <TooltipList>
                    <li><strong>Public Badge:</strong> Shows "Verified" if the file has integrity tracking enabled (hash exists). This indicates the file was uploaded with the integrity system active.</li>
                    <li><strong>Authenticated Verification:</strong> For logged-in users, the badge performs real-time verification by comparing the current file hash with the stored hash.</li>
                    <li>The file can be independently verified using its hash when downloading</li>
                    <li>Safe to download and use with confidence (when verified)</li>
                    <li>The domain name confirms where verification was performed</li>
                </TooltipList>
            </TooltipSection>
            
            <TooltipSection>
                <TooltipSectionTitle>Technical Details</TooltipSectionTitle>
                <TooltipDescription style={{ fontSize: '0.8rem', marginTop: 0 }}>
                    The hash is calculated on the original, decrypted file content using HMAC-SHA256 
                    with a secret keyphrase at upload time. For public badges, the badge shows "Verified" 
                    if a hash exists (indicating integrity tracking is enabled). For authenticated users 
                    with matching tokens, real-time verification compares the current file hash with the 
                    stored hash. This ensures the hash represents the actual file content and cannot be 
                    forged without the secret key.
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
                theme={tooltipTheme}
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

