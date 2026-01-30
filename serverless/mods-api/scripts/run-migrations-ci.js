#!/usr/bin/env node
/**
 * CI Migration Runner for mods-api
 * Imports migrations from separate files
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { runMigrations } from '../../../scripts/ci-migration-runner.js';

import { migration as migration001 } from '../migrations/001_attach_variants_to_first_version.ci.js';
import { migration as migration002 } from '../migrations/002_migrate_to_unified_keys.ci.js';
import { migration as migration003 } from '../migrations/003_fix_missing_indexes.ci.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

runMigrations({
    servicePrefix: 'mods',
    kvBinding: 'MODS_KV',
    wranglerPath: path.join(__dirname, '..', 'wrangler.toml'),
    migrations: [
        migration001,
        migration002,
        migration003,
    ]
}).catch(err => {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
});
