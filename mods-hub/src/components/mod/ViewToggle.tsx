/**
 * View toggle component
 * Allows switching between list and card views
 */

import styled from 'styled-components';
import { colors, spacing } from '../../theme';

const ToggleContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing.sm};
  padding: ${spacing.xs};
  background: ${colors.bgSecondary};
  border: 1px solid ${colors.border};
  border-radius: 6px;
`;

const ToggleButton = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${spacing.xs};
  padding: ${spacing.sm} ${spacing.md};
  background: ${props => props.$active ? colors.accent : 'transparent'};
  color: ${props => props.$active ? colors.bg : colors.textSecondary};
  border: none;
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: ${props => props.$active ? 600 : 400};
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${props => props.$active ? colors.accentHover : colors.bgTertiary};
    color: ${props => props.$active ? colors.bg : colors.text};
  }
  
  &:active {
    transform: scale(0.98);
  }
`;

const Icon = styled.span`
  font-size: 1rem;
  line-height: 1;
`;

export type ViewType = 'list' | 'card';

interface ViewToggleProps {
  view: ViewType;
  onViewChange: (view: ViewType) => void;
}

export function ViewToggle({ view, onViewChange }: ViewToggleProps) {
  return (
    <ToggleContainer>
      <ToggleButton
        $active={view === 'list'}
        onClick={() => onViewChange('list')}
        title="List view"
        aria-label="Switch to list view"
      >
        <Icon>☰</Icon>
        <span>List</span>
      </ToggleButton>
      <ToggleButton
        $active={view === 'card'}
        onClick={() => onViewChange('card')}
        title="Card view"
        aria-label="Switch to card view"
      >
        <Icon>⊞</Icon>
        <span>Cards</span>
      </ToggleButton>
    </ToggleContainer>
  );
}
