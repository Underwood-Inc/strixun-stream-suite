import { createGlobalStyle } from 'styled-components';
import { colors, typography } from './tokens';
import { getSeasonalKeyframesCSS } from '../utils/seasonalAnimations';

export const GlobalStyle = createGlobalStyle`
  /* Seasonal animation keyframes */
  ${getSeasonalKeyframesCSS()}
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  html {
    font-size: 16px;
    /* CSS variables for shared components (OTP login, etc.) */
    --card: ${colors.card};
    --card-hover: ${colors.cardHover};
    --bg: ${colors.bg};
    --bg-secondary: ${colors.bgSecondary};
    --bg-tertiary: ${colors.bgTertiary};
    --text: ${colors.text};
    --text-secondary: ${colors.textSecondary};
    --text-muted: ${colors.textMuted};
    --accent: ${colors.accent};
    --accent-hover: ${colors.accentHover};
    --accent-active: ${colors.accentActive};
    --success: ${colors.success};
    --warning: ${colors.warning};
    --danger: ${colors.danger};
    --info: ${colors.info};
    --border: ${colors.border};
    --border-light: ${colors.borderLight};
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
      color: ${colors.accentHover};
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

