/**
 * Enhanced API Framework - Tag System
 * 
 * Tag-based field filtering for ad-hoc response customization
 */

import type { ResponseFilterConfig } from '../types';

/**
 * Register a tag with field paths
 */
export function registerTag(
  config: ResponseFilterConfig,
  tag: string,
  fieldPaths: string[]
): void {
  config.tags[tag] = fieldPaths;
}

/**
 * Get all fields for multiple tags
 */
export function getTagFields(
  tags: string[],
  config: ResponseFilterConfig
): string[] {
  const fields: string[] = [];

  for (const tag of tags) {
    const tagFields = config.tags[tag] || [];
    fields.push(...tagFields);
  }

  return [...new Set(fields)]; // Remove duplicates
}

/**
 * Common tag definitions
 */
export const COMMON_TAGS = {
  summary: ['id', 'name', 'title', 'status'],
  detailed: ['*'], // All fields
  minimal: ['id'],
  public: ['id', 'name', 'title'], // Public-facing fields
  admin: ['*'], // All fields including sensitive
};

/**
 * Initialize common tags in config
 */
export function initializeCommonTags(config: ResponseFilterConfig): void {
  for (const [tag, fields] of Object.entries(COMMON_TAGS)) {
    registerTag(config, tag, fields);
  }
}

