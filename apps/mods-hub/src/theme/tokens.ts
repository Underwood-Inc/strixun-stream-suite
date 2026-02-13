/**
 * Design tokens for Mods Hub
 * Re-exports from shared @strixun/shared-styles for consistency
 * 
 * DO NOT add custom tokens here - all design tokens must be in shared-styles
 */

export { 
  colors, 
  spacing, 
  typography, 
  breakpoints, 
  media,
  radius,
  shadows,
} from '@strixun/shared-styles';

// For backward compatibility with existing code using responsiveSpacing
export const responsiveSpacing = {
  sm: { mobile: '8px', desktop: '16px' },
  md: { mobile: '16px', desktop: '24px' },
  lg: { mobile: '24px', desktop: '32px' },
};
