#!/usr/bin/env node
/**
 * Test Runner with Pre-Counting and Running Totals
 * 
 * Supports both unit/integration tests (vitest) and e2e tests (playwright)
 * 
 * Usage:
 *   pnpm test:all:totals                    # Run all tests (unit + e2e)
 *   pnpm test:all:totals --unit             # Run only unit/integration tests
 *   pnpm test:all:totals --e2e               # Run only e2e tests
 *   pnpm test:all:totals --unit --e2e       # Run both (same as default)
 */

import { execSync } from 'child_process';
import { readdir, readFile } from 'fs/promises';
import { join, relative } from 'path';

const ROOT_DIR = process.cwd();
const EXCLUDE_DIRS = ['node_modules', 'dist', '.git', '.storybook', 'storybook-static', 'dev-dist'];
const TEST_PATTERNS = [/.test\.(ts|tsx|js|jsx)$/, /.spec\.(ts|tsx|js|jsx)$/];
const E2E_PATTERNS = [/.e2e\.(test|spec)\.(ts|tsx|js|jsx)$/i, /e2e[\/\\].*\.(test|spec)\.(ts|tsx|js|jsx)$/i];

interface TestCount {
  package: string;
  path: string;
  testFiles: number;
  expectedTests: number; // Count of it/test blocks
  expectedDescribes: number;
  isE2E: boolean;
}

interface TestResult {
  package: string;
  path: string;
  testType: 'unit' | 'e2e';
  expectedTests: number;
  actualPassed: number;
  actualFailed: number;
  actualTotal: number;
  actualTestFiles: number;
  duration: number;
  success: boolean;
}

async function shouldExclude(path: string): Promise<boolean> {
  // Check if path contains any excluded directory
  // Use normalized path separators for Windows compatibility
  const normalizedPath = path.replace(/\\/g, '/');
  const parts = normalizedPath.split('/');
  
  // Check if any part of the path matches excluded directories
  return EXCLUDE_DIRS.some(dir => {
    // Check if the directory name appears anywhere in the path
    return parts.includes(dir);
  });
}

function isE2ETestFile(filePath: string): boolean {
  return E2E_PATTERNS.some(pattern => pattern.test(filePath));
}

function isUnitTestFile(filePath: string): boolean {
  if (isE2ETestFile(filePath)) return false;
  return TEST_PATTERNS.some(pattern => pattern.test(filePath));
}

