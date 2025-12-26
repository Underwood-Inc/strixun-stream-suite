#!/usr/bin/env node
/**
 * Cross-platform script to run integration tests with environment variables
 * Usage: node scripts/run-integration-tests.js [dev|prod]
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const environment = process.argv[2] || 'dev';

if (environment !== 'dev' && environment !== 'prod') {
  console.error(`Invalid environment: ${environment}. Use 'dev' or 'prod'.`);
  process.exit(1);
}

// Set environment variables
process.env.TEST_ENV = environment;
process.env.USE_LIVE_API = 'true';

console.log(`[Integration Tests] Running with ${environment} configuration...`);
console.log(`[Integration Tests] TEST_ENV=${environment}`);
console.log(`[Integration Tests] USE_LIVE_API=true`);
console.log('');

// Run vitest
try {
  execSync('vitest run customer-creation.integration.test.ts', {
    stdio: 'inherit',
    cwd: join(__dirname, '..'),
    env: process.env,
  });
} catch (error) {
  console.error('\n[Integration Tests] Tests failed!');
  process.exit(1);
}

