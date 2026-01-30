/**
 * Mods API Migrations
 * 
 * Import and export all migrations in order.
 * Add new migrations to this list as they're created.
 */

import type { Migration } from '../../shared/migration-runner.js';
import { migration as migration001 } from './attach-variants-to-first-version.js';
import { migration as migration002 } from './002_migrate_to_unified_keys.js';

/**
 * All migrations in order
 */
export const migrations: Migration[] = [
    migration001,
    migration002,
    // Add new migrations here
];
