#!/usr/bin/env node
/**
 * List Documentation Files That Can Be Removed After Wiki Migration
 * 
 * After migrating docs to the wiki, run this script to see which files
 * in the codebase can be safely removed (they're now in the wiki).
 * 
 * Usage:
 *   pnpm run list-migrated-docs
 */

import { readdirSync, statSync, existsSync } from 'fs';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Same directories and patterns as migration script
const DOC_DIRS = [
  'docs',
  'product-docs',
  'serverless',
  'mods-hub',
  'shared-components',
];

const SKIP_PATTERNS = [
  /^node_modules/,
  /^\.git/,
  /^dist/,
  /^\.changeset/,
  /^\.wiki-temp/,
  /CHANGELOG\.md$/i,
  /^README\.md$/i, // Keep README files
];

function findMarkdownFiles(dir, baseDir = rootDir) {
  const files = [];
  
  try {
    if (!existsSync(dir) || !statSync(dir).isDirectory()) {
      return files;
    }
    
    const entries = readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relativePath = relative(baseDir, fullPath);
      
      if (SKIP_PATTERNS.some(pattern => pattern.test(relativePath) || pattern.test(entry.name))) {
        continue;
      }
      
      if (entry.isDirectory()) {
        files.push(...findMarkdownFiles(fullPath, baseDir));
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    // Skip
  }
  
  return files;
}

function main() {
  console.log('[CLIPBOARD] Finding documentation files that can be removed after wiki migration...\n');
  
  const allFiles = [];
  
  for (const dir of DOC_DIRS) {
    const fullPath = join(rootDir, dir);
    if (existsSync(fullPath) && statSync(fullPath).isDirectory()) {
      const files = findMarkdownFiles(fullPath);
      allFiles.push(...files);
    }
  }
  
  console.log(`Found ${allFiles.length} documentation files:\n`);
  
  // Group by directory
  const byDir = {};
  
  for (const file of allFiles) {
    const relPath = relative(rootDir, file);
    const dir = dirname(relPath);
    if (!byDir[dir]) {
      byDir[dir] = [];
    }
    byDir[dir].push(relPath);
  }
  
  // Print organized list
  for (const [dir, files] of Object.entries(byDir).sort()) {
    console.log(`[FOLDER] ${dir}/`);
    for (const file of files.sort()) {
      console.log(`   - ${file}`);
    }
    console.log('');
  }
  
  console.log(`\n[FEATURE] Total: ${allFiles.length} files`);
  console.log(`\n[IDEA] These files can be removed from the codebase after verifying they're in the wiki.`);
  console.log(`   Keep only README.md files (needed for GitHub repo display).`);
}

main();


