#!/usr/bin/env node
/**
 * CI Migration Runner for customer-api
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { runMigrations } from '../../../scripts/ci-migration-runner.js';
import { migration as migration002 } from '../migrations/002_fix_broken_keys.ci.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

runMigrations({
    servicePrefix: 'customer',
    kvBinding: 'CUSTOMER_KV',
    wranglerPath: path.join(__dirname, '..', 'wrangler.toml'),
    migrations: [
        migration002,
    ]
}).catch(err => {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
});
