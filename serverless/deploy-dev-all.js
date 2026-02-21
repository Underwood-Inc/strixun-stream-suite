/**
 * Deploy All Workers to Development Environment
 * 
 * Deploys all Cloudflare Workers to the development environment for E2E testing.
 * This ensures tests run against live services without affecting production data.
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

const workers = [
  { name: 'otp-auth-service', path: 'otp-auth-service' },
  { name: 'mods-api', path: 'mods-api' },
  { name: 'suite-api', path: 'suite-api' },
  { name: 'customer-api', path: 'customer-api' },
  { name: 'game-api', path: 'game-api' },
  { name: 'chat-signaling', path: 'chat-signaling' },
  { name: 'url-shortener', path: 'url-shortener' },
  { name: 'access-service', path: 'access-service' },
];

const dryRun = process.argv.includes('--dry-run');

console.log('ℹ Deploying all workers to development environment...\n');

if (dryRun) {
  console.log('[DRY RUN] Would deploy the following workers:');
  workers.forEach((w) => console.log(`  - ${w.name}`));
  process.exit(0);
}

// Prebuild step: Build otp-login package (required for mods-hub and other frontends)
console.log('ℹ Building @strixun/otp-login package (required dependency)...');
try {
  execSync('pnpm --filter @strixun/otp-login build:react', {
    stdio: 'inherit',
    cwd: process.cwd(),
  });
  console.log('✓ @strixun/otp-login built successfully\n');
} catch (error) {
  console.error('✗ Failed to build @strixun/otp-login:', error.message);
  console.error('⚠  Continuing with deployment, but frontend apps may fail if they depend on otp-login\n');
}

let successCount = 0;
let failCount = 0;
const failures = [];

for (const worker of workers) {
  try {
    console.log(`ℹ Deploying ${worker.name}...`);
    const cwd = join(process.cwd(), 'serverless', worker.path);
    
    // Check if wrangler.toml exists
    try {
      const wranglerToml = readFileSync(join(cwd, 'wrangler.toml'), 'utf-8');
      if (!wranglerToml.includes('[env.development]')) {
        console.log(`⚠ ${worker.name} does not have development environment configured. Skipping.`);
        continue;
      }
    } catch (error) {
      console.log(`⚠ Could not read wrangler.toml for ${worker.name}. Skipping.`);
      continue;
    }
    
    // Deploy to development environment
    execSync('wrangler deploy --env development', {
      cwd,
      stdio: 'inherit',
    });
    
    console.log(`✓ ${worker.name} deployed successfully\n`);
    successCount++;
  } catch (error) {
    console.error(`✗ Failed to deploy ${worker.name}:`, error.message);
    failures.push(worker.name);
    failCount++;
  }
}

console.log('\nℹ Deployment Summary:');
console.log(`  Success: ${successCount}`);
console.log(`  Failed: ${failCount}`);

if (failures.length > 0) {
  console.log(`\n✗ Failed workers: ${failures.join(', ')}`);
  process.exit(1);
}

console.log('\n✓ All workers deployed to development environment!');
console.log('ℹ You can now run E2E tests: pnpm test:e2e');

