#!/usr/bin/env node

/**
 * Cross-platform helper script to run the appropriate log tailer script
 * Detects the operating system and runs the corresponding script
 */

import { platform } from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const isWindows = platform() === 'win32';

if (isWindows) {
    const scriptPath = join(__dirname, 'tail-logs.ps1');
    console.log('❓ Detected Windows - Running PowerShell script...\n');
    try {
        execSync(
            `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`,
            { stdio: 'inherit', cwd: rootDir }
        );
    } catch (error) {
        console.error('❌ Error running PowerShell script:', error.message);
        process.exit(1);
    }
} else {
    const scriptPath = join(__dirname, 'tail-logs.sh');
    console.log('❓ Detected Unix/Linux/macOS - Running Bash script...\n');
    try {
        execSync(
            `bash "${scriptPath}"`,
            { stdio: 'inherit', cwd: rootDir }
        );
    } catch (error) {
        console.error('❌ Error running Bash script:', error.message);
        process.exit(1);
    }
}

