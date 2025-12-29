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
  { name: 'twitch-api', path: 'twitch-api' },
  { name: 'customer-api', path: 'customer-api' },
  { name: 'game-api', path: 'game-api' },
  { name: 'chat-signaling', path: 'chat-signaling' },
  { name: 'url-shortener', path: 'url-shortener' },
];

const dryRun = process.argv.includes('--dry-run');

console.log('[INFO] Deploying all workers to development environment...\n');

if (dryRun) {
  console.log('[DRY RUN] Would deploy the following workers:');
  workers.forEach((w) => console.log(`  - ${w.name}`));
  process.exit(0);
}

let successCount = 0;
let failCount = 0;
const failures = [];

for (const worker of workers) {
  try {
    console.log(`[INFO] Deploying ${worker.name}...`);
    const cwd = join(process.cwd(), 'serverless', worker.path);
    
    // Check if wrangler.toml exists
    try {
      const wranglerToml = readFileSync(join(cwd, 'wrangler.toml'), 'utf-8');
      if (!wranglerToml.includes('[env.development]')) {
        console.log(`[WARNING] ${worker.name} does not have development environment configured. Skipping.`);
        continue;
      }
    } catch (error) {
      console.log(`[WARNING] Could not read wrangler.toml for ${worker.name}. Skipping.`);
      continue;
    }
    
    // Deploy to development environment
    execSync('wrangler deploy --env development', {
      cwd,
      stdio: 'inherit',
    });
    
    console.log(`[SUCCESS] ${worker.name} deployed successfully\n`);
    successCount++;
  } catch (error) {
    console.error(`[ERROR] Failed to deploy ${worker.name}:`, error.message);
    failures.push(worker.name);
    failCount++;
  }
}

console.log('\n[INFO] Deployment Summary:');
console.log(`  Success: ${successCount}`);
console.log(`  Failed: ${failCount}`);

if (failures.length > 0) {
  console.log(`\n[ERROR] Failed workers: ${failures.join(', ')}`);
  process.exit(1);
}

console.log('\n[SUCCESS] All workers deployed to development environment!');
console.log('[INFO] You can now run E2E tests: pnpm test:e2e');

