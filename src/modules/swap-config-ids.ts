/**
 * Stable IDs for swap configs — required by Streamkit API cloud sync.
 */

import type { SwapConfig } from '../types';

export function generateSwapConfigId(): string {
  return `swap_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Assign ids to legacy swap configs missing them. */
export function ensureSwapConfigIds(
  configs: SwapConfig[]
): { configs: SwapConfig[]; migrated: boolean } {
  let migrated = false;
  const withIds = configs.map((config) => {
    if (config.id) return config;
    migrated = true;
    return { ...config, id: generateSwapConfigId() };
  });
  return { configs: withIds, migrated };
}