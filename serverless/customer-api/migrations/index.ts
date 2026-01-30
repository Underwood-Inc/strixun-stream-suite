/**
 * Customer API Migrations
 * 
 * Import and export all migrations in order.
 * Add new migrations to this list as they're created.
 */

import type { Migration } from '../../shared/migration-runner.js';
import { migration as migration001 } from './001_migrate_to_unified_keys.js';

/**
 * All migrations in order
 */
export const migrations: Migration[] = [
    migration001,
    // Add new migrations here
];
