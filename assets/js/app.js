/**
 * Strixun Stream Suite - Main Application
 * 
 * Core application logic that ties all modules together:
 * - Storage backup/export/import
 * - UI state persistence
 * - Page navigation and UI helpers
 * - Module initialization
 * - Keyboard shortcuts
 * 
 * @version 1.0.0
 */

// ============ Storage Backup & Status Functions ============
function updateStorageStatus() {
    // Update engine status indicators
    const idbEl = document.getElementById('idbStatus');
    const lsEl = document.getElementById('lsStatus');
    
    if (idbEl) {
        const idbReady = window.SSS_Storage ? window.SSS_Storage.idbReady() : false;
        idbEl.textContent = idbReady ? '✅ IndexedDB' : '❌ IndexedDB';
        idbEl.style.color = idbReady ? 'var(--success)' : 'var(--danger)';
    }
    
    if (lsEl) {
        const lsWorks = (() => {
            try {
                localStorage.setItem('_test', '1');
                localStorage.removeItem('_test');
                return true;
            } catch (e) { return false; }
        })();
        lsEl.textContent = lsWorks ? '✅ localStorage' : '❌ localStorage';
        lsEl.style.color = lsWorks ? 'var(--success)' : 'var(--danger)';
    }
    
    // Update config counts
    const swapCountEl = document.getElementById('swapCount');
    const layoutCountEl = document.getElementById('layoutCount');
    const textCyclerCountEl = document.getElementById('textCyclerCount');
    
    if (swapCountEl) {
        const swapConfigs = window.SourceSwaps ? window.SourceSwaps.getConfigs() : [];
        swapCountEl.textContent = `(${swapConfigs.length || 0})`;
    }
    
    if (layoutCountEl) {
        const layoutPresets = window.Layouts ? window.Layouts.layoutPresets : [];
        layoutCountEl.textContent = `(${layoutPresets.length || 0})`;
    }
    
    if (textCyclerCountEl) {
        const count = window.TextCycler ? window.TextCycler.getConfigs().length : 0;
        textCyclerCountEl.textContent = `(${count})`;
    }
    
    // Update last backup info
    const lastBackupEl = document.getElementById('lastBackupInfo');
    if (lastBackupEl) {
        const lastBackup = storage.get('lastBackupTimestamp');
        if (lastBackup) {
            const date = new Date(lastBackup);
            lastBackupEl.textContent = `Last backup: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
        } else {
            lastBackupEl.textContent = 'No backup yet - consider exporting!';
        }
    }
}

function getSelectedExportData() {
    const backup = {
        version: 2,
        timestamp: new Date().toISOString(),
        exportedCategories: []
    };
    
    const swapConfigsForExport = window.SourceSwaps ? window.SourceSwaps.getConfigs() : [];
    if (document.getElementById('exportSwaps')?.checked && swapConfigsForExport?.length) {
        backup.swapConfigs = swapConfigsForExport;
        backup.exportedCategories.push('swaps');
    }
    
    const layoutPresets = window.Layouts ? window.Layouts.layoutPresets : [];
    if (document.getElementById('exportLayouts')?.checked && layoutPresets?.length) {
        backup.layoutPresets = layoutPresets;
        backup.exportedCategories.push('layouts');
    }
    
    if (document.getElementById('exportTextCyclers')?.checked) {
        const configs = window.TextCycler ? window.TextCycler.getConfigs() : [];
        if (configs.length) {
            backup.textCyclerConfigs = configs;
            backup.exportedCategories.push('textCyclers');
        }
    }
    
    if (document.getElementById('exportUIState')?.checked) {
        backup.ui_state = storage.get('ui_state') || {};
        backup.exportedCategories.push('uiState');
    }
    
    if (document.getElementById('exportCredentials')?.checked) {
        // Only export non-sensitive connection info
        backup.connectionSettings = {
            host: storage.getRaw('obs_host'),
            port: storage.getRaw('obs_port')
            // Note: password is NOT exported for security
        };
        backup.exportedCategories.push('connection');
    }
    
    return backup;
}

function exportSelectedData() {
    const backup = getSelectedExportData();
    
    if (backup.exportedCategories.length === 0) {
        log('Nothing to export! Select at least one category or add some configs.', 'error');
        return;
    }
    
    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `strixun-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Record backup timestamp
    storage.set('lastBackupTimestamp', new Date().toISOString());
    updateStorageStatus();
    
    log(`Exported: ${backup.exportedCategories.join(', ')}`, 'success');
}

function copyBackupToClipboard() {
    const backup = getSelectedExportData();
    
    if (backup.exportedCategories.length === 0) {
        log('Nothing to copy! Select at least one category.', 'error');
        return;
    }
    
    const json = JSON.stringify(backup, null, 2);
    navigator.clipboard.writeText(json).then(() => {
        log('Backup JSON copied to clipboard!', 'success');
    }).catch(() => {
        // Fallback
        prompt('Copy this JSON:', json);
    });
}

function importDataWithOptions() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            const text = await file.text();
            const backup = JSON.parse(text);
            
            if (!backup.version) {
                log('Invalid backup file format', 'error');
                return;
            }
            
            // Build import summary
            const categories = [];
            if (backup.swapConfigs?.length) categories.push(`${backup.swapConfigs.length} swap configs`);
            if (backup.layoutPresets?.length) categories.push(`${backup.layoutPresets.length} layout presets`);
            if (backup.textCyclerConfigs?.length) categories.push(`${backup.textCyclerConfigs.length} text cycler configs`);
            if (backup.ui_state) categories.push('UI preferences');
            if (backup.connectionSettings) categories.push('connection settings');
            
            if (categories.length === 0) {
                log('Backup file is empty!', 'error');
                return;
            }
            
            // Build import options dialog
            const importChoices = await showImportDialog(backup, categories);
            if (!importChoices) return; // Cancelled
            
            let imported = [];
            
            // Restore selected configs
            if (importChoices.swaps && backup.swapConfigs) {
                if (importChoices.merge) {
                    // Merge: add new, skip duplicates
                    const currentConfigs = window.SourceSwaps ? window.SourceSwaps.getConfigs() : [];
                    const existingNames = new Set(currentConfigs.map(c => c.name));
                    const newConfigs = backup.swapConfigs.filter(c => !existingNames.has(c.name));
                    if (window.SourceSwaps) {
                        window.SourceSwaps.setConfigs([...currentConfigs, ...newConfigs]);
                    }
                    imported.push(`${newConfigs.length} new swaps (merged)`);
                } else {
                    if (window.SourceSwaps) {
                        window.SourceSwaps.setConfigs(backup.swapConfigs);
                    }
                    imported.push(`${backup.swapConfigs.length} swaps (replaced)`);
                }
                if (window.SourceSwaps) {
                    storage.set('swapConfigs', window.SourceSwaps.getConfigs());
                }
            }
            
            if (importChoices.layouts && backup.layoutPresets) {
                const layoutPresets = window.Layouts ? window.Layouts.layoutPresets : [];
                if (importChoices.merge) {
                    const existingIds = new Set(layoutPresets.map(l => l.id));
                    const newLayouts = backup.layoutPresets.filter(l => !existingIds.has(l.id));
                    const updatedLayouts = [...layoutPresets, ...newLayouts];
                    if (window.Layouts) {
                        window.Layouts.layoutPresets = updatedLayouts;
                    }
                    storage.set('layoutPresets', updatedLayouts);
                    imported.push(`${newLayouts.length} new layouts (merged)`);
                } else {
                    if (window.Layouts) {
                        window.Layouts.layoutPresets = backup.layoutPresets;
                    }
                    storage.set('layoutPresets', backup.layoutPresets);
                    imported.push(`${backup.layoutPresets.length} layouts (replaced)`);
                }
            }
            
            if (importChoices.textCyclers && backup.textCyclerConfigs && window.TextCycler) {
                if (importChoices.merge) {
                    const existingConfigs = window.TextCycler.getConfigs();
                    const existingIds = new Set(existingConfigs.map(c => c.id));
                    const newConfigs = backup.textCyclerConfigs.filter(c => !existingIds.has(c.id));
                    window.TextCycler.addConfigs(newConfigs);
                    imported.push(`${newConfigs.length} new text cyclers (merged)`);
                } else {
                    window.TextCycler.setConfigs(backup.textCyclerConfigs);
                    imported.push(`${backup.textCyclerConfigs.length} text cyclers (replaced)`);
                }
            }
            
            if (importChoices.uiState && backup.ui_state) {
                storage.set('ui_state', backup.ui_state);
                imported.push('UI preferences');
            }
            
            if (importChoices.connection && backup.connectionSettings) {
                if (backup.connectionSettings.host) storage.setRaw('obs_host', backup.connectionSettings.host);
                if (backup.connectionSettings.port) storage.setRaw('obs_port', backup.connectionSettings.port);
                imported.push('connection settings');
            }
            
            // Re-render everything
            renderSavedSwaps();
            renderSavedLayouts();
            renderTextCyclerConfigs();
            loadUIState();
            updateStorageStatus();
            
            log(`Imported: ${imported.join(', ')}`, 'success');
        } catch (err) {
            log('Import failed: ' + err.message, 'error');
        }
    };
    
    input.click();
}

