#!/usr/bin/env node
/**
 * Setup Test Secrets for OTP Auth Service - Local Development and E2E Testing
 * 
 * This script ensures test secrets are available for local development.
 * It only sets secrets if they don't already exist (CI secrets take precedence).
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createHmac } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OTP_AUTH_DIR = join(__dirname, '..');

// Test secrets - safe defaults for local development
// IMPORTANT: JWT_SECRET must match mods-api JWT_SECRET for auth to work
// IMPORTANT: SERVICE_ENCRYPTION_KEY must match frontend VITE_SERVICE_ENCRYPTION_KEY
// NOTE: Frontend uses VITE_SERVICE_ENCRYPTION_KEY, but workers use SERVICE_ENCRYPTION_KEY
const TEST_SECRETS = {
  ENVIRONMENT: 'test', // Set to 'test' for E2E mode to skip Vite proxy
  JWT_SECRET: 'test-jwt-secret-for-local-development-12345678901234567890123456789012',
  RESEND_API_KEY: 're_test_key_for_local_development',
  RESEND_FROM_EMAIL: 'test@example.com',
  SERVICE_ENCRYPTION_KEY: 'test-service-encryption-key-for-local-development-12345678901234567890123456789012',
  VITE_SERVICE_ENCRYPTION_KEY: 'test-service-encryption-key-for-local-development-12345678901234567890123456789012',
  ALLOWED_ORIGINS: '*',
  SUPER_ADMIN_EMAILS: 'test@example.com',
};

/**
 * Check if a secret exists in .dev.vars
 */
