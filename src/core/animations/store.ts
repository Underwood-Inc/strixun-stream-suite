/**
 * Animation System - Store
 * 
 * User preferences and settings for animations
 */

import { writable, derived, get } from 'svelte/store';
import { storage } from '../../modules/storage';
import type { AnimationPreferences, AnimationConfig } from './types';

const STORAGE_KEY = 'ui_animation_preferences';

/**
 * Default animation preferences
 */
const DEFAULT_PREFERENCES: AnimationPreferences = {
  enabled: true,
  speed: 1.0,
  reduceMotion: false,
  overrides: {},
  disabled: [],
};

/**
 * Load preferences from storage
 */
function loadPreferences(): AnimationPreferences {
  const stored = storage.get(STORAGE_KEY) as Partial<AnimationPreferences> | null;
  if (!stored) {
    return { ...DEFAULT_PREFERENCES };
  }
  
  // Check for prefers-reduced-motion
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  
  return {
    ...DEFAULT_PREFERENCES,
    ...stored,
    reduceMotion: stored.reduceMotion ?? prefersReducedMotion,
  };
}

/**
 * Save preferences to storage
 */
function savePreferences(prefs: AnimationPreferences): void {
  storage.set(STORAGE_KEY, prefs);
}

/**
 * Animation preferences store
 */
export const animationPreferences = writable<AnimationPreferences>(loadPreferences());

/**
 * Check if animations are globally enabled
 */
export const animationsEnabled = derived(
  animationPreferences,
  ($prefs) => $prefs.enabled && !$prefs.reduceMotion
);

/**
 * Get animation speed multiplier
 */
export const animationSpeed = derived(
  animationPreferences,
  ($prefs) => $prefs.speed
);

/**
 * Update animation preferences
 */
export function updateAnimationPreferences(
  updates: Partial<AnimationPreferences>
): void {
  animationPreferences.update((current) => {
    const updated = { ...current, ...updates };
    savePreferences(updated);
    return updated;
  });
}

/**
 * Override animation config for a specific animation ID
 */
export function overrideAnimation(id: string, config: Partial<AnimationConfig>): void {
  animationPreferences.update((current) => {
    const updated = {
      ...current,
      overrides: {
        ...current.overrides,
        [id]: config,
      },
    };
    savePreferences(updated);
    return updated;
  });
}

/**
 * Disable a specific animation by ID
 */
export function disableAnimation(id: string): void {
  animationPreferences.update((current) => {
    if (current.disabled.includes(id)) {
      return current;
    }
    const updated = {
      ...current,
      disabled: [...current.disabled, id],
    };
    savePreferences(updated);
    return updated;
  });
}

/**
 * Enable a specific animation by ID
 */
export function enableAnimation(id: string): void {
  animationPreferences.update((current) => {
    const updated = {
      ...current,
      disabled: current.disabled.filter((disabledId) => disabledId !== id),
    };
    savePreferences(updated);
    return updated;
  });
}

/**
 * Get effective animation config (with user overrides applied)
 */
export function getEffectiveConfig(
  id: string | undefined,
  config: AnimationConfig
): AnimationConfig {
  if (!id) {
    return config;
  }
  
  const prefs = get(animationPreferences);
  
  // Check if globally disabled or this specific animation is disabled
  if (!prefs.enabled || prefs.disabled.includes(id)) {
    return { ...config, enabled: false };
  }
  
  // Apply user overrides
  const override = prefs.overrides[id];
  if (override) {
    return {
      ...config,
      ...override,
      duration: override.duration ?? config.duration,
      easing: override.easing ?? config.easing,
    };
  }
  
  // Apply speed multiplier
  if (prefs.speed !== 1.0 && config.duration) {
    return {
      ...config,
      duration: config.duration / prefs.speed,
    };
  }
  
  return config;
}

/**
 * Initialize animation preferences (check for system preferences)
 */
export function initAnimationPreferences(): void {
  // Check for prefers-reduced-motion on load
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  
  if (prefersReducedMotion) {
    const prefs = get(animationPreferences);
    if (!prefs.reduceMotion) {
      updateAnimationPreferences({ reduceMotion: true });
    }
  }
  
  // Listen for changes
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  mediaQuery.addEventListener('change', (e) => {
    updateAnimationPreferences({ reduceMotion: e.matches });
  });
}

