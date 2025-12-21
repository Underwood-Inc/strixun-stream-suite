import styled, { keyframes } from 'styled-components';
import { colors } from '@/theme/tokens';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

const sizeMap = {
  sm: '14px',
  md: '20px',
  lg: '32px',
};

const StyledSpinner = styled.div<{ $size: string; $color: string }>`
  width: ${({ $size }) => $size};
  height: ${({ $size }) => $size};
  border: 2px solid ${colors.borderLight};
  border-top-color: ${({ $color }) => $color};
  border-radius: 50%;
  animation: ${spin} 0.6s linear infinite;
`;

/**
 * Loading spinner component.
 */
export function Spinner({ size = 'md', color = colors.accent }: SpinnerProps) {
  return <StyledSpinner $size={sizeMap[size]} $color={color} />;
}

