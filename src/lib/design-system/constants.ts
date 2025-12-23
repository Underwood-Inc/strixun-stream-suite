/**
 * Design System Constants
 * 
 * Centralized design tokens and constants for the Strixun Stream Suite.
 * These values should match the SCSS variables in @styles/_variables.scss
 * 
 * @module DesignSystem
 */

/**
 * Color Palette
 * 
 * The color system uses a warm, retro arcade aesthetic with:
 * - Dark brown/black backgrounds for contrast
 * - Golden yellow accent for primary actions
 * - Blue for secondary accents and info states
 * - Standard semantic colors for status indicators
 */
export const COLORS = {
  // Background Colors
  bg: '#1a1611',
  bgDark: '#0f0e0b',
  card: '#252017',
  border: '#3d3627',
  borderLight: '#4a4336',
  
  // Brand Colors
  accent: '#edae49',
  accentLight: '#f9df74',
  accentDark: '#c68214',
  accent2: '#6495ed',
  
  // Status Colors
  success: '#28a745',
  warning: '#ffc107',
  danger: '#ea2b1f',
  info: '#6495ed',
  
  // Text Colors
  text: '#f9f9f9',
  textSecondary: '#b8b8b8',
  muted: '#888',
  
  // Glass Effects (with opacity)
  glassBg: 'rgba(37, 32, 23, 0.95)',
  glassBgDark: 'rgba(26, 22, 17, 0.98)',
  glassBorder: 'rgba(61, 54, 39, 0.8)',
} as const;

/**
 * Spacing Scale
 * 
 * Consistent spacing values used throughout the application.
 * Based on 8px grid system for visual harmony.
 */
export const SPACING = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  '2xl': '24px',
  '3xl': '32px',
  '4xl': '48px',
} as const;

/**
 * Border Radius
 * 
 * Border radius values for different UI elements.
 * Note: Arcade buttons use 0 (blocky style).
 */
export const BORDER_RADIUS = {
  none: '0',
  sm: '4px',
  md: '6px',
  lg: '8px',
  full: '50%',
} as const;

/**
 * Typography Scale
 * 
 * Font sizes for consistent typography hierarchy.
 */
export const TYPOGRAPHY = {
  xs: '0.75em',      // 12px
  sm: '0.85em',      // ~13.6px
  base: '0.9em',     // ~14.4px
  md: '1em',         // 16px
  lg: '1.25em',      // 20px
  xl: '1.5em',       // 24px
  '2xl': '1.75em',   // 28px
  '3xl': '2em',      // 32px
} as const;

/**
 * Font Weights
 */
export const FONT_WEIGHT = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

/**
 * Z-Index Scale
 * 
 * Layering system for proper stacking context.
 * Higher values = closer to user.
 */
export const Z_INDEX = {
  base: 1,
  dropdown: 1000,
  sticky: 100,
  modal: 10000,
  toast: 99999,
  alert: 100001,
  tooltip: 100002, // Highest - above everything
} as const;

/**
 * Animation Durations
 * 
 * Standard timing values for animations and transitions.
 */
export const ANIMATION = {
  fast: '0.1s',
  normal: '0.2s',
  slow: '0.3s',
  slower: '0.5s',
} as const;

/**
 * Animation Easing Functions
 * 
 * Cubic bezier curves for natural motion.
 */
export const EASING = {
  easeOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
} as const;

/**
 * Breakpoints
 * 
 * Responsive design breakpoints (mobile-first).
 */
export const BREAKPOINTS = {
  sm: '480px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
} as const;

/**
 * Shadow Values
 * 
 * Box shadow definitions for depth and elevation.
 */
export const SHADOWS = {
  sm: '0 2px 4px rgba(0, 0, 0, 0.1)',
  md: '0 2px 8px rgba(0, 0, 0, 0.2)',
  lg: '0 4px 12px rgba(0, 0, 0, 0.3)',
  glow: '0 0 8px var(--accent)',
} as const;

/**
 * CSS Custom Property Names
 * 
 * Reference to CSS variable names used in the application.
 * These should match the variables defined in _variables.scss
 */
export const CSS_VARS = {
  // Backgrounds
  bg: '--bg',
  bgDark: '--bg-dark',
  card: '--card',
  border: '--border',
  borderLight: '--border-light',
  
  // Brand Colors
  accent: '--accent',
  accentLight: '--accent-light',
  accentDark: '--accent-dark',
  accent2: '--accent2',
  
  // Status Colors
  success: '--success',
  warning: '--warning',
  danger: '--danger',
  info: '--info',
  
  // Text Colors
  text: '--text',
  textSecondary: '--text-secondary',
  muted: '--muted',
  
  // Glass Effects
  glassBg: '--glass-bg',
  glassBgDark: '--glass-bg-dark',
  glassBorder: '--glass-border',
} as const;

/**
 * Design System Theme
 * 
 * Complete theme object combining all design tokens.
 */
export const THEME = {
  colors: COLORS,
  spacing: SPACING,
  borderRadius: BORDER_RADIUS,
  typography: TYPOGRAPHY,
  fontWeight: FONT_WEIGHT,
  zIndex: Z_INDEX,
  animation: ANIMATION,
  easing: EASING,
  breakpoints: BREAKPOINTS,
  shadows: SHADOWS,
  cssVars: CSS_VARS,
} as const;

/**
 * Type exports for TypeScript usage
 */
export type ColorName = keyof typeof COLORS;
export type SpacingSize = keyof typeof SPACING;
export type BorderRadiusSize = keyof typeof BORDER_RADIUS;
export type TypographySize = keyof typeof TYPOGRAPHY;
export type FontWeightValue = typeof FONT_WEIGHT[keyof typeof FONT_WEIGHT];
export type ZIndexLevel = keyof typeof Z_INDEX;
export type AnimationDuration = keyof typeof ANIMATION;
export type EasingFunction = keyof typeof EASING;
export type BreakpointSize = keyof typeof BREAKPOINTS;
export type ShadowSize = keyof typeof SHADOWS;