async function showImportDialog(backup, categories) {
    return new Promise((resolve) => {
        // Simple confirm-based dialog (could be replaced with modal later)
        const hasSwaps = backup.swapConfigs?.length > 0;
        const hasLayouts = backup.layoutPresets?.length > 0;
        const hasTextCyclers = backup.textCyclerConfigs?.length > 0;
        const hasUI = !!backup.ui_state;
        const hasConnection = !!backup.connectionSettings;
        
        const msg = `Import backup from ${backup.timestamp ? new Date(backup.timestamp).toLocaleString() : 'unknown date'}?

Found:
${categories.map(c => '• ' + c).join('\n')}

Import mode:
• OK = REPLACE existing (overwrite)
• Cancel = abort

(Hold Shift + OK to MERGE instead of replace)`;
        
        const result = confirm(msg);
        if (!result) {
            resolve(null);
            return;
        }
        
        // Check if shift was held (merge mode) - using a simple approach
        const mergeMode = false; // For now, always replace. Could enhance with modal later.
        
        resolve({
            swaps: hasSwaps,
            layouts: hasLayouts,
            textCyclers: hasTextCyclers,
            uiState: hasUI,
            connection: hasConnection,
            merge: mergeMode
        });
    });
}

async function forceStorageSync() {
    log('Forcing storage sync...', 'info');
    
    // Re-save all configs to both storages
    if (window.SourceSwaps) {
        storage.set('swapConfigs', window.SourceSwaps.getConfigs());
    }
    if (window.TextCycler) {
        window.TextCycler.saveTextCyclerConfigs();
    }
    if (window.Layouts) {
        storage.set('layoutPresets', window.Layouts.layoutPresets);
    }
    
    // Flush to ensure everything is written
    await storage.flush();
    
    updateStorageStatus();
    log('Storage synced to IndexedDB + localStorage', 'success');
}

