import { forwardRef, type InputHTMLAttributes } from 'react';
import styled, { css, keyframes } from 'styled-components';
import { colors, radii, shadows, transitions } from '@/theme/tokens';

export interface ToggleProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  loading?: boolean;
}

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
`;

const ToggleWrapper = styled.label<{ $disabled?: boolean }>`
  display: inline-flex;
  align-items: center;
  cursor: ${({ $disabled }) => $disabled ? 'not-allowed' : 'pointer'};
  opacity: ${({ $disabled }) => $disabled ? 0.5 : 1};
`;

const ToggleTrack = styled.span<{ $checked: boolean; $loading: boolean }>`
  position: relative;
  width: 48px;
  height: 26px;
  background: ${({ $checked }) => $checked ? colors.accent : colors.border};
  border-radius: ${radii.full};
  transition: background ${transitions.normal}, box-shadow ${transitions.normal};
  flex-shrink: 0;
  
  &:hover {
    box-shadow: 0 0 0 2px ${colors.borderLight};
  }
  
  ${({ $loading }) => $loading && css`
    pointer-events: none;
    opacity: 0.7;
  `}
`;

const ToggleThumb = styled.span<{ $checked: boolean; $loading: boolean }>`
  position: absolute;
  top: 3px;
  left: 3px;
  width: 20px;
  height: 20px;
  background: #fff;
  border-radius: 50%;
  box-shadow: ${shadows.sm};
  transition: transform ${transitions.normal};
  transform: translateX(${({ $checked }) => $checked ? '22px' : '0'});
  
  ${({ $loading }) => $loading && css`
    background: ${colors.accentLight};
    animation: ${pulse} 0.6s ease-in-out infinite;
  `}
`;

const HiddenInput = styled.input`
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
`;

/**
 * Toggle switch component with gold theme and loading state.
 */
export const Toggle = forwardRef<HTMLInputElement, ToggleProps>(
  ({ loading = false, disabled, checked = false, onChange, ...props }, ref) => {
    return (
      <ToggleWrapper $disabled={disabled || loading}>
        <HiddenInput
          ref={ref}
          type="checkbox"
          checked={checked}
          disabled={disabled || loading}
          onChange={onChange}
          {...props}
        />
        <ToggleTrack $checked={!!checked} $loading={loading}>
          <ToggleThumb $checked={!!checked} $loading={loading} />
        </ToggleTrack>
      </ToggleWrapper>
    );
  }
);

Toggle.displayName = 'Toggle';

