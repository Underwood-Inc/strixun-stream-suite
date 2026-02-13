/**
 * RichTextEditor Modal Styles
 * Overlay, content, and form elements for modals
 */

import styled from 'styled-components';
import { colors, spacing } from '../../../../theme';

export const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

export const ModalContent = styled.div`
  background: ${colors.bgSecondary};
  border: 1px solid ${colors.border};
  border-radius: 8px;
  padding: ${spacing.lg};
  min-width: 300px;
  max-width: 400px;
`;

export const ModalTitle = styled.h3`
  margin: 0 0 ${spacing.md} 0;
  font-size: 1rem;
  color: ${colors.text};
`;

export const ModalInput = styled.input`
  width: 100%;
  padding: ${spacing.sm};
  background: ${colors.bg};
  border: 1px solid ${colors.border};
  border-radius: 4px;
  color: ${colors.text};
  font-size: 0.875rem;
  margin-bottom: ${spacing.sm};
  
  &:focus {
    outline: none;
    border-color: ${colors.accent};
  }
`;

export const ModalLabel = styled.label`
  display: block;
  font-size: 0.75rem;
  color: ${colors.textMuted};
  margin-bottom: ${spacing.xs};
`;

export const ModalActions = styled.div`
  display: flex;
  gap: ${spacing.sm};
  justify-content: flex-end;
  margin-top: ${spacing.md};
`;

export const ModalButton = styled.button<{ $primary?: boolean }>`
  padding: ${spacing.xs} ${spacing.md};
  border-radius: 4px;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.15s ease;
  
  ${props => props.$primary ? `
    background: ${colors.accent};
    border: none;
    color: ${colors.bg};
    
    &:hover {
      opacity: 0.9;
    }
  ` : `
    background: transparent;
    border: 1px solid ${colors.border};
    color: ${colors.textSecondary};
    
    &:hover {
      background: ${colors.bgTertiary};
    }
  `}
`;