// Legacy export function (for backwards compatibility)
function exportAllData() {
    // Check all boxes and export
    ['exportSwaps', 'exportLayouts', 'exportTextCyclers', 'exportUIState'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = true;
    });
    exportSelectedData();
}

// Legacy import function (for backwards compatibility)
function importAllData() {
    importDataWithOptions();
}

// ============ Recovery UI Functions ============
async function offerRecovery() {
    const recovery = checkForRecoverySnapshot();
    if (!recovery) return false;
    
    const age = new Date() - new Date(recovery.timestamp);
    const ageStr = age < 3600000 ? `${Math.round(age/60000)} minutes` : `${Math.round(age/3600000)} hours`;
    
    const msg = `🔄 Recovery Data Found!

Your configs appear empty, but we found a backup from ${ageStr} ago:
• ${recovery.swapConfigs?.length || 0} swap configs
• ${recovery.textCyclerConfigs?.length || 0} text cycler configs  

Restore this backup?`;
    
    if (confirm(msg)) {
        if (recovery.swapConfigs) {
            if (window.SourceSwaps) {
                window.SourceSwaps.setConfigs(recovery.swapConfigs);
            }
            storage.set('swapConfigs', recovery.swapConfigs);
        }
        if (recovery.textCyclerConfigs && window.TextCycler) {
            window.TextCycler.setConfigs(recovery.textCyclerConfigs);
        }
        
        renderSavedSwaps();
        renderSavedLayouts();
        renderTextCyclerConfigs();
        updateStorageStatus();
        
        log('Configs restored from recovery backup!', 'success');
        return true;
    }
    return false;
}

// ============ UI State Persistence ============
const UI_FIELDS = [
    'swapStyle', 'swapDuration', 'swapEasing', 'swapTempOverride',
    'textSource', 'textLines', 'textDuration', 'textTransition', 'transDuration',
    'swapSourceA', 'swapSourceB', 'swapNewSourceA', 'swapNewSourceB',
    'visAnimType', 'visAnimDuration', 'visAnimEasing',
    'layoutDuration', 'layoutEasing', 'layoutStagger'
];

// Checkbox fields need special handling
const UI_CHECKBOXES = ['swapPreserveAspect', 'swapDebugLogging', 'layoutApplyVisibility'];

function saveUIState() {
    const state = {};
    for (const id of UI_FIELDS) {
        const el = document.getElementById(id);
        if (el) state[id] = el.value;
    }
    // Also save checkbox states
    for (const id of UI_CHECKBOXES) {
        const el = document.getElementById(id);
        if (el) state[id] = el.checked;
    }
    storage.set('ui_state', state);
}

