#!/usr/bin/env node
/**
 * Update Version Badge in README.md
 * 
 * This script reads the version from package.json and updates
 * the version badge in README.md automatically.
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Read package.json
const packageJsonPath = join(rootDir, 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
const version = packageJson.version;

if (!version) {
  console.error('❌ No version found in package.json');
  process.exit(1);
}

console.log(`📦 Current version: ${version}`);

// Read README.md
const readmePath = join(rootDir, 'README.md');
let readmeContent = readFileSync(readmePath, 'utf-8');

// Pattern to match the version badge
// Matches: ![Version](https://img.shields.io/badge/version-X.X.X-blue?style=for-the-badge&logo=github)
const badgePattern = /!\[Version\]\(https:\/\/img\.shields\.io\/badge\/version-[0-9.]+-blue\?style=for-the-badge&logo=github\)/g;

// Check if badge exists
if (!badgePattern.test(readmeContent)) {
  console.error('❌ Version badge not found in README.md');
  console.error('   Expected pattern: ![Version](https://img.shields.io/badge/version-X.X.X-blue?style=for-the-badge&logo=github)');
  process.exit(1);
}

// Replace the version in the badge
const newBadge = `![Version](https://img.shields.io/badge/version-${version}-blue?style=for-the-badge&logo=github)`;
const updatedContent = readmeContent.replace(badgePattern, newBadge);

// Check if content actually changed
if (readmeContent === updatedContent) {
  console.log('ℹ️  Version badge already up to date');
  process.exit(0);
}

// Write updated README.md
writeFileSync(readmePath, updatedContent, 'utf-8');
console.log(`✅ Updated version badge to ${version}`);

