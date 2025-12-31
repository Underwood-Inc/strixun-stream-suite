/**
 * Fix Emojis Script
 * 
 * Systematically replaces all emojis with appropriate ASCII alternatives
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Comprehensive emoji to ASCII replacement mapping
const emojiReplacements = {
  // Question marks - remove or replace with arrows
  '\u2753': '',      // ❓ - remove (often used incorrectly)
  '\u2754': '',      // ❔ - remove
  '\u2049': '[!?]',  // ⁉️
  
  // Status indicators
  '\u2705': '[OK]',        // ✅
  '\u274C': '[ERROR]',     // ❌
  '\u26A0\uFE0F': '[WARNING]', // ⚠️
  '\u26A0': '[WARNING]',    // ⚠ (without variation selector)
  '\u1F512': '[SECURITY]', // 🔒
  '\u2139\uFE0F': '[INFO]', // ℹ️
  '\u2139': '[INFO]',      // ℹ (without variation selector)
  '\u1F4DD': '[NOTE]',      // 📝
  '\u1F680': '[DEPLOY]',   // 🚀
  '\u1F527': '[CONFIG]',   // 🔧
  '\u1F4E6': '[PACKAGE]',  // 📦
  '\u1F41B': '[BUG]',      // 🐛
  '\u2728': '[FEATURE]',   // ✨
  '\u1F4A1': '[IDEA]',     // 💡
  '\u1F50D': '[SEARCH]',   // 🔍
  '\u1F4CA': '[ANALYTICS]', // 📊
  '\u1F510': '[AUTH]',     // 🔐
  '\u26A1': '[PERF]',      // ⚡
  '\u1F3A8': '[UI]',       // 🎨
  '\u1F4DA': '[DOCS]',     // 📚
  '\u1F9EA': '[TEST]',     // 🧪
  '\u1F504': '[SYNC]',     // 🔄
  '\u23F1\uFE0F': '[TIME]', // ⏱️
  '\u23F1': '[TIME]',      // ⏱ (without variation selector)
  '\u1F4C8': '[METRICS]',  // 📈
  '\u1F4C9': '[DECREASE]', // 📉
  '\u1F3AF': '[TARGET]',   // 🎯
  '\u1F3C6': '[ACHIEVEMENT]', // 🏆
  '\u1F4BB': '[CODE]',     // 💻
  '\u1F310': '[WEB]',      // 🌐
  '\u1F4F1': '[MOBILE]',   // 📱
  '\u1F5A5\uFE0F': '[DESKTOP]', // 🖥️
  '\u1F5A5': '[DESKTOP]',  // 🖥 (without variation selector)
  '\u1F514': '[NOTIFICATION]', // 🔔
  '\u1F4E7': '[EMAIL]',    // 📧
  '\u1F517': '[LINK]',     // 🔗
  '\u1F4C4': '[FILE]',     // 📄
  '\u1F4C1': '[FOLDER]',  // 📁
  '\u1F5D1\uFE0F': '[DELETE]', // 🗑️
  '\u1F5D1': '[DELETE]',  // 🗑 (without variation selector)
  '\u2795': '[ADD]',       // ➕
  '\u2796': '[REMOVE]',    // ➖
  '\u274E': '[CANCEL]',    // ✖️
  '\u2714\uFE0F': '[CHECK]', // ✔️
  '\u2714': '[CHECK]',     // ✔ (without variation selector)
  '\u2757': '[ALERT]',     // ❗
  '\u1F4AC': '[CHAT]',     // 💬
  '\u1F464': '[USER]',     // 👤
  '\u1F465': '[USERS]',    // 👥
  '\u1F511': '[KEY]',      // 🔑
  '\u1F6E1\uFE0F': '[PROTECT]', // 🛡️
  '\u1F6E1': '[PROTECT]',  // 🛡 (without variation selector)
  '\u2699\uFE0F': '[SETTINGS]', // ⚙️
  '\u2699': '[SETTINGS]',  // ⚙ (without variation selector)
  '\u1F39B\uFE0F': '[CONTROL]', // 🎛️
  '\u1F39B': '[CONTROL]',  // 🎛 (without variation selector)
  '\u1F4CB': '[CLIPBOARD]', // 📋
  '\u1F516': '[BOOKMARK]', // 🔖
  '\u1F4CD': '[LOCATION]', // 📍
  '\u1F30D': '[GLOBAL]',   // 🌍
  '\u1F534': '[RED]',      // 🔴
  '\u1F7E2': '[GREEN]',    // 🟢
  '\u1F7E1': '[YELLOW]',   // 🟡
  '\u1F535': '[BLUE]',     // 🔵
  '\u26AB': '[BLACK]',     // ⚫
  '\u26AA': '[WHITE]',     // ⚪
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
  '.pnpm-store',
  '.changeset'
];

// Files to skip
const skipFiles = [
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
  'replace-emojis.js',
  'restore-emojis.js',
  'audit-emojis.js',
  'fix-emojis.js'
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
  return fileExtensions.includes(ext) || !ext;
}

/**
 * Replace emojis in text
 */
