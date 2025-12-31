/**
 * Lightweight, agnostic select component using React Portals
 * Prevents dropdown clipping by rendering outside parent containers
 * 
 * @example
 * <PortalSelect
 *   value={selectedValue}
 *   onChange={setSelectedValue}
 *   options={[
 *     { value: '1', label: 'Option 1' },
 *     { value: '2', label: 'Option 2' }
 *   ]}
 *   placeholder="Select an option..."
 * />
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { colors, spacing } from '../../theme';

const SelectContainer = styled.div`
  position: relative;
  width: 100%;
`;

const Trigger = styled.div<{ isOpen: boolean; disabled?: boolean }>`
  padding: ${spacing.sm} ${spacing.md};
  background: ${colors.bg};
  border: 1px solid ${colors.border};
  border-radius: 6px;
  color: ${colors.text};
  font-size: 0.875rem;
  cursor: ${({ disabled }) => disabled ? 'not-allowed' : 'pointer'};
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  opacity: ${({ disabled }) => disabled ? 0.6 : 1};
  
  &:hover:not(:disabled) {
    border-color: ${colors.borderLight || colors.border};
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
  }
  
  &:focus-within {
    border-color: ${colors.accent};
    box-shadow: 0 0 0 3px ${colors.accent}20, 0 2px 6px rgba(0, 0, 0, 0.1);
  }
`;

const TriggerText = styled.span<{ isPlaceholder?: boolean }>`
  color: ${({ isPlaceholder }) => isPlaceholder ? colors.textMuted : colors.text};
  font-style: ${({ isPlaceholder }) => isPlaceholder ? 'italic' : 'normal'};
`;

const Chevron = styled.span<{ isOpen: boolean }>`
  color: ${colors.textSecondary};
  font-size: 0.75rem;
  transition: transform 0.2s ease;
  transform: ${({ isOpen }) => isOpen ? 'rotate(180deg)' : 'rotate(0deg)'};
  margin-left: ${spacing.sm};
`;

const PortalDropdown = styled.div<{ x: number; y: number; width: number; isOpen: boolean }>`
  position: fixed;
  top: ${({ y }) => y}px;
  left: ${({ x }) => x}px;
  width: ${({ width }) => width}px;
  background: ${colors.bgSecondary};
  border: 1px solid ${colors.border};
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  z-index: 10000;
  max-height: 400px;
  overflow: hidden;
  display: ${({ isOpen }) => isOpen ? 'block' : 'none'};
  margin-top: ${spacing.xs};
`;

const SearchInput = styled.input`
  width: 100%;
  padding: ${spacing.sm} ${spacing.md};
  background: ${colors.bg};
  border: none;
  border-bottom: 1px solid ${colors.border};
  border-radius: 8px 8px 0 0;
  color: ${colors.text};
  font-size: 0.875rem;
  transition: all 0.2s ease;
  
  &:focus {
    outline: none;
    border-bottom-color: ${colors.accent};
  }
  
  &::placeholder {
    color: ${colors.textMuted};
  }
`;

const OptionsList = styled.div`
  max-height: 350px;
  overflow-y: auto;
  overflow-x: hidden;
`;

const Option = styled.div<{ isSelected: boolean; isHighlighted: boolean }>`
  padding: ${spacing.sm} ${spacing.md};
  cursor: pointer;
  background: ${({ isSelected, isHighlighted }) => 
    isSelected ? `${colors.accent}20` : isHighlighted ? colors.bgTertiary : 'transparent'};
  color: ${({ isSelected }) => isSelected ? colors.accent : colors.text};
  border-left: 3px solid ${({ isSelected }) => isSelected ? colors.accent : 'transparent'};
  transition: all 0.15s ease;
  font-size: 0.875rem;
  
  &:hover {
    background: ${colors.bgTertiary};
  }
`;

const EmptyState = styled.div`
  padding: ${spacing.lg};
  text-align: center;
  color: ${colors.textMuted};
  font-size: 0.875rem;
`;

export interface PortalSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface PortalSelectProps {
  value?: string;
  onChange: (value: string | undefined) => void;
  options: PortalSelectOption[];
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  renderOption?: (option: PortalSelectOption) => React.ReactNode;
  filterOptions?: (query: string, options: PortalSelectOption[]) => PortalSelectOption[];
}

export function PortalSelect({
  value,
  onChange,
  options,
  placeholder = 'Select an option...',
  searchable = false,
  searchPlaceholder = 'Search...',
  disabled = false,
  clearable = false,
  renderOption,
  filterOptions,
}: PortalSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter options based on search
  const filteredOptions = useMemo(() => {
    if (!searchable || !searchQuery.trim()) {
      return options;
    }
    
    if (filterOptions) {
      return filterOptions(searchQuery, options);
    }
    
    // Default filter: case-insensitive search on label
    const query = searchQuery.toLowerCase().trim();
    return options.filter(opt => 
      opt.label.toLowerCase().includes(query)
    );
  }, [options, searchQuery, searchable, filterOptions]);

  // Get selected option
  const selectedOption = useMemo(() => {
    return value ? options.find(opt => opt.value === value) : undefined;
  }, [value, options]);

  // Calculate dropdown position
  const updatePosition = useCallback(() => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    setPosition({
      x: rect.left,
      y: rect.bottom + window.scrollY,
      width: rect.width,
    });
  }, []);

  // Handle opening dropdown
  const handleOpen = useCallback(() => {
    if (disabled) return;
    updatePosition();
    setIsOpen(true);
    setSearchQuery('');
    setHighlightedIndex(0);
  }, [disabled, updatePosition]);

  // Handle closing dropdown
  const handleClose = useCallback(() => {
    setIsOpen(false);
    setSearchQuery('');
    setHighlightedIndex(0);
  }, []);

  // Handle clear
  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(undefined);
  }, [onChange]);

  // Handle option selection
  const handleSelect = useCallback((option: PortalSelectOption) => {
    if (option.disabled) return;
    onChange(option.value);
    handleClose();
  }, [onChange, handleClose]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        handleOpen();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredOptions[highlightedIndex] && !filteredOptions[highlightedIndex].disabled) {
          handleSelect(filteredOptions[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        handleClose();
        break;
    }
  }, [isOpen, filteredOptions, highlightedIndex, disabled, handleOpen, handleSelect, handleClose]);

  // Update position on scroll/resize
  useEffect(() => {
    if (!isOpen) return;

    const updatePos = () => updatePosition();
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);

    return () => {
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [isOpen, updatePosition]);

  // Auto-focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 0);
    }
  }, [isOpen, searchable]);

  // Handle click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const portal = document.getElementById('portal-select-root');
      
      // Close if click is outside both container and portal
      if (
        containerRef.current && 
        !containerRef.current.contains(target) &&
        (!portal || !portal.contains(target))
      ) {
        handleClose();
      }
    };

    // Use a small delay to avoid closing immediately when opening
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, handleClose]);

  // Ensure portal root exists
  useEffect(() => {
    if (!document.getElementById('portal-select-root')) {
      const portalRoot = document.createElement('div');
      portalRoot.id = 'portal-select-root';
      document.body.appendChild(portalRoot);
    }
  }, []);

  const portalRoot = document.getElementById('portal-select-root');

  return (
    <>
      <SelectContainer ref={containerRef}>
        <Trigger
          isOpen={isOpen}
          disabled={disabled}
          onClick={handleOpen}
          onKeyDown={handleKeyDown}
          tabIndex={disabled ? -1 : 0}
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
          <TriggerText isPlaceholder={!selectedOption}>
            {selectedOption ? selectedOption.label : placeholder}
          </TriggerText>
          {clearable && selectedOption && (
            <ClearButton
              type="button"
              onClick={handleClear}
              aria-label="Clear selection"
            >
              Clear
            </ClearButton>
          )}
          <Chevron isOpen={isOpen}>▼</Chevron>
        </Trigger>
      </SelectContainer>

      {isOpen && portalRoot && createPortal(
        <PortalDropdown
          x={position.x}
          y={position.y}
          width={position.width}
          isOpen={isOpen}
        >
          {searchable && (
            <SearchInput
              ref={searchInputRef}
              type="text"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setHighlightedIndex(0);
              }}
              onKeyDown={handleKeyDown}
            />
          )}
          <OptionsList>
            {filteredOptions.length === 0 ? (
              <EmptyState>No options found</EmptyState>
            ) : (
              filteredOptions.map((option, index) => (
                <Option
                  key={option.value}
                  isSelected={option.value === value}
                  isHighlighted={index === highlightedIndex}
                  onClick={() => handleSelect(option)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  style={{
                    opacity: option.disabled ? 0.5 : 1,
                    cursor: option.disabled ? 'not-allowed' : 'pointer',
                  }}
                >
                  {renderOption ? renderOption(option) : option.label}
                </Option>
              ))
            )}
          </OptionsList>
        </PortalDropdown>,
        portalRoot
      )}
    </>
  );
}
