#!/usr/bin/env node
/**
 * Fix encoding of wrangler.toml files
 * Converts UTF-16 LE to UTF-8 without BOM
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const workers = [
  'otp-auth-service',
  'mods-api',
  'customer-api',
  'game-api',
  'twitch-api',
  'url-shortener',
  'chat-signaling',
];

console.log('🔧 Converting wrangler.toml files from UTF-16 LE to UTF-8...\n');

let convertedCount = 0;
let skippedCount = 0;

for (const worker of workers) {
  const wranglerPath = join(rootDir, 'serverless', worker, 'wrangler.toml');
  
  try {
    // Read as buffer to detect encoding
    const buffer = readFileSync(wranglerPath);
    
    // Check if it's UTF-16 LE (starts with 0xFF 0xFE)
    const isUTF16LE = buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE;
    
    if (isUTF16LE) {
      console.log(`📦 ${worker}: Converting from UTF-16 LE to UTF-8...`);
      
      // Convert UTF-16 LE to string, then write as UTF-8
      const content = buffer.toString('utf16le');
      writeFileSync(wranglerPath, content, 'utf8');
      
      console.log(`   ✅ Converted successfully`);
      convertedCount++;
    } else {
      // Check if it's already UTF-8 but might have BOM
      const isUTF8BOM = buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF;
      
      if (isUTF8BOM) {
        console.log(`📦 ${worker}: Removing UTF-8 BOM...`);
        const content = buffer.toString('utf8').replace(/^\uFEFF/, '');
        writeFileSync(wranglerPath, content, 'utf8');
        console.log(`   ✅ BOM removed`);
        convertedCount++;
      } else {
        // Try to read as UTF-8 to see if it's already correct
        try {
          const testContent = buffer.toString('utf8');
          // If it parses fine, it's probably already UTF-8
          console.log(`📦 ${worker}: Already UTF-8 (skipping)`);
          skippedCount++;
        } catch (error) {
          // If it fails, try to convert anyway
          console.log(`📦 ${worker}: Unknown encoding, attempting conversion...`);
          const content = buffer.toString('utf16le');
          writeFileSync(wranglerPath, content, 'utf8');
          console.log(`   ✅ Converted`);
          convertedCount++;
        }
      }
    }
  } catch (error) {
    console.error(`   ❌ ${worker}: Failed to convert - ${error.message}`);
  }
}

console.log('\n📊 Conversion Summary:');
console.log(`   ✅ Converted: ${convertedCount}`);
console.log(`   ⏭️  Skipped: ${skippedCount}`);

if (convertedCount > 0) {
  console.log('\n✅ All files converted! You can now run: pnpm validate:all');
} else {
  console.log('\n✅ All files are already in the correct encoding!');
}

