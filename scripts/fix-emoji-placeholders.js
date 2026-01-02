/**
 * Fix Emoji Placeholders Script
 * 
 * Replaces [EMOJI] placeholders and fixes incorrect status labels with proper ASCII special characters
 * Uses actual special characters like ✓, ✗, ⚠, →, ★, ♥, etc.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Replacement mappings for [EMOJI] placeholders
// Using actual ASCII special characters
const emojiPlaceholderReplacements = [
  // Status indicators in code/console
  { pattern: /\[EMOJI\]\s*(Validating|Validating service)/gi, replacement: 'ℹ' },
  { pattern: /\[EMOJI\]\s*(Name|Main|Package)/gi, replacement: 'ℹ' },
  { pattern: /\[EMOJI\]\s*(Success|Success!)/gi, replacement: '✓' },
  { pattern: /\[EMOJI\]\s*(Error|Failed|Fail)/gi, replacement: '✗' },
  { pattern: /\[EMOJI\]\s*(Warning|Warn)/gi, replacement: '⚠' },
  { pattern: /\[EMOJI\]\s*(Info|Information)/gi, replacement: 'ℹ' },
  
  // Documentation headers and sections
  { pattern: /##\s*\[EMOJI\]\s*/g, replacement: '## ★ ' },
  { pattern: /###\s*\[EMOJI\]\s*/g, replacement: '### ★ ' },
  { pattern: /####\s*\[EMOJI\]\s*/g, replacement: '#### ★ ' },
  { pattern: /\[EMOJI\]\s*What You'll See/gi, replacement: '→ What You\'ll See' },
  { pattern: /\[EMOJI\]\s*Features/gi, replacement: '→ Features' },
  { pattern: /\[EMOJI\]\s*Requirements/gi, replacement: '→ Requirements' },
  { pattern: /\[EMOJI\]\s*Troubleshooting/gi, replacement: '⚠ Troubleshooting' },
  { pattern: /\[EMOJI\]\s*License/gi, replacement: '≡ License' },
  { pattern: /\[EMOJI\]\s*For Developers/gi, replacement: '→ For Developers' },
  { pattern: /\[EMOJI\]\s*Manual Installation/gi, replacement: '→ Manual Installation' },
  { pattern: /\[EMOJI\]\s*Quick Start/gi, replacement: '→ Quick Start' },
  { pattern: /\[EMOJI\]\s*API Endpoints/gi, replacement: '≡ API Endpoints' },
  { pattern: /\[EMOJI\]\s*Security Features/gi, replacement: '⚠ Security Features' },
  { pattern: /\[EMOJI\]\s*Next Steps/gi, replacement: '→ Next Steps' },
  { pattern: /\[EMOJI\]\s*Implementation Details/gi, replacement: '≡ Implementation Details' },
  { pattern: /\[EMOJI\]\s*Result/gi, replacement: '✓ Result' },
  { pattern: /\[EMOJI\]\s*Package Installed/gi, replacement: '✓ Package Installed' },
  { pattern: /\[EMOJI\]\s*Components Created/gi, replacement: '✓ Components Created' },
  { pattern: /\[EMOJI\]\s*Visualizations Implemented/gi, replacement: '✓ Visualizations Implemented' },
  { pattern: /\[EMOJI\]\s*Theming Integration/gi, replacement: '✓ Theming Integration' },
  { pattern: /\[EMOJI\]\s*Data Transformations/gi, replacement: '≡ Data Transformations' },
  { pattern: /\[EMOJI\]\s*Usage Examples/gi, replacement: '~ Usage Examples' },
  { pattern: /\[EMOJI\]\s*Notes/gi, replacement: '⚠ Notes' },
  { pattern: /\[EMOJI\]\s*Known Issues/gi, replacement: '⚠ Known Issues' },
  
  // UI/Button contexts
  { pattern: /\[EMOJI\]\s*Check All Scripts Status/gi, replacement: '→ Check All Scripts Status' },
  { pattern: /\[EMOJI\]\s*Show Common Issues/gi, replacement: '⚠ Show Common Issues' },
  { pattern: /\[EMOJI\]\s*Show Script Folder Path/gi, replacement: '≡ Show Script Folder Path' },
  { pattern: /\[EMOJI\]\s*Copy Token/gi, replacement: '✓ Copy Token' },
  { pattern: /\[EMOJI\]\s*Copy URL/gi, replacement: '✓ Copy URL' },
  { pattern: /\[EMOJI\]\s*Copy/gi, replacement: '✓ Copy' },
  { pattern: /\[EMOJI\]\s*Refresh/gi, replacement: '↻ Refresh' },
  { pattern: /\[EMOJI\]\s*Refresh Sources/gi, replacement: '↻ Refresh Sources' },
  { pattern: /\[EMOJI\]\s*Delete/gi, replacement: '✗ Delete' },
  { pattern: /\[EMOJI\]\s*Add Config/gi, replacement: '⊕ Add Config' },
  { pattern: /\[EMOJI\]\s*Swap Now/gi, replacement: '⇄ Swap Now' },
  { pattern: /\[EMOJI\]\s*Apply/gi, replacement: '✓ Apply' },
  { pattern: /\[EMOJI\]\s*Reset/gi, replacement: '↺ Reset' },
  { pattern: /\[EMOJI\]\s*Detect/gi, replacement: '→ Detect' },
  { pattern: /\[EMOJI\]\s*Browse/gi, replacement: '→ Browse' },
  { pattern: /\[EMOJI\]\s*Auto-Detect/gi, replacement: '→ Auto-Detect' },
  { pattern: /\[EMOJI\]\s*Check Updates/gi, replacement: '→ Check Updates' },
  { pattern: /\[EMOJI\]\s*Sign In/gi, replacement: '✓ Sign In' },
  { pattern: /\[EMOJI\]\s*Force Sync/gi, replacement: '⇄ Force Sync' },
  { pattern: /\[EMOJI\]\s*Copy as JSON/gi, replacement: '✓ Copy as JSON' },
  
  // Menu/Path contexts (like "View [EMOJI] Docks")
  { pattern: /View\s+\[EMOJI\]\s+Docks/gi, replacement: 'View Docks' },
  { pattern: /Tools\s+\[EMOJI\]\s+Scripts/gi, replacement: 'Tools → Scripts' },
  { pattern: /Tools\s+\[EMOJI\]\s+WebSocket/gi, replacement: 'Tools → WebSocket' },
  { pattern: /OBS\s+\[EMOJI\]\s+Tools/gi, replacement: 'OBS → Tools' },
  
  // Generic icon contexts (fallback)
  { pattern: /<div[^>]*class="[^"]*icon[^"]*"[^>]*>\[EMOJI\]<\/div>/gi, replacement: '<div class="icon">★</div>' },
  { pattern: /\.auth-screen__icon[^}]*\[EMOJI\]/gi, replacement: '★' },
  
  // Generic fallback - replace standalone [EMOJI] with ★
  { pattern: /\s*\[EMOJI\]\s*/g, replacement: ' ★ ' },
];

