#!/usr/bin/env node
/**
 * Setup Test Secrets for Local Development and E2E Testing
 * 
 * This script ensures test secrets are available for local development.
 * It only sets secrets if they don't already exist (CI secrets take precedence).
 * 
 * Usage:
 *   node scripts/setup-test-secrets.js
 * 
 * Environment Variables:
 *   - CI=true: Skip setup (CI should use wrangler secret put directly)
 *   - FORCE_SETUP=true: Force setting secrets even if they exist
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createHmac } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MODS_API_DIR = join(__dirname, '..');

// Test secrets - safe defaults for local development
const TEST_SECRETS = {
  ENVIRONMENT: 'development', // Set to 'development' for local dev to use localhost URLs
  JWT_SECRET: 'test-jwt-secret-for-local-development-12345678901234567890123456789012',
  NETWORK_INTEGRITY_KEYPHRASE: 'test-integrity-keyphrase-for-integration-tests',
  CUSTOMER_API_URL: 'http://localhost:8790', // Local dev customer-api URL
  ALLOWED_ORIGINS: '*',
  MODS_ENCRYPTION_KEY: 'strixun_mods_encryption_key_dev_2025_secure_random_64_char_minimum_required_for_pbkdf2_derivation', // Shared encryption key for mod files (must match mods-hub/.env VITE_MODS_ENCRYPTION_KEY)
};

/**
 * Check if a secret exists in .dev.vars
 */
function secretExistsInDevVars(secretName) {
  const devVarsPath = join(MODS_API_DIR, '.dev.vars');
  if (!existsSync(devVarsPath)) {
    return false;
  }
  
  const content = readFileSync(devVarsPath, 'utf-8');
  const regex = new RegExp(`^${secretName}=`, 'm');
  return regex.test(content);
}

/**
 * Ensure .dev.vars file exists with test secrets
 */
function setupDevVars() {
  const devVarsPath = join(MODS_API_DIR, '.dev.vars');
  const devVarsExamplePath = join(MODS_API_DIR, '.dev.vars.example');
  
  // If .dev.vars doesn't exist, create it from example or defaults
  if (!existsSync(devVarsPath)) {
    console.log('[Setup] Creating .dev.vars from defaults...');
    
    let content = '';
    if (existsSync(devVarsExamplePath)) {
      content = readFileSync(devVarsExamplePath, 'utf-8');
      // Replace placeholder values with test defaults
      content = content.replace(/ENVIRONMENT=.*/m, `ENVIRONMENT=${TEST_SECRETS.ENVIRONMENT}`);
      content = content.replace(/JWT_SECRET=.*/m, `JWT_SECRET=${TEST_SECRETS.JWT_SECRET}`);
      content = content.replace(/NETWORK_INTEGRITY_KEYPHRASE=.*/m, `NETWORK_INTEGRITY_KEYPHRASE=${TEST_SECRETS.NETWORK_INTEGRITY_KEYPHRASE}`);
      content = content.replace(/CUSTOMER_API_URL=.*/m, `CUSTOMER_API_URL=${TEST_SECRETS.CUSTOMER_API_URL}`);
      content = content.replace(/MODS_ENCRYPTION_KEY=.*/m, `MODS_ENCRYPTION_KEY=${TEST_SECRETS.MODS_ENCRYPTION_KEY}`);
      content = content.replace(/SERVICE_ENCRYPTION_KEY=.*/m, '');
      // Add missing secrets if not present
      if (!content.includes('ENVIRONMENT=')) {
        content = `ENVIRONMENT=${TEST_SECRETS.ENVIRONMENT}\n${content}`;
      }
      if (!content.includes('NETWORK_INTEGRITY_KEYPHRASE=')) {
        content += `\nNETWORK_INTEGRITY_KEYPHRASE=${TEST_SECRETS.NETWORK_INTEGRITY_KEYPHRASE}\n`;
      }
      if (!content.includes('CUSTOMER_API_URL=')) {
        content += `\nCUSTOMER_API_URL=${TEST_SECRETS.CUSTOMER_API_URL}\n`;
      }
      if (!content.includes('ALLOWED_ORIGINS=')) {
        content += `\nALLOWED_ORIGINS=${TEST_SECRETS.ALLOWED_ORIGINS}\n`;
      }
      if (!content.includes('MODS_ENCRYPTION_KEY=')) {
        content += `\nMODS_ENCRYPTION_KEY=${TEST_SECRETS.MODS_ENCRYPTION_KEY}\n`;
      }
    } else {
      // Create from scratch
      content = `# Mods API - Development Environment Variables (Auto-generated for testing)
# This file is gitignored and used by wrangler dev
# For local development, these test values are safe to use

ENVIRONMENT=${TEST_SECRETS.ENVIRONMENT}
JWT_SECRET=${TEST_SECRETS.JWT_SECRET}
NETWORK_INTEGRITY_KEYPHRASE=${TEST_SECRETS.NETWORK_INTEGRITY_KEYPHRASE}
CUSTOMER_API_URL=${TEST_SECRETS.CUSTOMER_API_URL}
ALLOWED_ORIGINS=${TEST_SECRETS.ALLOWED_ORIGINS}
MODS_ENCRYPTION_KEY=${TEST_SECRETS.MODS_ENCRYPTION_KEY}
`;
    }
    
    writeFileSync(devVarsPath, content, 'utf-8');
    console.log('✓ Created .dev.vars with test secrets');
  } else {
    // Check if secrets are missing and add them
    const existingContent = readFileSync(devVarsPath, 'utf-8');
    let updated = false;
    let newContent = existingContent;
    
    for (const [key, value] of Object.entries(TEST_SECRETS)) {
      if (!secretExistsInDevVars(key)) {
        console.log(`[Setup] Adding missing secret: ${key}`);
        newContent += `\n${key}=${value}\n`;
        updated = true;
      }
    }
    
    if (updated) {
      writeFileSync(devVarsPath, newContent, 'utf-8');
      console.log('✓ Updated .dev.vars with missing test secrets');
    } else {
      console.log('ℹ .dev.vars already has all required secrets');
    }
  }
}

