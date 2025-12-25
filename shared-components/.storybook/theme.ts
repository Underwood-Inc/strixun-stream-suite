/**
 * Storybook Theme Configuration
 * 
 * Custom theme matching the Strixun Stream Suite brand color palette.
 * Uses the official Storybook theming API for proper UI styling.
 */

import { create } from '@storybook/theming';

/**
 * Strixun Stream Suite Brand Colors
 * 
 * Color palette matching the design system:
 * - Background: Dark brown/black (#1a1611, #0f0e0b, #252017)
 * - Accent: Golden yellow (#edae49, #f9df74, #c68214)
 * - Secondary: Cornflower blue (#6495ed)
 * - Text: Light gray/white (#f9f9f9, #b8b8b8)
 */
export const strixunTheme = create({
  base: 'dark',
  
  // Brand colors
  colorPrimary: '#edae49', // --accent (golden yellow)
  colorSecondary: '#6495ed', // --accent2 (cornflower blue)
  
  // UI colors
  appBg: '#1a1611', // --bg (main background)
  appContentBg: '#1a1611', // --bg
  appPreviewBg: '#1a1611', // --bg
  appBorderColor: '#3d3627', // --border
  appBorderRadius: 8,
  
  // Text colors
  textColor: '#f9f9f9', // --text
  textInverseColor: '#1a1611', // --bg
  textMutedColor: '#b8b8b8', // --text-secondary
  
  // Toolbar colors
  barTextColor: '#b8b8b8', // --text-secondary
  barSelectedColor: '#edae49', // --accent
  barBg: '#0f0e0b', // --bg-dark
  
  // Form colors
  inputBg: '#0f0e0b', // --bg-dark
  inputBorder: '#3d3627', // --border
  inputTextColor: '#f9f9f9', // --text
  inputBorderRadius: 4,
  
  // Branding
  brandTitle: 'Strixun Stream Suite',
  brandUrl: 'https://design.idling.app',
  brandImage: undefined, // Can add logo later if needed
  brandTarget: '_self',
  
  // Typography
  fontBase: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontCode: '"Fira Code", "Consolas", "Monaco", monospace',
});

