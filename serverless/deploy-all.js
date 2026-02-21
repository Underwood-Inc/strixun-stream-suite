#!/usr/bin/env node
/**
 * Deploy All Workers Script
 * 
 * Deploys all Cloudflare Workers in the serverless directory sequentially.
 * This ensures proper deployment order and provides clear feedback.
 * 
 * Supports --dry-run flag for validation without deployment.
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { platform } from 'os';
import { existsSync, readFileSync } from 'fs';
import { parse } from '@iarna/toml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check for dry-run flag
const isDryRun = process.argv.includes('--dry-run') || process.argv.includes('-d');

const services = [
  { name: 'Suite API', path: 'suite-api', worker: 'strixun-suite-api', command: 'wrangler deploy' },
  { name: 'OTP Auth Service', path: 'otp-auth-service', worker: 'otp-auth-service', command: 'pnpm run deploy' },
  { name: 'Customer API', path: 'customer-api', worker: 'strixun-customer-api', command: 'wrangler deploy' },
  { name: 'Game API', path: 'game-api', worker: 'strixun-game-api', command: 'wrangler deploy' },
  { name: 'URL Shortener', path: 'url-shortener', worker: 'strixun-url-shortener', command: 'wrangler deploy --env production' },
  { name: 'Chat Signaling', path: 'chat-signaling', worker: 'strixun-chat-signaling', command: 'wrangler deploy' },
  { name: 'Mods API', path: 'mods-api', worker: 'strixun-mods-api', command: 'wrangler deploy' },
];

if (isDryRun) {
  console.log(' ★ DRY RUN MODE - Validating deployments without deploying\n');
} else {
  console.log(' ★ Deploying All Cloudflare Workers\n');
}
console.log(`Found ${services.length} services to ${isDryRun ? 'validate' : 'deploy'}:\n`);
services.forEach((service, index) => {
  console.log(`  ${index + 1}. ${service.name} (${service.worker})`);
});
console.log('');

let successCount = 0;
let failCount = 0;
const results = [];

/**
 * Execute command with timeout and progress logging
 * Cross-platform compatible spawn for shell commands
 */
function execWithTimeout(command, options, timeoutMs = 600000) { // 10 minutes default
  return new Promise((resolve, reject) => {
    console.log(`   [TIME]  Timeout: ${timeoutMs / 1000 / 60} minutes`);
    console.log(` ★ Starting command...\n`);
    
    const startTime = Date.now();
    
    // Determine shell based on platform for cross-platform compatibility
    const isWindows = platform() === 'win32';
    const shell = isWindows ? process.env.COMSPEC || 'cmd.exe' : '/bin/sh';
    const shellFlag = isWindows ? '/c' : '-c';
    
    // For shell commands, spawn with proper shell syntax
    // On Windows: cmd.exe /c "command"
    // On Unix: /bin/sh -c "command"
    const child = spawn(shell, [shellFlag, command], {
      ...options,
      stdio: 'inherit',
    });
    
    // Progress logging every 30 seconds
    const progressInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      console.log(`    Still building... (${minutes}m ${seconds}s elapsed)`);
    }, 30000);
    
    let timeoutId = setTimeout(() => {
      clearInterval(progressInterval);
      child.kill('SIGTERM');
      // Give it a moment, then force kill
      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGKILL');
        }
      }, 5000);
      reject(new Error(`Command timed out after ${timeoutMs / 1000} seconds`));
    }, timeoutMs);
    
    child.on('error', (error) => {
      clearInterval(progressInterval);
      clearTimeout(timeoutId);
      reject(error);
    });
    
    child.on('exit', (code, signal) => {
      clearInterval(progressInterval);
      clearTimeout(timeoutId);
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      
      if (code === 0) {
        console.log(`\n   ✓ Command completed in ${minutes}m ${seconds}s`);
        resolve();
      } else {
        reject(new Error(`Command exited with code ${code}${signal ? ` (signal: ${signal})` : ''} after ${minutes}m ${seconds}s`));
      }
    });
  });
}

/**
 * Validate service configuration for dry-run
 */
async function validateService(service) {
  const servicePath = join(__dirname, service.path);
  const issues = [];
  const info = {};

  // Check if service directory exists
  if (!existsSync(servicePath)) {
    issues.push(`Service directory does not exist: ${servicePath}`);
    return { valid: false, issues, info };
  }

  // Check for wrangler.toml
  const wranglerTomlPath = join(servicePath, 'wrangler.toml');
  if (!existsSync(wranglerTomlPath)) {
    issues.push(`Missing wrangler.toml at ${wranglerTomlPath}`);
  } else {
    try {
      const tomlContent = readFileSync(wranglerTomlPath, 'utf-8');
      const config = parse(tomlContent);
      info.name = config.name;
      info.main = config.main;
      info.compatibility_date = config.compatibility_date;
      
      // Check if main file exists
      if (config.main) {
        const mainPath = join(servicePath, config.main);
        if (!existsSync(mainPath)) {
          issues.push(`Main file specified in wrangler.toml does not exist: ${config.main}`);
        } else {
          info.mainExists = true;
        }
      } else {
        issues.push('No main file specified in wrangler.toml');
      }

      // Check for KV namespaces
      if (config.kv_namespaces && Array.isArray(config.kv_namespaces)) {
        info.kvNamespaces = config.kv_namespaces.length;
        config.kv_namespaces.forEach((ns, idx) => {
          if (!ns.id || !ns.binding) {
            issues.push(`KV namespace ${idx + 1} missing id or binding`);
          }
        });
      }

      // Check for routes
      if (config.routes && Array.isArray(config.routes)) {
        info.routes = config.routes.length;
      }
    } catch (error) {
      issues.push(`Failed to parse wrangler.toml: ${error.message}`);
    }
  }

  // Check for package.json
  const packageJsonPath = join(servicePath, 'package.json');
  if (existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      info.packageName = packageJson.name;
      info.hasDeployScript = !!(packageJson.scripts && packageJson.scripts.deploy);
    } catch (error) {
      issues.push(`Failed to parse package.json: ${error.message}`);
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    info
  };
}

