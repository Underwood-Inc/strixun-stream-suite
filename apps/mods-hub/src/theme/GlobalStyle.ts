/**
 * Global styles for Mods Hub
 * Extends shared @strixun/shared-styles with app-specific additions
 */

import { createGlobalStyle } from 'styled-components';
import { colors, spacing, radius, shadows, typography } from '@strixun/shared-styles';
import { getSeasonalKeyframesCSS } from '../utils/seasonalAnimations';

// Mods Hub global style - includes all shared CSS variables plus app-specific extensions
export const GlobalStyle = createGlobalStyle`
  /* Seasonal animation keyframes */
  ${getSeasonalKeyframesCSS()}

  *, *::before, *::after {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  html {
    font-size: 16px;
    
    /* CSS Variables - from shared @strixun/shared-styles */
    /* Backgrounds */
    --bg: ${colors.bg};
    --bg-dark: ${colors.bgDark};
    --bg-secondary: ${colors.bgSecondary};
    --bg-tertiary: ${colors.bgTertiary};
    --card: ${colors.card};
    --card-hover: ${colors.cardHover};
    
    /* Borders */
    --border: ${colors.border};
    --border-light: ${colors.borderLight};
    
    /* Brand Colors */
    --accent: ${colors.accent};
    --accent-light: ${colors.accentLight};
    --accent-dark: ${colors.accentDark};
    --accent-hover: ${colors.accentHover};
    --accent-active: ${colors.accentActive};
    --accent2: ${colors.accent2};
    
    /* Status Colors */
    --success: ${colors.success};
    --warning: ${colors.warning};
    --danger: ${colors.danger};
    --info: ${colors.info};
    
    /* Text Colors */
    --text: ${colors.text};
    --text-secondary: ${colors.textSecondary};
    --text-muted: ${colors.textMuted};
    --muted: ${colors.muted};
    
    /* Glass Effects */
    --glass-bg: ${colors.glassBg};
    --glass-bg-dark: ${colors.glassBgDark};
    --glass-border: ${colors.glassBorder};
    
    /* Spacing */
    --spacing-xs: ${spacing.xs};
    --spacing-sm: ${spacing.sm};
    --spacing-md: ${spacing.md};
    --spacing-lg: ${spacing.lg};
    --spacing-xl: ${spacing.xl};
    --spacing-2xl: ${spacing['2xl']};
    --spacing-3xl: ${spacing['3xl']};
    
    /* Border Radius */
    --radius-sm: ${radius.sm};
    --radius-md: ${radius.md};
    --radius-lg: ${radius.lg};
    --border-radius: ${radius.md};
    --border-radius-sm: ${radius.sm};
    
    /* Shadows */
    --shadow-sm: ${shadows.sm};
    --shadow-md: ${shadows.md};
    --shadow-lg: ${shadows.lg};
    
    /* Typography */
    --font-family: ${typography.fontFamily};
    --font-sans: ${typography.fontFamily};
    --font-display: Georgia, serif;
  }

  body {
    font-family: ${typography.fontFamily};
    font-size: ${typography.fontSize.base};
    color: ${colors.text};
    background: ${colors.bg};
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    line-height: 1.5;
  }

  #root {
    min-height: 100vh;
  }

  a {
    color: ${colors.accent};
    text-decoration: none;
    transition: color 0.2s ease;

    &:hover {
      color: ${colors.accentLight};
    }
  }

  button {
    font-family: inherit;
    cursor: pointer;
    border: none;
    outline: none;
  }

  input, textarea, select {
    font-family: inherit;
    outline: none;
  }

  /* Scrollbar styling */
  ::-webkit-scrollbar {
    width: 12px;
    height: 12px;
  }

  ::-webkit-scrollbar-track {
    background: ${colors.bgSecondary};
  }

  ::-webkit-scrollbar-thumb {
    background: ${colors.border};
    border-radius: 6px;

    &:hover {
      background: ${colors.borderLight};
    }
  }

  /* Text Selection - Strixun brand orange with pure black text for legibility */
  ::selection {
    background: ${colors.accent};
    color: #000000;
  }

  ::-moz-selection {
    background: ${colors.accent};
    color: #000000;
  }

  ::-webkit-selection {
    background: ${colors.accent};
    color: #000000;
  }

  /* Global click ripple effect - subtle ring ripple */
  .click-ripple {
    position: fixed;
    width: 4px;
    height: 4px;
    border: 1px solid rgba(255, 255, 255, 0.5);
    border-radius: 50%;
    background: transparent;
    pointer-events: none;
    transform: translate(-50%, -50%) scale(0);
    animation: ripple-expand 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 9999;
  }

  @keyframes ripple-expand {
    0% {
      transform: translate(-50%, -50%) scale(0);
      opacity: 1;
      border-width: 1px;
    }
    100% {
      transform: translate(-50%, -50%) scale(12);
      opacity: 0;
      border-width: 0.5px;
    }
  }
`;
