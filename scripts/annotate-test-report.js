#!/usr/bin/env node
/**
 * Test Report Annotation Script for GitHub Actions
 * 
 * Reads TEST_REPORT.md and outputs it to GitHub Actions step summary
 * and creates annotations for packages with tests, without tests, and failures.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';

/**
 * Read and parse the test report markdown file
 */
function readTestReport(reportPath = 'TEST_REPORT.md') {
  if (!existsSync(reportPath)) {
    console.error(`✗ Test report not found: ${reportPath}`);
    process.exit(1);
  }

  try {
    return readFileSync(reportPath, 'utf-8');
  } catch (error) {
    console.error(`✗ Failed to read test report: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Parse test report and extract statistics
 */
function parseTestReport(reportContent) {
  const lines = reportContent.split('\n');
  const stats = {
    totalPackages: 0,
    totalFiles: 0,
    totalTests: 0,
    totalSkipped: 0,
    successRate: '0.00',
    packages: []
  };

  let inPackageBreakdown = false;
  let inPackagesWithTests = false;
  let inPackagesWithoutTests = false;

  for (const line of lines) {
    // Extract overall statistics
    const totalPackagesMatch = line.match(/\*\*Total Packages Tested\*\*:\s+(\d+)/);
    if (totalPackagesMatch) {
      stats.totalPackages = parseInt(totalPackagesMatch[1], 10);
    }

    const totalFilesMatch = line.match(/\*\*Total Test Files\*\*:\s+(\d+)/);
    if (totalFilesMatch) {
      stats.totalFiles = parseInt(totalFilesMatch[1], 10);
    }

    const totalTestsMatch = line.match(/\*\*Total Tests\*\*:\s+(\d+)/);
    if (totalTestsMatch) {
      stats.totalTests = parseInt(totalTestsMatch[1], 10);
    }

    const totalSkippedMatch = line.match(/\*\*Total Skipped\*\*:\s+(\d+)/);
    if (totalSkippedMatch) {
      stats.totalSkipped = parseInt(totalSkippedMatch[1], 10);
    }

    const successRateMatch = line.match(/\*\*Success Rate\*\*:\s+([\d.]+)%/);
    if (successRateMatch) {
      stats.successRate = successRateMatch[1];
    }

    // Track section boundaries
    if (line.includes('## Package Breakdown')) {
      inPackageBreakdown = true;
      continue;
    }
    if (line.includes('## Packages with Tests')) {
      inPackageBreakdown = false;
      inPackagesWithTests = true;
      continue;
    }
    if (line.includes('## Packages without Tests')) {
      inPackagesWithTests = false;
      inPackagesWithoutTests = true;
      continue;
    }

    // Parse package table rows
    if (inPackageBreakdown && line.startsWith('|') && !line.includes('---') && !line.includes('Package')) {
      const parts = line.split('|').map(p => p.trim()).filter(p => p);
      if (parts.length >= 5) {
        const [pkg, files, tests, skipped, status] = parts;
        stats.packages.push({
          name: pkg,
          files: parseInt(files, 10) || 0,
          tests: parseInt(tests, 10) || 0,
          skipped: parseInt(skipped, 10) || 0,
          status: status
        });
      }
    }
  }

  return stats;
}

/**
 * Output report to GitHub step summary
 */
function outputToStepSummary(reportContent) {
  // Output the full report to step summary
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    try {
      writeFileSync(summaryPath, reportContent + '\n', { flag: 'a' });
    } catch (error) {
      console.error(`✗ Failed to write to step summary: ${error.message}`);
      // Fallback: output to console
      console.log('\n' + reportContent);
    }
  } else {
    // Fallback: output to console
    console.log('\n' + reportContent);
  }
}

/**
 * Create GitHub annotations for packages
 */
function createAnnotations(stats) {
  const packagesWithTests = stats.packages.filter(p => p.tests > 0);
  const packagesWithoutTests = stats.packages.filter(p => p.tests === 0);

  // Notice for packages with tests
  for (const pkg of packagesWithTests) {
    const message = `${pkg.name}: ${pkg.tests} tests passed`;
    if (pkg.skipped > 0) {
      console.log(`::notice::${pkg.name} has ${pkg.tests} tests (${pkg.skipped} skipped)`);
    } else {
      console.log(`::notice::${pkg.name} has ${pkg.tests} tests`);
    }
  }

  // Warning for packages without tests
  for (const pkg of packagesWithoutTests) {
    console.log(`::warning::${pkg.name} has no tests`);
  }

  // Overall summary annotation
  if (stats.totalTests > 0) {
    console.log(`::notice::Test Summary: ${stats.totalTests} tests across ${stats.totalPackages} packages (${stats.successRate}% success rate)`);
  } else {
    console.log(`::warning::No tests found across ${stats.totalPackages} packages`);
  }
}

/**
 * Main function
 */
function main() {
  const reportPath = process.argv[2] || 'TEST_REPORT.md';
  
  // Read the test report
  const reportContent = readTestReport(reportPath);
  
  // Output full report to step summary
  outputToStepSummary(reportContent);
  
  // Parse and create annotations
  const stats = parseTestReport(reportContent);
  createAnnotations(stats);
}

// Run the script
try {
  main();
} catch (error) {
  console.error('✗ Failed to annotate test report:', error.message);
  process.exit(1);
}

