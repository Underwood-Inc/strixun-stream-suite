#!/usr/bin/env node
/**
 * Deploy All Workers Script
 * 
 * Deploys all Cloudflare Workers in the serverless directory sequentially.
 * This ensures proper deployment order and provides clear feedback.
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const services = [
  { name: 'Twitch API', path: '.', worker: 'strixun-twitch-api', command: 'wrangler deploy' },
  { name: 'OTP Auth Service', path: 'otp-auth-service', worker: 'otp-auth-service', command: 'pnpm run deploy' },
  { name: 'URL Shortener', path: 'url-shortener', worker: 'strixun-url-shortener', command: 'wrangler deploy' },
  { name: 'Chat Signaling', path: 'chat-signaling', worker: 'strixun-chat-signaling', command: 'wrangler deploy' },
];

console.log('🚀 Deploying All Cloudflare Workers\n');
console.log(`Found ${services.length} services to deploy:\n`);
services.forEach((service, index) => {
  console.log(`  ${index + 1}. ${service.name} (${service.worker})`);
});
console.log('');

let successCount = 0;
let failCount = 0;
const results = [];

for (const service of services) {
  const servicePath = join(__dirname, service.path);
  
  console.log(`\n📦 Deploying ${service.name}...`);
  console.log(`   Path: ${servicePath}`);
  console.log(`   Worker: ${service.worker}`);
  
  try {
    execSync(service.command || 'wrangler deploy', {
      cwd: servicePath,
      stdio: 'inherit',
      encoding: 'utf-8',
    });
    
    console.log(`✅ ${service.name} deployed successfully!`);
    successCount++;
    results.push({ service: service.name, status: 'success' });
  } catch (error) {
    console.error(`❌ ${service.name} deployment failed!`);
    console.error(`   Error: ${error.message}`);
    failCount++;
    results.push({ service: service.name, status: 'failed', error: error.message });
    
    // Ask if user wants to continue
    console.log(`\n⚠️  Continuing with remaining services...`);
  }
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 Deployment Summary');
console.log('='.repeat(60));
console.log(`✅ Successful: ${successCount}`);
console.log(`❌ Failed: ${failCount}`);
console.log(`📦 Total: ${services.length}\n`);

if (failCount > 0) {
  console.log('Failed services:');
  results
    .filter(r => r.status === 'failed')
    .forEach(r => {
      console.log(`  ❌ ${r.service}`);
    });
  console.log('');
}

if (failCount === 0) {
  console.log('🎉 All services deployed successfully!\n');
  process.exit(0);
} else {
  console.log('⚠️  Some deployments failed. Check the errors above.\n');
  process.exit(1);
}