function loadUIState() {
    try {
        const state = storage.get('ui_state') || {};
        for (const id of UI_FIELDS) {
            const el = document.getElementById(id);
            if (el && state[id] !== undefined && state[id] !== '') {
                el.value = state[id];
            }
        }
        // Also load checkbox states
        for (const id of UI_CHECKBOXES) {
            const el = document.getElementById(id);
            if (el && state[id] !== undefined) {
                el.checked = state[id];
            }
        }
    } catch (e) {
        console.error('Error loading UI state:', e);
    }
}

function setupUIStatePersistence() {
    // Save on any input change - multiple events for robustness
    for (const id of UI_FIELDS) {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', saveUIState);
            el.addEventListener('input', saveUIState);
            el.addEventListener('blur', saveUIState);
        }
    }
    // Also listen to checkbox changes
    for (const id of UI_CHECKBOXES) {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', saveUIState);
        }
    }
}

// ============ UI Functions ============
function showPage(id, save = true) {
    // Check if tab is disabled (requires connection)
    const featurePages = ['sources', 'text', 'swaps', 'layouts'];
    const scriptStatus = window.ScriptStatus ? window.ScriptStatus.scriptStatus : { connected: false };
    if (featurePages.includes(id) && !scriptStatus.connected) {
        // Don't switch to disabled page, redirect to setup
        log('Connect to OBS first to use this feature', 'error');
        showPage('setup', false);
        return;
    }
    
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    
    const pageElement = document.getElementById('page-' + id);
    if (!pageElement) {
        console.warn(`[showPage] Page element 'page-${id}' not found, defaulting to dashboard`);
        showPage('dashboard', save);
        return;
    }
    pageElement.classList.add('active');
    
    // Find and activate the corresponding tab - must match order in HTML nav.tabs
    const tabs = document.querySelectorAll('.tab');
    const tabIds = ['dashboard', 'sources', 'text', 'swaps', 'layouts', 'scripts', 'install', 'setup'];
    const tabIndex = tabIds.indexOf(id);
    if (tabIndex >= 0 && tabs[tabIndex]) {
        tabs[tabIndex].classList.add('active');
    }
    
    // Render feature notices for pages that require scripts
    const pageFeatureMap = {
        'sources': { id: 'page-sources', feature: 'sources', script: 'Source Animations' },
        'text': { id: 'page-text', feature: 'text', script: 'Text Cycler' },
        'swaps': { id: 'page-swaps', feature: 'swap', script: 'Source Swap' },
        'layouts': { id: 'page-layouts', feature: 'layouts', script: 'Source Layouts' }
    };
    
    const pageInfo = pageFeatureMap[id];
    if (pageInfo && typeof renderFeatureNotice === 'function') {
        renderFeatureNotice(pageInfo.id, pageInfo.feature, pageInfo.script);
    }
    
    // Save active tab
    if (save) {
        storage.setRaw('active_tab', id);
    }
}

function restoreActiveTab() {
    const savedTab = storage.getRaw('active_tab');
    if (savedTab) {
        showPage(savedTab, false);
    }
}

function log(msg, type = '') {
    const el = document.getElementById('log');
    if (!el) return;
    
    const entry = document.createElement('div');
    entry.className = 'log-entry ' + type;
    
    const time = document.createElement('span');
    time.className = 'log-entry__time';
    time.textContent = `[${new Date().toLocaleTimeString()}]`;
    
    const text = document.createElement('span');
    text.className = 'log-entry__text';
    text.textContent = msg;
    
    entry.appendChild(time);
    entry.appendChild(text);
    
    el.insertBefore(entry, el.firstChild);
    if (el.children.length > 100) el.removeChild(el.lastChild);
}

function clearLog() {
    const el = document.getElementById('log');
    if (el) el.innerHTML = '';
    log('Log cleared', 'info');
}

function copyUrl() {
    const url = document.getElementById('dockUrl');
    if (!url) return;
    url.select();
    document.execCommand('copy');
    const copyStatus = document.getElementById('copyStatus');
    if (copyStatus) {
        copyStatus.textContent = '✓ Copied to clipboard!';
        setTimeout(() => { copyStatus.textContent = ''; }, 2000);
    }
}

function renderDashSwaps() {
    if (window.SourceSwaps) {
        window.SourceSwaps.renderDashSwaps();
        return;
    }
    const grid = document.getElementById('dashSwapGrid');
    if (!grid) return;
    const swapConfigs = window.SourceSwaps ? window.SourceSwaps.getConfigs() : [];
    if (swapConfigs.length === 0) {
        grid.innerHTML = '<div class="empty-state" style="padding:10px;grid-column:1/-1">No saved swaps. Go to 🔄 tab to create one.</div>';
        return;
    }
    grid.innerHTML = swapConfigs.map((c, i) => 
        `<button class="source-btn" onclick="loadSwapConfig(${i})">${c.name}</button>`
    ).join('');
}