function replaceEmojis(text, filePath) {
  let result = text;
  const replacements = [];
  
  // Sort by length (longest first) to handle variation selectors correctly
  const sortedReplacements = Object.entries(emojiReplacements)
    .sort((a, b) => b[0].length - a[0].length);
  
  for (const [emoji, replacement] of sortedReplacements) {
    if (result.includes(emoji)) {
      const count = (result.match(new RegExp(emoji.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
      result = result.replaceAll(emoji, replacement);
      replacements.push({ emoji, replacement, count });
    }
  }
  
  // Also catch any remaining emojis with a comprehensive regex
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{2190}-\u{21FF}]|[\u{2300}-\u{23FF}]|[\u{2B50}-\u{2B55}]|[\u{3030}-\u{303F}]|[\u{FE00}-\u{FE0F}]|[\u{1F000}-\u{1F02F}]|[\u{1F0A0}-\u{1F0FF}]|[\u{1F100}-\u{1F1FF}]|[\u{1F200}-\u{1F2FF}]|[\u{1F300}-\u{1F5FF}]|[\u{1F600}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{2753}-\u{2754}]|[\u{2049}]|[\u{2139}]|[\u{26A0}]|[\u{2705}]|[\u{274C}]|[\u{2757}]|[\u{2728}]|[\u{26A1}]|[\u{2699}]|[\u{2714}]|[\u{274E}]|[\u{2795}]|[\u{2796}]|[\u{26AB}]|[\u{26AA}]/gu;
  
  const remainingEmojis = [...new Set(result.match(emojiRegex) || [])];
  if (remainingEmojis.length > 0) {
    for (const emoji of remainingEmojis) {
      // Skip if already in our replacement map (might be a variation)
      const isInMap = sortedReplacements.some(([e]) => e.includes(emoji) || emoji.includes(e));
      if (!isInMap) {
        result = result.replaceAll(emoji, '[EMOJI]');
        replacements.push({ emoji, replacement: '[EMOJI]', count: 1 });
      }
    }
  }
  
  return { result, replacements };
}

/**
 * Recursively scan and fix files
 */
function scanAndFix(dirPath, stats = { files: 0, fixed: 0, totalReplacements: 0 }) {
  try {
    const entries = readdirSync(dirPath);
    
    for (const entry of entries) {
      const fullPath = join(dirPath, entry);
      
      try {
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          if (!shouldSkipDir(entry)) {
            scanAndFix(fullPath, stats);
          }
        } else if (stat.isFile()) {
          if (!shouldSkipFile(entry) && shouldProcessFile(entry)) {
            stats.files++;
            
            try {
              const content = readFileSync(fullPath, 'utf-8');
              const { result, replacements } = replaceEmojis(content, fullPath);
              
              if (replacements.length > 0) {
                writeFileSync(fullPath, result, 'utf-8');
                stats.fixed++;
                const total = replacements.reduce((sum, r) => sum + r.count, 0);
                stats.totalReplacements += total;
                console.log(`[FIXED] ${fullPath.replace(projectRoot + '\\', '').replace(projectRoot + '/', '')}: ${total} replacement(s)`);
              }
            } catch (error) {
              if (error.code !== 'EISDIR' && error.code !== 'ENOENT') {
                console.warn(`[WARN] Could not process: ${fullPath}`);
              }
            }
          }
        }
      } catch (error) {
        // Skip files we can't access
      }
    }
  } catch (error) {
    // Skip directories we can't access
  }
  
  return stats;
}

/**
 * Main function
 */
async function main() {
  console.log('========================================');
  console.log('  Fix Emojis Script');
  console.log('========================================');
  console.log('');
  
  console.log('[INFO] Scanning and fixing emojis...');
  const stats = scanAndFix(projectRoot);
  
  console.log('');
  console.log('========================================');
  console.log('  Summary');
  console.log('========================================');
  console.log(`  Files scanned: ${stats.files}`);
  console.log(`  Files fixed: ${stats.fixed}`);
  console.log(`  Total replacements: ${stats.totalReplacements}`);
  console.log('');
  console.log('[SUCCESS] Emoji fixing complete!');
  console.log('');
}

main().catch(console.error);
