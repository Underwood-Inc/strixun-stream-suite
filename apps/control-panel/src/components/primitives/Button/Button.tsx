import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import styled, { css, keyframes } from 'styled-components';
import { colors, radii, spacing, transitions, fontWeights } from '@/theme/tokens';
import type { ButtonVariant, ButtonSize } from '@/types';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
}

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

const variantStyles = {
  primary: css`
    background: ${colors.accent};
    border-color: ${colors.accent};
    color: ${colors.bgDark};
    font-weight: ${fontWeights.semibold};
    
    &:hover:not(:disabled) {
      background: ${colors.accentLight};
    }
  `,
  secondary: css`
    background: ${colors.card};
    border-color: ${colors.border};
    color: ${colors.text};
    
    &:hover:not(:disabled) {
      background: ${colors.border};
    }
  `,
  danger: css`
    background: ${colors.danger};
    border-color: ${colors.danger};
    color: #fff;
    font-weight: ${fontWeights.semibold};
    
    &:hover:not(:disabled) {
      filter: brightness(1.1);
    }
  `,
  success: css`
    background: ${colors.success};
    border-color: ${colors.success};
    color: #fff;
    font-weight: ${fontWeights.semibold};
    
    &:hover:not(:disabled) {
      filter: brightness(1.1);
    }
  `,
  warning: css`
    background: ${colors.warning};
    border-color: ${colors.warning};
    color: ${colors.bgDark};
    font-weight: ${fontWeights.semibold};
    
    &:hover:not(:disabled) {
      filter: brightness(1.1);
    }
  `,
  ghost: css`
    background: transparent;
    border-color: transparent;
    color: ${colors.accent};
    
    &:hover:not(:disabled) {
      background: rgba(237, 174, 73, 0.1);
    }
  `,
};

const sizeStyles = {
  sm: css`
    padding: ${spacing.xs} ${spacing.sm};
    font-size: 0.85rem;
  `,
  md: css`
    padding: ${spacing.sm} ${spacing.lg};
    font-size: 0.95rem;
  `,
  lg: css`
    padding: ${spacing.md} ${spacing.xl};
    font-size: 1.1rem;
  `,
};

const StyledButton = styled.button<{
  $variant: ButtonVariant;
  $size: ButtonSize;
  $loading: boolean;
  $fullWidth: boolean;
}>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${spacing.sm};
  border: 1px solid;
  border-radius: ${radii.md};
  cursor: pointer;
  transition: all ${transitions.fast};
  position: relative;
  white-space: nowrap;
  
  ${({ $variant }) => variantStyles[$variant]}
  ${({ $size }) => sizeStyles[$size]}
  ${({ $fullWidth }) => $fullWidth && css`width: 100%;`}
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  ${({ $loading }) => $loading && css`
    color: transparent;
    pointer-events: none;
    
    &::after {
      content: '';
      position: absolute;
      width: 16px;
      height: 16px;
      border: 2px solid currentColor;
      border-top-color: transparent;
      border-radius: 50%;
      animation: ${spin} 0.6s linear infinite;
    }
  `}
`;

/**
 * Button component with multiple variants and loading state.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', loading = false, fullWidth = false, children, disabled, ...props }, ref) => {
    return (
      <StyledButton
        ref={ref}
        $variant={variant}
        $size={size}
        $loading={loading}
        $fullWidth={fullWidth}
        disabled={disabled || loading}
        {...props}
      >
        {children}
      </StyledButton>
    );
  }
);

Button.displayName = 'Button';

