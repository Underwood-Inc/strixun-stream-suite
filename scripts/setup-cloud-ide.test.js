/**
 * Test suite for setup-cloud-ide.js
 * 
 * Tests that the script:
 * 1. Creates all required files
 * 2. Doesn't overwrite existing files
 * 3. Creates files with correct content
 * 4. Handles missing directories gracefully
 */

import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');
const TEST_DIR = join(ROOT_DIR, '.test-setup-cloud-ide');

// Paths to test files
const TEST_PATHS = {
  otpAuthDevVars: join(TEST_DIR, 'serverless', 'otp-auth-service', '.dev.vars'),
  modsApiDevVars: join(TEST_DIR, 'serverless', 'mods-api', '.dev.vars'),
  customerApiDevVars: join(TEST_DIR, 'serverless', 'customer-api', '.dev.vars'),
  modsHubEnv: join(TEST_DIR, 'mods-hub', '.env'),
};

/**
 * Run the setup script with TEST_DIR as root
 */
function runSetupScript() {
  const setupScriptPath = join(ROOT_DIR, 'scripts', 'setup-cloud-ide.js');
  const setupScript = readFileSync(setupScriptPath, 'utf-8');
  
  // Replace ROOT_DIR with TEST_DIR
  const modifiedScript = setupScript.replace(
    /const ROOT_DIR = join\(__dirname, '\.\.'\);/,
    `const ROOT_DIR = ${JSON.stringify(TEST_DIR)};`
  );
  
  const tempScriptPath = join(TEST_DIR, 'setup-cloud-ide-temp.js');
  writeFileSync(tempScriptPath, modifiedScript);
  
  try {
    execSync(`node ${tempScriptPath}`, {
      cwd: TEST_DIR,
      stdio: 'pipe',
    });
  } finally {
    if (existsSync(tempScriptPath)) {
      rmSync(tempScriptPath, { force: true });
    }
  }
}

