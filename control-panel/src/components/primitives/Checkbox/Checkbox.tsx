import { forwardRef, type InputHTMLAttributes } from 'react';
import styled from 'styled-components';
import { colors, radii, spacing, transitions } from '@/theme/tokens';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

const CheckboxWrapper = styled.label`
  display: inline-flex;
  align-items: center;
  gap: ${spacing.sm};
  cursor: pointer;
  user-select: none;
  
  &:has(input:disabled) {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const HiddenInput = styled.input`
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
`;

const CheckboxBox = styled.span<{ $checked: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  background: ${({ $checked }) => $checked ? colors.accent : colors.bg};
  border: 2px solid ${({ $checked }) => $checked ? colors.accentDark : colors.border};
  border-radius: ${radii.sm};
  transition: all ${transitions.fast};
  flex-shrink: 0;
  
  &::after {
    content: '[EMOJI]';
    color: ${colors.bgDark};
    font-size: 12px;
    font-weight: bold;
    opacity: ${({ $checked }) => $checked ? 1 : 0};
    transform: scale(${({ $checked }) => $checked ? 1 : 0.5});
    transition: all ${transitions.fast};
  }
  
  ${CheckboxWrapper}:hover & {
    border-color: ${colors.accent};
  }
`;

const LabelText = styled.span`
  font-size: 0.9rem;
  color: ${colors.text};
`;

/**
 * Checkbox component with gold theme.
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, checked = false, disabled, ...props }, ref) => {
    return (
      <CheckboxWrapper>
        <HiddenInput
          ref={ref}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          {...props}
        />
        <CheckboxBox $checked={!!checked} />
        {label && <LabelText>{label}</LabelText>}
      </CheckboxWrapper>
    );
  }
);

Checkbox.displayName = 'Checkbox';

