/**
 * Strixun Stream Suite - Installer/Script Manager Module
 * 
 * Handles script installation wizard, path detection, and script generation
 * 
 * @version 1.0.0
 */

// ============ Available Scripts ============
const AVAILABLE_SCRIPTS = [
    {
        id: 'source_animations',
        name: 'Source Animations',
        file: 'source_animations.lua',
        version: '2.7.0',
        icon: '[FEATURE]',
        description: 'Animates sources when visibility is toggled. Supports fade, slide, zoom, and pop animations with customizable easing.',
        features: ['Fade In/Out', 'Slide animations', 'Zoom effects', 'Pop animations', 'Per-source config', 'No flicker!']
    },
    {
        id: 'source_swap',
        name: 'Source Swap',
        file: 'source_swap.lua',
        version: '3.1.0',
        icon: ' ★ ',
        description: 'Smoothly swap position and size of two sources with animation. Supports multiple swap configs with hotkeys.',
        features: ['Animated swaps', 'Multiple configs', 'Hotkey support', 'Aspect ratio control', 'Works with groups']
    },
    {
        id: 'text_cycler',
        name: 'Text Cycler',
        file: 'text_cycler.lua',
        version: '1.0.0',
        icon: ' ★ ',
        description: 'Cycles through text strings with optional transition animations like obfuscate, typewriter, and glitch effects.',
        features: ['Text cycling', 'Obfuscate effect', 'Typewriter effect', 'Glitch effect', 'Hotkey support']
    },
    {
        id: 'quick_controls',
        name: 'Quick Controls',
        file: 'quick_controls.lua',
        version: '1.0.0',
        icon: '[PERF]',
        description: 'Hotkey to cycle aspect ratio override mode for source swaps.',
        features: ['Aspect cycle hotkey', 'Quick access']
    },
    {
        id: 'script_manager',
        name: 'Script Manager',
        file: 'script_manager.lua',
        version: '1.0.0',
        icon: ' ★ ',
        description: 'Unified dashboard to manage and configure all animation scripts in OBS.',
        features: ['Script overview', 'Enable/disable scripts', 'Status at a glance']
    }
];

// ============ Installer State ============
let installerState = {
    sourcePath: '',
    targetPath: '',
    selectedScripts: [],
    existingFiles: [],
    installAction: 'replace', // 'skip', 'backup', 'replace'
    generatedScript: ''
};

// ============ Initialization ============
function initScriptsAndInstaller() {
    renderScriptsList();
    detectSourcePath();
    detectOBSPath();
    
    // Set initial dock context UI (for step 4 if user navigates there)
    if (typeof updateDockContextUI === 'function') {
        updateDockContextUI();
    }
}

function renderScriptsList() {
    const container = document.getElementById('scriptsList');
    if (!container) return;
    
    container.innerHTML = AVAILABLE_SCRIPTS.map(script => `
        <div class="script-card">
            <div class="script-header">
                <span class="script-icon">${script.icon}</span>
                <div>
                    <div class="script-name">${script.name}</div>
                    <div class="script-version">v${script.version}</div>
                </div>
            </div>
            <p class="script-desc">${script.description}</p>
            <div class="script-file">${script.file}</div>
        </div>
    `).join('');
}