/**
 * Prebuild step: Build required dependencies
 * 
 * CRITICAL: Prebuild failures MUST fail the entire deployment.
 * No prebuild step is allowed to silently fail.
 */
async function prebuild() {
  console.log('\n ★ Prebuild Step: Building required dependencies\n');
  
  console.log('ℹ Building @strixun/otp-login package (required for frontend apps)...');
  try {
    await execWithTimeout(
      'pnpm --filter @strixun/otp-login build:react',
      { cwd: join(__dirname, '..') },
      300000 // 5 minutes timeout
    );
    console.log('✓ @strixun/otp-login built successfully\n');
  } catch (error) {
    console.error('✗ CRITICAL: Failed to build @strixun/otp-login:', error.message);
    console.error('✗ Prebuild step failed - deployment aborted to prevent broken deployments\n');
    // Re-throw to fail the entire script
    throw new Error(`Prebuild step failed: ${error.message}`);
  }
}

/**
 * Execute deployment or validation
 */
async function deployAll() {
  // Run prebuild step before deployment (skip for dry-run)
  if (!isDryRun) {
    await prebuild();
  }
  
  for (const service of services) {
    const servicePath = join(__dirname, service.path);
    
    if (isDryRun) {
      console.log(`\nℹ ${service.name}...`);
      console.log(`   Path: ${servicePath}`);
      console.log(`   Worker: ${service.worker}`);
      
      const validation = await validateService(service);
      
      if (validation.valid) {
        console.log(`   ✓ Configuration valid`);
        if (validation.info.name) console.log(`   ℹ: ${validation.info.name}`);
        if (validation.info.main) console.log(`   ℹ: ${validation.info.main}`);
        if (validation.info.compatibility_date) console.log(`    Compatibility: ${validation.info.compatibility_date}`);
        if (validation.info.kvNamespaces) console.log(`    KV Namespaces: ${validation.info.kvNamespaces}`);
        if (validation.info.routes) console.log(`     Routes: ${validation.info.routes}`);
        if (validation.info.packageName) console.log(`   ℹ: ${validation.info.packageName}`);
        console.log(`   ✓ ${service.name} validation passed!`);
        successCount++;
        results.push({ service: service.name, status: 'valid' });
      } else {
        console.error(`   ✗ Configuration issues found:`);
        validation.issues.forEach(issue => {
          console.error(`      • ${issue}`);
        });
        failCount++;
        results.push({ service: service.name, status: 'invalid', issues: validation.issues });
        console.log(`\n⚠  Continuing with remaining services...`);
      }
    } else {
      console.log(`\n ★ Deploying ${service.name}...`);
      console.log(`   Path: ${servicePath}`);
      console.log(`   Worker: ${service.worker}`);
      console.log(`   Command: ${service.command || 'wrangler deploy'}`);
      
      try {
        // Use timeout for build-heavy services (OTP Auth Service)
        const timeout = service.name === 'OTP Auth Service' ? 900000 : 600000; // 15 min for OTP, 10 min for others
        
        await execWithTimeout(
          service.command || 'wrangler deploy',
          { cwd: servicePath },
          timeout
        );
        
        console.log(`✓ ${service.name} deployed successfully!`);
        successCount++;
        results.push({ service: service.name, status: 'success' });
      } catch (error) {
        console.error(`✗ ${service.name} deployment failed!`);
        console.error(`   Error: ${error.message}`);
        failCount++;
        results.push({ service: service.name, status: 'failed', error: error.message });
        
        // Ask if user wants to continue
        console.log(`\n⚠  Continuing with remaining services...`);
      }
    }
  }
}

// Run deployment or validation
deployAll().then(() => {
  // Summary
  console.log('\n' + '='.repeat(60));
  if (isDryRun) {
    console.log(' ★ Validation Summary');
  } else {
    console.log(' ★ Deployment Summary');
  }
  console.log('='.repeat(60));
  console.log(`✓ ${isDryRun ? 'Valid' : 'Successful'}: ${successCount}`);
  console.log(`✗ ${isDryRun ? 'Invalid' : 'Failed'}: ${failCount}`);
  console.log(` ★ Total: ${services.length}\n`);

  if (failCount > 0) {
    if (isDryRun) {
      console.log('Services with validation issues:');
      results
        .filter(r => r.status === 'invalid' || r.status === 'failed')
        .forEach(r => {
          console.log(`  ✗ ${r.service}`);
          if (r.issues) {
            r.issues.forEach(issue => {
              console.log(`     • ${issue}`);
            });
          }
          if (r.error) {
            console.log(`     • ${r.error}`);
          }
        });
    } else {
      console.log('Failed services:');
      results
        .filter(r => r.status === 'failed')
        .forEach(r => {
          console.log(`  ✗ ${r.service}`);
        });
    }
    console.log('');
  }

  if (failCount === 0) {
    if (isDryRun) {
      console.log(' All services validated successfully! Ready to deploy.\n');
    } else {
      console.log(' All services deployed successfully!\n');
    }
    process.exit(0);
  } else {
    if (isDryRun) {
      console.log('⚠  Some services have validation issues. Fix them before deploying.\n');
    } else {
      console.log('⚠  Some deployments failed. Check the errors above.\n');
    }
    process.exit(1);
  }
}).catch((error) => {
  console.error(`✗ Fatal error during ${isDryRun ? 'validation' : 'deployment'}:`, error);
  process.exit(1);
});


