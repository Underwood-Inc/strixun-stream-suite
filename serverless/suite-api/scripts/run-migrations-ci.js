#!/usr/bin/env node
/**
 * CI Migration Runner for suite-api
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { runMigrations } from '../../../scripts/ci-migration-runner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

runMigrations({
    servicePrefix: 'suite',
    kvBinding: 'SUITE_CACHE',
    wranglerPath: path.join(__dirname, '..', 'wrangler.toml'),
    migrations: []
}).catch(err => {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
});