// ============ Path Detection ============
function detectSourcePath() {
    // Get current page URL and extract folder path
    const url = window.location.href;
    let path = '';
    
    if (url.startsWith('file:///')) {
        path = url.replace('file:///', '').replace(/\//g, '\\');
        path = path.substring(0, path.lastIndexOf('\\'));
        path = decodeURIComponent(path);
    } else {
        path = '(Run from local file to detect)';
    }
    
    installerState.sourcePath = path;
    const input = document.getElementById('installSourcePath');
    if (input) input.value = path;
}

function detectOBSPath() {
    // Common OBS paths for different OS
    const suggestions = [];
    
    // Detect OS from user agent
    const ua = navigator.userAgent.toLowerCase();
    
    if (ua.includes('win')) {
        // Windows paths
        const username = installerState.sourcePath.match(/Users\\([^\\]+)/)?.[1] || 'USERNAME';
        suggestions.push(
            `C:\\Users\\${username}\\AppData\\Roaming\\obs-studio\\basic\\scripts`,
            `C:\\Program Files\\obs-studio\\data\\obs-plugins\\frontend-tools\\scripts`,
            `C:\\ProgramData\\obs-studio\\basic\\scripts`
        );
    } else if (ua.includes('mac')) {
        // macOS paths
        suggestions.push(
            '~/Library/Application Support/obs-studio/basic/scripts',
            '/Applications/OBS.app/Contents/Resources/data/obs-plugins/frontend-tools/scripts'
        );
    } else {
        // Linux paths
        suggestions.push(
            '~/.config/obs-studio/basic/scripts',
            '/usr/share/obs/obs-plugins/frontend-tools/scripts'
        );
    }
    
    // Render suggestions
    const container = document.getElementById('pathSuggestions');
    if (container) {
        container.innerHTML = suggestions.map(path => 
            `<span class="path-suggestion" onclick="window.Installer.setTargetPath('${path.replace(/\\/g, '\\\\')}')">${path}</span>`
        ).join('');
    }
    
    // Set first suggestion as default
    if (!installerState.targetPath && suggestions.length > 0) {
        setTargetPath(suggestions[0]);
    }
}

function setTargetPath(path) {
    installerState.targetPath = path;
    const input = document.getElementById('installTargetPath');
    if (input) input.value = path;
}

function browseTargetPath() {
    // Can't actually browse in browser, but show instructions
    const path = prompt('Enter the full path to your OBS scripts folder:', installerState.targetPath);
    if (path) {
        setTargetPath(path);
    }
}

// ============ Installation Wizard ============
function goToInstallStep(step) {
    // Hide all steps
    document.querySelectorAll('.install-step').forEach(s => s.classList.remove('active'));
    
    // Show target step
    const stepEl = document.getElementById('installStep' + step);
    if (stepEl) stepEl.classList.add('active');
    
    // Step-specific logic
    if (step === 2) {
        renderInstallScriptsList();
    } else if (step === 3) {
        renderInstallReview();
    } else if (step === 4) {
        // Update UI based on dock vs browser context
        if (typeof updateDockContextUI === 'function') {
            updateDockContextUI();
        }
    }
}

function renderInstallScriptsList() {
    const container = document.getElementById('installScriptsList');
    if (!container) return;
    
    // Check for existing files (simulated - in real scenario would need backend)
    // For now, we'll show all as "new" and let user indicate if they exist
    
    container.innerHTML = AVAILABLE_SCRIPTS.map(script => {
        const isSelected = installerState.selectedScripts.includes(script.id);
        const existsInTarget = installerState.existingFiles.includes(script.file);
        
        let statusTag = '<span class="script-status-tag new">New</span>';
        if (existsInTarget) {
            statusTag = '<span class="script-status-tag exists">Exists</span>';
        }
        
        return `
            <div class="install-script-item">
                <input type="checkbox" id="install_${script.id}" 
                       ${isSelected ? 'checked' : ''} 
                       onchange="window.Installer.toggleScriptSelection('${script.id}')">
                <div class="script-info">
                    <div class="script-name">${script.icon} ${script.name}</div>
                    <div style="font-size:0.8em;color:var(--muted)">${script.file} • v${script.version}</div>
                </div>
                ${statusTag}
            </div>
        `;
    }).join('');
    
    // Add "check existing" button
    container.innerHTML += `
        <div style="margin-top:8px">
            <button onclick="window.Installer.markExistingFiles()"> ★ I have some scripts already installed</button>
        </div>
    `;
    
    // Select all by default if none selected
    if (installerState.selectedScripts.length === 0) {
        AVAILABLE_SCRIPTS.forEach(s => installerState.selectedScripts.push(s.id));
        renderInstallScriptsList();
    }
}

function toggleScriptSelection(scriptId) {
    const idx = installerState.selectedScripts.indexOf(scriptId);
    if (idx > -1) {
        installerState.selectedScripts.splice(idx, 1);
    } else {
        installerState.selectedScripts.push(scriptId);
    }
}

function markExistingFiles() {
    const existing = prompt(
        'Enter the filenames of scripts you already have installed (comma-separated):\n\n' +
        'Example: source_animations.lua, source_swap.lua\n\n' +
        'Leave empty if none installed.'
    );
    
    if (existing !== null) {
        installerState.existingFiles = existing
            .split(',')
            .map(f => f.trim())
            .filter(f => f.length > 0);
        
        if (installerState.existingFiles.length > 0) {
            document.getElementById('existingInstallCard').style.display = 'block';
            renderExistingInstallInfo();
        } else {
            document.getElementById('existingInstallCard').style.display = 'none';
        }
        
        renderInstallScriptsList();
    }
}

function renderExistingInstallInfo() {
    const container = document.getElementById('existingInstallInfo');
    if (!container) return;
    
    container.innerHTML = `
        <p>The following scripts appear to already exist in your target folder:</p>
        <ul style="margin:8px 0 0 16px">
            ${installerState.existingFiles.map(f => `<li>${f}</li>`).join('')}
        </ul>
        <p style="margin-top:8px;color:var(--muted);font-size:0.9em">
            Choose how to handle existing files:
        </p>
    `;
}

function handleExistingInstall(action) {
    installerState.installAction = action;
    
    const actionText = {
        'skip': 'Skipping existing files',
        'backup': 'Will backup existing files before replacing',
        'replace': 'Will replace all existing files'
    };
    
    if (typeof log === 'function') {
        log(actionText[action], 'info');
    }
    document.getElementById('existingInstallCard').style.display = 'none';
}

function renderInstallReview() {
    const container = document.getElementById('installReview');
    if (!container) return;
    
    const selectedScripts = AVAILABLE_SCRIPTS.filter(s => 
        installerState.selectedScripts.includes(s.id)
    );
    
    if (selectedScripts.length === 0) {
        container.innerHTML = '<p style="color:var(--danger)">No scripts selected. Go back and select at least one script.</p>';
        return;
    }
    
    container.innerHTML = `
        <div class="install-review-item">
            <span><strong>Source:</strong></span>
            <span style="font-size:0.85em">${installerState.sourcePath || '(not set)'}</span>
        </div>
        <div class="install-review-item">
            <span><strong>Target:</strong></span>
            <span style="font-size:0.85em">${installerState.targetPath || '(not set)'}</span>
        </div>
        <div class="install-review-item">
            <span><strong>Scripts:</strong></span>
            <span>${selectedScripts.length} selected</span>
        </div>
        <div style="margin-top:8px">
            ${selectedScripts.map(s => `
                <div style="display:flex;justify-content:space-between;padding:2px 0;font-size:0.85em">
                    <span>${s.icon} ${s.name}</span>
                    <span style="color:var(--muted)">${s.file}</span>
                </div>
            `).join('')}
        </div>
        ${installerState.existingFiles.length > 0 ? `
            <div class="install-review-item" style="margin-top:8px;border-top:1px solid var(--bg);padding-top:8px">
                <span><strong>Existing files:</strong></span>
                <span>${installerState.installAction}</span>
            </div>
        ` : ''}
    `;
}

// ============ Script Generation ============
function generateInstallScript() {
    const method = document.getElementById('installMethod').value;
    const selectedScripts = AVAILABLE_SCRIPTS.filter(s => 
        installerState.selectedScripts.includes(s.id)
    );
    
    if (selectedScripts.length === 0) {
        if (typeof log === 'function') {
            log('No scripts selected', 'error');
        }
        return;
    }
    
    const source = installerState.sourcePath;
    const target = installerState.targetPath;
    
    if (!source || !target || source.includes('(') || target.includes('(')) {
        if (typeof log === 'function') {
            log('Set valid source and target paths first', 'error');
        }
        return;
    }
    
    let script = '';
    
    switch (method) {
        case 'powershell':
            script = generatePowerShellScript(selectedScripts, source, target);
            break;
        case 'batch':
            script = generateBatchScript(selectedScripts, source, target);
            break;
        case 'bash':
            script = generateBashScript(selectedScripts, source, target);
            break;
        case 'manual':
            script = generateManualInstructions(selectedScripts, source, target);
            break;
    }
    
    installerState.generatedScript = script;
    
    const output = document.getElementById('installOutput');
    if (output) output.textContent = script;
    
    goToInstallStep(4);
}

function generatePowerShellScript(scripts, source, target) {
    const backup = installerState.installAction === 'backup';
    const skip = installerState.installAction === 'skip';
    
    let ps = `# Strixun's Stream Suite Installer
# Generated: ${new Date().toISOString()}
# Run this script as Administrator

$source = "${source}"
$target = "${target}"

# Create target directory if it doesn't exist
if (!(Test-Path $target)) {
    New-Item -ItemType Directory -Path $target -Force
    Write-Host "Created directory: $target" -ForegroundColor Green
}

`;

    if (backup) {
        ps += `# Backup existing files
$backupDir = "$target\\backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
Write-Host "Backup directory: $backupDir" -ForegroundColor Cyan

`;
    }

    scripts.forEach(s => {
        const isExisting = installerState.existingFiles.includes(s.file);
        
        if (skip && isExisting) {
            ps += `# Skipping ${s.file} (already exists)\n`;
            ps += `Write-Host "Skipped: ${s.file} (exists)" -ForegroundColor Yellow\n\n`;
        } else {
            if (backup && isExisting) {
                ps += `# Backup ${s.file}
if (Test-Path "$target\\${s.file}") {
    Copy-Item "$target\\${s.file}" "$backupDir\\${s.file}"
    Write-Host "Backed up: ${s.file}" -ForegroundColor Cyan
}
`;
            }
            ps += `# Install ${s.name}
Copy-Item "$source\\${s.file}" "$target\\${s.file}" -Force
Write-Host "Installed: ${s.file}" -ForegroundColor Green

`;
        }
    });

    ps += `
Write-Host ""
Write-Host "Installation complete!" -ForegroundColor Green
Write-Host "Restart OBS and go to Tools > Scripts to add the scripts." -ForegroundColor White
Write-Host ""
Read-Host "Press Enter to exit"
`;

    return ps;
}

function generateBatchScript(scripts, source, target) {
    const backup = installerState.installAction === 'backup';
    const skip = installerState.installAction === 'skip';
    
    let bat = `@echo off
REM Strixun's Stream Suite Installer
REM Generated: ${new Date().toISOString()}
REM Run this script as Administrator

set "source=${source}"
set "target=${target}"

REM Create target directory if needed
if not exist "%target%" mkdir "%target%"

`;

    if (backup) {
        bat += `REM Create backup directory
set "backup=%target%\\backup_%date:~-4%%date:~-7,2%%date:~-10,2%"
mkdir "%backup%" 2>nul

`;
    }

    scripts.forEach(s => {
        const isExisting = installerState.existingFiles.includes(s.file);
        
        if (skip && isExisting) {
            bat += `REM Skipping ${s.file} (already exists)\necho Skipped: ${s.file}\n\n`;
        } else {
            if (backup && isExisting) {
                bat += `if exist "%target%\\${s.file}" copy "%target%\\${s.file}" "%backup%\\${s.file}"\n`;
            }
            bat += `copy /Y "%source%\\${s.file}" "%target%\\${s.file}"\necho Installed: ${s.file}\n\n`;
        }
    });

    bat += `
echo.
echo Installation complete!
echo Restart OBS and go to Tools ^> Scripts to add the scripts.
pause
`;

    return bat;
}

function generateBashScript(scripts, source, target) {
    const backup = installerState.installAction === 'backup';
    const skip = installerState.installAction === 'skip';
    
    let bash = `#!/bin/bash
# Strixun's Stream Suite Installer
# Generated: ${new Date().toISOString()}
# Run: chmod +x install.sh && ./install.sh

SOURCE="${source.replace(/\\/g, '/')}"
TARGET="${target.replace(/\\/g, '/')}"

# Create target directory
mkdir -p "$TARGET"

`;

    if (backup) {
        bash += `# Create backup
BACKUP="$TARGET/backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP"

`;
    }

    scripts.forEach(s => {
        const isExisting = installerState.existingFiles.includes(s.file);
        
        if (skip && isExisting) {
            bash += `# Skipping ${s.file} (already exists)\necho "Skipped: ${s.file}"\n\n`;
        } else {
            if (backup && isExisting) {
                bash += `[ -f "$TARGET/${s.file}" ] && cp "$TARGET/${s.file}" "$BACKUP/${s.file}"\n`;
            }
            bash += `cp "$SOURCE/${s.file}" "$TARGET/${s.file}"\necho "Installed: ${s.file}"\n\n`;
        }
    });

    bash += `
echo ""
echo "Installation complete!"
echo "Restart OBS and go to Tools > Scripts to add the scripts."
`;

    return bash;
}

function generateManualInstructions(scripts, source, target) {
    let manual = `=== Strixun's Stream Suite - Manual Installation ===
Generated: ${new Date().toISOString()}

SOURCE FOLDER:
${source}

TARGET FOLDER:
${target}

STEPS:
1. Open File Explorer
2. Navigate to the SOURCE folder above
3. Copy the following files:

`;

    scripts.forEach((s, i) => {
        manual += `   ${i + 1}. ${s.file} (${s.name})\n`;
    });

    manual += `
4. Navigate to the TARGET folder above
   (Create it if it doesn't exist)

5. Paste the files

6. Open OBS Studio
7. Go to Tools > Scripts
8. Click the + button
9. Navigate to: ${target}
10. Select all the .lua files and click Open

11. Configure each script in the Scripts window

Done! Your scripts are now installed.
`;

    return manual;
}

function copyInstallScript() {
    if (!installerState.generatedScript) {
        if (typeof log === 'function') {
            log('Generate a script first', 'error');
        }
        return;
    }
    
    navigator.clipboard.writeText(installerState.generatedScript).then(() => {
        if (typeof log === 'function') {
            log('Script copied to clipboard!', 'success');
        }
    });
}

function downloadInstallScript() {
    if (!installerState.generatedScript) {
        if (typeof log === 'function') {
            log('Generate a script first', 'error');
        }
        return;
    }
    
    const method = document.getElementById('installMethod').value;
    const extensions = {
        'powershell': 'ps1',
        'batch': 'bat',
        'bash': 'sh',
        'manual': 'txt'
    };
    
    const filename = `obs_animation_suite_install.${extensions[method]}`;
    const blob = new Blob([installerState.generatedScript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // In OBS dock, download likely failed - offer clipboard fallback
    if (typeof isOBSDock === 'function' && isOBSDock()) {
        // Give the download a moment to potentially work, then offer fallback
        setTimeout(() => {
            if (confirm(`Download may not work in OBS dock.\n\nCopy script to clipboard instead?\n\nSave as: ${filename}`)) {
                copyInstallScript();
            }
        }, 500);
    } else {
        if (typeof log === 'function') {
            log(`Downloaded ${filename}`, 'success');
        }
    }
}

// ============ Exports ============
if (typeof window !== 'undefined') {
    window.Installer = {
        init: initScriptsAndInstaller,
        renderScriptsList,
        detectSourcePath,
        detectOBSPath,
        setTargetPath,
        browseTargetPath,
        goToInstallStep,
        renderInstallScriptsList,
        toggleScriptSelection,
        markExistingFiles,
        renderExistingInstallInfo,
        handleExistingInstall,
        renderInstallReview,
        generateInstallScript,
        copyInstallScript,
        downloadInstallScript,
        getAvailableScripts: () => AVAILABLE_SCRIPTS,
        getState: () => installerState
    };
}

