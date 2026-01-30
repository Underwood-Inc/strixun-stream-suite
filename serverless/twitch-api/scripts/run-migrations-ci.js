#!/usr/bin/env node
/**
 * CI Migration Runner for twitch-api
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { runMigrations } from '../../../scripts/ci-migration-runner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

runMigrations({
    servicePrefix: 'twitch',
    kvBinding: 'TWITCH_CACHE',
    wranglerPath: path.join(__dirname, '..', 'wrangler.toml'),
    migrations: []
}).catch(err => {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
});
