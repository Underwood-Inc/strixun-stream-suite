/**
 * Build script that ensures VITE_SERVICE_ENCRYPTION_KEY is available
 * 
 * Supports multiple sources (in priority order):
 * 1. Environment variable (works with GitHub Actions secrets, CI/CD, etc.)
 * 2. Dashboard .env file (for local development)
 * 3. Cloudflare Worker secrets (via wrangler - fallback for local builds)
 * 
 * GitHub Actions: Set VITE_SERVICE_ENCRYPTION_KEY in repository secrets,
 *                 then pass it as an env var in the workflow step
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = path.join(__dirname, '..');
const dashboardDir = path.join(rootDir, 'dashboard');

/**
 * Get VITE_SERVICE_ENCRYPTION_KEY from various sources
 */
function getEncryptionKey() {
  // Priority 1: Environment variable (works with GitHub Actions secrets, CI/CD, etc.)
  // GitHub Actions passes secrets as environment variables via the 'env:' section
  if (process.env.VITE_SERVICE_ENCRYPTION_KEY) {
    const key = process.env.VITE_SERVICE_ENCRYPTION_KEY.trim();
    if (key.length >= 32) {
      // Check if we're in CI/CD (GitHub Actions, etc.)
      const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
      const source = isCI ? 'CI/CD environment (GitHub Actions secret)' : 'environment variable';
      console.log(`✅ Found VITE_SERVICE_ENCRYPTION_KEY in ${source}`);
      return key;
    } else {
      console.warn(`⚠️  VITE_SERVICE_ENCRYPTION_KEY found but too short (${key.length} chars, need 32+)`);
    }
  }

  // Priority 2: Dashboard .env file
  const envPath = path.join(dashboardDir, '.env');
  if (fs.existsSync(envPath)) {
    try {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const match = envContent.match(/VITE_SERVICE_ENCRYPTION_KEY\s*=\s*(.+)/);
      if (match && match[1]) {
        const key = match[1].trim().replace(/^["']|["']$/g, ''); // Remove quotes
        if (key.length >= 32) {
          console.log('✅ Found VITE_SERVICE_ENCRYPTION_KEY in dashboard/.env');
          return key;
        }
      }
    } catch (error) {
      console.warn('⚠️  Failed to read dashboard/.env:', error.message);
    }
  }

  // Priority 3: Cloudflare Worker secrets (via wrangler)
  try {
    console.log('🔍 Attempting to get VITE_SERVICE_ENCRYPTION_KEY from Cloudflare Worker secrets...');
    const result = execSync('wrangler secret get VITE_SERVICE_ENCRYPTION_KEY 2>&1', {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: 'pipe'
    });
    const key = result.trim();
    if (key && key.length >= 32 && !key.includes('error') && !key.includes('not found') && !key.includes('No secret')) {
      console.log('✅ Found VITE_SERVICE_ENCRYPTION_KEY in Cloudflare Worker secrets');
      return key;
    }
  } catch (error) {
    // wrangler secret get might fail if not authenticated or secret doesn't exist
    console.warn('⚠️  Could not get VITE_SERVICE_ENCRYPTION_KEY from Cloudflare Worker secrets');
  }

  // Key not found
  const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
  console.error('❌ VITE_SERVICE_ENCRYPTION_KEY not found!');
  console.error('');
  if (isCI) {
    console.error('   For CI/CD (GitHub Actions):');
    console.error('   1. Go to Settings ❓ Secrets and variables ❓ Actions');
    console.error('   2. Add repository secret: VITE_SERVICE_ENCRYPTION_KEY');
    console.error('   3. Update the workflow to pass it as an env var:');
    console.error('      env:');
    console.error('        VITE_SERVICE_ENCRYPTION_KEY: ${{ secrets.VITE_SERVICE_ENCRYPTION_KEY }}');
    console.error('');
  }
  console.error('   For local development:');
  console.error('   1. Environment variable:');
  console.error('      export VITE_SERVICE_ENCRYPTION_KEY=your-key-here');
  console.error('   2. Dashboard .env file:');
  console.error('      echo "VITE_SERVICE_ENCRYPTION_KEY=your-key-here" > dashboard/.env');
  console.error('   3. Cloudflare Worker secret (fallback):');
  console.error('      wrangler secret put VITE_SERVICE_ENCRYPTION_KEY');
  console.error('');
  console.error('   The key must be at least 32 characters long.');
  console.error('   It must match the VITE_SERVICE_ENCRYPTION_KEY set in Cloudflare Worker secrets.');
  process.exit(1);
}

// Get the encryption key
const encryptionKey = getEncryptionKey();

// Build the dashboard with the key
console.log('❓ Building dashboard with encryption key...');
try {
  execSync('pnpm build', {
    cwd: dashboardDir,
    env: {
      ...process.env,
      VITE_SERVICE_ENCRYPTION_KEY: encryptionKey
    },
    stdio: 'inherit'
  });
  console.log('✅ Dashboard build complete');
} catch (error) {
  console.error('❌ Dashboard build failed');
  process.exit(1);
}

// Process built files
console.log('📦 Processing built files for embedding...');
try {
  execSync('node scripts/build-dashboard.js', {
    cwd: rootDir,
    stdio: 'inherit'
  });
  console.log('✅ Build complete!');
} catch (error) {
  console.error('❌ Failed to process dashboard files');
  process.exit(1);
}

