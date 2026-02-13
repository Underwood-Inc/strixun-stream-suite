import { forwardRef, type SelectHTMLAttributes } from 'react';
import styled from 'styled-components';
import { colors, radii, spacing, transitions } from '@/theme/tokens';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
}

const SelectWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.xs};
  margin-bottom: ${spacing.sm};
`;

const Label = styled.label`
  font-size: 0.85rem;
  color: ${colors.muted};
`;

const StyledSelect = styled.select`
  width: 100%;
  padding: ${spacing.sm} ${spacing.md};
  background: ${colors.bg};
  border: 1px solid ${colors.border};
  border-radius: ${radii.md};
  color: ${colors.text};
  font-size: 0.95rem;
  cursor: pointer;
  transition: border-color ${transitions.normal};
  
  &:focus {
    outline: none;
    border-color: ${colors.accent};
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  option {
    background: ${colors.card};
    color: ${colors.text};
  }
`;

/**
 * Select dropdown component with optional label.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, id, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');
    
    const content = (
      <StyledSelect ref={ref} id={selectId} {...props}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </StyledSelect>
    );
    
    if (label) {
      return (
        <SelectWrapper>
          <Label htmlFor={selectId}>{label}</Label>
          {content}
        </SelectWrapper>
      );
    }
    
    return content;
  }
);

Select.displayName = 'Select';

