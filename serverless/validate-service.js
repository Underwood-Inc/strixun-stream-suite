#!/usr/bin/env node
/**
 * Validate Service Script
 * 
 * Validates a single Cloudflare Worker service configuration
 * without deploying. Useful for dry-run validation.
 * 
 * Usage: node validate-service.js <service-path>
 * Example: node validate-service.js otp-auth-service
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { parse } from '@iarna/toml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const servicePath = process.argv[2];

if (!servicePath) {
  console.error('❌ Error: Service path required');
  console.error('Usage: node validate-service.js <service-path>');
  console.error('Example: node validate-service.js otp-auth-service');
  console.error('Example: node validate-service.js . (for root service)');
  process.exit(1);
}

// Handle root directory (.) - validate current directory
const fullPath = servicePath === '.' ? __dirname : join(__dirname, servicePath);

if (!existsSync(fullPath)) {
  console.error(`❌ Error: Service directory does not exist: ${fullPath}`);
  process.exit(1);
}

console.log(`🔍 Validating service: ${servicePath}\n`);
console.log(`   Path: ${fullPath}\n`);

const issues = [];
const info = {};

// Check for wrangler.toml
const wranglerTomlPath = join(fullPath, 'wrangler.toml');
if (!existsSync(wranglerTomlPath)) {
  issues.push(`Missing wrangler.toml at ${wranglerTomlPath}`);
} else {
  try {
    const tomlContent = readFileSync(wranglerTomlPath, 'utf-8');
    const config = parse(tomlContent);
    info.name = config.name;
    info.main = config.main;
    info.compatibility_date = config.compatibility_date;
    
    console.log(`   📝 Name: ${config.name || 'Not specified'}`);
    console.log(`   📄 Main: ${config.main || 'Not specified'}`);
    console.log(`   ❓ Compatibility: ${config.compatibility_date || 'Not specified'}`);
    
    // Check if main file exists
    if (config.main) {
      const mainPath = join(fullPath, config.main);
      if (!existsSync(mainPath)) {
        issues.push(`Main file specified in wrangler.toml does not exist: ${config.main}`);
        console.log(`   ❌ Main file missing: ${config.main}`);
      } else {
        info.mainExists = true;
        console.log(`   ✅ Main file exists: ${config.main}`);
      }
    } else {
      issues.push('No main file specified in wrangler.toml');
      console.log(`   ❌ No main file specified`);
    }

    // Check for KV namespaces
    if (config.kv_namespaces && Array.isArray(config.kv_namespaces)) {
      info.kvNamespaces = config.kv_namespaces.length;
      console.log(`   ❓ KV Namespaces: ${config.kv_namespaces.length}`);
      config.kv_namespaces.forEach((ns, idx) => {
        if (!ns.id || !ns.binding) {
          issues.push(`KV namespace ${idx + 1} missing id or binding`);
          console.log(`   ❌ KV namespace ${idx + 1} incomplete`);
        } else {
          console.log(`   ✅ KV namespace ${idx + 1}: ${ns.binding} (${ns.id})`);
        }
      });
    }

    // Check for routes
    if (config.routes && Array.isArray(config.routes)) {
      info.routes = config.routes.length;
      console.log(`   ❓❓  Routes: ${config.routes.length}`);
      config.routes.forEach((route, idx) => {
        console.log(`      ${idx + 1}. ${route.pattern || route} (zone: ${route.zone_name || 'default'})`);
      });
    }
  } catch (error) {
    issues.push(`Failed to parse wrangler.toml: ${error.message}`);
    console.error(`   ❌ Failed to parse wrangler.toml: ${error.message}`);
  }
}

// Check for package.json
const packageJsonPath = join(fullPath, 'package.json');
if (existsSync(packageJsonPath)) {
  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    info.packageName = packageJson.name;
    info.hasDeployScript = !!(packageJson.scripts && packageJson.scripts.deploy);
    console.log(`   📦 Package: ${packageJson.name || 'Not specified'}`);
    console.log(`   ${info.hasDeployScript ? '✅' : '⚠️ '} Deploy script: ${info.hasDeployScript ? 'Found' : 'Missing'}`);
  } catch (error) {
    issues.push(`Failed to parse package.json: ${error.message}`);
    console.error(`   ❌ Failed to parse package.json: ${error.message}`);
  }
} else {
  console.log(`   ⚠️  No package.json found (optional)`);
}

console.log('');

if (issues.length === 0) {
  console.log('✅ Service validation passed! Ready to deploy.\n');
  process.exit(0);
} else {
  console.error('❌ Service validation failed with the following issues:');
  issues.forEach(issue => {
    console.error(`   • ${issue}`);
  });
  console.error('');
  process.exit(1);
}

