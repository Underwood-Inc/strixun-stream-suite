#!/usr/bin/env node
/**
 * Deploy All Workers Script
 * 
 * Deploys all Cloudflare Workers in the serverless directory sequentially.
 * This ensures proper deployment order and provides clear feedback.
 */

import { execSync, spawn } from 'child_process';
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

/**
 * Execute command with timeout and progress logging
 */
function execWithTimeout(command, options, timeoutMs = 600000) { // 10 minutes default
  return new Promise((resolve, reject) => {
    console.log(`   ⏱️  Timeout: ${timeoutMs / 1000 / 60} minutes`);
    console.log(`   🚀 Starting command...\n`);
    
    const startTime = Date.now();
    let lastProgressLog = startTime;
    
    // Use shell: true for complex commands like "pnpm run deploy"
    // When using shell: true, pass command as first arg, options as second
    const child = spawn(command, [], {
      ...options,
      shell: true,
      stdio: 'inherit',
    });
    
    // Progress logging every 30 seconds
    const progressInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      console.log(`   ⏳ Still building... (${minutes}m ${seconds}s elapsed)`);
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
        console.log(`\n   ✅ Command completed in ${minutes}m ${seconds}s`);
        resolve();
      } else {
        reject(new Error(`Command exited with code ${code}${signal ? ` (signal: ${signal})` : ''} after ${minutes}m ${seconds}s`));
      }
    });
  });
}

async function deployAll() {
  for (const service of services) {
    const servicePath = join(__dirname, service.path);
    
    console.log(`\n📦 Deploying ${service.name}...`);
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
}

// Run deployment
deployAll().then(() => {
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
}).catch((error) => {
  console.error('❌ Fatal error during deployment:', error);
  process.exit(1);
});


