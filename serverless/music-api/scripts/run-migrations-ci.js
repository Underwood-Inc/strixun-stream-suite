#!/usr/bin/env node
/**
 * CI Migration Runner for music-api
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { runMigrations } from '../../../scripts/ci-migration-runner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

runMigrations({
    servicePrefix: 'music',
    kvBinding: 'MUSIC_KV',
    wranglerPath: path.join(__dirname, '..', 'wrangler.toml'),
    migrations: []
}).catch(err => {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
});
