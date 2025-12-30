import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load .dev.vars files into process.env for E2E tests
 * This runs before all tests and ensures env vars are available in all workers
 */
function loadDevVars() {
  const devVarsPaths = [
    join(__dirname, 'serverless', 'mods-api', '.dev.vars'),
    join(__dirname, 'serverless', 'otp-auth-service', '.dev.vars'),
  ];
  
  for (const devVarsPath of devVarsPaths) {
    if (existsSync(devVarsPath)) {
      const content = readFileSync(devVarsPath, 'utf-8');
      const lines = content.split('\n');
      
      for (const line of lines) {
        const trimmed = line.trim();
        // Skip comments and empty lines
        if (!trimmed || trimmed.startsWith('#')) continue;
        
        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim();
          // Set env var (will be available to all test workers)
          process.env[key] = value;
        }
      }
    }
  }
}

export default async function globalSetup() {
  // Load .dev.vars into process.env before tests run
  loadDevVars();
  console.log('[Global Setup] Loaded .dev.vars files');
  const tokenSet = !!process.env.E2E_TEST_JWT_TOKEN;
  const otpSet = !!process.env.E2E_TEST_OTP_CODE;
  console.log('[Global Setup] E2E_TEST_JWT_TOKEN:', tokenSet ? `SET (${process.env.E2E_TEST_JWT_TOKEN.substring(0, 20)}...)` : 'NOT SET');
  console.log('[Global Setup] E2E_TEST_OTP_CODE:', otpSet ? 'SET' : 'NOT SET');
  
  if (!tokenSet && !otpSet) {
    console.error('[Global Setup] ERROR: Neither E2E_TEST_JWT_TOKEN nor E2E_TEST_OTP_CODE is set!');
    console.error('[Global Setup] Make sure .dev.vars files exist and contain these values.');
    throw new Error('E2E test credentials not found. Run setup:test-secrets scripts first.');
  }
}

