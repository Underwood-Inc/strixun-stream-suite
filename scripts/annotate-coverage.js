#!/usr/bin/env node
/**
 * Coverage Annotation Script for GitHub Actions
 * 
 * Analyzes coverage reports and generates GitHub Actions annotations
 * for files with coverage, files without coverage, and files with defects.
 */

import { readFileSync, existsSync } from 'fs';
import { relative } from 'path';

const COVERAGE_THRESHOLD = 80; // Minimum acceptable coverage percentage
const LOW_COVERAGE_THRESHOLD = 50; // Threshold for warning

/**
 * Parse coverage summary JSON file
 */
function parseCoverageSummary(filePath) {
  try {
    if (!existsSync(filePath)) {
      return null;
    }
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`✗ Failed to parse coverage file: ${filePath}`, error);
    return null;
  }
}

/**
 * Analyze coverage and categorize files
 */
function analyzeCoverage(summary, workspaceRoot = process.cwd()) {
  const covered = [];
  const uncovered = [];
  const lowCoverage = [];

  // Get all files from coverage summary (excluding 'total')
  const files = Object.keys(summary).filter(key => key !== 'total');

  for (const file of files) {
    const fileData = summary[file];
    if (!fileData || typeof fileData !== 'object' || !fileData.lines) {
      continue;
    }

    const coverage = fileData.lines.pct;
    const relativePath = file.startsWith(workspaceRoot)
      ? relative(workspaceRoot, file)
      : file;

    const coverageFile = {
      path: relativePath,
      coverage,
      lines: {
        covered: fileData.lines.covered,
        total: fileData.lines.total,
      },
      hasLowCoverage: coverage < LOW_COVERAGE_THRESHOLD,
      hasNoCoverage: coverage === 0,
    };

    if (coverageFile.hasNoCoverage) {
      uncovered.push(relativePath);
    } else if (coverageFile.hasLowCoverage) {
      lowCoverage.push(coverageFile);
      covered.push(coverageFile);
    } else {
      covered.push(coverageFile);
    }
  }

  return { covered, uncovered, lowCoverage };
}

/**
 * Generate GitHub Actions annotation
 */
function createAnnotation(type, file, message, line, col) {
  const parts = [`::${type}`];
  const properties = [`file=${file}`];
  
  if (line !== undefined) {
    properties.push(`line=${line}`);
  }
  if (col !== undefined) {
    properties.push(`col=${col}`);
  }
  
  if (properties.length > 0) {
    parts.push(properties.join(','));
  }
  
  parts.push(`::${message}`);
  return parts.join(' ');
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);
  const coveragePath = args[0] || 'coverage/coverage-summary.json';
  const workspaceRoot = args[1] || process.cwd();
  const serviceName = args[2] || 'Unknown Service';

  console.log(`ℹ Analyzing coverage for: ${serviceName}`);
  console.log(`ℹ Coverage file: ${coveragePath}`);
  console.log(`ℹ Workspace root: ${workspaceRoot}`);

  const summary = parseCoverageSummary(coveragePath);
  
  if (!summary) {
    console.log(`::warning::No coverage report found at ${coveragePath}`);
    console.log(`::notice::Coverage analysis skipped - report file not found`);
    process.exit(0);
  }

  const { covered, uncovered, lowCoverage } = analyzeCoverage(summary, workspaceRoot);
  const totalCoverage = summary.total?.lines?.pct || 0;

  // Output summary
  console.log(`\n## Coverage Analysis for ${serviceName}`);
  console.log(`**Total Coverage:** ${totalCoverage.toFixed(2)}%`);
  console.log(`**Files with Coverage:** ${covered.length}`);
  console.log(`**Files without Coverage:** ${uncovered.length}`);
  console.log(`**Files with Low Coverage (<${LOW_COVERAGE_THRESHOLD}%):** ${lowCoverage.length}\n`);

  // Annotate files with coverage
  console.log(`\n### Files with Test Coverage\n`);
  for (const file of covered) {
    if (!file.hasLowCoverage) {
      const message = `File has ${file.coverage.toFixed(2)}% coverage (${file.lines.covered}/${file.lines.total} lines)`;
      console.log(createAnnotation('notice', file.path, message));
    }
  }

  // Annotate files with low coverage (defects)
  console.log(`\n### Files with Low Coverage (Defects)\n`);
  for (const file of lowCoverage) {
    const message = `[DEFECT] Low coverage: ${file.coverage.toFixed(2)}% (${file.lines.covered}/${file.lines.total} lines). Target: ${COVERAGE_THRESHOLD}%`;
    console.log(createAnnotation('warning', file.path, message));
    console.log(`::notice file=${file.path}::Action Required: Add tests to increase coverage above ${COVERAGE_THRESHOLD}%`);
  }

  // Annotate files without coverage (defects)
  console.log(`\n### Files without Test Coverage (Defects)\n`);
  for (const file of uncovered) {
    const message = `[DEFECT] No test coverage detected. Action Required: Add test file for this module`;
    console.log(createAnnotation('warning', file, message));
    console.log(`::notice file=${file}::Remediation: Create corresponding test file (*.test.ts or *.spec.ts)`);
  }

  // Overall status
  if (totalCoverage < COVERAGE_THRESHOLD) {
    console.log(`\n::warning::Total coverage (${totalCoverage.toFixed(2)}%) is below threshold (${COVERAGE_THRESHOLD}%)`);
  } else {
    console.log(`\n::notice::Total coverage (${totalCoverage.toFixed(2)}%) meets threshold (${COVERAGE_THRESHOLD}%)`);
  }

  // Exit with appropriate code
  if (uncovered.length > 0 || lowCoverage.length > 0) {
    console.log(`\n⚠ Found ${uncovered.length} files without coverage and ${lowCoverage.length} files with low coverage`);
    process.exit(0); // Don't fail the build, just report
  } else {
    console.log(`\n✓ All files have adequate test coverage`);
    process.exit(0);
  }
}

main();

