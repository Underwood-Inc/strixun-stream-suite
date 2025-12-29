#!/usr/bin/env node
/**
 * Test Audit Script
 * 
 * Audits all test files in the codebase and verifies test:all runs all tests
 */

import { readdir, readFile, stat } from 'fs/promises';
import { join, relative } from 'path';
import { execSync } from 'child_process';

interface TestFile {
  path: string;
  package: string;
  testCount: number;
  describeCount: number;
  itCount: number;
}

interface PackageTestSummary {
  package: string;
  testFiles: number;
  totalTests: number;
  totalDescribes: number;
  totalIts: number;
}

const ROOT_DIR = process.cwd();
const EXCLUDE_DIRS = ['node_modules', 'dist', '.git', '.storybook', 'storybook-static', 'dev-dist', 'e2e'];
const TEST_PATTERNS = [/.test\.(ts|tsx|js|jsx)$/, /.spec\.(ts|tsx|js|jsx)$/];
const E2E_PATTERNS = [/.e2e\.(test|spec)\.(ts|tsx|js|jsx)$/, /\.e2e\.(test|spec)\.(ts|tsx|js|jsx)$/];

async function shouldExclude(path: string): Promise<boolean> {
  const parts = path.split(/[/\\]/);
  return EXCLUDE_DIRS.some(dir => parts.includes(dir));
}

async function isTestFile(filePath: string): Promise<boolean> {
  const isE2E = E2E_PATTERNS.some(pattern => pattern.test(filePath));
  if (isE2E) return false; // Exclude e2e tests
  
  return TEST_PATTERNS.some(pattern => pattern.test(filePath));
}

async function findTestFiles(dir: string, packageName: string = 'root'): Promise<TestFile[]> {
  const testFiles: TestFile[] = [];
  
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relPath = relative(ROOT_DIR, fullPath);
      
      if (await shouldExclude(relPath)) {
        continue;
      }
      
      if (entry.isDirectory()) {
        // Determine package name from directory structure
        let newPackage = packageName;
        if (relPath.startsWith('packages/')) {
          const match = relPath.match(/^packages\/([^/]+)/);
          if (match) newPackage = `@strixun/${match[1]}`;
        } else if (relPath.startsWith('serverless/')) {
          const match = relPath.match(/^serverless\/([^/]+)/);
          if (match) newPackage = `strixun-${match[1]}`;
        } else if (relPath.startsWith('mods-hub')) {
          newPackage = '@strixun/mods-hub';
        } else if (relPath.startsWith('control-panel')) {
          newPackage = '@strixun/control-panel';
        } else if (relPath.startsWith('shared-components')) {
          newPackage = '@strixun/shared-components';
        }
        
        const subFiles = await findTestFiles(fullPath, newPackage);
        testFiles.push(...subFiles);
      } else if (entry.isFile() && await isTestFile(entry.name)) {
        const content = await readFile(fullPath, 'utf-8');
        const describeMatches = content.match(/describe\s*\(/g);
        const itMatches = content.match(/\b(it|test)\s*\(/g);
        
        testFiles.push({
          path: relPath,
          package: packageName,
          testCount: (describeMatches?.length || 0) + (itMatches?.length || 0),
          describeCount: describeMatches?.length || 0,
          itCount: itMatches?.length || 0,
        });
      }
    }
  } catch (error) {
    // Ignore permission errors
  }
  
  return testFiles;
}

function getPackagesWithTestScripts(): string[] {
  try {
    const result = execSync('pnpm -r list --depth -1 --json', { 
      encoding: 'utf-8',
      cwd: ROOT_DIR 
    });
    
    const packages = JSON.parse(result);
    const packagesWithTests: string[] = [];
    
    for (const pkg of packages) {
      if (pkg.path && pkg.name) {
        try {
          const pkgJson = require(join(pkg.path, 'package.json'));
          if (pkgJson.scripts && pkgJson.scripts.test) {
            packagesWithTests.push(pkg.name);
          }
        } catch {
          // Ignore packages without package.json
        }
      }
    }
    
    return packagesWithTests;
  } catch (error) {
    console.error('[ERROR] Failed to get packages with test scripts:', error);
    return [];
  }
}

