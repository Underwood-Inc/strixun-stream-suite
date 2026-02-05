/**
 * RichTextEditor Toolbar Styles
 * Toolbar buttons, groups, and indicators
 */

import styled from 'styled-components';
import { colors, spacing } from '../../../../theme';

export const Toolbar = styled.div`
  display: flex;
  gap: 2px;
  padding: ${spacing.xs} ${spacing.sm};
  background: ${colors.bgTertiary};
  border-bottom: 1px solid ${colors.border};
  border-radius: 4px 4px 0 0;
  flex-wrap: wrap;
  align-items: center;
  position: relative;
  z-index: 2;
`;

export const ToolbarGroup = styled.div`
  display: flex;
  gap: 2px;
  align-items: center;
`;

export const ToolbarButton = styled.button<{ $active?: boolean }>`
  background: ${props => props.$active ? colors.accent + '30' : 'transparent'};
  border: none;
  color: ${props => props.$active ? colors.accent : colors.textSecondary};
  padding: 6px 8px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.8125rem;
  font-weight: 500;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 28px;
  
  &:hover {
    background: ${colors.bgSecondary};
    color: ${colors.accent};
  }
  
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  
  svg {
    width: 16px;
    height: 16px;
  }
`;

export const ToolbarSelect = styled.select`
  background: transparent;
  border: none;
  color: ${colors.textSecondary};
  font-size: 0.8125rem;
  padding: 4px 8px;
  border-radius: 3px;
  cursor: pointer;
  outline: none;
  
  &:hover {
    background: ${colors.bgSecondary};
  }
  
  &:focus {
    background: ${colors.bgSecondary};
  }
  
  option {
    background: ${colors.bgSecondary};
    color: ${colors.text};
  }
`;

export const ToolbarDivider = styled.div`
  width: 1px;
  background: ${colors.border};
  margin: 0 ${spacing.xs};
  height: 20px;
`;

export const PayloadIndicator = styled.div<{ $warning?: boolean; $error?: boolean }>`
  margin-left: auto;
  font-size: 0.75rem;
  color: ${props => props.$error ? colors.danger : props.$warning ? colors.warning : colors.textMuted};
  display: flex;
  align-items: center;
  gap: ${spacing.xs};
`;

export const PreviewToggle = styled.button<{ $active?: boolean }>`
  background: ${props => props.$active ? colors.accent : 'transparent'};
  border: 1px solid ${props => props.$active ? colors.accent : colors.border};
  color: ${props => props.$active ? colors.bg : colors.textSecondary};
  padding: 4px 12px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 500;
  transition: all 0.15s ease;
  
  &:hover {
    background: ${props => props.$active ? colors.accent : colors.bgSecondary};
  }
`;

/** Container for mode controls */
export const ModeControlsContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing.xs};
  margin-left: auto;
`;

/** Primary Edit/Preview toggle */
export const ModeToggle = styled.button<{ $active?: boolean }>`
  background: ${props => props.$active ? colors.accent : 'transparent'};
  border: 1px solid ${props => props.$active ? colors.accent : colors.border};
  color: ${props => props.$active ? colors.bg : colors.textSecondary};
  padding: 4px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 500;
  transition: all 0.15s ease;
  
  &:hover {
    background: ${props => props.$active ? colors.accent : colors.bgSecondary};
  }
`;

/** Secondary display mode selector (shown only in preview mode) */
export const DisplayModeSelect = styled.select`
  background: ${colors.bgSecondary};
  border: 1px solid ${colors.border};
  color: ${colors.text};
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.7rem;
  cursor: pointer;
  outline: none;
  
  &:focus {
    border-color: ${colors.accent};
  }
  
  option {
    background: ${colors.bgSecondary};
    color: ${colors.text};
  }
`;
