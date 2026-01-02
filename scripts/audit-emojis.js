/**
 * Comprehensive Emoji Audit Script
 * 
 * Identifies all emojis in the codebase with context and suggests appropriate replacements
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Emoji to ASCII replacement mapping with context-aware suggestions
const emojiReplacements = {
  // Question marks - often used incorrectly
  '\u2753': '[?]',      // ❓
  '\u2754': '[?]',      // ❔
  '\u2049': '[!?]',     // ⁉️
  
  // Status indicators
  '\u2705': '✓',      // ✅
  '\u274C': '✗',        // ❌
  '\u26A0\uFE0F': '⚠', // ⚠️
  '\u1F512': '[SECURITY]',    // 🔒
  '\u2139\uFE0F': 'ℹ',   // ℹ️
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
  '\u2757': '[ALERT]',        // ❗
  '\u1F4AC': '[CHAT]',        // 💬
  '\u1F464': '[USER]',       // 👤
  '\u1F465': '[USERS]',       // 👥
  '\u1F511': '[KEY]',         // 🔑
  '\u1F6E1\uFE0F': '[PROTECT]', // 🛡️
  '\u2699\uFE0F': '[SETTINGS]', // ⚙️
  '\u1F39B\uFE0F': '[CONTROL]', // 🎛️
  '\u1F4CB': '[CLIPBOARD]',    // 📋
  '\u1F516': '[BOOKMARK]',     // 🔖
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
  'audit-emojis.js'
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
 * Find all emojis in text with context
 */
function findEmojisWithContext(text, filePath) {
  // Comprehensive emoji regex pattern
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{2190}-\u{21FF}]|[\u{2300}-\u{23FF}]|[\u{2B50}-\u{2B55}]|[\u{3030}-\u{303F}]|[\u{FE00}-\u{FE0F}]|[\u{1F000}-\u{1F02F}]|[\u{1F0A0}-\u{1F0FF}]|[\u{1F100}-\u{1F1FF}]|[\u{1F200}-\u{1F2FF}]|[\u{1F300}-\u{1F5FF}]|[\u{1F600}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{2753}-\u{2754}]|[\u{2049}]|[\u{2139}]|[\u{26A0}]|[\u{2705}]|[\u{274C}]|[\u{2757}]|[\u{2728}]|[\u{26A1}]|[\u{2699}]|[\u{2714}]|[\u{274E}]|[\u{2795}]|[\u{2796}]|[\u{26AB}]|[\u{26AA}]/gu;
  
  const matches = [];
  const lines = text.split('\n');
  
  lines.forEach((line, lineIndex) => {
    let match;
    const lineRegex = new RegExp(emojiRegex.source, 'gu');
    while ((match = lineRegex.exec(line)) !== null) {
      const emoji = match[0];
      const index = match.index;
      
      // Get context (20 chars before and after)
      const start = Math.max(0, index - 20);
      const end = Math.min(line.length, index + emoji.length + 20);
      const context = line.substring(start, end);
      
      // Determine if this is a problematic usage
      const isQuestionMark = emoji === '❓' || emoji === '❔' || emoji === '⁉️';
      const isInTemplateGuide = filePath.includes('TEMPLATE_GUIDE');
      const isInExample = context.includes('Instead of:') || context.includes('Example:');
      const isInCodeBlock = text.substring(0, text.indexOf(line)).split('```').length % 2 === 1;
      
      // Determine appropriate replacement
      let replacement = emojiReplacements[emoji] || ' ★ ';
      let issue = '';
      
      if (isQuestionMark && !isInCodeBlock) {
        issue = 'Question mark emoji used - should use [?] or remove if not needed';
        if (isInTemplateGuide) {
          issue += ' (CRITICAL: Template guide contradicts its own rules!)';
        }
      } else if (isInTemplateGuide && !isInCodeBlock) {
        issue = 'Emoji in template guide - contradicts ASCII-only rule';
      }
      
      matches.push({
        emoji,
        line: lineIndex + 1,
        column: index + 1,
        context: context.trim(),
        replacement,
        issue,
        fullLine: line.trim()
      });
    }
  });
  
  return matches;
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
              const emojis = findEmojisWithContext(content, fullPath);
              
              if (emojis.length > 0) {
                const relativePath = fullPath.replace(projectRoot + '\\', '').replace(projectRoot + '/', '');
                results.emojis.set(relativePath, emojis);
              }
            } catch (error) {
              // Skip binary files or files that can't be read
              if (error.code !== 'EISDIR' && error.code !== 'ENOENT') {
                console.warn(`⚠ Could not read file: ${fullPath}`);
              }
            }
          }
        }
      } catch (error) {
        // Skip files we can't access
        if (error.code !== 'ENOENT') {
          // Silently skip
        }
      }
    }
  } catch (error) {
    // Silently skip directories we can't access
  }
  
  return results;
}