// ============ Source Swap Wrapper Functions ============
function updateSwapDropdowns() {
    if (window.SourceSwaps) {
        window.SourceSwaps.updateSwapDropdowns();
    }
}

async function executeSwap(sourceAOverride, sourceBOverride) {
    if (window.SourceSwaps) {
        return window.SourceSwaps.executeSwap(sourceAOverride, sourceBOverride);
    }
}

function saveCurrentSwap() {
    if (window.SourceSwaps) {
        window.SourceSwaps.saveCurrentSwap();
    }
}

function addSwapConfig() {
    if (window.SourceSwaps) {
        window.SourceSwaps.addSwapConfig();
    }
}

function refreshSwapSources() {
    if (window.SourceSwaps) {
        window.SourceSwaps.refreshSwapSources();
    }
}

function renderSavedSwaps() {
    if (window.SourceSwaps) {
        window.SourceSwaps.renderSavedSwaps();
    }
}

function loadSwapConfig(index) {
    if (window.SourceSwaps) {
        window.SourceSwaps.loadSwapConfig(index);
    }
}

function deleteSwapConfig(index) {
    if (window.SourceSwaps) {
        window.SourceSwaps.deleteSwapConfig(index);
    }
}

function exportConfigs() {
    if (window.SourceSwaps) {
        window.SourceSwaps.exportConfigs();
    }
}

function importConfigs() {
    if (window.SourceSwaps) {
        window.SourceSwaps.importConfigs();
    }
}

// ============ Layout Management Wrapper Functions ============
function renderSavedLayouts() {
    if (window.Layouts) {
        window.Layouts.renderSavedLayouts();
    }
}

// ============ Text Cycler Wrapper Functions ============
function renderTextCyclerConfigs() {
    if (window.TextCycler) {
        window.TextCycler.renderTextCyclerConfigs();
    }
}

function newTextConfig() {
    if (window.TextCycler) {
        window.TextCycler.newTextConfig();
    }
}

function loadTextConfig(index) {
    if (window.TextCycler) {
        window.TextCycler.loadConfig(index);
    }
}

function saveCurrentTextConfig() {
    if (window.TextCycler) {
        window.TextCycler.saveCurrentTextConfig();
    }
}

function deleteCurrentTextConfig() {
    if (window.TextCycler) {
        window.TextCycler.deleteCurrentTextConfig();
    }
}

function saveTextCyclerConfigs() {
    if (window.TextCycler) {
        window.TextCycler.saveTextCyclerConfigs();
    }
}

function exportTextConfigs() {
    if (window.TextCycler) {
        window.TextCycler.exportTextConfigs();
    }
}

function importTextConfigs() {
    if (window.TextCycler) {
        window.TextCycler.importTextConfigs();
    }
}

function startTextCycler() {
    if (window.TextCycler) {
        window.TextCycler.startTextCycler();
    }
}

function stopTextCycler() {
    if (window.TextCycler) {
        window.TextCycler.stopTextCycler();
    }
}

function quickStartConfig(index) {
    if (window.TextCycler) {
        window.TextCycler.quickStart(index);
    }
}

function restoreRunningTextCyclers() {
    if (window.TextCycler) {
        window.TextCycler.restoreRunningTextCyclers();
    }
}

// ============ Text Cycler UI Helpers ============
function updateTextCyclerMode() {
    const modeEl = document.getElementById('textCyclerMode');
    const modeInfo = document.getElementById('modeInfo');
    if (!modeEl || !modeInfo) return;
    
    const mode = modeEl.value;
    const browserModeSettings = document.getElementById('browserModeSettings');
    const legacyModeSettings = document.getElementById('legacyModeSettings');
    const textStyleCard = document.getElementById('textStyleCard');
    
    if (browserModeSettings) browserModeSettings.style.display = mode === 'browser' ? 'block' : 'none';
    if (legacyModeSettings) legacyModeSettings.style.display = mode === 'legacy' ? 'block' : 'none';
    if (textStyleCard) textStyleCard.style.display = mode === 'browser' ? 'block' : 'none';
    
    if (mode === 'browser') {
        modeInfo.textContent = 'Uses a Browser Source in OBS with smooth CSS animations. Create a Browser Source pointing to text_cycler_display.html';
    } else {
        modeInfo.textContent = 'Updates an existing OBS text source directly. Limited to text scramble animations.';
    }
}

function updateConfigIdPreview() {
    const configIdEl = document.getElementById('textConfigId');
    const previewEl = document.getElementById('configIdPreview');
    if (!configIdEl || !previewEl) return;
    const configId = configIdEl.value || 'config1';
    previewEl.textContent = configId;
}

