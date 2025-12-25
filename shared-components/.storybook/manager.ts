/**
 * Storybook Manager Configuration
 * 
 * Applies the custom Strixun Stream Suite theme to the Storybook UI.
 * This file configures the manager (sidebar, toolbar, panels) appearance.
 */

import { addons } from '@storybook/manager-api';
import { strixunTheme } from './theme.js';

addons.setConfig({
  theme: strixunTheme,
});

