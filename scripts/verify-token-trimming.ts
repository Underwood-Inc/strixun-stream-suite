/**
 * Verification Script: Token Trimming Fix
 * 
 * This script verifies that all token extraction points have .trim() applied
 * to prevent token mismatch errors between encryption and decryption.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

interface TokenExtraction {
  file: string;
  line: number;
  code: string;
  hasTrim: boolean;
}

const workspaceRoot = process.cwd();
const filesToCheck: string[] = [];

// Find all TypeScript and JavaScript files in serverless and packages directories
function findFiles(dir: string, extensions: string[] = ['.ts', '.js']): void {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      
      // Skip node_modules and build directories
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.wrangler' || entry.name === 'dist' || entry.name === 'build') {
          continue;
        }
        findFiles(fullPath, extensions);
      } else if (entry.isFile()) {
        const ext = entry.name.substring(entry.name.lastIndexOf('.'));
        if (extensions.includes(ext)) {
          filesToCheck.push(fullPath);
        }
      }
    }
  } catch (error) {
    // Skip directories we can't read
  }
}

// Find all relevant files
findFiles(join(workspaceRoot, 'serverless'));
findFiles(join(workspaceRoot, 'packages'));

const tokenExtractions: TokenExtraction[] = [];

// Patterns that indicate token extraction
const tokenPatterns = [
  /authHeader\.substring\(7\)/g,
  /\.substring\(7\)/g,
  /\.replace\(['"]Bearer\s+['"]/g,
  /Authorization.*substring\(7\)/g,
];

// Check each file
for (const filePath of filesToCheck) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      // Check for token extraction patterns
      for (const pattern of tokenPatterns) {
        const matches = line.matchAll(pattern);
        for (const match of matches) {
          const matchText = match[0];
          const lineNum = index + 1;
          
          // Check if this line or the next line has .trim()
          const hasTrim = line.includes('.trim()') || 
                         (index + 1 < lines.length && lines[index + 1].includes('.trim()'));
          
          // Skip if it's in a comment or string literal (basic check)
          if (!line.trim().startsWith('//') && !line.includes('CRITICAL: Trim token')) {
            tokenExtractions.push({
              file: filePath.replace(workspaceRoot + '\\', '').replace(workspaceRoot + '/', ''),
              line: lineNum,
              code: line.trim(),
              hasTrim
            });
          }
        }
      }
    });
  } catch (error) {
    // Skip files we can't read
  }
}

// Filter to only show extractions that might need trimming (exclude false positives)
const criticalExtractions = tokenExtractions.filter(ext => {
  const code = ext.code.toLowerCase();
  // Only include actual token extractions, not random substring calls
  return (code.includes('authorization') || code.includes('authheader') || code.includes('bearer')) &&
         !code.includes('random') && 
         !code.includes('test_') &&
         !code.includes('jti:') &&
         !code.includes('csrf_');
});

// Group by file
const byFile = new Map<string, TokenExtraction[]>();
for (const ext of criticalExtractions) {
  if (!byFile.has(ext.file)) {
    byFile.set(ext.file, []);
  }
  byFile.get(ext.file)!.push(ext);
}

// Report results
console.log('🔍 Token Trimming Verification Report\n');
console.log('=' .repeat(80));
console.log(`\n📊 Summary:`);
console.log(`   Total files checked: ${filesToCheck.length}`);
console.log(`   Files with token extractions: ${byFile.size}`);
console.log(`   Total token extraction points: ${criticalExtractions.length}`);

const withoutTrim = criticalExtractions.filter(ext => !ext.hasTrim);
const withTrim = criticalExtractions.filter(ext => ext.hasTrim);

console.log(`\n✓ Token extractions WITH .trim(): ${withTrim.length}`);
console.log(`✗ Token extractions WITHOUT .trim(): ${withoutTrim.length}`);

if (withoutTrim.length > 0) {
  console.log(`\n⚠  Files needing fixes:`);
  const filesNeedingFix = new Set(withoutTrim.map(ext => ext.file));
  for (const file of filesNeedingFix) {
    console.log(`\n   📄 ${file}`);
    withoutTrim.filter(ext => ext.file === file).forEach(ext => {
      console.log(`      Line ${ext.line}: ${ext.code.substring(0, 80)}...`);
    });
  }
  process.exit(1);
} else {
  console.log(`\n✓ SUCCESS: All token extraction points have .trim() applied!`);
  console.log(`\n📋 Files verified:`);
  for (const [file, exts] of byFile.entries()) {
    console.log(`   ✓ ${file} (${exts.length} extraction${exts.length > 1 ? 's' : ''})`);
  }
  process.exit(0);
}