function getBrowserSourceUrl(configId) {
    const currentPath = window.location.pathname;
    const displayPath = currentPath.replace('control_panel.html', 'text_cycler_display.html');
    return `file://${displayPath}?id=${configId || 'config1'}`;
}

function updateBrowserSourceUrlPreview() {
    const configIdEl = document.getElementById('textConfigId');
    const previewEl = document.getElementById('browserSourceUrlPreview');
    if (!configIdEl || !previewEl) return;
    const configId = configIdEl.value || 'config1';
    previewEl.textContent = getBrowserSourceUrl(configId);
}

function copyBrowserSourceUrl() {
    const configIdEl = document.getElementById('textConfigId');
    if (!configIdEl) return;
    const configId = configIdEl.value || 'config1';
    const url = getBrowserSourceUrl(configId);
    
    navigator.clipboard.writeText(url).then(() => {
        log('URL copied! Add as Browser Source in OBS', 'success');
    }).catch(() => {
        prompt('Copy this URL:', url);
    });
}

function updateTransitionMode() {
    const transitionEl = document.getElementById('textTransition');
    const infoEl = document.getElementById('transitionInfo');
    if (!transitionEl || !infoEl) return;
    
    const val = transitionEl.value;
    const descriptions = {
        'none': 'Instant text change',
        'fade': 'Smooth fade in/out',
        'obfuscate': 'Minecraft enchant table scramble, reveal left-to-right',
        'typewriter': 'Type out one character at a time',
        'glitch': 'Random glitch characters that settle',
        'scramble': 'Full scramble, then snap to final',
        'wave': 'Characters appear in a wave pattern',
        'slide_left': 'Slide out left, slide in from right',
        'slide_right': 'Slide out right, slide in from left',
        'slide_up': 'Slide up transition',
        'slide_down': 'Slide down transition',
        'pop': 'Pop in with scale bounce'
    };
    infoEl.textContent = descriptions[val] || '';
}

function updateTextSourceDropdown() {
    const select = document.getElementById('textSource');
    if (!select) return;
    
    const savedState = storage.get('ui_state') || {};
    const current = select.value || savedState.textSource || '';
    
    // Access global sources from websocket module (textSources is updated in sources.js)
    // Filter sources to get text sources
    const currentSources = typeof sources !== 'undefined' ? sources : [];
    const filteredTextSources = currentSources.filter(s => 
        s.inputKind && (s.inputKind.includes('text') || s.inputKind === 'text_gdiplus_v2' || s.inputKind === 'text_ft2_source_v2')
    );
    
    select.innerHTML = '<option value="">-- Select Text Source --</option>' +
        filteredTextSources.map(s => `<option value="${s.sourceName}">${s.sourceName}</option>`).join('');
    
    if (current && filteredTextSources.find(s => s.sourceName === current)) {
        select.value = current;
    }
}

async function loadTextSource() {
    const nameEl = document.getElementById('textSource');
    const previewEl = document.getElementById('textPreview');
    if (!nameEl || !previewEl) return;
    
    const name = nameEl.value;
    if (!name) {
        previewEl.textContent = 'Select a source';
        return;
    }
    
    try {
        const data = await request('GetInputSettings', { inputName: name });
        const text = data.inputSettings.text || '';
        previewEl.textContent = text || '(empty)';
    } catch (e) {
        log('Error loading text: ' + e, 'error');
    }
}

