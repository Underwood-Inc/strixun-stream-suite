/**
 * Lightweight, agnostic select component using React Portals
 * Prevents dropdown clipping by rendering outside parent containers
 * 
 * Features:
 * - Viewport-aware positioning (auto-flips if no space)
 * - Searchable with custom filter support
 * - Keyboard navigation (arrow keys, enter, escape)
 * - Custom option rendering
 * - Clearable selection
 * - Fully themeable via props
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';

export interface PortalSelectTheme {
  colors: {
    bg: string;
    bgSecondary: string;
    bgTertiary: string;
    text: string;
    textSecondary: string;
    textMuted: string;
    border: string;
    accent: string;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
  };
}

const SelectContainer = styled.div`
  position: relative;
  width: 100%;
`;

const Trigger = styled.button<{ $isOpen: boolean; theme: PortalSelectTheme }>`
  width: 100%;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.bg};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ $isOpen }) => $isOpen ? '6px 6px 0 0' : '6px'};
  ${({ $isOpen }) => $isOpen && 'border-bottom: none;'}
  color: ${({ theme }) => theme.colors.text};
  font-size: 0.875rem;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.2s ease;
  text-align: left;
  
  &:hover {
    border-color: ${({ theme }) => theme.colors.accent};
  }
  
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.accent};
    ${({ $isOpen, theme }) => !$isOpen && `box-shadow: 0 0 0 3px ${theme.colors.accent}20;`}
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const TriggerText = styled.span<{ $isPlaceholder?: boolean; theme: PortalSelectTheme }>`
  color: ${({ $isPlaceholder, theme }) => $isPlaceholder ? theme.colors.textMuted : theme.colors.text};
  font-style: ${({ $isPlaceholder }) => $isPlaceholder ? 'italic' : 'normal'};
  flex: 1;
`;

const Chevron = styled.span<{ $isOpen: boolean; theme: PortalSelectTheme }>`
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: 0.75rem;
  transition: transform 0.2s ease;
  transform: ${({ $isOpen }) => $isOpen ? 'rotate(180deg)' : 'rotate(0deg)'};
  margin-left: ${({ theme }) => theme.spacing.sm};
`;

const Dropdown = styled.div<{ $x: number; $y: number; $width: number; $openUpward?: boolean; theme: PortalSelectTheme }>`
  position: fixed;
  top: ${({ $y }) => $y}px;
  left: ${({ $x }) => $x}px;
  width: ${({ $width }) => $width}px;
  background: ${({ theme }) => theme.colors.bgSecondary};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ $openUpward }) => $openUpward ? '8px 8px 0 0' : '0 0 8px 8px'};
  ${({ $openUpward }) => $openUpward ? 'border-bottom: none;' : 'border-top: none;'}
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  z-index: 999999;
  max-height: 400px;
  overflow: hidden;
  animation: ${({ $openUpward }) => $openUpward ? 'dropdownFadeInUp' : 'dropdownFadeInDown'} 0.15s ease-out;
  ${({ $openUpward }) => $openUpward ? 'margin-bottom: -1px;' : 'margin-top: -1px;'}
  
  @keyframes dropdownFadeInDown {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes dropdownFadeInUp {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const SearchInput = styled.input<{ theme: PortalSelectTheme }>`
  width: 100%;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.bg};
  border: none;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 0;
  color: ${({ theme }) => theme.colors.text};
  font-size: 0.875rem;
  
  &:focus {
    outline: none;
    border-bottom-color: ${({ theme }) => theme.colors.accent};
  }
  
  &::placeholder {
    color: ${({ theme }) => theme.colors.textMuted};
  }
`;

const OptionsList = styled.div`
  max-height: 350px;
  overflow-y: auto;
  overflow-x: hidden;
`;

const Option = styled.div<{ $isSelected: boolean; $isHighlighted: boolean; theme: PortalSelectTheme }>`
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  cursor: pointer;
  background: ${({ $isSelected, $isHighlighted, theme }) => 
    $isSelected ? `${theme.colors.accent}20` : $isHighlighted ? theme.colors.bgTertiary : 'transparent'};
  color: ${({ $isSelected, theme }) => $isSelected ? theme.colors.accent : theme.colors.text};
  border-left: 3px solid ${({ $isSelected, theme }) => $isSelected ? theme.colors.accent : 'transparent'};
  transition: all 0.15s ease;
  font-size: 0.875rem;
  
  &:hover {
    background: ${({ theme }) => theme.colors.bgTertiary};
  }
`;

const EmptyState = styled.div<{ theme: PortalSelectTheme }>`
  padding: ${({ theme }) => theme.spacing.lg};
  text-align: center;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 0.875rem;
`;

const ClearButton = styled.button<{ theme: PortalSelectTheme }>`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: 0.75rem;
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
  margin-left: ${({ theme }) => theme.spacing.sm};
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${({ theme }) => theme.colors.bgTertiary};
    color: ${({ theme }) => theme.colors.text};
  }
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
  theme: PortalSelectTheme;
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
  theme,
}: PortalSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isOpenUpward, setIsOpenUpward] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter options
  const filteredOptions = useMemo(() => {
    if (!searchable || !searchQuery.trim()) {
      return options;
    }
    
    if (filterOptions) {
      return filterOptions(searchQuery, options);
    }
    
    const query = searchQuery.toLowerCase().trim();
    return options.filter(opt => 
      opt.label.toLowerCase().includes(query)
    );
  }, [options, searchQuery, searchable, filterOptions]);

  // Get selected option
  const selectedOption = useMemo(() => {
    return value ? options.find(opt => opt.value === value) : undefined;
  }, [value, options]);

  // Calculate position with viewport boundary detection
  const updatePosition = useCallback(() => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const dropdownMaxHeight = 400; // Match max-height from styled component
    const margin = 8; // Margin from viewport edges
    
    // Calculate available space above and below
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    
    // Determine if dropdown should open upward
    const shouldOpenUpward = spaceBelow < dropdownMaxHeight && spaceAbove > spaceBelow;
    
    // Calculate Y position (pin directly to trigger)
    let y = shouldOpenUpward 
      ? rect.top - Math.min(dropdownMaxHeight, spaceAbove - margin)
      : rect.bottom;
    
    // Store open direction for styling
    setIsOpenUpward(shouldOpenUpward);
    
    // Ensure Y doesn't go below viewport
    if (!shouldOpenUpward && y + dropdownMaxHeight > window.innerHeight) {
      y = window.innerHeight - dropdownMaxHeight - margin;
    }
    
    // Ensure Y doesn't go above viewport
    if (y < margin) {
      y = margin;
    }
    
    // Calculate X position (prevent overflow on right)
    let x = rect.left;
    const dropdownWidth = rect.width;
    
    if (x + dropdownWidth > window.innerWidth - margin) {
      x = window.innerWidth - dropdownWidth - margin;
    }
    
    // Ensure X doesn't go negative
    if (x < margin) {
      x = margin;
    }
    
    setPosition({
      x,
      y,
      width: rect.width,
    });
  }, []);

  // Toggle dropdown
  const toggleDropdown = useCallback(() => {
    if (disabled) return;
    
    if (!isOpen) {
      updatePosition();
      setIsOpen(true);
      setSearchQuery('');
      setHighlightedIndex(0);
    } else {
      setIsOpen(false);
    }
  }, [disabled, isOpen, updatePosition]);

  // Close dropdown
  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setSearchQuery('');
    setHighlightedIndex(0);
  }, []);

  // Handle selection
  const handleSelect = useCallback((option: PortalSelectOption) => {
    if (option.disabled) return;
    onChange(option.value);
    closeDropdown();
  }, [onChange, closeDropdown]);

  // Handle clear
  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(undefined);
  }, [onChange]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) return;

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
        closeDropdown();
        break;
    }
  }, [isOpen, filteredOptions, highlightedIndex, handleSelect, closeDropdown]);

  // Update position on scroll/resize
  useEffect(() => {
    if (!isOpen) return;

    const handleUpdate = () => {
      updatePosition();
    };

    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);
    document.addEventListener('scroll', handleUpdate, true);

    return () => {
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
      document.removeEventListener('scroll', handleUpdate, true);
    };
  }, [isOpen, updatePosition]);

  // Auto-focus search input
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }, [isOpen, searchable]);

  // Click outside handler
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      
      if (
        containerRef.current && 
        !containerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        closeDropdown();
      }
    };

    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, closeDropdown]);

  return (
    <>
      <SelectContainer ref={containerRef}>
        <Trigger
          type="button"
          disabled={disabled}
          onClick={toggleDropdown}
          onKeyDown={handleKeyDown}
          theme={theme}
          $isOpen={isOpen}
        >
          <TriggerText $isPlaceholder={!selectedOption} theme={theme}>
            {selectedOption ? selectedOption.label : placeholder}
          </TriggerText>
          {clearable && selectedOption && (
            <ClearButton
              type="button"
              onClick={handleClear}
              theme={theme}
            >
              Clear
            </ClearButton>
          )}
          <Chevron $isOpen={isOpen} theme={theme}>▼</Chevron>
        </Trigger>
      </SelectContainer>

      {isOpen && createPortal(
        <Dropdown
          ref={dropdownRef}
          $x={position.x}
          $y={position.y}
          $width={position.width}
          $openUpward={isOpenUpward}
          theme={theme}
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
              theme={theme}
            />
          )}
          <OptionsList>
            {filteredOptions.length === 0 ? (
              <EmptyState theme={theme}>No options found</EmptyState>
            ) : (
              filteredOptions.map((option, index) => (
                <Option
                  key={option.value}
                  $isSelected={option.value === value}
                  $isHighlighted={index === highlightedIndex}
                  onClick={() => handleSelect(option)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  style={{
                    opacity: option.disabled ? 0.5 : 1,
                    cursor: option.disabled ? 'not-allowed' : 'pointer',
                  }}
                  theme={theme}
                >
                  {renderOption ? renderOption(option) : option.label}
                </Option>
              ))
            )}
          </OptionsList>
        </Dropdown>,
        document.body
      )}
    </>
  );
}
