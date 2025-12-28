/**
 * Advanced Search Input Component (React)
 * 
 * Human-friendly search input with support for:
 * - Quoted exact phrases: "exact phrase"
 * - Space-separated AND terms: term1 term2
 * - Pipe-separated OR groups: term1 | term2
 * - Wildcard prefix matching: term*
 */

import React, { useRef } from 'react';
import styled from 'styled-components';

// Default colors matching the theme - can be overridden via styled-components
const defaultColors = {
  bgSecondary: '#252525',
  border: '#3a3a3a',
  text: '#f9f9f9',
  textMuted: '#808080',
  accent: '#d4af37',
};

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Wrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

const Icon = styled.span`
  position: absolute;
  left: 12px;
  font-size: 1em;
  pointer-events: none;
  z-index: 1;
`;

const Input = styled.input`
  width: 100%;
  padding: 10px 32px 10px 36px;
  background: ${defaultColors.bgSecondary};
  border: 1px solid ${defaultColors.border};
  border-radius: 8px;
  color: ${defaultColors.text};
  font-size: 0.9em;
  transition: all 0.2s ease;
  
  &:focus {
    outline: none;
    border-color: ${defaultColors.accent};
    box-shadow: 0 0 0 2px rgba(237, 174, 73, 0.1);
  }
  
  &::placeholder {
    color: ${defaultColors.textMuted};
    font-size: 0.85em;
  }
`;

const ClearButton = styled.button`
  position: absolute;
  right: 8px;
  background: transparent;
  border: none;
  color: ${defaultColors.textMuted};
  cursor: pointer;
  padding: 4px 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85em;
  border-radius: 4px;
  transition: all 0.2s ease;
  z-index: 1;
  
  &:hover {
    color: ${defaultColors.text};
    background: ${defaultColors.border};
  }
`;

const Hint = styled.div`
  margin-top: 0;
  color: ${defaultColors.textMuted};
  
  small {
    font-size: 0.75em;
    line-height: 1.4;
  }
`;

export interface AdvancedSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputId?: string;
  showHint?: boolean;
  onClear?: () => void;
}

export function AdvancedSearchInput({
  value,
  onChange,
  placeholder = 'Search... (use "quotes" for exact, space for AND, | for OR)',
  inputId,
  showHint = true,
  onClear
}: AdvancedSearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  
  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };
  
  const handleClear = () => {
    if (inputRef.current) {
      inputRef.current.value = '';
      onChange('');
      inputRef.current.focus();
    }
    if (onClear) {
      onClear();
    }
  };
  
  const generatedId = inputId || `advanced-search-${Math.random().toString(36).substr(2, 9)}`;
  
  return (
    <Container>
      <Wrapper>
        <Icon>[SEARCH]</Icon>
        <Input
          ref={inputRef}
          type="text"
          id={generatedId}
          placeholder={placeholder}
          value={value}
          onChange={handleInput}
        />
        {value.trim() && (
          <ClearButton
            onClick={handleClear}
            type="button"
            aria-label="Clear search"
            title="Clear search"
          >
            [EMOJI]
          </ClearButton>
        )}
      </Wrapper>
      {showHint && (
        <Hint>
          <small>Use quotes for exact phrases, space for AND, | for OR</small>
        </Hint>
      )}
    </Container>
  );
}

