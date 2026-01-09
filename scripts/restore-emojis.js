/**
 * Emoji Restoration Script
 * 
 * Inverts the emoji replacement - restores ASCII text like ✓, ✗ back to emojis
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// ASCII to Emoji restoration mapping (inverted from replace-emojis.js)
// Note: These are the ASCII replacements that will be restored to emojis
const asciiToEmoji = {
  '✓': '✓',
  '✗': '✗',
  '⚠': '⚠',
  '[SECURITY]': '🔒',
  'ℹ': 'ℹ',
  '[NOTE]': '📝',
  '[DEPLOY]': '🚀',
  '[CONFIG]': '🔧',
  '[PACKAGE]': '📦',
  '[BUG]': '🐛',
  '[FEATURE]': '✨',
  '[IDEA]': '💡',
  '[SEARCH]': '🔍',
  '[ANALYTICS]': '📊',
  '[AUTH]': '🔐',
  '[PERF]': '⚡',
  '[UI]': '🎨',
  '[DOCS]': '📚',
  '[TEST]': '🧪',
  '[SYNC]': '🔄',
  '[TIME]': '⏱️',
  '[METRICS]': '📈',
  '[DECREASE]': '📉',
  '[TARGET]': '🎯',
  '[ACHIEVEMENT]': '🏆',
  '[CODE]': '💻',
  '[WEB]': '🌐',
  '[MOBILE]': '📱',
  '[DESKTOP]': '🖥️',
  '[NOTIFICATION]': '🔔',
  '[EMAIL]': '📧',
  '[LINK]': '🔗',
  '[FILE]': '📄',
  '[FOLDER]': '📁',
  '[DELETE]': '🗑️',
  '[ADD]': '➕',
  '[REMOVE]': '➖',
  '[CANCEL]': '✖️',
  '[CHECK]': '✔️',
  '[QUESTION]': '❓',
  '[ALERT]': '❗',
  '[CHAT]': '💬',
  '[USER]': '👤',
  '[USERS]': '👥',
  '[KEY]': '🔑',
  '[PROTECT]': '🛡️',
  '[SETTINGS]': '⚙️',
  '[CONTROL]': '🎛️',
  '[CLIPBOARD]': '📋',
  '[BOOKMARK]': '🔖',
  '[LOCATION]': '📍',
  '[GLOBAL]': '🌍',
  '[RED]': '🔴',
  '[GREEN]': '🟢',
  '[YELLOW]': '🟡',
  '[BLUE]': '🔵',
  '[BLACK]': '⚫',
  '[WHITE]': '⚪',
  ' ★ ': '❓', // Generic fallback - you may want to handle this differently
};

// File extensions to process
const fileExtensions = [
  '.ts', '.tsx', '.js', '.jsx', '.svelte', '.vue', '.html', '.md',
  '.ps1', '.sh', '.bash', '.py', '.lua', '.css', '.scss', '.json'
];

// Directories to skip
const skipDirs = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.svelte-kit',
  'storybook-static',
  '.wrangler',
  'coverage',
  '.turbo',
  '.pnpm-store'
];

// Files to skip
const skipFiles = [
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
  'replace-emojis.js', // Skip the original replacement script
  'restore-emojis.js'  // Skip this script itself
];

/**
 * Check if a directory should be skipped
 */
function shouldSkipDir(dirName) {
  return skipDirs.includes(dirName) || dirName.startsWith('.');
}

/**
 * Check if a file should be skipped
 */
function shouldSkipFile(fileName) {
  return skipFiles.includes(fileName) || fileName.startsWith('.');
}

/**
 * Check if file extension should be processed
 */
function shouldProcessFile(fileName) {
  const ext = extname(fileName);
  return fileExtensions.includes(ext) || !ext; // Include files without extensions
}

/**
 * Find all ASCII replacements in text
 */
function findAsciiReplacements(text) {
  const matches = [];
  const asciiPatterns = Object.keys(asciiToEmoji);
  
  for (const pattern of asciiPatterns) {
    const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    let match;
    while ((match = regex.exec(text)) !== null) {
      matches.push({
        ascii: match[0],
        index: match.index,
        line: text.substring(0, match.index).split('\n').length,
        emoji: asciiToEmoji[match[0]]
      });
    }
  }
  
  return matches;
}

/**
 * Replace ASCII text with emojis
 */
