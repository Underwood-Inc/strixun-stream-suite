/**
 * Version Selector Component
 * Dropdown for selecting a specific mod version
 * Updates URL to enable direct linking to versions
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { colors, spacing } from '../../theme';
import type { ModVersion } from '../../types/mod';

interface VersionSelectorProps {
  versions: ModVersion[];
  selectedVersion: ModVersion;
  modSlug: string;
}

const SelectorContainer = styled.div`
  position: relative;
  display: inline-block;
`;

const SelectorButton = styled.button`
  font-family: inherit;
  cursor: pointer;
  outline: none;
  transition: all 0.1s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  background: var(--border, #3d3627);
  border: 3px solid var(--border-light, #4a4336);
  border-radius: 0;
  color: var(--text, #f9f9f9);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  padding: 12px 24px;
  box-shadow: 0 4px 0 var(--border-light, #4a4336);
  overflow: hidden;
  display: flex;
  align-items: center;
  gap: ${spacing.sm};
  min-width: 140px;
  justify-content: space-between;
  font-size: 1rem;
  
  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 0 var(--border-light, #4a4336);
    color: var(--text, #f9f9f9);
  }
  
  &:active:not(:disabled) {
    transform: translateY(2px);
    box-shadow: 0 2px 0 var(--border-light, #4a4336);
  }
`;

const VersionLabel = styled.span`
  display: flex;
  align-items: center;
  gap: ${spacing.xs};
`;

const LatestBadge = styled.span`
  background: ${colors.accent};
  color: #000;
  font-size: 0.625rem;
  font-weight: 700;
  padding: 2px 4px;
  border-radius: 2px;
  text-transform: uppercase;
`;

const ChevronIcon = styled.span<{ $isOpen: boolean }>`
  display: inline-block;
  transition: transform 0.2s ease;
  transform: ${props => props.$isOpen ? 'rotate(180deg)' : 'rotate(0deg)'};
  font-size: 0.75rem;
`;

const Dropdown = styled.div<{ $isOpen: boolean }>`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  min-width: 220px;
  max-height: 300px;
  overflow-y: auto;
  background: ${colors.bgSecondary};
  border: 2px solid ${colors.border};
  border-top: none;
  z-index: 100;
  display: ${props => props.$isOpen ? 'block' : 'none'};
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
`;

const VersionOption = styled.button<{ $isSelected: boolean }>`
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: ${spacing.sm} ${spacing.md};
  background: ${props => props.$isSelected ? colors.bgTertiary : 'transparent'};
  border: none;
  border-bottom: 1px solid ${colors.border};
  color: ${colors.text};
  cursor: pointer;
  transition: background 0.15s ease;
  text-align: left;
  
  &:last-child {
    border-bottom: none;
  }
  
  &:hover {
    background: ${colors.bgTertiary};
  }
  
  ${props => props.$isSelected && `
    border-left: 3px solid ${colors.accent};
  `}
`;

const VersionNumber = styled.span`
  font-weight: 600;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: ${spacing.xs};
`;

const VersionDate = styled.span`
  font-size: 0.75rem;
  color: ${colors.textMuted};
`;

const CopyLinkButton = styled.button`
  font-family: inherit;
  cursor: pointer;
  outline: none;
  transition: all 0.1s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  background: var(--border, #3d3627);
  border: 3px solid var(--border-light, #4a4336);
  border-radius: 0;
  color: var(--text, #f9f9f9);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  padding: 12px 24px;
  box-shadow: 0 4px 0 var(--border-light, #4a4336);
  overflow: hidden;
  font-size: 1rem;
  
  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 0 var(--border-light, #4a4336);
    color: var(--text, #f9f9f9);
  }
  
  &:active:not(:disabled) {
    transform: translateY(2px);
    box-shadow: 0 2px 0 var(--border-light, #4a4336);
  }
`;

const CopiedToast = styled.span`
  position: absolute;
  top: -30px;
  right: 0;
  background: ${colors.success};
  color: #000;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 4px;
  animation: fadeInOut 2s ease forwards;
  
  @keyframes fadeInOut {
    0% { opacity: 0; transform: translateY(5px); }
    15% { opacity: 1; transform: translateY(0); }
    85% { opacity: 1; transform: translateY(0); }
    100% { opacity: 0; transform: translateY(-5px); }
  }
`;

const SelectorWrapper = styled.div`
  display: flex;
  align-items: center;
  position: relative;
`;

export function VersionSelector({ versions, selectedVersion, modSlug }: VersionSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  
  const latestVersion = versions[0]; // versions are sorted newest first
  const isLatest = selectedVersion.versionId === latestVersion?.versionId;
  
  // Determine base path (handle both /mods/:slug and /:slug routes)
  const getVersionUrl = (version: ModVersion) => {
    const isModsPath = location.pathname.startsWith('/mods/');
    const basePath = isModsPath ? `/mods/${modSlug}` : `/${modSlug}`;
    
    // If selecting latest, use base path (no version)
    if (version.versionId === latestVersion?.versionId) {
      return basePath;
    }
    
    return `${basePath}/v/${version.version}`;
  };
  
  const handleVersionSelect = (version: ModVersion) => {
    setIsOpen(false);
    navigate(getVersionUrl(version));
  };
  
  const handleCopyLink = async () => {
    const url = `${window.location.origin}${getVersionUrl(selectedVersion)}`;
    try {
      await navigator.clipboard.writeText(url);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Close on escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);
  
  return (
    <SelectorWrapper>
      <SelectorContainer ref={containerRef}>
        <SelectorButton 
          onClick={() => setIsOpen(!isOpen)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <VersionLabel>
            v{selectedVersion.version}
            {isLatest && <LatestBadge>Latest</LatestBadge>}
          </VersionLabel>
          <ChevronIcon $isOpen={isOpen}>▼</ChevronIcon>
        </SelectorButton>
        
        <Dropdown $isOpen={isOpen} role="listbox">
          {versions.map((version, index) => (
            <VersionOption
              key={version.versionId}
              $isSelected={version.versionId === selectedVersion.versionId}
              onClick={() => handleVersionSelect(version)}
              role="option"
              aria-selected={version.versionId === selectedVersion.versionId}
            >
              <VersionNumber>
                v{version.version}
                {index === 0 && <LatestBadge>Latest</LatestBadge>}
              </VersionNumber>
              <VersionDate>
                {new Date(version.createdAt).toLocaleDateString()} • {version.downloads} downloads
              </VersionDate>
            </VersionOption>
          ))}
        </Dropdown>
      </SelectorContainer>
      
      <CopyLinkButton onClick={handleCopyLink} title="Copy link to this version">
        📋 Copy Link
      </CopyLinkButton>
      
      {showCopied && <CopiedToast>Link copied!</CopiedToast>}
    </SelectorWrapper>
  );
}