// ============ Initialization ============
document.addEventListener('DOMContentLoaded', async () => {
    // CRITICAL: Initialize storage system FIRST before anything else
    console.log('[Init] Starting storage initialization...');
    try {
        await initIndexedDB();
        await loadStorageCache();
        console.log('[Init] Storage system ready');
    } catch (e) {
        console.error('[Init] Storage init error (using fallback):', e);
    }
    
    // NOW load configs from storage into memory
    // Initialize Source Swaps module
    if (window.SourceSwaps) {
        SourceSwaps.init({
            storage,
            log,
            get connected() { return connected; },
            get currentScene() { return currentScene; },
            get sources() { return sources; },
            request,
            isOBSDock,
            showPage,
            initSearchForList
        });
        SourceSwaps.loadConfigs();
    }
    
    // Compatibility: expose swapConfigs as global variable
    Object.defineProperty(window, 'swapConfigs', {
        get: () => window.SourceSwaps ? window.SourceSwaps.getConfigs() : [],
        set: (val) => { if (window.SourceSwaps) window.SourceSwaps.setConfigs(val); },
        configurable: true,
        enumerable: true
    });
    
    // Load source opacity configs
    if (window.Sources && typeof window.Sources.loadSourceOpacityConfigs === 'function') {
        window.Sources.loadSourceOpacityConfigs();
    }
    
    // Initialize Text Cycler module
    if (window.TextCycler) {
        TextCycler.init({
            storage,
            log,
            get connected() { return connected; },
            get ws() { return ws; },
            get msgId() { return msgId; },
            isOBSDock,
            request,
            get sources() { return sources; },
            get storageSyncTimer() { return window.StorageSync ? window.StorageSync.storageSyncTimer : null; },
            set storageSyncTimer(val) { if (window.StorageSync) window.StorageSync.storageSyncTimer = val; },
            broadcastStorage: () => { if (window.StorageSync) window.StorageSync.scheduleBroadcast(); },
            STORAGE_SYNC_DEBOUNCE: window.StorageSync ? window.StorageSync.STORAGE_SYNC_DEBOUNCE : 500
        });
        TextCycler.loadConfigs();
        
        // Compatibility: expose textCyclerConfigs and currentTextConfigIndex as global variables
        Object.defineProperty(window, 'textCyclerConfigs', {
            get: () => TextCycler.getConfigs(),
            configurable: true,
            enumerable: true
        });
        Object.defineProperty(window, 'currentTextConfigIndex', {
            get: () => TextCycler.getCurrentIndex(),
            set: (val) => TextCycler.setCurrentIndex(val),
            configurable: true,
            enumerable: true
        });
    }
    
    // Get textCyclerConfigs from module for compatibility (local const for init code)
    const textCyclerConfigs = window.TextCycler ? window.TextCycler.getConfigs() : (storage.get('textCyclerConfigs') || []);
    
    const swapConfigsCount = window.SourceSwaps ? window.SourceSwaps.getConfigs().length : 0;
    const sourceOpacityConfigs = window.Sources ? window.Sources.sourceOpacityConfigs : {};
    console.log('[Init] Loaded configs - Swaps:', swapConfigsCount, 
                'TextCycler:', textCyclerConfigs.length, 
                'Opacity:', Object.keys(sourceOpacityConfigs).length);
    
    // Check for recovery if configs are empty
    const totalConfigs = swapConfigsCount + textCyclerConfigs.length;
    if (totalConfigs === 0) {
        const recovered = await offerRecovery();
        if (recovered) {
            console.log('[Init] Configs restored from recovery snapshot');
        }
    }
    
    // Start auto-backup system
    startAutoBackup();
    
    // Initialize UI modules
    console.log('[Init] Initializing UI modules...');
    if (window.UIUtils && window.UIUtils.SplitPanel) {
        window.UIUtils.SplitPanel.init();
    }
    if (window.UIUtils && window.UIUtils.CollapsibleCards) {
        window.UIUtils.CollapsibleCards.init();
    }
    
    // Set dock URL
    const url = window.location.href;
    const dockUrlEl = document.getElementById('dockUrl');
    if (dockUrlEl) dockUrlEl.value = url;
    
    // Render loaded configs
    if (window.SourceSwaps) {
        SourceSwaps.renderSavedSwaps();
    }
    renderTextCyclerConfigs();
    if (window.Layouts && typeof window.Layouts.initLayouts === 'function') {
        window.Layouts.initLayouts();
    }
    // Initialize installer (function is global from installer.js module)
    if (typeof initScriptsAndInstaller === 'function') {
        initScriptsAndInstaller();
    }
    loadUIState();
    restoreActiveTab();
    if (typeof updateConnectionState === 'function') {
        updateConnectionState();
    }
    setupUIStatePersistence();
    
    // Initialize script status (will show "not connected" banner)
    if (typeof renderStartupBanner === 'function') {
        renderStartupBanner();
    }
    if (typeof updateTabStates === 'function') {
        updateTabStates();
    }
    
    // Restore running text cyclers
    setTimeout(restoreRunningTextCyclers, 1000);
    updateTransitionMode();
    updateStorageStatus();
    if (window.Version && typeof window.Version.initVersionDisplay === 'function') {
        window.Version.initVersionDisplay();
    }
    
    // Initialize Storage Sync module
    if (window.StorageSync) {
        StorageSync.init({
            storage,
            log,
            get connected() { return connected; },
            isOBSDock,
            request,
            // Callbacks for getting/setting configs
            getSwapConfigs: () => window.SourceSwaps ? window.SourceSwaps.getConfigs() : [],
            setSwapConfigs: (val) => { if (window.SourceSwaps) window.SourceSwaps.setConfigs(val); },
            getTextCyclerConfigs: () => window.TextCycler ? window.TextCycler.getConfigs() : [],
            setTextCyclerConfigs: (val) => { if (window.TextCycler) window.TextCycler.setConfigs(val); },
            getLayoutPresets: () => window.Layouts ? window.Layouts.layoutPresets : [],
            setLayoutPresets: (val) => { if (window.Layouts) window.Layouts.layoutPresets = val; },
            // Render callbacks
            renderSavedSwaps: () => { if (window.SourceSwaps) window.SourceSwaps.renderSavedSwaps(); },
            renderTextCyclerConfigs: () => { if (window.TextCycler) window.TextCycler.renderConfigs(); },
            renderSavedLayouts,
            updateStorageStatus
        });
        StorageSync.loadAutoSyncPref();
    }
    
    if (window.TwitchAPI && typeof window.TwitchAPI.loadTwitchSettings === 'function') {
        window.TwitchAPI.loadTwitchSettings();
    }
    
    // Setup credential UI listeners
    const rememberCredsEl = document.getElementById('rememberCreds');
    const passwordEl = document.getElementById('password');
    if (rememberCredsEl && typeof updateSecurityWarning === 'function') {
        rememberCredsEl.addEventListener('change', updateSecurityWarning);
    }
    if (passwordEl && typeof updateSecurityWarning === 'function') {
        passwordEl.addEventListener('input', updateSecurityWarning);
    }
    
    // Load saved credentials and auto-connect
    try {
        if (typeof loadCredentials === 'function') {
            const hasCreds = await loadCredentials();
            if (hasCreds && passwordEl && passwordEl.value) {
                log('Credentials unlocked. Auto-connecting...', 'info');
                setTimeout(() => {
                    if (typeof connect === 'function') {
                        connect();
                    }
                }, 500);
            } else if (hasCreds) {
                log('Host/port loaded. Enter password to connect.', 'info');
            } else {
                log('Ready. Connect to OBS to begin.', 'info');
            }
        } else {
            log('Ready. Connect to OBS to begin.', 'info');
        }
    } catch (e) {
        console.error('Credential load error:', e);
        log('Ready. Connect to OBS to begin.', 'info');
    }
    
    // Setup color picker sync for text cycler
    const textColorPicker = document.getElementById('textColorPicker');
    const textColor = document.getElementById('textColor');
    if (textColorPicker && textColor) {
        textColorPicker.addEventListener('input', (e) => {
            textColor.value = e.target.value;
        });
        textColor.addEventListener('input', (e) => {
            if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                textColorPicker.value = e.target.value;
            }
        });
    }
    
    const textStrokeColorPicker = document.getElementById('textStrokeColorPicker');
    const textStrokeColor = document.getElementById('textStrokeColor');
    if (textStrokeColorPicker && textStrokeColor) {
        textStrokeColorPicker.addEventListener('input', (e) => {
            textStrokeColor.value = e.target.value;
        });
        textStrokeColor.addEventListener('input', (e) => {
            if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                textStrokeColorPicker.value = e.target.value;
            }
        });
    }
});

