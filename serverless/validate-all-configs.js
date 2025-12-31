#!/usr/bin/env node
/**
 * Validate all worker wrangler.toml configurations
 * Checks for:
 * - Valid TOML syntax
 * - Required fields (name, main)
 * - Default KV namespace bindings (for dashboard-configured routes)
 * - Environment configurations
 * - Consistency across environments
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse } from '@iarna/toml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const workers = [
  { name: 'otp-auth-service', path: 'otp-auth-service', expectedKVs: ['OTP_AUTH_KV'] },
  { name: 'mods-api', path: 'mods-api', expectedKVs: ['MODS_KV', 'OTP_AUTH_KV'], expectedR2: ['MODS_R2'] },
  { name: 'customer-api', path: 'customer-api', expectedKVs: ['CUSTOMER_KV'] },
  { name: 'game-api', path: 'game-api', expectedKVs: ['GAME_KV'] },
  { name: 'twitch-api', path: 'twitch-api', expectedKVs: ['TWITCH_CACHE'] },
  { name: 'url-shortener', path: 'url-shortener', expectedKVs: ['URL_KV', 'ANALYTICS_KV'] },
  { name: 'chat-signaling', path: 'chat-signaling', expectedKVs: ['CHAT_KV'] },
];

let totalIssues = 0;
let totalWarnings = 0;

console.log('ℹ all worker configurations...\n');

for (const worker of workers) {
  const workerPath = join(rootDir, 'serverless', worker.path);
  const wranglerPath = join(workerPath, 'wrangler.toml');
  
  console.log(` ★ ${worker.name}`);
  console.log(`   Path: ${worker.path}`);
  
  const issues = [];
  const warnings = [];
  
  // Check if wrangler.toml exists
  if (!existsSync(wranglerPath)) {
    issues.push(`Missing wrangler.toml at ${wranglerPath}`);
    console.log(`   ✗ Missing wrangler.toml\n`);
    totalIssues++;
    continue;
  }
  
  // Parse and validate TOML
  let config;
  try {
    let tomlContent = readFileSync(wranglerPath, 'utf-8');
    // Remove BOM and any invalid characters at the start
    tomlContent = tomlContent.replace(/^\uFEFF/, '').replace(/^\uFFFD/, '').trim();
    if (tomlContent.charCodeAt(0) === 0xFEFF || tomlContent.charCodeAt(0) === 0xFFFD) {
      tomlContent = tomlContent.slice(1);
    }
    config = parse(tomlContent);
  } catch (error) {
    issues.push(`Failed to parse wrangler.toml: ${error.message}`);
    console.log(`   ✗ Invalid TOML: ${error.message}\n`);
    totalIssues++;
    continue;
  }
  
  // Check required fields
  if (!config.name) {
    issues.push('Missing required field: name');
  } else {
    console.log(`   ✓ Name: ${config.name}`);
  }
  
  if (!config.main) {
    issues.push('Missing required field: main');
  } else {
    const mainPath = join(workerPath, config.main);
    if (!existsSync(mainPath)) {
      issues.push(`Main file does not exist: ${config.main}`);
      console.log(`   ✗ Main file missing: ${config.main}`);
    } else {
      console.log(`   ✓ Main: ${config.main}`);
    }
  }
  
  // Check for default KV namespaces (root level)
  const rootKVs = config.kv_namespaces || [];
  const rootKVBindings = rootKVs.map(ns => ns.binding).filter(Boolean);
  
  console.log(` ★ Default KV Namespaces: ${rootKVs.length}`);
  
  // Check each expected KV exists at root level
  for (const expectedKV of worker.expectedKVs) {
    const kv = rootKVs.find(ns => ns.binding === expectedKV);
    if (!kv) {
      issues.push(`Missing default KV namespace binding: ${expectedKV}`);
      console.log(`   ✗ Missing default KV: ${expectedKV}`);
    } else if (!kv.id) {
      issues.push(`KV namespace ${expectedKV} missing id`);
      console.log(`   ✗ KV ${expectedKV} missing id`);
    } else {
      console.log(`   ✓ Default KV: ${expectedKV} (${kv.id})`);
    }
  }
  
  // Check for unexpected KV namespaces at root
  for (const kv of rootKVs) {
    if (kv.binding && !worker.expectedKVs.includes(kv.binding)) {
      warnings.push(`Unexpected default KV namespace: ${kv.binding}`);
      console.log(`   ⚠  Unexpected KV: ${kv.binding}`);
    }
  }
  
  // Check for R2 buckets if expected
  if (worker.expectedR2) {
    const rootR2 = config.r2_buckets || [];
    console.log(` ★ Default R2 Buckets: ${rootR2.length}`);
    
    for (const expectedR2 of worker.expectedR2) {
      const r2 = rootR2.find(b => b.binding === expectedR2);
      if (!r2) {
        issues.push(`Missing default R2 bucket binding: ${expectedR2}`);
        console.log(`   ✗ Missing default R2: ${expectedR2}`);
      } else {
        console.log(`   ✓ Default R2: ${expectedR2} (${r2.bucket_name || 'N/A'})`);
      }
    }
  }
  
  // Check environment configurations
  const hasProduction = !!config['env.production'];
  const hasDevelopment = !!config['env.development'];
  
  console.log(` ★ Environments: ${hasProduction ? '✓ production' : '✗ production'} ${hasDevelopment ? '✓ development' : '⚠  development'}`);
  
  if (hasProduction) {
    const prodKVs = config['env.production']?.kv_namespaces || [];
    console.log(`      Production KV namespaces: ${prodKVs.length}`);
  }
  
  if (hasDevelopment) {
    const devKVs = config['env.development']?.kv_namespaces || [];
    console.log(`      Development KV namespaces: ${devKVs.length}`);
  }
  
  // Check for routes
  const routes = config.routes || [];
  if (routes.length > 0) {
    console.log(` ★ ️  Default routes: ${routes.length}`);
    routes.forEach((route, idx) => {
      const pattern = typeof route === 'string' ? route : route.pattern;
      console.log(`      ${idx + 1}. ${pattern}`);
    });
  } else {
    warnings.push('No default routes configured (routes may be in dashboard)');
    console.log(`   ⚠  No default routes (may be in dashboard)`);
  }
  
  // Summary for this worker
  if (issues.length > 0) {
    console.log(`   ✗ Issues found: ${issues.length}`);
    issues.forEach(issue => console.log(`      - ${issue}`));
    totalIssues += issues.length;
  }
  
  if (warnings.length > 0) {
    console.log(`   ⚠  Warnings: ${warnings.length}`);
    warnings.forEach(warning => console.log(`      - ${warning}`));
    totalWarnings += warnings.length;
  }
  
  if (issues.length === 0 && warnings.length === 0) {
    console.log(`   ✓ All checks passed`);
  }
  
  console.log('');
}

// Final summary
console.log(' ★ Validation Summary:');
console.log(`   Total Issues: ${totalIssues}`);
console.log(`   Total Warnings: ${totalWarnings}`);

if (totalIssues === 0 && totalWarnings === 0) {
  console.log('\n✓ All worker configurations are valid!');
  process.exit(0);
} else if (totalIssues === 0) {
  console.log('\n⚠  All configurations are valid, but some warnings were found.');
  process.exit(0);
} else {
  console.log('\n✗ Some configurations have issues that need to be fixed.');
  process.exit(1);
}

