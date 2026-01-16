/**
 * Strixun Stream Suite - Design Tokens (TypeScript)
 * 
 * Single source of truth for design tokens across all TypeScript/React projects.
 * These values MUST match _variables.scss - this is the TypeScript equivalent.
 * 
 * Usage in React (styled-components):
 *   import { colors, spacing } from '@shared-styles/tokens';
 *   const Card = styled.div`background: ${colors.card};`;
 * 
 * Usage with GlobalStyle:
 *   import { GlobalStyle } from '@shared-styles/GlobalStyle';
 *   <GlobalStyle />
 */

// ============ Color Palette ============
// Matches _variables.scss $colors map EXACTLY
export const colors = {
  // Backgrounds
  bg: '#1a1611',
  bgDark: '#0f0e0b',
  bgSecondary: '#1a1611', // Alias for consistency with some apps
  bgTertiary: '#252017',  // Alias
  card: '#252017',
  cardHover: '#2d2920',
  
  // Borders
  border: '#3d3627',
  borderLight: '#4a4336',
  
  // Brand Colors (Gold/Amber accent)
  accent: '#edae49',
  accentLight: '#f9df74',
  accentDark: '#c68214',
  accentHover: '#f9df74', // Alias for accentLight
  accentActive: '#c68214', // Alias for accentDark
  accent2: '#6495ed', // Secondary accent (blue)
  
  // Status Colors
  success: '#28a745',
  warning: '#ffc107',
  danger: '#ea2b1f',
  info: '#6495ed',
  
  // Text Colors
  text: '#f9f9f9',
  textSecondary: '#b8b8b8',
  textMuted: '#888888',
  muted: '#888888', // Alias
  
  // Glass Effects
  glassBg: 'rgba(37, 32, 23, 0.95)',
  glassBgDark: 'rgba(26, 22, 17, 0.98)',
  glassBorder: 'rgba(61, 54, 39, 0.8)',
} as const;

// ============ Spacing ============
// Matches _variables.scss --spacing-* CSS variables
export const spacing = {
  xs: '8px',
  sm: '12px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  xxl: '48px',    // Alias for backward compatibility
  '2xl': '48px',
  '3xl': '64px',
} as const;

// ============ Border Radius ============
// Matches _variables.scss --radius-* CSS variables
export const radius = {
  sm: '4px',
  md: '8px',
  lg: '12px',
} as const;

// ============ Shadows ============
// Matches _variables.scss --shadow-* CSS variables
export const shadows = {
  sm: '0 2px 4px rgba(0, 0, 0, 0.2)',
  md: '0 4px 8px rgba(0, 0, 0, 0.3)',
  lg: '0 8px 16px rgba(0, 0, 0, 0.4)',
} as const;

// ============ Typography ============
export const typography = {
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
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
} as const;

// ============ Breakpoints ============
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

// ============ Media Queries ============
export const media = {
  sm: `@media (min-width: ${breakpoints.sm})`,
  md: `@media (min-width: ${breakpoints.md})`,
  lg: `@media (min-width: ${breakpoints.lg})`,
  xl: `@media (min-width: ${breakpoints.xl})`,
  '2xl': `@media (min-width: ${breakpoints['2xl']})`,
  mobile: `@media (max-width: ${breakpoints.md})`,
  tablet: `@media (min-width: ${breakpoints.md}) and (max-width: ${breakpoints.lg})`,
} as const;

// ============ Type exports ============
export type Colors = typeof colors;
export type Spacing = typeof spacing;
export type Radius = typeof radius;
export type Shadows = typeof shadows;
export type Typography = typeof typography;
export type Breakpoints = typeof breakpoints;
export type Media = typeof media;
