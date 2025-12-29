/**
 * Theme Store
 * 
 * Manages UI theme settings including fonts, colors, and other customization options.
 * Persists settings to storage and applies them via CSS variables.
 */

import { writable, derived, type Writable, type Readable } from 'svelte/store';
import { storage } from '../modules/storage';

export interface ThemeSettings {
  fontFamily: string;
  // Future: colors, spacing, etc.
}

const DEFAULT_THEME: ThemeSettings = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const STORAGE_KEY = 'ui_theme_settings';

// Load theme from storage
function loadTheme(): ThemeSettings {
  try {
    const stored = storage.get(STORAGE_KEY);
    if (stored && typeof stored === 'object') {
      return {
        ...DEFAULT_THEME,
        ...(stored as Partial<ThemeSettings>),
      };
    }
  } catch (error) {
    console.warn('[Theme] Failed to load theme from storage:', error);
  }
  return { ...DEFAULT_THEME };
}

// Save theme to storage
function saveTheme(theme: ThemeSettings): void {
  try {
    storage.set(STORAGE_KEY, theme);
  } catch (error) {
    console.error('[Theme] Failed to save theme to storage:', error);
  }
}

// Apply theme to document
function applyTheme(theme: ThemeSettings): void {
  if (typeof document === 'undefined') return;
  
  const root = document.documentElement;
  root.style.setProperty('--font-family', theme.fontFamily);
}

// Create writable store
const themeStore: Writable<ThemeSettings> = writable(loadTheme());

// Subscribe to changes and apply them
themeStore.subscribe((theme) => {
  applyTheme(theme);
  saveTheme(theme);
});

// Initialize theme on load
if (typeof document !== 'undefined') {
  const initialTheme = loadTheme();
  applyTheme(initialTheme);
  themeStore.set(initialTheme);
}

// Export store
export const theme: Readable<ThemeSettings> = themeStore;

// Actions
export function setFontFamily(fontFamily: string): void {
  themeStore.update((current) => ({
    ...current,
    fontFamily,
  }));
}

export function resetTheme(): void {
  themeStore.set({ ...DEFAULT_THEME });
}

// Available fonts
export const AVAILABLE_FONTS = [
  {
    name: 'System Default',
    value: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  {
    name: 'Minecraft',
    value: '"Minecraft", sans-serif',
  },
  {
    name: 'Inter',
    value: '"Inter", sans-serif',
  },
  {
    name: 'Roboto',
    value: '"Roboto", sans-serif',
  },
  {
    name: 'Open Sans',
    value: '"Open Sans", sans-serif',
  },
] as const;

