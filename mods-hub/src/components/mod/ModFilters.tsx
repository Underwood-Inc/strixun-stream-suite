/**
 * Mod filters component
 * Search and category filtering
 */

import styled from 'styled-components';
import { colors, spacing, media } from '../../theme';

const Container = styled.div`
  display: flex;
  gap: ${spacing.md};
  align-items: center;
  flex-wrap: wrap;
  
  ${media.mobile} {
    flex-direction: column;
    align-items: stretch;
    gap: ${spacing.sm};
    width: 100%;
  }
`;

const Input = styled.input`
  padding: ${spacing.sm} ${spacing.md};
  background: ${colors.bgSecondary};
  border: 1px solid ${colors.border};
  border-radius: 4px;
  color: ${colors.text};
  font-size: 0.875rem;
  min-width: 200px;
  flex: 1;
  
  &:focus {
    border-color: ${colors.accent};
    outline: none;
  }
  
  &::placeholder {
    color: ${colors.textMuted};
  }
  
  ${media.mobile} {
    min-width: 0;
    width: 100%;
  }
`;

const Select = styled.select`
  padding: ${spacing.sm} ${spacing.md};
  background: ${colors.bgSecondary};
  border: 1px solid ${colors.border};
  border-radius: 4px;
  color: ${colors.text};
  font-size: 0.875rem;
  cursor: pointer;
  flex-shrink: 0;
  
  &:focus {
    border-color: ${colors.accent};
    outline: none;
  }
  
  ${media.mobile} {
    width: 100%;
  }
`;

interface ModFiltersProps {
    category: string;
    search: string;
    onCategoryChange: (category: string) => void;
    onSearchChange: (search: string) => void;
}

export function ModFilters({ category, search, onCategoryChange, onSearchChange }: ModFiltersProps) {
    return (
        <Container>
            <Input
                type="text"
                placeholder="Search mods..."
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
            />
            <Select value={category} onChange={(e) => onCategoryChange(e.target.value)}>
                <option value="">All Categories</option>
                <option value="script">Script</option>
                <option value="overlay">Overlay</option>
                <option value="theme">Theme</option>
                <option value="asset">Asset</option>
                <option value="plugin">Plugin</option>
                <option value="other">Other</option>
            </Select>
        </Container>
    );
}

