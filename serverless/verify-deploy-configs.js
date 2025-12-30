#!/usr/bin/env node
/**
 * Verify all worker configurations match what wrangler reports
 * Runs dry-run deploys and compares expected vs actual bindings
 */

import { execSync } from 'child_process';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const workers = [
  {
    name: 'otp-auth-service',
    path: 'otp-auth-service',
    expectedKVs: ['OTP_AUTH_KV'],
    expectedR2: [],
  },
  {
    name: 'mods-api',
    path: 'mods-api',
    expectedKVs: ['MODS_KV', 'OTP_AUTH_KV'],
    expectedR2: ['MODS_R2'],
  },
  {
    name: 'customer-api',
    path: 'customer-api',
    expectedKVs: ['CUSTOMER_KV'],
    expectedR2: [],
  },
  {
    name: 'game-api',
    path: 'game-api',
    expectedKVs: ['GAME_KV'],
    expectedR2: [],
  },
  {
    name: 'twitch-api',
    path: 'twitch-api',
    expectedKVs: ['TWITCH_CACHE'],
    expectedR2: [],
  },
  {
    name: 'url-shortener',
    path: 'url-shortener',
    expectedKVs: ['URL_KV', 'ANALYTICS_KV'],
    expectedR2: [],
  },
  {
    name: 'chat-signaling',
    path: 'chat-signaling',
    expectedKVs: ['CHAT_KV'],
    expectedR2: [],
  },
];

console.log('🔍 Verifying worker configurations match wrangler deploy output...\n');

let allMatch = true;

for (const worker of workers) {
  const workerPath = join(rootDir, 'serverless', worker.path);
  
  console.log(`📦 ${worker.name}`);
  
  try {
    const output = execSync('pnpm exec wrangler deploy --dry-run --env=""', {
      cwd: workerPath,
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    
    // Extract bindings from output
    const bindingsSection = output.match(/Your Worker has access to the following bindings:([\s\S]*?)(?:\n\n|--dry-run|Total Upload)/);
    if (!bindingsSection) {
      console.log(`   ⚠️  Could not parse bindings from output`);
      allMatch = false;
      continue;
    }
    
    const bindingsText = bindingsSection[1];
    const kvBindings = [];
    const r2Bindings = [];
    
    // Parse KV bindings
    const kvMatches = bindingsText.matchAll(/env\.(\w+)\s+\(([^)]+)\)\s+KV Namespace/g);
    for (const match of kvMatches) {
      kvBindings.push({ name: match[1], id: match[2] });
    }
    
    // Parse R2 bindings
    const r2Matches = bindingsText.matchAll(/env\.(\w+)\s+\(([^)]+)\)\s+R2 Bucket/g);
    for (const match of r2Matches) {
      r2Bindings.push({ name: match[1], bucket: match[2] });
    }
    
    // Check KV bindings
    const foundKVNames = kvBindings.map(b => b.name);
    const missingKVs = worker.expectedKVs.filter(kv => !foundKVNames.includes(kv));
    const extraKVs = foundKVNames.filter(kv => !worker.expectedKVs.includes(kv));
    
    // Check R2 bindings
    const foundR2Names = r2Bindings.map(b => b.name);
    const missingR2 = worker.expectedR2.filter(r2 => !foundR2Names.includes(r2));
    const extraR2 = foundR2Names.filter(r2 => !worker.expectedR2.includes(r2));
    
    // Report results
    let workerMatch = true;
    
    if (missingKVs.length > 0) {
      console.log(`   ❌ Missing KV bindings: ${missingKVs.join(', ')}`);
      workerMatch = false;
    }
    
    if (extraKVs.length > 0) {
      console.log(`   ⚠️  Unexpected KV bindings: ${extraKVs.join(', ')}`);
    }
    
    if (missingR2.length > 0) {
      console.log(`   ❌ Missing R2 bindings: ${missingR2.join(', ')}`);
      workerMatch = false;
    }
    
    if (extraR2.length > 0) {
      console.log(`   ⚠️  Unexpected R2 bindings: ${extraR2.join(', ')}`);
    }
    
    if (workerMatch && extraKVs.length === 0 && extraR2.length === 0) {
      console.log(`   ✅ All bindings match expected configuration`);
      console.log(`      KV: ${foundKVNames.join(', ')}`);
      if (foundR2Names.length > 0) {
        console.log(`      R2: ${foundR2Names.join(', ')}`);
      }
    } else if (workerMatch) {
      console.log(`   ⚠️  Bindings present but some unexpected ones found`);
      console.log(`      KV: ${foundKVNames.join(', ')}`);
      if (foundR2Names.length > 0) {
        console.log(`      R2: ${foundR2Names.join(', ')}`);
      }
    }
    
    if (!workerMatch) {
      allMatch = false;
    }
    
  } catch (error) {
    const errorOutput = error.stdout || error.stderr || error.message;
    // Check if it's just a warning about routes (which we can ignore)
    if (errorOutput.includes('Unexpected fields found') && errorOutput.includes('routes')) {
      console.log(`   ⚠️  TOML parsing warning (routes field) - but continuing...`);
      // Try to extract bindings anyway
      try {
        const output = error.stdout || '';
        const bindingsSection = output.match(/Your Worker has access to the following bindings:([\s\S]*?)(?:\n\n|--dry-run|Total Upload)/);
        if (bindingsSection) {
          const bindingsText = bindingsSection[1];
          const kvMatches = bindingsText.matchAll(/env\.(\w+)\s+\(([^)]+)\)\s+KV Namespace/g);
          const foundKVNames = Array.from(kvMatches, m => m[1]);
          const missingKVs = worker.expectedKVs.filter(kv => !foundKVNames.includes(kv));
          
          if (missingKVs.length === 0) {
            console.log(`   ✅ All expected KV bindings found: ${foundKVNames.join(', ')}`);
          } else {
            console.log(`   ❌ Missing KV bindings: ${missingKVs.join(', ')}`);
            allMatch = false;
          }
        }
      } catch (e) {
        console.log(`   ❌ Failed to parse output: ${error.message}`);
        allMatch = false;
      }
    } else {
      console.log(`   ❌ Validation failed: ${error.message}`);
      allMatch = false;
    }
  }
  
  console.log('');
}

if (allMatch) {
  console.log('✅ All worker configurations match expected bindings!');
  process.exit(0);
} else {
  console.log('❌ Some configurations do not match expected bindings.');
  process.exit(1);
}