describe('setup-cloud-ide.js', () => {
  beforeAll(() => {
    // Create test directory structure
    mkdirSync(join(TEST_DIR, 'serverless', 'otp-auth-service'), { recursive: true });
    mkdirSync(join(TEST_DIR, 'serverless', 'mods-api'), { recursive: true });
    mkdirSync(join(TEST_DIR, 'serverless', 'customer-api'), { recursive: true });
    mkdirSync(join(TEST_DIR, 'mods-hub'), { recursive: true });
  });

  afterAll(() => {
    // Clean up test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('should create all required files', () => {
    runSetupScript();

    // Verify all files exist
    expect(existsSync(TEST_PATHS.otpAuthDevVars)).toBe(true);
    expect(existsSync(TEST_PATHS.modsApiDevVars)).toBe(true);
    expect(existsSync(TEST_PATHS.customerApiDevVars)).toBe(true);
    expect(existsSync(TEST_PATHS.modsHubEnv)).toBe(true);
  });

  it('should create files with correct content', () => {
    runSetupScript();

    // Read and verify content
    const otpAuthContent = readFileSync(TEST_PATHS.otpAuthDevVars, 'utf-8');
    const modsApiContent = readFileSync(TEST_PATHS.modsApiDevVars, 'utf-8');
    const customerApiContent = readFileSync(TEST_PATHS.customerApiDevVars, 'utf-8');
    const modsHubContent = readFileSync(TEST_PATHS.modsHubEnv, 'utf-8');

    // Verify OTP Auth Service content
    expect(otpAuthContent).toContain('ENVIRONMENT=test');
    expect(otpAuthContent).toContain('JWT_SECRET=test-jwt-secret-for-local-development');
    expect(otpAuthContent).toContain('RESEND_API_KEY=re_test_key_for_local_development');
    expect(otpAuthContent).toContain('NETWORK_INTEGRITY_KEYPHRASE=test-integrity-keyphrase-for-integration-tests');

    // Verify Mods API content
    expect(modsApiContent).toContain('ENVIRONMENT=test');
    expect(modsApiContent).toContain('JWT_SECRET=test-jwt-secret-for-local-development');
    expect(modsApiContent).toContain('MODS_ENCRYPTION_KEY=strixun_mods_encryption_key_dev_2025');
    expect(modsApiContent).toContain('CUSTOMER_API_URL=http://localhost:8790');

    // Verify Customer API content
    expect(customerApiContent).toContain('ENVIRONMENT=test');
    expect(customerApiContent).toContain('JWT_SECRET=test-jwt-secret-for-local-development');
    expect(customerApiContent).toContain('NETWORK_INTEGRITY_KEYPHRASE=test-integrity-keyphrase-for-integration-tests');

    // Verify Mods Hub content
    expect(modsHubContent).toContain('VITE_MODS_ENCRYPTION_KEY=strixun_mods_encryption_key_dev_2025');
  });

  it('should not overwrite existing files', () => {
    // Create existing file with custom content
    const customContent = '# Custom existing file\nCUSTOM_VAR=existing_value\n';
    writeFileSync(TEST_PATHS.otpAuthDevVars, customContent);

    // Run the setup script again
    runSetupScript();

    // Verify file was not overwritten
    const content = readFileSync(TEST_PATHS.otpAuthDevVars, 'utf-8');
    expect(content).toContain('CUSTOM_VAR=existing_value');
    expect(content).not.toContain('ENVIRONMENT=test');
  });

  it('should create files with matching encryption keys', () => {
    runSetupScript();

    // Read both files that need matching keys
    const modsApiContent = readFileSync(TEST_PATHS.modsApiDevVars, 'utf-8');
    const modsHubContent = readFileSync(TEST_PATHS.modsHubEnv, 'utf-8');

    // Extract encryption keys
    const modsApiKeyMatch = modsApiContent.match(/MODS_ENCRYPTION_KEY=(.+)/);
    const modsHubKeyMatch = modsHubContent.match(/VITE_MODS_ENCRYPTION_KEY=(.+)/);

    expect(modsApiKeyMatch).toBeTruthy();
    expect(modsHubKeyMatch).toBeTruthy();

    const modsApiKey = modsApiKeyMatch[1].trim();
    const modsHubKey = modsHubKeyMatch[1].trim();

    expect(modsApiKey).toBe(modsHubKey);
  });

  it('should create files with matching JWT secrets', () => {
    runSetupScript();

    // Read all files that need matching JWT secrets
    const otpAuthContent = readFileSync(TEST_PATHS.otpAuthDevVars, 'utf-8');
    const modsApiContent = readFileSync(TEST_PATHS.modsApiDevVars, 'utf-8');
    const customerApiContent = readFileSync(TEST_PATHS.customerApiDevVars, 'utf-8');

    // Extract JWT secrets
    const otpAuthSecretMatch = otpAuthContent.match(/JWT_SECRET=(.+)/);
    const modsApiSecretMatch = modsApiContent.match(/JWT_SECRET=(.+)/);
    const customerApiSecretMatch = customerApiContent.match(/JWT_SECRET=(.+)/);

    expect(otpAuthSecretMatch).toBeTruthy();
    expect(modsApiSecretMatch).toBeTruthy();
    expect(customerApiSecretMatch).toBeTruthy();

    const otpAuthSecret = otpAuthSecretMatch[1].trim();
    const modsApiSecret = modsApiSecretMatch[1].trim();
    const customerApiSecret = customerApiSecretMatch[1].trim();

    expect(otpAuthSecret).toBe(modsApiSecret);
    expect(modsApiSecret).toBe(customerApiSecret);
  });

  it('should create files with matching network integrity keyphrases', () => {
    runSetupScript();

    // Read all files that need matching network integrity keyphrases
    const otpAuthContent = readFileSync(TEST_PATHS.otpAuthDevVars, 'utf-8');
    const modsApiContent = readFileSync(TEST_PATHS.modsApiDevVars, 'utf-8');
    const customerApiContent = readFileSync(TEST_PATHS.customerApiDevVars, 'utf-8');

    // Extract network integrity keyphrases
    const otpAuthKeyphraseMatch = otpAuthContent.match(/NETWORK_INTEGRITY_KEYPHRASE=(.+)/);
    const modsApiKeyphraseMatch = modsApiContent.match(/NETWORK_INTEGRITY_KEYPHRASE=(.+)/);
    const customerApiKeyphraseMatch = customerApiContent.match(/NETWORK_INTEGRITY_KEYPHRASE=(.+)/);

    expect(otpAuthKeyphraseMatch).toBeTruthy();
    expect(modsApiKeyphraseMatch).toBeTruthy();
    expect(customerApiKeyphraseMatch).toBeTruthy();

    const otpAuthKeyphrase = otpAuthKeyphraseMatch[1].trim();
    const modsApiKeyphrase = modsApiKeyphraseMatch[1].trim();
    const customerApiKeyphrase = customerApiKeyphraseMatch[1].trim();

    expect(otpAuthKeyphrase).toBe(modsApiKeyphrase);
    expect(modsApiKeyphrase).toBe(customerApiKeyphrase);
  });

  it('should handle missing directories gracefully', () => {
    // Remove a directory
    rmSync(join(TEST_DIR, 'serverless', 'otp-auth-service'), { recursive: true, force: true });

    // Run the script - should create directory and file
    runSetupScript();

    // Verify directory and file were created
    expect(existsSync(join(TEST_DIR, 'serverless', 'otp-auth-service'))).toBe(true);
    expect(existsSync(TEST_PATHS.otpAuthDevVars)).toBe(true);
  });
});