// Fix incorrect status labels - replace with ASCII special characters
const statusLabelFixes = [
  { pattern: /\[SUCCESS\]/gi, replacement: '✓' },
  { pattern: /\[success\]/gi, replacement: '✓' },
  { pattern: /\[FAIL\]/gi, replacement: '✗' },
  { pattern: /\[ail\]/gi, replacement: '✗' },
  { pattern: /\[fail\]/gi, replacement: '✗' },
  { pattern: /\[failed\]/gi, replacement: '✗' },
  { pattern: /\[WARNING\]/gi, replacement: '⚠' },
  { pattern: /\[WARN\]/gi, replacement: '⚠' },
  { pattern: /\[warn\]/gi, replacement: '⚠' },
  { pattern: /\[ERROR\]/gi, replacement: '✗' },
  { pattern: /\[error\]/gi, replacement: '✗' },
  { pattern: /\[INFO\]/gi, replacement: 'ℹ' },
  { pattern: /\[info\]/gi, replacement: 'ℹ' },
  { pattern: /\[OK\]/gi, replacement: '✓' },
  { pattern: /\[ok\]/gi, replacement: '✓' },
  { pattern: /\[PASS\]/gi, replacement: '✓' },
  { pattern: /\[pass\]/gi, replacement: '✓' },
];