/**
 * Main setup function
 */
function main() {
  // Skip in CI - CI should use GitHub secrets
  if (process.env.CI === 'true') {
    console.log('ℹ Running in CI - skipping local secret setup');
    console.log('ℹ CI should use GitHub secrets for E2E_TEST_JWT_TOKEN and E2E_TEST_OTP_CODE');
    // Still set up .dev.vars for local workers (but not test keys)
    setupDevVars();
    return;
  }
  
  console.log('[Setup] Ensuring test secrets are available for local development...');
  console.log('[Setup] Note: CI secrets take precedence over these defaults\n');
  
  try {
    setupDevVars();
    
    // Generate test keys for E2E testing (only for local dev, not CI)
    if (process.env.CI !== 'true') {
      console.log('\n[Setup] Generating test keys for E2E testing...');
      generateTestKeys();
    }
    
    console.log('\n✓ Test secrets are ready for local development');
    console.log('ℹ Secrets are stored in .dev.vars (gitignored)');
    console.log('ℹ For CI, set E2E_TEST_OTP_CODE and E2E_TEST_JWT_TOKEN as GitHub secrets');
  } catch (error) {
    console.error('✗ Failed to setup test secrets:', error.message);
    process.exit(1);
  }
}

/**
 * Generate test keys (OTP code and JWT token) for E2E testing
 */
function generateTestKeys() {
  const devVarsPath = join(MODS_API_DIR, '.dev.vars');
  
  // Read JWT_SECRET from .dev.vars
  let jwtSecret = TEST_SECRETS.JWT_SECRET;
  if (existsSync(devVarsPath)) {
    const content = readFileSync(devVarsPath, 'utf-8');
    const jwtMatch = content.match(/^JWT_SECRET=(.+)$/m);
    if (jwtMatch) {
      jwtSecret = jwtMatch[1].trim();
    }
  }
  
  // Generate random 9-digit OTP code
  const testOTPCode = Math.floor(100000000 + Math.random() * 900000000).toString();
  
  // Generate test JWT token for test@example.com (super admin)
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + (7 * 60 * 60); // 7 hours
  
  const payload = {
    sub: 'user_test12345678',
    iss: 'auth.idling.app',
    aud: 'default',
    exp: expiresAt,
    iat: now,
    jti: `test_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    email: 'test@example.com',
    email_verified: true,
    userId: 'user_test12345678',
    customerId: 'test_customer_e2e', // Test customer ID for E2E testing (required for mod uploads)
    csrf: `csrf_${Math.random().toString(36).substring(7)}`,
    isSuperAdmin: true,
  };
  
  // Create JWT (HS256) - using base64url encoding
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = Buffer.from(JSON.stringify(header))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  const payloadB64 = Buffer.from(JSON.stringify(payload))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  const signatureInput = `${headerB64}.${payloadB64}`;
  
  // Generate signature using Node.js crypto (matches Web Crypto API HMAC-SHA256)
  // Use base64url encoding directly (Node.js 15+ supports this)
  const signature = createHmac('sha256', jwtSecret)
    .update(signatureInput)
    .digest('base64url');
  
  const testJWTToken = `${headerB64}.${payloadB64}.${signature}`;
  
  // Read existing .dev.vars
  let content = '';
  if (existsSync(devVarsPath)) {
    content = readFileSync(devVarsPath, 'utf-8');
  }
  
  // Remove existing test keys if present
  content = content.replace(/^E2E_TEST_OTP_CODE=.*$/m, '');
  content = content.replace(/^E2E_TEST_JWT_TOKEN=.*$/m, '');
  content = content.replace(/^# E2E Test Keys.*$/m, '');
  content = content.trim();
  
  // Add new test keys
  if (content && !content.endsWith('\n')) {
    content += '\n';
  }
  content += `\n# E2E Test Keys (auto-generated for local dev)\n`;
  content += `# Note: E2E_TEST_JWT_TOKEN is a pre-generated test token for test@example.com (super admin)\n`;
  content += `E2E_TEST_OTP_CODE=${testOTPCode}\n`;
  content += `E2E_TEST_JWT_TOKEN=${testJWTToken}\n`;
  
  writeFileSync(devVarsPath, content, 'utf-8');
  console.log(`✓ Generated test keys: E2E_TEST_OTP_CODE=${testOTPCode}, E2E_TEST_JWT_TOKEN=...`);
  
  // Return keys so they can be exported to process.env if needed
  return { otpCode: testOTPCode, jwtToken: testJWTToken };
}

main();