function restoreEmojis(text) {
  let result = text;
  let replaced = [];
  
  // Sort by length (longest first) to avoid partial matches
  const sortedPatterns = Object.keys(asciiToEmoji).sort((a, b) => b.length - a.length);
  
  for (const ascii of sortedPatterns) {
    const emoji = asciiToEmoji[ascii];
    if (result.includes(ascii)) {
      result = result.replaceAll(ascii, emoji);
      replaced.push({ ascii, emoji });
    }
  }
  
  return { result, replaced };
}

/**
 * Recursively scan directory for files
 */
function scanDirectory(dirPath, results = { files: [], replacements: new Map() }) {
  try {
    const entries = readdirSync(dirPath);
    
    for (const entry of entries) {
      const fullPath = join(dirPath, entry);
      
      try {
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          if (!shouldSkipDir(entry)) {
            scanDirectory(fullPath, results);
          }
        } else if (stat.isFile()) {
          if (!shouldSkipFile(entry) && shouldProcessFile(entry)) {
            results.files.push(fullPath);
            
            try {
              const content = readFileSync(fullPath, 'utf-8');
              const replacements = findAsciiReplacements(content);
              
              if (replacements.length > 0) {
                const relativePath = fullPath.replace(projectRoot + '\\', '').replace(projectRoot + '/', '');
                results.replacements.set(relativePath, replacements);
              }
            } catch (error) {
              // Skip binary files or files that can't be read
              if (error.code !== 'EISDIR') {
                console.warn(`⚠ Could not read file: ${fullPath}`);
              }
            }
          }
        }
      } catch (error) {
        // Skip files we can't access
        if (error.code !== 'ENOENT') {
          console.warn(`⚠ Could not access: ${fullPath}`);
        }
      }
    }
  } catch (error) {
    console.warn(`⚠ Could not scan directory: ${dirPath}`);
  }
  
  return results;
}

/**
 * Main function
 */
async function main() {
  console.log('========================================');
  console.log('  Emoji Restoration Tool');
  console.log('========================================');
  console.log('');
  
  // Step 1: Audit
  console.log('ℹ Scanning codebase for ASCII replacements...');
  const audit = scanDirectory(projectRoot);
  
  console.log(`ℹ Found ${audit.files.length} files to check`);
  console.log(`ℹ Found ${audit.replacements.size} files with ASCII replacements`);
  console.log('');
  
  if (audit.replacements.size === 0) {
    console.log('✓ No ASCII replacements found in codebase!');
    return;
  }
  
  // Step 2: Report findings
  console.log('Files with ASCII replacements:');
  console.log('========================================');
  
  const allReplacements = new Map();
  for (const [file, replacements] of audit.replacements.entries()) {
    console.log(`\n${file}:`);
    for (const { ascii, emoji, line } of replacements) {
      console.log(`  Line ${line}: ${ascii} -> ${emoji}`);
      if (!allReplacements.has(ascii)) {
        allReplacements.set(ascii, emoji);
      }
    }
  }
  
  console.log('');
  console.log('========================================');
  console.log('Unique replacements found:');
  for (const [ascii, emoji] of allReplacements.entries()) {
    console.log(`  ${ascii} -> ${emoji}`);
  }
  console.log('');
  
  // Step 3: Ask for confirmation
  console.log('Ready to restore emojis from ASCII replacements.');
  console.log('This will modify files in place.');
  console.log('');
  
  // Step 4: Replace
  console.log('ℹ Restoring emojis...');
  let totalReplacements = 0;
  const modifiedFiles = [];
  
  for (const filePath of audit.replacements.keys()) {
    const fullPath = join(projectRoot, filePath);
    
    try {
      const content = readFileSync(fullPath, 'utf-8');
      const { result, replaced } = restoreEmojis(content);
      
      if (replaced.length > 0) {
        writeFileSync(fullPath, result, 'utf-8');
        totalReplacements += replaced.length;
        modifiedFiles.push({ file: filePath, replacements: replaced });
        console.log(`✓ ${filePath}: ${replaced.length} restoration(s)`);
      }
    } catch (error) {
      console.error(`✗ Failed to process ${filePath}: ${error.message}`);
    }
  }
  
  console.log('');
  console.log('========================================');
  console.log('  Summary');
  console.log('========================================');
  console.log(`  Files modified: ${modifiedFiles.length}`);
  console.log(`  Total restorations: ${totalReplacements}`);
  console.log('');
  console.log('✓ Emoji restoration complete!');
  console.log('');
}

main().catch(console.error);

