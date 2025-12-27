/**
 * Integrity badge component
 * Displays Strixun file integrity verification badge
 */

import { useState } from 'react';
import styled from 'styled-components';
import { colors, spacing } from '../../theme';

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
    modId: string;
    versionId: string;
    showCopyButton?: boolean;
    style?: 'flat' | 'flat-square' | 'plastic';
}

export function IntegrityBadge({ modId, versionId, showCopyButton = false, style = 'flat' }: IntegrityBadgeProps) {
    const [copied, setCopied] = useState(false);
    const API_BASE_URL = import.meta.env.VITE_MODS_API_URL || 'https://mods-api.idling.app';
    const badgeUrl = `${API_BASE_URL}/mods/${modId}/versions/${versionId}/badge${style !== 'flat' ? `?style=${style}` : ''}`;
    const markdownUrl = `![Strixun Verified](${badgeUrl})`;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(markdownUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Failed to copy badge URL:', error);
        }
    };

    return (
        <BadgeContainer>
            <BadgeImage 
                src={badgeUrl} 
                alt="Strixun Verified" 
                title="Strixun file integrity verified"
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

