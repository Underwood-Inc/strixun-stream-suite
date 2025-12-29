/**
 * Theme Settings Visibility Store
 * 
 * Manages the visibility state of the theme settings overlay.
 */

import { writable, type Writable } from 'svelte/store';

export const themeSettingsVisible: Writable<boolean> = writable(false);

