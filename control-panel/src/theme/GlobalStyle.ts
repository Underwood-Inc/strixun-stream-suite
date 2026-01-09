import { createGlobalStyle } from 'styled-components';
import { colors, radii } from './tokens';

/**
 * Global styles for the application.
 * Sets up CSS reset, base typography, and CSS variables.
 */
export const GlobalStyle = createGlobalStyle`
  /* CSS Variables for runtime theming */
  :root {
    --color-bg: ${colors.bg};
    --color-bg-dark: ${colors.bgDark};
    --color-card: ${colors.card};
    --color-border: ${colors.border};
    --color-border-light: ${colors.borderLight};
    --color-accent: ${colors.accent};
    --color-accent-light: ${colors.accentLight};
    --color-accent-dark: ${colors.accentDark};
    --color-success: ${colors.success};
    --color-warning: ${colors.warning};
    --color-danger: ${colors.danger};
    --color-text: ${colors.text};
    --color-text-secondary: ${colors.textSecondary};
    --color-muted: ${colors.muted};
  }

  /* Reset */
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  /* Base */
  html {
    font-size: 14px;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
    background-color: ${colors.bg};
    color: ${colors.text};
    line-height: 1.5;
    min-height: 100vh;
  }

  #root {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  /* Scrollbar styling */
  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  ::-webkit-scrollbar-track {
    background: transparent;
  }

  ::-webkit-scrollbar-thumb {
    background: ${colors.border};
    border-radius: ${radii.sm};
  }

  ::-webkit-scrollbar-thumb:hover {
    background: ${colors.muted};
  }

  ::-webkit-scrollbar-corner {
    background: transparent;
  }

  /* Firefox scrollbar */
  * {
    scrollbar-width: thin;
    scrollbar-color: ${colors.border} transparent;
  }

  /* Focus styles */
  :focus-visible {
    outline: 2px solid ${colors.accent};
    outline-offset: 2px;
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
`;

