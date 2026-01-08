#!/usr/bin/env node
/**
 * Verify JWT Secrets Match Across Services
 * 
 * This script checks that all services are using the same JWT_SECRET value.
 * If they don't match, authentication will fail with "JWT signature verification failed".
 * 
 * Usage:
 *   node serverless/scripts/verify-jwt-secrets.js
 */

import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..', '..');

const SERVICES = [
  { name: 'otp-auth-service', path: 'serverless/otp-auth-service' },
  { name: 'mods-api', path: 'serverless/mods-api' },
  { name: 'customer-api', path: 'serverless/customer-api' },
];

const EXPECTED_SECRET = 'test-jwt-secret-for-local-development-12345678901234567890123456789012';

/**
 * Extract JWT_SECRET from .dev.vars file
 */
function getJWTSecret(servicePath) {
  const devVarsPath = join(ROOT_DIR, servicePath, '.dev.vars');
  
  if (!existsSync(devVarsPath)) {
    return { found: false, value: null, error: 'File does not exist' };
  }
  
  try {
    const content = readFileSync(devVarsPath, 'utf-8');
    const match = content.match(/^JWT_SECRET=(.+)$/m);
    
    if (!match) {
      return { found: false, value: null, error: 'JWT_SECRET not found in file' };
    }
    
    const secret = match[1].trim();
    return { found: true, value: secret, error: null };
  } catch (error) {
    return { found: false, value: null, error: error.message };
  }
}

/**
 * Main verification
 */
function main() {
  console.log('🔍 Verifying JWT_SECRET across services...\n');
  
  const results = [];
  let allMatch = true;
  let allExist = true;
  
  for (const service of SERVICES) {
    const result = getJWTSecret(service.path);
    results.push({ service: service.name, ...result });
    
    if (!result.found) {
      allExist = false;
      console.log(`✗ ${service.name}: ${result.error}`);
    } else {
      const matches = result.value === EXPECTED_SECRET;
      const status = matches ? '✓' : '⚠';
      console.log(`${status} ${service.name}: ${matches ? 'MATCHES' : 'MISMATCH'}`);
      
      if (!matches) {
        allMatch = false;
        console.log(`   Expected: ${EXPECTED_SECRET.substring(0, 50)}...`);
        console.log(`   Found:    ${result.value.substring(0, 50)}...`);
      }
    }
  }
  
  console.log('\n' + '='.repeat(60));
  
  if (!allExist) {
    console.log('\n⚠  Some services are missing JWT_SECRET in .dev.vars');
    console.log('   Run the setup scripts to create them:');
    console.log('   - cd serverless/otp-auth-service && node scripts/setup-test-secrets.js');
    console.log('   - cd serverless/mods-api && node scripts/setup-test-secrets.js');
    console.log('   - cd serverless/customer-api && node scripts/setup-test-secrets.js');
    process.exit(1);
  }
  
  if (!allMatch) {
    console.log('\n✗ JWT_SECRET values do not match across services!');
    console.log('   This will cause authentication failures.');
    console.log('\n   To fix:');
    console.log('   1. Update all .dev.vars files to use the same JWT_SECRET');
    console.log(`   2. Expected value: ${EXPECTED_SECRET}`);
    console.log('   3. Or run the setup scripts to auto-fix:');
    console.log('      - cd serverless/otp-auth-service && node scripts/setup-test-secrets.js');
    console.log('      - cd serverless/mods-api && node scripts/setup-test-secrets.js');
    process.exit(1);
  }
  
  console.log('\n✓ All services are using matching JWT_SECRET values!');
  console.log('   Authentication should work correctly.');
  process.exit(0);
}

main();