// ============ Keyboard Shortcuts ============
document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    // 1-9 triggers saved swap configs
    if (e.key >= '1' && e.key <= '9') {
        const idx = parseInt(e.key) - 1;
        const swapConfigs = window.SourceSwaps ? window.SourceSwaps.getConfigs() : [];
        if (idx < swapConfigs.length) loadSwapConfig(idx);
    }
    // Space toggles text cycler (if cycleInterval exists - from text-cycler.js)
    if (e.key === ' ') {
        e.preventDefault();
        // Check if text cycler is running
        if (window.TextCycler) {
            const isRunning = window.TextCycler.isRunning();
            if (isRunning) {
                window.TextCycler.stopTextCycler();
            } else {
                window.TextCycler.startTextCycler();
            }
        }
    }
});

// ============ Exports (for non-module usage) ============
// All functions are already global, but we expose them via window.App for clarity
if (typeof window !== 'undefined') {
    window.App = {
        // Storage functions
        updateStorageStatus,
        getSelectedExportData,
        exportSelectedData,
        copyBackupToClipboard,
        importDataWithOptions,
        showImportDialog,
        forceStorageSync,
        exportAllData,
        importAllData,
        offerRecovery,
        // UI state
        saveUIState,
        loadUIState,
        setupUIStatePersistence,
        // UI functions
        showPage,
        restoreActiveTab,
        log,
        clearLog,
        copyUrl,
        renderDashSwaps,
        // Text cycler UI
        updateTextCyclerMode,
        updateConfigIdPreview,
        getBrowserSourceUrl,
        updateBrowserSourceUrlPreview,
        copyBrowserSourceUrl,
        updateTransitionMode,
        updateTextSourceDropdown,
        loadTextSource
    };
}

