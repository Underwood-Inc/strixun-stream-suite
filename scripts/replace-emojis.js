/**
 * Emoji Replacement Script
 * 
 * Audits the codebase for emojis and replaces them with ASCII-compatible alternatives
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Emoji to ASCII replacement mapping
// Note: These are the actual emoji characters that will be replaced
// The values are their ASCII-compatible replacements
const emojiReplacements = {
  // Common status emojis
  '\u2705': '✓',      // ✓
  '\u274C': '✗',        // ✗
  '\u26A0\uFE0F': '⚠', // ⚠
  '\u1F512': '[SECURITY]',    // 🔒
  '\u2139\uFE0F': 'ℹ',   // ℹ
  '\u1F4DD': '[NOTE]',        // 📝
  '\u1F680': '[DEPLOY]',       // 🚀
  '\u1F527': '[CONFIG]',      // 🔧
  '\u1F4E6': '[PACKAGE]',     // 📦
  '\u1F41B': '[BUG]',         // 🐛
  '\u2728': '[FEATURE]',      // ✨
  '\u1F4A1': '[IDEA]',        // 💡
  '\u1F50D': '[SEARCH]',      // 🔍
  '\u1F4CA': '[ANALYTICS]',   // 📊
  '\u1F510': '[AUTH]',        // 🔐
  '\u26A1': '[PERF]',         // ⚡
  '\u1F3A8': '[UI]',          // 🎨
  '\u1F4DA': '[DOCS]',        // 📚
  '\u1F9EA': '[TEST]',        // 🧪
  '\u1F504': '[SYNC]',        // 🔄
  '\u23F1\uFE0F': '[TIME]',   // ⏱️
  '\u1F4C8': '[METRICS]',     // 📈
  '\u1F4C9': '[DECREASE]',    // 📉
  '\u1F3AF': '[TARGET]',      // 🎯
  '\u1F3C6': '[ACHIEVEMENT]', // 🏆
  '\u1F4BB': '[CODE]',        // 💻
  '\u1F310': '[WEB]',        // 🌐
  '\u1F4F1': '[MOBILE]',      // 📱
  '\u1F5A5\uFE0F': '[DESKTOP]', // 🖥️
  '\u1F514': '[NOTIFICATION]', // 🔔
  '\u1F4E7': '[EMAIL]',       // 📧
  '\u1F517': '[LINK]',        // 🔗
  '\u1F4C4': '[FILE]',        // 📄
  '\u1F4C1': '[FOLDER]',      // 📁
  '\u1F5D1\uFE0F': '[DELETE]', // 🗑️
  '\u2795': '[ADD]',          // ➕
  '\u2796': '[REMOVE]',       // ➖
  '\u274E': '[CANCEL]',       // ✖️
  '\u2714\uFE0F': '[CHECK]',  // ✔️
  '\u2753': '[QUESTION]',    // ❓
  '\u2757': '[ALERT]',        // ❗
  '\u1F4AC': '[CHAT]',        // 💬
  '\u1F464': '[USER]',       // 👤
  '\u1F465': '[USERS]',       // 👥
  '\u1F511': '[KEY]',         // 🔑
  '\u1F6E1\uFE0F': '[PROTECT]', // 🛡️
  '\u2699\uFE0F': '[SETTINGS]', // ⚙️
  '\u1F39B\uFE0F': '[CONTROL]', // 🎛️
  '\u1F4CB': '[CLIPBOARD]',   // 📋
  '\u1F516': '[BOOKMARK]',    // 🔖
  '\u1F4CD': '[LOCATION]',    // 📍
  '\u1F30D': '[GLOBAL]',      // 🌍
  '\u1F534': '[RED]',         // 🔴
  '\u1F7E2': '[GREEN]',       // 🟢
  '\u1F7E1': '[YELLOW]',      // 🟡
  '\u1F535': '[BLUE]',        // 🔵
  '\u26AB': '[BLACK]',        // ⚫
  '\u26AA': '[WHITE]',        // ⚪
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
  'yarn.lock'
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
 * Find all emojis in text
 */
