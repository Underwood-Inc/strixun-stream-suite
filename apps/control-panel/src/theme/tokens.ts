/**
 * Design Tokens for Strixun Stream Suite
 * 
 * These tokens define the visual language of the application.
 * Based on the existing gold/dark theme from idling.app palette.
 */

export const colors = {
  // Backgrounds
  bg: '#1a1611',
  bgDark: '#0f0e0b',
  card: '#252017',
  
  // Borders
  border: '#3d3627',
  borderLight: '#4a4336',
  
  // Brand / Accent (Gold)
  accent: '#edae49',
  accentLight: '#f9df74',
  accentDark: '#c68214',
  
  // Secondary accent (Blue - for info states)
  accent2: '#6495ed',
  
  // Semantic
  success: '#28a745',
  warning: '#ffc107',
  danger: '#ea2b1f',
  info: '#6495ed',
  
  // Text
  text: '#f9f9f9',
  textSecondary: '#b8b8b8',
  muted: '#888888',
  
  // Glass effects
  glassBg: 'rgba(37, 32, 23, 0.95)',
  glassBgDark: 'rgba(26, 22, 17, 0.98)',
  glassBorder: 'rgba(61, 54, 39, 0.8)',
} as const;

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  xxl: '32px',
} as const;

export const radii = {
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  full: '9999px',
} as const;

export const shadows = {
  sm: '0 1px 3px rgba(0, 0, 0, 0.3)',
  md: '0 4px 12px rgba(0, 0, 0, 0.4)',
  lg: '0 8px 24px rgba(0, 0, 0, 0.5)',
  glow: '0 0 12px rgba(237, 174, 73, 0.4)',
} as const;

export const fontSizes = {
  xs: '0.75rem',
  sm: '0.85rem',
  md: '0.95rem',
  lg: '1.1rem',
  xl: '1.4rem',
  xxl: '1.8rem',
} as const;

export const fontWeights = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

export const transitions = {
  fast: '0.1s ease',
  normal: '0.2s ease',
  slow: '0.3s ease',
} as const;

export const zIndex = {
  base: 0,
  dropdown: 100,
  sticky: 200,
  modal: 300,
  tooltip: 400,
} as const;

// Combined theme object
export const theme = {
  colors,
  spacing,
  radii,
  shadows,
  fontSizes,
  fontWeights,
  transitions,
  zIndex,
} as const;

export type Theme = typeof theme;
export type Colors = typeof colors;

