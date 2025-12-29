import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';

function generateReport() {
  // Delete old report file if it exists
  if (existsSync('TEST_REPORT.md')) {
    try {
      unlinkSync('TEST_REPORT.md');
    } catch (error) {
      // Ignore errors deleting old report
    }
  }
  
  // Read the test output file
  let output = '';
  if (existsSync('test-output.txt')) {
    output = readFileSync('test-output.txt', 'utf8');
  } else {
    console.error('[ERROR] test-output.txt not found. Tests must be run first.');
    process.exit(1);
  }
  try {
    const packages = {};
    const lines = output.split('\n');
    let currentPackage = null;
    let currentFiles = 0;
    
    for (const line of lines) {
      // Match package name - handle both "package test$" and "package test:" formats
      const pkgMatch = line.match(/(\S+)\s+test[:$]/);
      if (pkgMatch) {
        currentPackage = pkgMatch[1];
        currentFiles = 0;
      }
      
      // Match test files line - must come before tests line
      const filesMatch = line.match(/Test Files\s+(\d+)\s+passed(?:\s+\|\s+(\d+)\s+skipped)?/);
      if (filesMatch && currentPackage) {
        currentFiles = parseInt(filesMatch[1], 10);
      }
      
      // Match tests line
      const testsMatch = line.match(/Tests\s+(\d+)\s+passed(?:\s+\|\s+(\d+)\s+skipped)?/);
      if (testsMatch && currentPackage) {
        const tests = parseInt(testsMatch[1], 10);
        const skipped = testsMatch[2] ? parseInt(testsMatch[2], 10) : 0;
        packages[currentPackage] = {
          Files: currentFiles,
          Tests: tests,
          Skipped: skipped
        };
        currentFiles = 0;
      }
      
      // Match "No test files found"
      if (line.includes('No test files found') && currentPackage) {
        if (!packages[currentPackage]) {
          packages[currentPackage] = {
            Files: 0,
            Tests: 0,
            Skipped: 0
          };
        }
      }
    }
    
    // Calculate totals
    const totalFiles = Object.values(packages).reduce((sum, p) => sum + p.Files, 0);
    const totalTests = Object.values(packages).reduce((sum, p) => sum + p.Tests, 0);
    const totalSkipped = Object.values(packages).reduce((sum, p) => sum + p.Skipped, 0);
    const successRate = totalTests + totalSkipped > 0 
      ? ((totalTests / (totalTests + totalSkipped)) * 100).toFixed(2)
      : '0.00';
    
    // Generate report
    let report = `# Test Summary Report
Generated: ${new Date().toISOString().replace('T', ' ').substring(0, 19)}

## Overall Statistics
- **Total Packages Tested**: ${Object.keys(packages).length}
- **Total Test Files**: ${totalFiles}
- **Total Tests**: ${totalTests}
- **Total Skipped**: ${totalSkipped}
- **Success Rate**: ${successRate}%

## Package Breakdown

| Package | Test Files | Tests | Skipped | Status |
|---------|-----------|-------|---------|--------|
`;
    
    // Sort packages and add to table
    Object.entries(packages)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([pkg, stats]) => {
        const status = stats.Tests > 0 ? 'PASS' : 'NO TESTS';
        report += `| ${pkg} | ${stats.Files} | ${stats.Tests} | ${stats.Skipped} | ${status} |\n`;
      });
    
    report += '\n## Packages with Tests\n';
    Object.entries(packages)
      .filter(([, stats]) => stats.Tests > 0)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([pkg, stats]) => {
        report += `- **${pkg}**: ${stats.Tests} tests across ${stats.Files} file(s)`;
        if (stats.Skipped > 0) {
          report += ` (${stats.Skipped} skipped)`;
        }
        report += '\n';
      });
    
    report += '\n## Packages without Tests\n';
    Object.entries(packages)
      .filter(([, stats]) => stats.Tests === 0)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([pkg]) => {
        report += `- ${pkg}\n`;
      });
    
    // Write report
    writeFileSync('TEST_REPORT.md', report, 'utf8');
    console.log('\n[SUCCESS] Test report generated: TEST_REPORT.md');
    
  } catch (error) {
    console.error('\n[ERROR] Failed to generate report:', error.message);
    process.exit(1);
  }
}

// Run the report generation
generateReport();
