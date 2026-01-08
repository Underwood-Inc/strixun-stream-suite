/**
 * Design tokens for Mods Hub
 * Themed to match Strixun Stream Suite
 */

export const colors = {
  // Background colors
  bg: '#1a1a1a',
  bgSecondary: '#252525',
  bgTertiary: '#2d2d2d',
  
  // Text colors
  text: '#f9f9f9',
  textSecondary: '#b0b0b0',
  textMuted: '#808080',
  
  // Accent colors (gold theme)
  accent: '#d4af37',
  accentHover: '#e5c158',
  accentActive: '#b8941f',
  
  // Status colors
  success: '#4caf50',
  warning: '#ff9800',
  danger: '#f44336',
  info: '#2196f3',
  
  // Border colors
  border: '#3a3a3a',
  borderLight: '#4a4a4a',
  
  // Card colors
  card: '#252525',
  cardHover: '#2d2d2d',
};

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  xxl: '48px',
};

export const typography = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
};

export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};

export const media = {
  sm: `@media (min-width: ${breakpoints.sm})`,
  md: `@media (min-width: ${breakpoints.md})`,
  lg: `@media (min-width: ${breakpoints.lg})`,
  xl: `@media (min-width: ${breakpoints.xl})`,
  '2xl': `@media (min-width: ${breakpoints['2xl']})`,
};

export const responsiveSpacing = {
  sm: { mobile: spacing.sm, desktop: spacing.md },
  md: { mobile: spacing.md, desktop: spacing.lg },
  lg: { mobile: spacing.lg, desktop: spacing.xl },
};
