/**
 * Theme exports for Mods Hub
 * Uses shared @strixun/shared-styles as the source of truth
 */

// Re-export shared global style
export { GlobalStyle as SharedGlobalStyle } from '@strixun/shared-styles';

// Export mods-hub specific global style (includes seasonal animations)
export { GlobalStyle } from './GlobalStyle';

// Re-export all tokens from shared styles
export { 
  colors, 
  spacing, 
  typography,
  breakpoints,
  media,
  radius,
  shadows,
} from '@strixun/shared-styles';

// Local exports for backward compatibility
export { responsiveSpacing } from './tokens';