// Also replace bracketed ASCII art patterns with actual characters
const bracketedAsciiFixes = [
  { pattern: /\[\*\]/g, replacement: '★' },
  { pattern: /\[>\]/g, replacement: '→' },
  { pattern: /\[~\]/g, replacement: '~' },
  { pattern: /\[=\]/g, replacement: '≡' },
  { pattern: /\[\+\]/g, replacement: '✓' },
  { pattern: /\[-\]/g, replacement: '✗' },
  { pattern: /\[!\]/g, replacement: '⚠' },
  { pattern: /\[#\]/g, replacement: '#' },
  { pattern: /\[@\]/g, replacement: '@' },
  { pattern: /\[\|\]/g, replacement: '|' },
];

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
  '.changeset',
  'playwright-report'
];

// Files to skip
const skipFiles = [
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
  'fix-emoji-placeholders.js'
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
 * Replace emoji placeholders and fix status labels in text
 */
function fixEmojiPlaceholders(text, filePath) {
  let result = text;
  const replacements = [];
  
  // Apply emoji placeholder replacements (in order, most specific first)
  for (const { pattern, replacement } of emojiPlaceholderReplacements) {
    const matches = result.match(pattern);
    if (matches) {
      result = result.replace(pattern, replacement);
      replacements.push({ 
        type: 'emoji_placeholder', 
        pattern: pattern.toString(), 
        replacement, 
        count: matches.length 
      });
    }
  }
  
  // Apply status label fixes
  for (const { pattern, replacement } of statusLabelFixes) {
    const matches = result.match(pattern);
    if (matches) {
      result = result.replace(pattern, replacement);
      replacements.push({ 
        type: 'status_label', 
        pattern: pattern.toString(), 
        replacement, 
        count: matches.length 
      });
    }
  }
  
  // Apply bracketed ASCII art fixes
  for (const { pattern, replacement } of bracketedAsciiFixes) {
    const matches = result.match(pattern);
    if (matches) {
      result = result.replace(pattern, replacement);
      replacements.push({ 
        type: 'bracketed_ascii', 
        pattern: pattern.toString(), 
        replacement, 
        count: matches.length 
      });
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
              const { result, replacements } = fixEmojiPlaceholders(content, fullPath);
              
              if (replacements.length > 0) {
                writeFileSync(fullPath, result, 'utf-8');
                stats.fixed++;
                const total = replacements.reduce((sum, r) => sum + r.count, 0);
                stats.totalReplacements += total;
                const relativePath = fullPath.replace(projectRoot + '\\', '').replace(projectRoot + '/', '');
                console.log(`✓ ${relativePath}: ${total} replacement(s)`);
              }
            } catch (error) {
              if (error.code !== 'EISDIR' && error.code !== 'ENOENT') {
                console.warn(`⚠ Could not process: ${fullPath}`);
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
  console.log('  Fix Emoji Placeholders Script');
  console.log('========================================');
  console.log('');
  
  console.log('ℹ Scanning and fixing emoji placeholders...');
  const stats = scanAndFix(projectRoot);
  
  console.log('');
  console.log('========================================');
  console.log('  Summary');
  console.log('========================================');
  console.log(`  Files scanned: ${stats.files}`);
  console.log(`  Files fixed: ${stats.fixed}`);
  console.log(`  Total replacements: ${stats.totalReplacements}`);
  console.log('');
  console.log('✓ Emoji placeholder fixing complete!');
  console.log('');
}

main().catch(console.error);
