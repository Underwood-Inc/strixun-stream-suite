import { forwardRef, type InputHTMLAttributes } from 'react';
import styled from 'styled-components';
import { colors, radii, spacing, transitions } from '@/theme/tokens';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Input label */
  label?: string;
}

const InputWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.xs};
  margin-bottom: ${spacing.sm};
`;

const Label = styled.label`
  font-size: 0.85rem;
  color: ${colors.muted};
`;

const StyledInput = styled.input`
  width: 100%;
  padding: ${spacing.sm} ${spacing.md};
  background: ${colors.bg};
  border: 1px solid ${colors.border};
  border-radius: ${radii.md};
  color: ${colors.text};
  font-size: 0.95rem;
  transition: border-color ${transitions.normal};
  
  &:focus {
    outline: none;
    border-color: ${colors.accent};
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  &::placeholder {
    color: ${colors.muted};
  }
`;

/**
 * Text input component with optional label.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    
    if (label) {
      return (
        <InputWrapper>
          <Label htmlFor={inputId}>{label}</Label>
          <StyledInput ref={ref} id={inputId} {...props} />
        </InputWrapper>
      );
    }
    
    return <StyledInput ref={ref} id={inputId} {...props} />;
  }
);

Input.displayName = 'Input';

