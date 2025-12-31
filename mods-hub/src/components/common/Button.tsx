/**
 * Shared Button Component
 * Uses styles from shared-styles/_mixins.scss via buttonStyles utility
 * Ensures consistent button styling across mods-hub
 */

import styled from 'styled-components';
import { getButtonStyles, type ButtonVariant } from '../../utils/buttonStyles';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: React.ReactNode;
}

const StyledButton = styled.button<{ variant: ButtonVariant }>`
  ${({ variant }) => getButtonStyles(variant)}
`;

export function Button({ variant = 'primary', children, ...props }: ButtonProps) {
  return (
    <StyledButton variant={variant} {...props}>
      {children}
    </StyledButton>
  );
}
