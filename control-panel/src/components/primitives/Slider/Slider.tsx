import { forwardRef, type InputHTMLAttributes } from 'react';
import styled, { css } from 'styled-components';
import { colors, radii, shadows, transitions } from '@/theme/tokens';

export interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Compact inline version */
  inline?: boolean;
}

const sliderThumbStyles = css`
  -webkit-appearance: none;
  appearance: none;
  width: 22px;
  height: 22px;
  background: ${colors.accent};
  border-radius: ${radii.sm};
  border: 2px solid ${colors.accentDark};
  box-shadow: ${shadows.sm};
  cursor: grab;
  transition: transform ${transitions.fast}, background ${transitions.fast};
  
  &:hover {
    background: ${colors.accentLight};
    transform: scale(1.1);
  }
  
  &:active {
    cursor: grabbing;
    transform: scale(0.95);
  }
`;

const sliderThumbInlineStyles = css`
  width: 16px;
  height: 16px;
  border-radius: 3px;
`;

const StyledSlider = styled.input<{ $inline: boolean }>`
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: ${({ $inline }) => $inline ? '8px' : '12px'};
  background: ${colors.bg};
  border-radius: ${radii.md};
  border: ${({ $inline }) => $inline ? '1px' : '2px'} solid ${colors.border};
  cursor: pointer;
  transition: border-color ${transitions.normal};
  
  &:hover {
    border-color: ${colors.accent};
  }
  
  &:focus {
    outline: none;
    border-color: ${colors.accent};
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  /* Webkit (Chrome, Safari, Edge) */
  &::-webkit-slider-thumb {
    ${sliderThumbStyles}
    ${({ $inline }) => $inline && sliderThumbInlineStyles}
  }
  
  &:disabled::-webkit-slider-thumb {
    cursor: not-allowed;
    background: ${colors.muted};
  }
  
  /* Firefox */
  &::-moz-range-thumb {
    ${sliderThumbStyles}
    ${({ $inline }) => $inline && sliderThumbInlineStyles}
  }
  
  &::-moz-range-track {
    background: transparent;
    border: none;
  }
  
  &:disabled::-moz-range-thumb {
    cursor: not-allowed;
    background: ${colors.muted};
  }
`;

/**
 * Slider component with chunky gold theme.
 */
export const Slider = forwardRef<HTMLInputElement, SliderProps>(
  ({ inline = false, ...props }, ref) => {
    return (
      <StyledSlider
        ref={ref}
        type="range"
        $inline={inline}
        {...props}
      />
    );
  }
);

Slider.displayName = 'Slider';

