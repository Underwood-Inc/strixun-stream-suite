/**
 * RichTextEditor Layout Styles
 * Main containers and wrappers
 */

import styled from 'styled-components';
import { colors, spacing } from '../../../../theme';

export const EditorContainer = styled.div`
  position: relative;
`;

export const EditorWrapper = styled.div<{ $height: number; $hasError?: boolean }>`
  background: ${colors.bgSecondary};
  border: 1px solid ${props => props.$hasError ? colors.danger : colors.border};
  border-radius: 4px;
  min-height: ${props => props.$height}px;
  height: 500px;
  position: relative;
  overflow: hidden;
  resize: vertical;
  
  &:focus-within {
    border-color: ${props => props.$hasError ? colors.danger : colors.accent};
    box-shadow: 0 0 0 2px ${props => props.$hasError ? colors.danger + '20' : colors.accent + '20'};
  }
  
  /* Custom resize handle indicator */
  &::after {
    content: '';
    position: absolute;
    bottom: 2px;
    right: 2px;
    width: 12px;
    height: 12px;
    background: linear-gradient(
      135deg,
      transparent 50%,
      ${colors.border} 50%,
      ${colors.border} 60%,
      transparent 60%,
      transparent 70%,
      ${colors.border} 70%,
      ${colors.border} 80%,
      transparent 80%
    );
    pointer-events: none;
    opacity: 0.6;
  }
`;

export const Label = styled.label`
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: ${colors.text};
  margin-bottom: ${spacing.xs};
`;

export const HelpText = styled.span`
  font-size: 0.75rem;
  color: ${colors.textMuted};
  margin-left: ${spacing.sm};
  font-weight: 400;
`;

export const ErrorBanner = styled.div`
  background: ${colors.danger}20;
  color: ${colors.danger};
  padding: ${spacing.xs} ${spacing.sm};
  font-size: 0.75rem;
  border-bottom: 1px solid ${colors.danger}40;
`;

export const HiddenInput = styled.input`
  display: none;
`;

/** Side-by-side container for editor and preview */
export const SplitContainer = styled.div<{ $height: number }>`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${spacing.sm};
  min-height: ${props => props.$height}px;
  width: 100%;
`;

/** Left panel (editor) in split mode */
export const SplitEditorPane = styled.div`
  display: flex;
  flex-direction: column;
  border: 1px solid ${colors.border};
  border-radius: 4px;
  overflow: hidden;
  background: ${colors.bgSecondary};
  min-width: 0;
  width: 100%;
`;

/** Right panel (preview) in split mode */
export const SplitPreviewPane = styled.div`
  display: flex;
  flex-direction: column;
  border: 1px solid ${colors.border};
  border-radius: 4px;
  overflow: hidden;
  background: ${colors.bgSecondary};
  min-width: 0;
  width: 100%;
`;

/** Panel header label */
export const PaneLabel = styled.div`
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: ${colors.textMuted};
  padding: ${spacing.xs} ${spacing.sm};
  background: ${colors.bgTertiary};
  border-bottom: 1px solid ${colors.border};
  flex-shrink: 0;
`;

/** Content area within a pane */
export const PaneContent = styled.div`
  flex: 1;
  overflow: auto;
  min-height: 0;
  width: 100%;
  
  /* Ensure editor fills the pane */
  & > div {
    height: 100%;
    width: 100%;
  }
`;

/** Full preview wrapper */
export const FullPreviewWrapper = styled.div<{ $height: number }>`
  min-height: ${props => props.$height}px;
  border: 1px solid ${colors.border};
  border-radius: 4px;
  overflow: hidden;
  background: ${colors.bgSecondary};
  display: flex;
  flex-direction: column;
  width: 100%;
`;
