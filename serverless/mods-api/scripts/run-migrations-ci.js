#!/usr/bin/env node
/**
 * CI Migration Runner for mods-api
 * Imports migrations from separate files
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { runMigrations } from '../../../scripts/ci-migration-runner.js';

import { migration as migration005 } from '../migrations/005_fix_version_index_keys.ci.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

runMigrations({
    servicePrefix: 'mods',
    kvBinding: 'MODS_KV',
    wranglerPath: path.join(__dirname, '..', 'wrangler.toml'),
    migrations: [
        migration005,
    ]
}).catch(err => {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
});
