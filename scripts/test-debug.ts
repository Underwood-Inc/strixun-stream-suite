import { readdir, readFile } from 'fs/promises';
import { join, relative } from 'path';

const ROOT_DIR = process.cwd();
const TEST_PATTERNS = [/.test\.(ts|tsx|js|jsx)$/, /.spec\.(ts|tsx|js|jsx)$/];
const E2E_PATTERNS = [/.e2e\.(test|spec)\.(ts|tsx|js|jsx)$/i, /e2e[\/\\].*\.(test|spec)\.(ts|tsx|js|jsx)$/i];

function isE2ETestFile(filePath: string): boolean {
  return E2E_PATTERNS.some(pattern => pattern.test(filePath));
}

function isUnitTestFile(filePath: string): boolean {
  if (isE2ETestFile(filePath)) return false;
  return TEST_PATTERNS.some(pattern => pattern.test(filePath));
}

async function scanForTests(dir: string, depth = 0): Promise<string[]> {
  const testFiles: string[] = [];
  
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relPath = relative(ROOT_DIR, fullPath);
      
      // Skip common exclusions
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') {
        continue;
      }
      
      if (entry.isDirectory()) {
        const subFiles = await scanForTests(fullPath, depth + 1);
        testFiles.push(...subFiles);
      } else if (entry.isFile()) {
        const isE2E = isE2ETestFile(relPath);
        const isUnit = isUnitTestFile(relPath);
        
        if (isE2E || isUnit) {
          testFiles.push(relPath);
          console.log(`Found ${isE2E ? 'E2E' : 'UNIT'} test: ${relPath}`);
        }
      }
    }
  } catch (error: any) {
    if (error.code !== 'EACCES') {
      console.error(`Error scanning ${dir}:`, error.message);
    }
  }
  
  return testFiles;
}

async function main() {
  console.log(`Scanning from: ${ROOT_DIR}\n`);
  const testFiles = await scanForTests(ROOT_DIR);
  console.log(`\nTotal test files found: ${testFiles.length}`);
  console.log(`E2E: ${testFiles.filter(f => isE2ETestFile(f)).length}`);
  console.log(`Unit: ${testFiles.filter(f => isUnitTestFile(f)).length}`);
}

main().catch(console.error);