function secretExistsInDevVars(secretName) {
  const devVarsPath = join(OTP_AUTH_DIR, '.dev.vars');
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
  const devVarsPath = join(OTP_AUTH_DIR, '.dev.vars');
  const devVarsExamplePath = join(OTP_AUTH_DIR, '.dev.vars.example');
  
  // If .dev.vars doesn't exist, create it from example or defaults
  if (!existsSync(devVarsPath)) {
    console.log('[Setup] Creating .dev.vars from defaults...');
    
    let content = '';
    if (existsSync(devVarsExamplePath)) {
      content = readFileSync(devVarsExamplePath, 'utf-8');
      // Replace placeholder values with test defaults
      content = content.replace(/ENVIRONMENT=.*/m, `ENVIRONMENT=${TEST_SECRETS.ENVIRONMENT}`);
      content = content.replace(/JWT_SECRET=.*/m, `JWT_SECRET=${TEST_SECRETS.JWT_SECRET}`);
      content = content.replace(/RESEND_API_KEY=.*/m, `RESEND_API_KEY=${TEST_SECRETS.RESEND_API_KEY}`);
      content = content.replace(/RESEND_FROM_EMAIL=.*/m, `RESEND_FROM_EMAIL=${TEST_SECRETS.RESEND_FROM_EMAIL}`);
      if (!content.includes('ENVIRONMENT=')) {
        content = `ENVIRONMENT=${TEST_SECRETS.ENVIRONMENT}\n${content}`;
      }
      if (!content.includes('SERVICE_ENCRYPTION_KEY=')) {
        content += `\nSERVICE_ENCRYPTION_KEY=${TEST_SECRETS.SERVICE_ENCRYPTION_KEY}\n`;
      }
      if (!content.includes('VITE_SERVICE_ENCRYPTION_KEY=')) {
        content += `\nVITE_SERVICE_ENCRYPTION_KEY=${TEST_SECRETS.VITE_SERVICE_ENCRYPTION_KEY}\n`;
      }
      if (!content.includes('ALLOWED_ORIGINS=')) {
        content += `\nALLOWED_ORIGINS=${TEST_SECRETS.ALLOWED_ORIGINS}\n`;
      }
      if (!content.includes('SUPER_ADMIN_EMAILS=')) {
        content += `\nSUPER_ADMIN_EMAILS=${TEST_SECRETS.SUPER_ADMIN_EMAILS}\n`;
      }
    } else {
      // Create from scratch
      content = `# OTP Auth Service - Development Environment Variables (Auto-generated for testing)
# This file is gitignored and used by wrangler dev
# For local development, these test values are safe to use

ENVIRONMENT=${TEST_SECRETS.ENVIRONMENT}
JWT_SECRET=${TEST_SECRETS.JWT_SECRET}
RESEND_API_KEY=${TEST_SECRETS.RESEND_API_KEY}
RESEND_FROM_EMAIL=${TEST_SECRETS.RESEND_FROM_EMAIL}
SERVICE_ENCRYPTION_KEY=${TEST_SECRETS.SERVICE_ENCRYPTION_KEY}
VITE_SERVICE_ENCRYPTION_KEY=${TEST_SECRETS.VITE_SERVICE_ENCRYPTION_KEY}
ALLOWED_ORIGINS=${TEST_SECRETS.ALLOWED_ORIGINS}
SUPER_ADMIN_EMAILS=${TEST_SECRETS.SUPER_ADMIN_EMAILS}
`;
    }
    
    writeFileSync(devVarsPath, content, 'utf-8');
    console.log('✓ Created .dev.vars with test secrets');
  } else {
    // Check if secrets are missing and add them
    const existingContent = readFileSync(devVarsPath, 'utf-8');
    let updated = false;
    let newContent = existingContent;
    
    // Special handling for SUPER_ADMIN_EMAILS - ensure test@example.com is included
    const testEmail = 'test@example.com';
    if (secretExistsInDevVars('SUPER_ADMIN_EMAILS')) {
      // Check if test@example.com is already in the list
      const superAdminMatch = existingContent.match(/^SUPER_ADMIN_EMAILS=(.+)$/m);
      if (superAdminMatch) {
        const existingEmails = superAdminMatch[1].split(',').map(e => e.trim().toLowerCase());
        if (!existingEmails.includes(testEmail.toLowerCase())) {
          console.log(`[Setup] Adding ${testEmail} to SUPER_ADMIN_EMAILS (required for E2E tests)`);
          // Add test@example.com to the existing list
          newContent = newContent.replace(
            /^SUPER_ADMIN_EMAILS=(.+)$/m,
            `SUPER_ADMIN_EMAILS=$1,${testEmail}`
          );
          updated = true;
        }
      }
    } else {
      // SUPER_ADMIN_EMAILS doesn't exist, add it
      console.log(`[Setup] Adding SUPER_ADMIN_EMAILS with ${testEmail}`);
      newContent += `\nSUPER_ADMIN_EMAILS=${testEmail}\n`;
      updated = true;
    }
    
    // Handle other secrets normally
    for (const [key, value] of Object.entries(TEST_SECRETS)) {
      if (key === 'SUPER_ADMIN_EMAILS') {
        // Already handled above
        continue;
      }
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
  // Skip in CI - CI should use wrangler secret put directly
  if (process.env.CI === 'true') {
    console.log('ℹ Running in CI - skipping local secret setup');
    return;
  }
  
  console.log('[Setup] Ensuring test secrets are available for OTP auth service...');
  
  try {
    setupDevVars();
    
    // Generate test keys for E2E testing (only for local dev, not CI)
    if (process.env.CI !== 'true') {
      console.log('[Setup] Generating test keys for E2E testing...');
      generateTestKeys();
    }
    
    console.log('✓ Test secrets are ready for local development');
  } catch (error) {
    console.error('✗ Failed to setup test secrets:', error.message);
    process.exit(1);
  }
}

/**
 * Generate test keys (OTP code and JWT token) for E2E testing
 */
function generateTestKeys() {
  const devVarsPath = join(OTP_AUTH_DIR, '.dev.vars');
  
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
    customerId: null,
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
  
  const signature = createHmac('sha256', jwtSecret)
    .update(signatureInput)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  
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
}

main();

