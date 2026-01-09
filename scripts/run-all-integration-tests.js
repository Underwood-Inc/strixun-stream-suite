#!/usr/bin/env node
/**
 * Run all integration tests across all services
 * 
 * This script automatically discovers all *.integration.test.ts files
 * and runs them grouped by service/project.
 * Workers are automatically started by the shared setup file.
 * 
 * Usage: node scripts/run-all-integration-tests.js
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join, relative } from 'path';
import { readdir, stat } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Set environment variable so shared setup knows we're running integration tests
process.env.VITEST_INTEGRATION = 'true';

/**
 * Recursively find all integration test files
 */
async function findIntegrationTests(dir, relativePath = '', found = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relPath = relativePath ? join(relativePath, entry.name) : entry.name;
    
    // Skip node_modules, dist, .git, and other build/cache directories
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') && entry.name !== '.') continue;
      if (entry.name === 'node_modules') continue;
      if (entry.name === 'dist') continue;
      if (entry.name === '.wrangler') continue;
      if (entry.name === '.turbo') continue;
      
      await findIntegrationTests(fullPath, relPath, found);
    } else if (entry.isFile() && entry.name.endsWith('.integration.test.ts')) {
      found.push({
        file: relPath,
        fullPath: fullPath,
        dir: dir
      });
    }
  }
  
  return found;
}

/**
 * Determine the service/project directory for a test file
 * Returns the directory that should contain vitest.config.ts
 */
async function getServiceDir(testFile) {
  const parts = testFile.file.split(/[/\\]/);
  
  // Find the service root (where vitest.config.ts would be)
  // For serverless/* services, it's the serverless/{service} directory
  // For mods-hub, it's the mods-hub directory
  // For other projects, it's the project root
  
  if (parts[0] === 'serverless' && parts.length > 1) {
    // serverless/{service}/...
    return join(rootDir, parts[0], parts[1]);
  } else if (parts[0] === 'mods-hub') {
    // mods-hub/...
    return join(rootDir, 'mods-hub');
  } else {
    // Other projects - use the directory containing the test file
    // But go up to find the project root (where package.json is)
    let currentDir = testFile.dir;
    while (currentDir !== rootDir) {
      try {
        const packageJsonPath = join(currentDir, 'package.json');
        const stats = await stat(packageJsonPath);
        if (stats.isFile()) {
          return currentDir;
        }
      } catch {
        // package.json doesn't exist, continue up
      }
      currentDir = dirname(currentDir);
    }
    // Fallback to test file directory
    return testFile.dir;
  }
}

/**
 * Group test files by their service directory
 */
async function groupTestsByService(testFiles) {
  const serviceMap = new Map();
  
  for (const testFile of testFiles) {
    const serviceDir = await getServiceDir(testFile);
    const serviceName = relative(rootDir, serviceDir);
    
    if (!serviceMap.has(serviceName)) {
      serviceMap.set(serviceName, {
        name: serviceName,
        dir: serviceDir,
        files: []
      });
    }
    
    serviceMap.get(serviceName).files.push(testFile);
  }
  
  return Array.from(serviceMap.values());
}

// Main execution
(async () => {
  try {
    console.log('[Integration Tests] Discovering all integration test files...\n');
    
    // Find all integration test files
    const testFiles = await findIntegrationTests(rootDir);
    
    if (testFiles.length === 0) {
      console.log('[Integration Tests] No integration test files found.');
      process.exit(0);
    }
    
    console.log(`[Integration Tests] Found ${testFiles.length} integration test file(s):`);
    testFiles.forEach(({ file }) => console.log(`  - ${file}`));
    console.log('');
    
    // Group tests by service
    console.log('[Integration Tests] Grouping tests by service...\n');
    const services = await groupTestsByService(testFiles);
    
    console.log(`[Integration Tests] Found ${services.length} service(s) with integration tests:\n`);
    services.forEach(service => {
      console.log(`  - ${service.name} (${service.files.length} test file(s))`);
    });
    console.log('');
    console.log('[Integration Tests] Workers will start automatically via shared setup.\n');
    
    let totalPassed = 0;
    let totalFailed = 0;
    const results = [];
    
    // Run tests for each service
    for (const service of services) {
      try {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`[Integration Tests] Running tests in ${service.name}...`);
        console.log(`  Test files: ${service.files.map(f => f.file).join(', ')}`);
        console.log('='.repeat(60) + '\n');
        
        // Get relative paths from service directory
        const testFilePaths = service.files.map(testFile => {
          return relative(service.dir, testFile.fullPath).replace(/\\/g, '/');
        });
        
        // Run vitest with specific file paths
        // The shared setup will automatically start workers
        const vitestCommand = `pnpm vitest run ${testFilePaths.join(' ')}`;
        execSync(vitestCommand, {
          stdio: 'inherit',
          cwd: service.dir,
          env: {
            ...process.env,
            VITEST_INTEGRATION: 'true'
          }
        });
        
        results.push({ service: service.name, status: 'passed', fileCount: service.files.length });
        totalPassed++;
        console.log(`\n[Integration Tests] ✓ ${service.name} tests passed (${service.files.length} file(s))\n`);
      } catch (error) {
        results.push({ service: service.name, status: 'failed', fileCount: service.files.length });
        totalFailed++;
        console.error(`\n[Integration Tests] ✗ ${service.name} tests failed (${service.files.length} file(s))\n`);
        // Continue with other services
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('[Integration Tests] Summary:');
    console.log('='.repeat(60));
    results.forEach(({ service, status, fileCount }) => {
      const icon = status === 'passed' ? '✓' : '✗';
      console.log(`  ${icon} ${service}: ${status} (${fileCount} test file(s))`);
    });
    console.log(`\n  Total services: ${services.length}`);
    console.log(`  Total test files: ${testFiles.length}`);
    console.log(`  Passed: ${totalPassed}`);
    console.log(`  Failed: ${totalFailed}`);
    console.log('='.repeat(60) + '\n');
    
    if (totalFailed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('[Integration Tests] Error:', error);
    process.exit(1);
  }
})();