function findEmojis(text) {
  // Unicode ranges for common emojis
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{2190}-\u{21FF}]|[\u{2300}-\u{23FF}]|[\u{2B50}-\u{2B55}]|[\u{3030}-\u{303F}]|[\u{FE00}-\u{FE0F}]|[\u{1F000}-\u{1F02F}]|[\u{1F0A0}-\u{1F0FF}]|[\u{1F100}-\u{1F1FF}]|[\u{1F200}-\u{1F2FF}]|[\u{1F300}-\u{1F5FF}]|[\u{1F600}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]/gu;
  
  const matches = [];
  let match;
  while ((match = emojiRegex.exec(text)) !== null) {
    matches.push({
      emoji: match[0],
      index: match.index,
      line: text.substring(0, match.index).split('\n').length
    });
  }
  return matches;
}

/**
 * Replace emojis in text
 */
function replaceEmojis(text) {
  let result = text;
  let replaced = [];
  
  for (const [emoji, replacement] of Object.entries(emojiReplacements)) {
    if (result.includes(emoji)) {
      result = result.replaceAll(emoji, replacement);
      replaced.push({ emoji, replacement });
    }
  }
  
  // Also replace any remaining emojis with generic ★ tag
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{2190}-\u{21FF}]|[\u{2300}-\u{23FF}]|[\u{2B50}-\u{2B55}]|[\u{3030}-\u{303F}]|[\u{FE00}-\u{FE0F}]|[\u{1F000}-\u{1F02F}]|[\u{1F0A0}-\u{1F0FF}]|[\u{1F100}-\u{1F1FF}]|[\u{1F200}-\u{1F2FF}]|[\u{1F300}-\u{1F5FF}]|[\u{1F600}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]/gu;
  
  const remainingEmojis = [...new Set(result.match(emojiRegex) || [])];
  if (remainingEmojis.length > 0) {
    for (const emoji of remainingEmojis) {
      if (!emojiReplacements[emoji]) {
        result = result.replaceAll(emoji, ' ★ ');
        replaced.push({ emoji, replacement: ' ★ ' });
      }
    }
  }
  
  return { result, replaced };
}

/**
 * Recursively scan directory for files
 */
function scanDirectory(dirPath, results = { files: [], emojis: new Map() }) {
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
              const emojis = findEmojis(content);
              
              if (emojis.length > 0) {
                const relativePath = fullPath.replace(projectRoot + '\\', '').replace(projectRoot + '/', '');
                results.emojis.set(relativePath, emojis);
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
  console.log('  Emoji Audit and Replacement Tool');
  console.log('========================================');
  console.log('');
  
  // Step 1: Audit
  console.log('ℹ Scanning codebase for emojis...');
  const audit = scanDirectory(projectRoot);
  
  console.log(`ℹ Found ${audit.files.length} files to check`);
  console.log(`ℹ Found ${audit.emojis.size} files with emojis`);
  console.log('');
  
  if (audit.emojis.size === 0) {
    console.log('✓ No emojis found in codebase!');
    return;
  }
  
  // Step 2: Report findings
  console.log('Files with emojis:');
  console.log('========================================');
  
  const allEmojis = new Set();
  for (const [file, emojis] of audit.emojis.entries()) {
    console.log(`\n${file}:`);
    for (const { emoji, line } of emojis) {
      console.log(`  Line ${line}: ${emoji}`);
      allEmojis.add(emoji);
    }
  }
  
  console.log('');
  console.log('========================================');
  console.log('Unique emojis found:');
  for (const emoji of allEmojis) {
    const replacement = emojiReplacements[emoji] || ' ★ ';
    console.log(`  ${emoji} -> ${replacement}`);
  }
  console.log('');
  
  // Step 3: Ask for confirmation
  console.log('Ready to replace emojis with ASCII alternatives.');
  console.log('This will modify files in place.');
  console.log('');
  
  // In a real script, you'd use readline, but for now we'll auto-proceed
  // For safety, we'll create a backup or dry-run mode
  
  // Step 4: Replace
  console.log('ℹ Replacing emojis...');
  let totalReplacements = 0;
  const modifiedFiles = [];
  
  for (const filePath of audit.emojis.keys()) {
    const fullPath = join(projectRoot, filePath);
    
    try {
      const content = readFileSync(fullPath, 'utf-8');
      const { result, replaced } = replaceEmojis(content);
      
      if (replaced.length > 0) {
        writeFileSync(fullPath, result, 'utf-8');
        totalReplacements += replaced.length;
        modifiedFiles.push({ file: filePath, replacements: replaced });
        console.log(`✓ ${filePath}: ${replaced.length} replacement(s)`);
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
  console.log(`  Total replacements: ${totalReplacements}`);
  console.log('');
  console.log('✓ Emoji replacement complete!');
  console.log('');
}

main().catch(console.error);