/**
 * Main function
 */
async function main() {
  console.log('========================================');
  console.log('  Comprehensive Emoji Audit Tool');
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
  
  // Step 2: Categorize findings
  const problematicFiles = [];
  const questionMarkIssues = [];
  const templateGuideIssues = [];
  const allEmojis = new Map();
  
  for (const [file, emojis] of audit.emojis.entries()) {
    const fileIssues = emojis.filter(e => e.issue);
    if (fileIssues.length > 0) {
      problematicFiles.push({ file, emojis: fileIssues });
    }
    
    const qmIssues = emojis.filter(e => e.emoji === '❓' || e.emoji === '❔' || e.emoji === '⁉️');
    if (qmIssues.length > 0) {
      questionMarkIssues.push({ file, emojis: qmIssues });
    }
    
    if (file.includes('TEMPLATE_GUIDE')) {
      templateGuideIssues.push({ file, emojis });
    }
    
    for (const emoji of emojis) {
      if (!allEmojis.has(emoji.emoji)) {
        allEmojis.set(emoji.emoji, {
          emoji: emoji.emoji,
          replacement: emoji.replacement,
          count: 0,
          files: new Set()
        });
      }
      const entry = allEmojis.get(emoji.emoji);
      entry.count++;
      entry.files.add(file);
    }
  }
  
  // Step 3: Report findings
  console.log('========================================');
  console.log('  CRITICAL ISSUES');
  console.log('========================================');
  
  if (templateGuideIssues.length > 0) {
    console.log('\n⚠ TEMPLATE_GUIDE.md CONTRADICTS ITS OWN RULES:');
    for (const { file, emojis } of templateGuideIssues) {
      console.log(`\n  ${file}:`);
      for (const emoji of emojis) {
        console.log(`    Line ${emoji.line}:${emoji.column} - ${emoji.emoji} ${emoji.issue || ''}`);
        console.log(`      Context: ${emoji.context}`);
        console.log(`      Should be: ${emoji.replacement}`);
      }
    }
  }
  
  if (questionMarkIssues.length > 0) {
    console.log('\n⚠ QUESTION MARK EMOJIS (❓) USED INCORRECTLY:');
    for (const { file, emojis } of questionMarkIssues) {
      console.log(`\n  ${file}:`);
      for (const emoji of emojis) {
        console.log(`    Line ${emoji.line}:${emoji.column} - ${emoji.emoji}`);
        console.log(`      Context: ${emoji.context}`);
        console.log(`      Full line: ${emoji.fullLine}`);
        console.log(`      Should be: ${emoji.replacement} or removed`);
      }
    }
  }
  
  console.log('\n========================================');
  console.log('  ALL EMOJI USAGE SUMMARY');
  console.log('========================================');
  console.log(`\nTotal unique emojis found: ${allEmojis.size}`);
  console.log(`Total emoji instances: ${Array.from(allEmojis.values()).reduce((sum, e) => sum + e.count, 0)}`);
  console.log(`Files with emojis: ${audit.emojis.size}`);
  
  console.log('\nEmoji breakdown:');
  const sortedEmojis = Array.from(allEmojis.values()).sort((a, b) => b.count - a.count);
  for (const entry of sortedEmojis.slice(0, 20)) {
    console.log(`  ${entry.emoji} (${entry.count}x) -> ${entry.replacement}`);
    console.log(`    Found in ${entry.files.size} file(s)`);
  }
  
  console.log('\n========================================');
  console.log('  FILES WITH EMOJIS');
  console.log('========================================');
  
  const sortedFiles = Array.from(audit.emojis.entries()).sort((a, b) => b[1].length - a[1].length);
  for (const [file, emojis] of sortedFiles.slice(0, 30)) {
    console.log(`\n${file} (${emojis.length} emoji(s)):`);
    const uniqueEmojis = new Set(emojis.map(e => e.emoji));
    console.log(`  Unique emojis: ${Array.from(uniqueEmojis).join(' ')}`);
    if (emojis.some(e => e.issue)) {
      console.log(`  ⚠ Has problematic usage`);
    }
  }
  
  console.log('\n========================================');
  console.log('  SUMMARY');
  console.log('========================================');
  console.log(`  Total files scanned: ${audit.files.length}`);
  console.log(`  Files with emojis: ${audit.emojis.size}`);
  console.log(`  Files with issues: ${problematicFiles.length}`);
  console.log(`  Question mark issues: ${questionMarkIssues.length}`);
  console.log(`  Template guide issues: ${templateGuideIssues.length}`);
  console.log('');
  console.log('ℹ Audit complete. Review the issues above.');
  console.log('ℹ Use the replacement suggestions to fix problematic emoji usage.');
  console.log('');
}

main().catch(console.error);