async function main() {
  console.log('[INFO] Auditing test files in codebase...\n');
  
  const testFiles = await findTestFiles(ROOT_DIR);
  const packagesWithTests = getPackagesWithTestScripts();
  
  // Group by package
  const packageMap = new Map<string, TestFile[]>();
  for (const testFile of testFiles) {
    if (!packageMap.has(testFile.package)) {
      packageMap.set(testFile.package, []);
    }
    packageMap.get(testFile.package)!.push(testFile);
  }
  
  // Calculate summaries
  const summaries: PackageTestSummary[] = [];
  for (const [pkg, files] of packageMap.entries()) {
    summaries.push({
      package: pkg,
      testFiles: files.length,
      totalTests: files.reduce((sum, f) => sum + f.testCount, 0),
      totalDescribes: files.reduce((sum, f) => sum + f.describeCount, 0),
      totalIts: files.reduce((sum, f) => sum + f.itCount, 0),
    });
  }
  
  // Sort by package name
  summaries.sort((a, b) => a.package.localeCompare(b.package));
  
  // Print summary
  console.log('='.repeat(80));
  console.log('TEST FILE AUDIT SUMMARY');
  console.log('='.repeat(80));
  console.log(`\nTotal Test Files Found: ${testFiles.length}`);
  console.log(`Total Packages with Tests: ${summaries.length}`);
  console.log(`Total Packages with Test Scripts: ${packagesWithTests.length}`);
  console.log(`\nTotal Test Suites (describe): ${summaries.reduce((sum, s) => sum + s.totalDescribes, 0)}`);
  console.log(`Total Test Cases (it/test): ${summaries.reduce((sum, s) => sum + s.totalIts, 0)}`);
  console.log(`Total Test Count (approximate): ${summaries.reduce((sum, s) => sum + s.totalTests, 0)}`);
  
  console.log('\n' + '='.repeat(80));
  console.log('PACKAGE BREAKDOWN');
  console.log('='.repeat(80));
  
  for (const summary of summaries) {
    const hasTestScript = packagesWithTests.some(p => 
      p === summary.package || 
      p.includes(summary.package.replace('@strixun/', '')) ||
      p.includes(summary.package.replace('strixun-', ''))
    );
    
    const status = hasTestScript ? '[OK]' : '[MISSING TEST SCRIPT]';
    console.log(`\n${status} ${summary.package}`);
    console.log(`  Test Files: ${summary.testFiles}`);
    console.log(`  Test Suites: ${summary.totalDescribes}`);
    console.log(`  Test Cases: ${summary.totalIts}`);
    console.log(`  Files:`);
    const packageFiles = testFiles.filter(f => f.package === summary.package);
    for (const file of packageFiles) {
      console.log(`    - ${file.path}`);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('PACKAGES WITH TEST SCRIPTS (but may have no test files)');
  console.log('='.repeat(80));
  
  const packagesWithoutTestFiles = packagesWithTests.filter(pkg => {
    return !summaries.some(s => 
      s.package === pkg || 
      pkg.includes(s.package.replace('@strixun/', '')) ||
      pkg.includes(s.package.replace('strixun-', ''))
    );
  });
  
  if (packagesWithoutTestFiles.length > 0) {
    for (const pkg of packagesWithoutTestFiles) {
      console.log(`  - ${pkg} (has test script but no test files found)`);
    }
  } else {
    console.log('  (none)');
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('RECOMMENDATIONS');
  console.log('='.repeat(80));
  
  const missingScripts = summaries.filter(s => {
    return !packagesWithTests.some(p => 
      p === s.package || 
      p.includes(s.package.replace('@strixun/', '')) ||
      p.includes(s.package.replace('strixun-', ''))
    );
  });
  
  if (missingScripts.length > 0) {
    console.log('\n[WARNING] Packages with test files but missing test scripts:');
    for (const pkg of missingScripts) {
      console.log(`  - ${pkg.package} (${pkg.testFiles} test files)`);
    }
  }
  
  console.log('\n[INFO] Run "pnpm test:all" to execute all tests');
  console.log('[INFO] Run "pnpm test:all:sequential" for sequential execution');
  console.log('\n');
}

main().catch(error => {
  console.error('[ERROR]', error);
  process.exit(1);
});

