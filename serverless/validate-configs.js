#!/usr/bin/env node
/**
 * Validate all worker configurations using wrangler
 * Uses wrangler's built-in validation via dry-run
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const workers = [
  'otp-auth-service',
  'mods-api',
  'customer-api',
  'game-api',
  'suite-api',
  'url-shortener',
  'chat-signaling',
];

console.log('ℹ all worker configurations with wrangler...\n');

let successCount = 0;
let failCount = 0;
const failures = [];

for (const worker of workers) {
  const workerPath = join(rootDir, 'serverless', worker);
  const wranglerPath = join(workerPath, 'wrangler.toml');
  
  if (!existsSync(wranglerPath)) {
    console.log(`✗ ${worker}: Missing wrangler.toml`);
    failCount++;
    failures.push(`${worker}: Missing wrangler.toml`);
    continue;
  }
  
  console.log(`ℹ ${worker}...`);
  
  try {
    // Use wrangler's dry-run to validate the config
    execSync('pnpm exec wrangler deploy --dry-run', {
      cwd: workerPath,
      stdio: 'pipe',
      encoding: 'utf-8',
    });
    console.log(`   ✓ ${worker}: Configuration valid\n`);
    successCount++;
  } catch (error) {
    const errorOutput = error.stdout || error.stderr || error.message;
    console.log(`   ✗ ${worker}: Validation failed`);
    // Extract meaningful error messages
    if (errorOutput.includes('Error')) {
      const errorLines = errorOutput.split('\n').filter(line => 
        line.includes('Error') || line.includes('error') || line.includes('Invalid')
      ).slice(0, 3);
      errorLines.forEach(line => console.log(`      ${line.trim()}`));
    }
    console.log('');
    failCount++;
    failures.push(`${worker}: ${error.message}`);
  }
}

console.log(' ★ Validation Summary:');
console.log(`   ✓ Passed: ${successCount}`);
console.log(`   ✗ Failed: ${failCount}`);

if (failCount === 0) {
  console.log('\n✓ All worker configurations are valid!');
  process.exit(0);
} else {
  console.log('\n✗ Some configurations have issues:');
  failures.forEach(failure => console.log(`   • ${failure}`));
  process.exit(1);
}