async function countTestsInFile(filePath: string): Promise<{ describes: number; tests: number }> {
  try {
    const content = await readFile(filePath, 'utf-8');
    
    // Count describe blocks (test suites)
    const describeMatches = content.match(/describe\s*\(/g);
    const describeCount = describeMatches?.length || 0;
    
    // Count it/test blocks (actual test cases)
    // Match: it(, it.skip(, it.only(, test(, test.skip(, test.only(
    const itMatches = content.match(/\b(it|test)\s*(?:\.(?:skip|only|todo))?\s*\(/g);
    const itCount = itMatches?.length || 0;
    
    return { describes: describeCount, tests: itCount };
  } catch {
    return { describes: 0, tests: 0 };
  }
}

async function findPackageForPath(filePath: string): Promise<{ name: string; path: string }> {
  // Walk up the directory tree to find the nearest package.json
  let currentPath = filePath;
  const pathSep = process.platform === 'win32' ? '\\' : '/';
  
  while (currentPath !== ROOT_DIR && currentPath.length > ROOT_DIR.length) {
    const packageJsonPath = join(currentPath, 'package.json');
    
    try {
      const pkgJsonContent = await readFile(packageJsonPath, 'utf-8');
      const pkgJson = JSON.parse(pkgJsonContent);
      if (pkgJson.name) {
        return {
          name: pkgJson.name,
          path: currentPath,
        };
      }
    } catch {
      // Continue searching up the tree
    }
    
    // Move up one directory
    const parentPath = join(currentPath, '..');
    if (parentPath === currentPath) break; // Reached root
    currentPath = parentPath;
  }
  
  // Fallback: try to determine from path structure
  const relPath = relative(ROOT_DIR, filePath);
  if (relPath.startsWith('packages' + pathSep)) {
    const match = relPath.match(/^packages[\/\\]([^\/\\]+)/);
    if (match) {
      return {
        name: `@strixun/${match[1]}`,
        path: join(ROOT_DIR, 'packages', match[1]),
      };
    }
  } else if (relPath.startsWith('serverless' + pathSep)) {
    const match = relPath.match(/^serverless[\/\\]([^\/\\]+)/);
    if (match) {
      return {
        name: `strixun-${match[1]}`,
        path: join(ROOT_DIR, 'serverless', match[1]),
      };
    }
  } else if (relPath.startsWith('mods-hub')) {
    return {
      name: '@strixun/mods-hub',
      path: join(ROOT_DIR, 'mods-hub'),
    };
  } else if (relPath.startsWith('control-panel')) {
    return {
      name: '@strixun/control-panel',
      path: join(ROOT_DIR, 'control-panel'),
    };
  } else if (relPath.startsWith('shared-components')) {
    return {
      name: '@strixun/shared-components',
      path: join(ROOT_DIR, 'shared-components'),
    };
  }
  
  // Default to root
  return {
    name: 'root',
    path: ROOT_DIR,
  };
}

async function findAndCountTests(
  dir: string, 
  packageName: string, 
  packagePath: string,
  testType: 'unit' | 'e2e' | 'both'
): Promise<TestCount[]> {
  const testCounts: TestCount[] = [];
  const fileCounts = new Map<string, { files: number; describes: number; tests: number; isE2E: boolean; packagePath: string }>();
  
  let filesScanned = 0;
  let testFilesFound = 0;
  
  async function scanDirectory(currentDir: string): Promise<void> {
    try {
      const entries = await readdir(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(currentDir, entry.name);
        const relPath = relative(ROOT_DIR, fullPath);
        
        // Skip if entry name itself is excluded (faster check)
        if (EXCLUDE_DIRS.includes(entry.name)) {
          continue;
        }
        
        // Also check the full relative path
        if (await shouldExclude(relPath)) {
          continue;
        }
        
        if (entry.isDirectory()) {
          // Recursively scan all directories (no hardcoded package detection here)
          await scanDirectory(fullPath);
        } else if (entry.isFile()) {
          filesScanned++;
          const isE2E = isE2ETestFile(relPath);
          const isUnit = isUnitTestFile(relPath);
          
          // Filter by test type
          if (testType === 'unit' && !isUnit) continue;
          if (testType === 'e2e' && !isE2E) continue;
          if (testType === 'both' && !isUnit && !isE2E) continue;
          
          if (isUnit || isE2E) {
            testFilesFound++;
            // Find the package for this test file dynamically
            const pkgInfo = await findPackageForPath(fullPath);
            const counts = await countTestsInFile(fullPath);
            
            const key = `${pkgInfo.name}:${isE2E ? 'e2e' : 'unit'}`;
            if (!fileCounts.has(key)) {
              fileCounts.set(key, { files: 0, describes: 0, tests: 0, isE2E, packagePath: pkgInfo.path });
            }
            
            const pkgCounts = fileCounts.get(key)!;
            pkgCounts.files++;
            pkgCounts.describes += counts.describes;
            pkgCounts.tests += counts.tests;
          }
        }
      }
    } catch (error) {
      // Ignore permission errors, but log for debugging
      if (process.env.DEBUG) {
        console.error(`[DEBUG] Error scanning ${currentDir}:`, error);
      }
    }
  }
  
  await scanDirectory(dir);
  
  if (process.env.DEBUG) {
    console.log(`[DEBUG] Scanned ${filesScanned} files, found ${testFilesFound} test files`);
    console.log(`[DEBUG] Found ${fileCounts.size} package/test type combinations`);
    for (const [key, counts] of fileCounts.entries()) {
      console.log(`[DEBUG] ${key}: ${counts.files} files, ${counts.tests} tests`);
    }
  }
  
  // Update testCounts with aggregated data - build from fileCounts directly
  testCounts.length = 0; // Clear any pre-existing entries
  for (const [key, counts] of fileCounts.entries()) {
    const [pkg, type] = key.split(':');
    testCounts.push({
      package: pkg,
      path: counts.packagePath,
      testFiles: counts.files,
      expectedTests: counts.tests,
      expectedDescribes: counts.describes,
      isE2E: counts.isE2E,
    });
  }
  
  return testCounts;
}

async function getPackagesWithTestScripts(testType: 'unit' | 'e2e' | 'both'): Promise<Array<{ name: string; path: string; hasE2E: boolean }>> {
  try {
    const result = execSync('pnpm -r list --depth -1 --json', { 
      encoding: 'utf-8',
      cwd: ROOT_DIR 
    });
    
    const packages = JSON.parse(result);
    const packagesWithTests: Array<{ name: string; path: string; hasE2E: boolean }> = [];
    
    for (const pkg of packages) {
      if (pkg.path && pkg.name) {
        try {
          const pkgJsonPath = join(pkg.path, 'package.json');
          const pkgJsonContent = await readFile(pkgJsonPath, 'utf-8');
          const pkgJson = JSON.parse(pkgJsonContent);
          const hasTest = pkgJson.scripts && pkgJson.scripts.test;
          const hasE2E = pkgJson.scripts && (pkgJson.scripts['test:e2e'] || pkgJson.scripts.e2e);
          
          if (testType === 'unit' && hasTest) {
            packagesWithTests.push({ name: pkg.name, path: pkg.path, hasE2E: false });
          } else if (testType === 'e2e') {
            // For e2e, check root package or packages with e2e scripts
            if (pkg.path === ROOT_DIR && hasE2E) {
              packagesWithTests.push({ name: 'root', path: pkg.path, hasE2E: true });
            } else if (hasE2E) {
              packagesWithTests.push({ name: pkg.name, path: pkg.path, hasE2E: true });
            }
          } else if (testType === 'both') {
            if (hasTest) {
              packagesWithTests.push({ name: pkg.name, path: pkg.path, hasE2E: false });
            }
            // Add root for e2e if it has e2e script
            if (pkg.path === ROOT_DIR && hasE2E && !packagesWithTests.some(p => p.path === ROOT_DIR && p.hasE2E)) {
              packagesWithTests.push({ name: 'root', path: pkg.path, hasE2E: true });
            }
          }
        } catch (error: any) {
          if (process.env.DEBUG) {
            console.log(`[DEBUG] Error reading package.json for ${pkg.path}:`, error.message);
          }
        }
      }
    }
    
    return packagesWithTests;
  } catch (error: any) {
    console.error('[ERROR] Failed to get packages with test scripts:', error.message);
    return [];
  }
}

function parseVitestOutput(output: string): { 
  passed: number; 
  failed: number; 
  total: number;
  testFiles: number;
} {
  // Try to parse vitest output
  const passedMatch = output.match(/(\d+)\s+passed/i);
  const failedMatch = output.match(/(\d+)\s+failed/i);
  const testFilesMatch = output.match(/Test Files\s+(\d+)/i);
  const totalMatch = output.match(/Tests\s+(\d+)/i);
  
  const passed = passedMatch ? parseInt(passedMatch[1], 10) : 0;
  const failed = failedMatch ? parseInt(failedMatch[1], 10) : 0;
  const testFiles = testFilesMatch ? parseInt(testFilesMatch[1], 10) : 0;
  const total = totalMatch ? parseInt(totalMatch[1], 10) : (passed + failed);
  
  return { passed, failed, total, testFiles };
}

function parsePlaywrightOutput(output: string): { 
  passed: number; 
  failed: number; 
  total: number;
  testFiles: number;
} {
  // Try to parse playwright output
  const passedMatch = output.match(/(\d+)\s+passed/i);
  const failedMatch = output.match(/(\d+)\s+failed/i);
  const skippedMatch = output.match(/(\d+)\s+skipped/i);
  const totalMatch = output.match(/(\d+)\s+test/i);
  
  const passed = passedMatch ? parseInt(passedMatch[1], 10) : 0;
  const failed = failedMatch ? parseInt(failedMatch[1], 10) : 0;
  const skipped = skippedMatch ? parseInt(skippedMatch[1], 10) : 0;
  const total = totalMatch ? parseInt(totalMatch[1], 10) : (passed + failed + skipped);
  
  // Playwright doesn't always report test files separately, try to extract
  const testFilesMatch = output.match(/(\d+)\s+test file/i);
  const testFiles = testFilesMatch ? parseInt(testFilesMatch[1], 10) : 0;
  
  return { passed, failed, total, testFiles };
}

async function runTestsSequential(testType: 'unit' | 'e2e' | 'both'): Promise<void> {
  const testTypeLabel = testType === 'both' ? 'all tests (unit + e2e)' : testType === 'e2e' ? 'e2e tests' : 'unit/integration tests';
  
  console.log(`[INFO] Phase 1: Counting ${testTypeLabel} BEFORE running...\n`);
  
  // Count all tests first
  const expectedCounts = await findAndCountTests(ROOT_DIR, 'root', ROOT_DIR, testType);
  const packagesWithTests = await getPackagesWithTestScripts(testType);
  
  if (process.env.DEBUG) {
    console.log(`[DEBUG] Found ${expectedCounts.length} expected test counts`);
    console.log(`[DEBUG] Found ${packagesWithTests.length} packages with test scripts`);
    for (const pkg of packagesWithTests) {
      console.log(`[DEBUG] Package with script: ${pkg.name} at ${pkg.path}`);
    }
  }
  
  // Separate unit and e2e counts
  const unitCounts = expectedCounts.filter(ec => !ec.isE2E);
  const e2eCounts = expectedCounts.filter(ec => ec.isE2E);
  
  // Match expected counts with packages that have test scripts
  const testPlan: Array<TestCount & { hasScript: boolean; testType: 'unit' | 'e2e' }> = [];
  
  // Add unit tests
  if (testType === 'unit' || testType === 'both') {
    for (const pkg of packagesWithTests.filter(p => !p.hasE2E)) {
      const expected = unitCounts.find(ec => 
        ec.package === pkg.name ||
        pkg.name.includes(ec.package.replace('@strixun/', '')) ||
        pkg.name.includes(ec.package.replace('strixun-', ''))
      );
      
      if (expected) {
        testPlan.push({
          ...expected,
          hasScript: true,
          testType: 'unit',
        });
      } else {
        // Package has test script but no test files found (might be empty)
        testPlan.push({
          package: pkg.name,
          path: pkg.path,
          testFiles: 0,
          expectedTests: 0,
          expectedDescribes: 0,
          isE2E: false,
          hasScript: true,
          testType: 'unit',
        });
      }
    }
  }
  
  // Add e2e tests - collect all e2e test counts
  if (testType === 'e2e' || testType === 'both') {
    // For e2e, we need to run playwright from root, but collect all e2e tests
    const rootE2E = packagesWithTests.find(p => p.hasE2E && p.path === ROOT_DIR);
    if (rootE2E || e2eCounts.length > 0) {
      // Sum all e2e tests across packages
      const totalE2ETests = e2eCounts.reduce((sum, ec) => sum + ec.expectedTests, 0);
      const totalE2EFiles = e2eCounts.reduce((sum, ec) => sum + ec.testFiles, 0);
      const totalE2EDescribes = e2eCounts.reduce((sum, ec) => sum + ec.expectedDescribes, 0);
      
      if (totalE2ETests > 0 || rootE2E) {
        testPlan.push({
          package: 'root',
          path: ROOT_DIR,
          testFiles: totalE2EFiles,
          expectedTests: totalE2ETests,
          expectedDescribes: totalE2EDescribes,
          isE2E: true,
          hasScript: !!rootE2E,
          testType: 'e2e',
        });
      }
    }
  }
  
  // Sort by test type then package name
  testPlan.sort((a, b) => {
    if (a.testType !== b.testType) return a.testType === 'unit' ? -1 : 1;
    return a.package.localeCompare(b.package);
  });
  
  // Print pre-run summary
  const totalExpectedTests = testPlan.reduce((sum, tp) => sum + tp.expectedTests, 0);
  const totalExpectedFiles = testPlan.reduce((sum, tp) => sum + tp.testFiles, 0);
  const totalExpectedDescribes = testPlan.reduce((sum, tp) => sum + tp.expectedDescribes, 0);
  
  const unitExpected = testPlan.filter(tp => tp.testType === 'unit').reduce((sum, tp) => sum + tp.expectedTests, 0);
  const e2eExpected = testPlan.filter(tp => tp.testType === 'e2e').reduce((sum, tp) => sum + tp.expectedTests, 0);
  
  console.log('='.repeat(80));
  console.log('PRE-RUN TEST COUNT');
  console.log('='.repeat(80));
  console.log(`\nTotal Packages: ${testPlan.length}`);
  console.log(`Total Test Files: ${totalExpectedFiles}`);
  console.log(`Total Test Suites (describe): ${totalExpectedDescribes}`);
  console.log(`Total Test Cases Expected (it/test): ${totalExpectedTests}`);
  
  if (testType === 'both') {
    console.log(`\n  Unit/Integration Tests: ${unitExpected}`);
    console.log(`  E2E Tests: ${e2eExpected}`);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('PACKAGE BREAKDOWN (Expected)');
  console.log('='.repeat(80));
  
  for (const plan of testPlan) {
    const status = plan.hasScript ? '[OK]' : '[NO SCRIPT]';
    const typeLabel = plan.testType === 'e2e' ? '[E2E]' : '[UNIT]';
    console.log(`\n${status} ${typeLabel} ${plan.package}`);
    console.log(`  Test Files: ${plan.testFiles}`);
    console.log(`  Test Suites: ${plan.expectedDescribes}`);
    console.log(`  Test Cases: ${plan.expectedTests}`);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log(`Phase 2: Running ${testTypeLabel}...\n`);
  console.log('='.repeat(80));
  
  // Now run the tests
  const results: TestResult[] = [];
  let globalExpected = 0;
  let globalActualPassed = 0;
  let globalActualFailed = 0;
  let globalActualTotal = 0;
  
  for (let i = 0; i < testPlan.length; i++) {
    const plan = testPlan[i];
    const typeLabel = plan.testType === 'e2e' ? '[E2E]' : '[UNIT]';
    console.log(`\n[${i + 1}/${testPlan.length}] ${typeLabel} Running: ${plan.package}`);
    console.log(`  Expected: ${plan.expectedTests} test cases in ${plan.testFiles} files`);
    
    globalExpected += plan.expectedTests;
    
    try {
      const startTime = Date.now();
      const command = plan.testType === 'e2e' ? 'pnpm test:e2e' : 'pnpm test';
      const output = execSync(command, {
        encoding: 'utf-8',
        cwd: plan.path,
        stdio: 'pipe',
      });
      
      const duration = Date.now() - startTime;
      const stats = plan.testType === 'e2e' 
        ? parsePlaywrightOutput(output)
        : parseVitestOutput(output);
      
      globalActualPassed += stats.passed;
      globalActualFailed += stats.failed;
      globalActualTotal += stats.total;
      
      const success = stats.failed === 0;
      
      results.push({
        package: plan.package,
        path: plan.path,
        testType: plan.testType,
        expectedTests: plan.expectedTests,
        actualPassed: stats.passed,
        actualFailed: stats.failed,
        actualTotal: stats.total,
        actualTestFiles: stats.testFiles,
        duration,
        success,
      });
      
      const status = success ? '[PASSED]' : '[FAILED]';
      const matchStatus = plan.expectedTests === stats.total 
        ? '[MATCH]' 
        : plan.expectedTests > stats.total 
          ? '[MISSING]' 
          : '[EXTRA]';
      
      console.log(`  ${status} ${matchStatus} Actual: ${stats.passed} passed, ${stats.failed} failed, ${stats.total} total`);
      console.log(`  Expected: ${plan.expectedTests} | Actual: ${stats.total} | Difference: ${stats.total - plan.expectedTests}`);
      console.log(`  Duration: ${duration}ms`);
      console.log(`  Running Total: ${globalActualPassed} passed, ${globalActualFailed} failed, ${globalActualTotal} total (expected: ${globalExpected})`);
      
    } catch (error: any) {
      const duration = Date.now() - Date.now();
      const output = error.stdout || error.stderr || '';
      const stats = plan.testType === 'e2e' 
        ? parsePlaywrightOutput(output)
        : parseVitestOutput(output);
      
      globalActualPassed += stats.passed;
      globalActualFailed += stats.failed;
      globalActualTotal += stats.total;
      
      const success = false;
      
      results.push({
        package: plan.package,
        path: plan.path,
        testType: plan.testType,
        expectedTests: plan.expectedTests,
        actualPassed: stats.passed,
        actualFailed: stats.failed,
        actualTotal: stats.total,
        actualTestFiles: stats.testFiles,
        duration,
        success,
      });
      
      const matchStatus = plan.expectedTests === stats.total 
        ? '[MATCH]' 
        : plan.expectedTests > stats.total 
          ? '[MISSING]' 
          : '[EXTRA]';
      
      console.log(`  [FAILED] ${matchStatus} Actual: ${stats.passed} passed, ${stats.failed} failed, ${stats.total} total`);
      console.log(`  Expected: ${plan.expectedTests} | Actual: ${stats.total} | Difference: ${stats.total - plan.expectedTests}`);
      console.log(`  Running Total: ${globalActualPassed} passed, ${globalActualFailed} failed, ${globalActualTotal} total (expected: ${globalExpected})`);
    }
  }
  
  // Final summary
  const unitResults = results.filter(r => r.testType === 'unit');
  const e2eResults = results.filter(r => r.testType === 'e2e');
  
  console.log('\n' + '='.repeat(80));
  console.log('FINAL SUMMARY');
  console.log('='.repeat(80));
  console.log(`\nTotal Packages Tested: ${results.length}`);
  console.log(`\nExpected Test Cases: ${globalExpected}`);
  console.log(`Actual Test Cases Run: ${globalActualTotal}`);
  console.log(`Difference: ${globalActualTotal - globalExpected} ${globalActualTotal > globalExpected ? '(extra tests found)' : globalActualTotal < globalExpected ? '(tests may have been skipped)' : '(perfect match)'}`);
  
  if (testType === 'both') {
    const unitExpected = unitResults.reduce((sum, r) => sum + r.expectedTests, 0);
    const unitActual = unitResults.reduce((sum, r) => sum + r.actualTotal, 0);
    const e2eExpected = e2eResults.reduce((sum, r) => sum + r.expectedTests, 0);
    const e2eActual = e2eResults.reduce((sum, r) => sum + r.actualTotal, 0);
    
    console.log(`\nUnit/Integration Tests:`);
    console.log(`  Expected: ${unitExpected} | Actual: ${unitActual}`);
    console.log(`  Passed: ${unitResults.reduce((sum, r) => sum + r.actualPassed, 0)} | Failed: ${unitResults.reduce((sum, r) => sum + r.actualFailed, 0)}`);
    console.log(`\nE2E Tests:`);
    console.log(`  Expected: ${e2eExpected} | Actual: ${e2eActual}`);
    console.log(`  Passed: ${e2eResults.reduce((sum, r) => sum + r.actualPassed, 0)} | Failed: ${e2eResults.reduce((sum, r) => sum + r.actualFailed, 0)}`);
  }
  
  console.log(`\nTest Results:`);
  console.log(`  Passed: ${globalActualPassed}`);
  console.log(`  Failed: ${globalActualFailed}`);
  console.log(`  Total: ${globalActualTotal}`);
  console.log(`  Success Rate: ${globalActualTotal > 0 ? ((globalActualPassed / globalActualTotal) * 100).toFixed(2) : 0}%`);
  
  console.log('\n' + '='.repeat(80));
  console.log('PACKAGE BREAKDOWN (Expected vs Actual)');
  console.log('='.repeat(80));
  
  for (const result of results) {
    const status = result.success ? '[PASSED]' : '[FAILED]';
    const typeLabel = result.testType === 'e2e' ? '[E2E]' : '[UNIT]';
    const matchStatus = result.expectedTests === result.actualTotal 
      ? '[MATCH]' 
      : result.expectedTests > result.actualTotal 
        ? `[MISSING ${result.expectedTests - result.actualTotal}]` 
        : `[EXTRA ${result.actualTotal - result.expectedTests}]`;
    
    console.log(`\n${status} ${matchStatus} ${typeLabel} ${result.package}`);
    console.log(`  Expected: ${result.expectedTests} test cases`);
    console.log(`  Actual: ${result.actualTotal} test cases (${result.actualPassed} passed, ${result.actualFailed} failed)`);
    console.log(`  Test Files: ${result.actualTestFiles}`);
    console.log(`  Duration: ${result.duration}ms`);
  }
  
  if (globalActualFailed > 0) {
    console.log('\n[ERROR] Some tests failed!');
    process.exit(1);
  } else if (globalActualTotal !== globalExpected) {
    console.log(`\n[WARNING] Test count mismatch! Expected ${globalExpected} but ran ${globalActualTotal}`);
    // Don't exit with error for count mismatch, just warn
  } else {
    console.log('\n[SUCCESS] All tests passed and counts match!');
    process.exit(0);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const parallel = args.includes('--parallel');
  const unitOnly = args.includes('--unit');
  const e2eOnly = args.includes('--e2e');
  
  let testType: 'unit' | 'e2e' | 'both' = 'both';
  if (unitOnly && !e2eOnly) {
    testType = 'unit';
  } else if (e2eOnly && !unitOnly) {
    testType = 'e2e';
  }
  
  if (parallel) {
    console.log('[INFO] Parallel mode not yet supported with pre-counting');
    console.log('[INFO] Use without --parallel flag for sequential execution with counts\n');
    process.exit(1);
  } else {
    await runTestsSequential(testType);
  }
}

main().catch(error => {
  console.error('[ERROR]', error);
  process.exit(1);
});
