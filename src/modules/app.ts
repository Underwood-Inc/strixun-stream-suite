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
 * @version 2.0.0 (TypeScript)
 */

import { storage, checkForRecoverySnapshot, startAutoBackup } from './storage';
import { request } from './websocket';
import { connected, sources } from '../stores/connection';
import { get } from 'svelte/store';
import { navigateTo, currentPage } from '../stores/navigation';
import { ScriptStatus } from './script-status';
import type { StorageBackup } from '../types';

// ============ Types ============
interface ImportChoices {
  swaps: boolean;
  layouts: boolean;
  textCyclers: boolean;
  uiState: boolean;
  connection: boolean;
  merge: boolean;
}

// ============ Storage Backup & Status Functions ============

export function updateStorageStatus(): void {
  // Update engine status indicators
  const idbEl = document.getElementById('idbStatus');
  const lsEl = document.getElementById('lsStatus');
  
  if (idbEl) {
    const idbReady = (window as any).SSS_Storage ? (window as any).SSS_Storage.idbReady() : false;
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
    const swapConfigs = (window as any).SourceSwaps ? (window as any).SourceSwaps.getConfigs() : [];
    swapCountEl.textContent = `(${swapConfigs.length || 0})`;
  }
  
  if (layoutCountEl) {
    const layoutPresets = (window as any).Layouts ? (window as any).Layouts.layoutPresets : [];
    layoutCountEl.textContent = `(${layoutPresets.length || 0})`;
  }
  
  if (textCyclerCountEl) {
    const count = (window as any).TextCycler ? (window as any).TextCycler.getConfigs().length : 0;
    textCyclerCountEl.textContent = `(${count})`;
  }
  
  // Update last backup info
  const lastBackupEl = document.getElementById('lastBackupInfo');
  if (lastBackupEl) {
    const lastBackup = storage.get('lastBackupTimestamp') as string | null;
    if (lastBackup) {
      const date = new Date(lastBackup);
      lastBackupEl.textContent = `Last backup: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    } else {
      lastBackupEl.textContent = 'No backup yet - consider exporting!';
    }
  }
}

export function getSelectedExportData(): StorageBackup {
  const backup: StorageBackup = {
    version: 2,
    timestamp: new Date().toISOString(),
    exportedCategories: []
  };
  
  const swapConfigsForExport = (window as any).SourceSwaps ? (window as any).SourceSwaps.getConfigs() : [];
  if ((document.getElementById('exportSwaps') as HTMLInputElement)?.checked && swapConfigsForExport?.length) {
    backup.swapConfigs = swapConfigsForExport;
    backup.exportedCategories.push('swaps');
  }
  
  const layoutPresets = (window as any).Layouts ? (window as any).Layouts.layoutPresets : [];
  if ((document.getElementById('exportLayouts') as HTMLInputElement)?.checked && layoutPresets?.length) {
    backup.layoutPresets = layoutPresets;
    backup.exportedCategories.push('layouts');
  }
  
  if ((document.getElementById('exportTextCyclers') as HTMLInputElement)?.checked) {
    const configs = (window as any).TextCycler ? (window as any).TextCycler.getConfigs() : [];
    if (configs.length) {
      backup.textCyclerConfigs = configs;
      backup.exportedCategories.push('textCyclers');
    }
  }
  
  if ((document.getElementById('exportUIState') as HTMLInputElement)?.checked) {
    backup.ui_state = (storage.get('ui_state') as Record<string, any>) || {};
    backup.exportedCategories.push('uiState');
  }
  
  if ((document.getElementById('exportCredentials') as HTMLInputElement)?.checked) {
    // Only export non-sensitive connection info
    backup.connectionSettings = {
      host: storage.getRaw('obs_host') as string | undefined,
      port: storage.getRaw('obs_port') as string | undefined
      // Note: password is NOT exported for security
    };
    backup.exportedCategories.push('connection');
  }
  
  return backup;
}

export function exportSelectedData(): void {
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

export function copyBackupToClipboard(): void {
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

export function importDataWithOptions(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const backup = JSON.parse(text) as StorageBackup;
      
      if (!backup.version) {
        log('Invalid backup file format', 'error');
        return;
      }
      
      // Build import summary
      const categories: string[] = [];
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
      
      const imported: string[] = [];
      
      // Restore selected configs
      if (importChoices.swaps && backup.swapConfigs) {
        if (importChoices.merge) {
          // Merge: add new, skip duplicates
          const currentConfigs = (window as any).SourceSwaps ? (window as any).SourceSwaps.getConfigs() : [];
          const existingNames = new Set(currentConfigs.map((c: any) => c.name));
          const newConfigs = backup.swapConfigs.filter((c: any) => !existingNames.has(c.name));
          if ((window as any).SourceSwaps) {
            (window as any).SourceSwaps.setConfigs([...currentConfigs, ...newConfigs]);
          }
          imported.push(`${newConfigs.length} new swaps (merged)`);
        } else {
          if ((window as any).SourceSwaps) {
            (window as any).SourceSwaps.setConfigs(backup.swapConfigs);
          }
          imported.push(`${backup.swapConfigs.length} swaps (replaced)`);
        }
        if ((window as any).SourceSwaps) {
          storage.set('swapConfigs', (window as any).SourceSwaps.getConfigs());
        }
      }
      
      if (importChoices.layouts && backup.layoutPresets) {
        const layoutPresets = (window as any).Layouts ? (window as any).Layouts.layoutPresets : [];
        if (importChoices.merge) {
          const existingIds = new Set(layoutPresets.map((l: any) => l.id));
          const newLayouts = backup.layoutPresets.filter((l: any) => !existingIds.has(l.id));
          const updatedLayouts = [...layoutPresets, ...newLayouts];
          if ((window as any).Layouts) {
            (window as any).Layouts.layoutPresets = updatedLayouts;
          }
          storage.set('layoutPresets', updatedLayouts);
          imported.push(`${newLayouts.length} new layouts (merged)`);
        } else {
          if ((window as any).Layouts) {
            (window as any).Layouts.layoutPresets = backup.layoutPresets;
          }
          storage.set('layoutPresets', backup.layoutPresets);
          imported.push(`${backup.layoutPresets.length} layouts (replaced)`);
        }
      }
      
      if (importChoices.textCyclers && backup.textCyclerConfigs && (window as any).TextCycler) {
        if (importChoices.merge) {
          const existingConfigs = (window as any).TextCycler.getConfigs();
          const existingIds = new Set(existingConfigs.map((c: any) => c.id));
          const newConfigs = backup.textCyclerConfigs.filter((c: any) => !existingIds.has(c.id));
          (window as any).TextCycler.addConfigs(newConfigs);
          imported.push(`${newConfigs.length} new text cyclers (merged)`);
        } else {
          (window as any).TextCycler.setConfigs(backup.textCyclerConfigs);
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
      const error = err as Error;
      log('Import failed: ' + error.message, 'error');
    }
  };
  
  input.click();
}

export async function showImportDialog(backup: StorageBackup, categories: string[]): Promise<ImportChoices | null> {
  return new Promise((resolve) => {
    // Simple confirm-based dialog (could be replaced with modal later)
    const hasSwaps = (backup.swapConfigs?.length || 0) > 0;
    const hasLayouts = (backup.layoutPresets?.length || 0) > 0;
    const hasTextCyclers = (backup.textCyclerConfigs?.length || 0) > 0;
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

export async function forceStorageSync(): Promise<void> {
  log('Forcing storage sync...', 'info');
  
  // Re-save all configs to both storages
  if ((window as any).SourceSwaps) {
    storage.set('swapConfigs', (window as any).SourceSwaps.getConfigs());
  }
  if ((window as any).TextCycler) {
    (window as any).TextCycler.saveTextCyclerConfigs();
  }
  if ((window as any).Layouts) {
    storage.set('layoutPresets', (window as any).Layouts.layoutPresets);
  }
  
  // Flush to ensure everything is written
  await storage.flush();
  
  updateStorageStatus();
  log('Storage synced to IndexedDB + localStorage', 'success');
}

// Legacy export function (for backwards compatibility)
export function exportAllData(): void {
  // Check all boxes and export
  ['exportSwaps', 'exportLayouts', 'exportTextCyclers', 'exportUIState'].forEach(id => {
    const el = document.getElementById(id) as HTMLInputElement;
    if (el) el.checked = true;
  });
  exportSelectedData();
}

// Legacy import function (for backwards compatibility)
export function importAllData(): void {
  importDataWithOptions();
}

// ============ Recovery UI Functions ============
export async function offerRecovery(): Promise<boolean> {
  const recovery = checkForRecoverySnapshot();
  if (!recovery) return false;
  
  const age = new Date().getTime() - new Date(recovery.timestamp).getTime();
  const ageStr = age < 3600000 ? `${Math.round(age/60000)} minutes` : `${Math.round(age/3600000)} hours`;
  
  const msg = `🔄 Recovery Data Found!

Your configs appear empty, but we found a backup from ${ageStr} ago:
• ${recovery.swapConfigs?.length || 0} swap configs
• ${recovery.textCyclerConfigs?.length || 0} text cycler configs  

Restore this backup?`;
  
  if (confirm(msg)) {
    if (recovery.swapConfigs) {
      if ((window as any).SourceSwaps) {
        (window as any).SourceSwaps.setConfigs(recovery.swapConfigs);
      }
      storage.set('swapConfigs', recovery.swapConfigs);
    }
    if (recovery.textCyclerConfigs && (window as any).TextCycler) {
      (window as any).TextCycler.setConfigs(recovery.textCyclerConfigs);
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

export function saveUIState(): void {
  const state: Record<string, any> = {};
  for (const id of UI_FIELDS) {
    const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
    if (el) state[id] = el.value;
  }
  // Also save checkbox states
  for (const id of UI_CHECKBOXES) {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (el) state[id] = el.checked;
  }
  storage.set('ui_state', state);
}

export function loadUIState(): void {
  try {
    const state = (storage.get('ui_state') as Record<string, any>) || {};
    for (const id of UI_FIELDS) {
      const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
      if (el && state[id] !== undefined && state[id] !== '') {
        el.value = state[id];
      }
    }
    // Also load checkbox states
    for (const id of UI_CHECKBOXES) {
      const el = document.getElementById(id) as HTMLInputElement | null;
      if (el && state[id] !== undefined) {
        el.checked = state[id];
      }
    }
  } catch (e) {
    console.error('Error loading UI state:', e);
  }
}

export function setupUIStatePersistence(): void {
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
export function showPage(id: string, save: boolean = true): void {
  // Check if tab is disabled (requires connection)
  // Use the Svelte store which is the source of truth for connection state
  const featurePages = ['sources', 'text', 'swaps', 'layouts'];
  const isConnected = get(connected);
  
  if (featurePages.includes(id) && !isConnected) {
    // Don't switch to disabled page, redirect to setup
    log('Connect to OBS first to use this feature', 'error');
    navigateTo('setup', false);
    return;
  }
  
  // Use Svelte navigation store - this handles all state management reactively
  navigateTo(id, save);
  
  // Legacy DOM manipulation for HTML pages (only if elements exist)
  // Note: Svelte components handle their own state, so this is only for legacy HTML
  const pageElement = document.getElementById('page-' + id);
  if (pageElement) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    pageElement.classList.add('active');
  }
  
  // NOTE: Tab active states are now handled reactively by Navigation.svelte
  // Do NOT manipulate .tab elements directly - let Svelte handle it
  
  // Render feature notices for pages that require scripts
  const pageFeatureMap: Record<string, { id: string; feature: string; script: string }> = {
    'sources': { id: 'page-sources', feature: 'sources', script: 'Source Animations' },
    'text': { id: 'page-text', feature: 'text', script: 'Text Cycler' },
    'swaps': { id: 'page-swaps', feature: 'swap', script: 'Source Swap' },
    'layouts': { id: 'page-layouts', feature: 'layouts', script: 'Source Layouts' }
  };
  
  const pageInfo = pageFeatureMap[id];
  if (pageInfo && typeof (window as any).renderFeatureNotice === 'function') {
    (window as any).renderFeatureNotice(pageInfo.id, pageInfo.feature, pageInfo.script);
  }
}

export function restoreActiveTab(): void {
  const savedTab = storage.getRaw('active_tab') as string | null;
  if (savedTab) {
    showPage(savedTab, false);
  }
}

export function log(msg: string, type: string = 'info', flair?: string, icon?: string): void {
  // Use new store-based logging if available
  if (typeof window !== 'undefined' && (window as any).addLogEntry) {
    // Map old type strings to new LogType
    let logType: 'info' | 'success' | 'error' | 'warning' | 'debug' = 'info';
    if (type === 'success' || type === 'error' || type === 'warning' || type === 'debug') {
      logType = type as 'info' | 'success' | 'error' | 'warning' | 'debug';
    }
    
    // Auto-detect flairs from common patterns
    let detectedFlair = flair;
    if (!detectedFlair) {
      const upperMsg = msg.toUpperCase();
      if (upperMsg.includes('CONNECTED') || upperMsg.includes('SUCCESS')) {
        detectedFlair = 'CONNECTION';
      } else if (upperMsg.includes('ERROR') || upperMsg.includes('FAILED')) {
        detectedFlair = 'ERROR';
      } else if (upperMsg.includes('WARNING') || upperMsg.includes('WARN')) {
        detectedFlair = 'WARNING';
      } else if (upperMsg.includes('IMPORTED') || upperMsg.includes('EXPORTED')) {
        detectedFlair = 'DATA';
      } else if (upperMsg.includes('REFRESHED') || upperMsg.includes('UPDATED')) {
        detectedFlair = 'UPDATE';
      }
    }
    
    (window as any).addLogEntry(msg, logType, detectedFlair, icon);
    return;
  }
  
  // Fallback to DOM-based logging for backward compatibility
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

export function clearLog(): void {
  const el = document.getElementById('log');
  if (el) el.innerHTML = '';
  log('Log cleared', 'info');
}

export function copyUrl(): void {
  const url = document.getElementById('dockUrl') as HTMLInputElement | null;
  if (!url) return;
  url.select();
  document.execCommand('copy');
  const copyStatus = document.getElementById('copyStatus');
  if (copyStatus) {
    copyStatus.textContent = '✓ Copied to clipboard!';
    setTimeout(() => { copyStatus.textContent = ''; }, 2000);
  }
}

export function renderDashSwaps(): void {
  if ((window as any).SourceSwaps) {
    (window as any).SourceSwaps.renderDashSwaps();
    return;
  }
  const grid = document.getElementById('dashSwapGrid');
  if (!grid) return;
  const swapConfigs = (window as any).SourceSwaps ? (window as any).SourceSwaps.getConfigs() : [];
  if (swapConfigs.length === 0) {
    grid.innerHTML = '<div class="empty-state" style="padding:10px;grid-column:1/-1">No saved swaps. Go to 🔄 tab to create one.</div>';
    return;
  }
  // Render buttons with proper escaping
  grid.innerHTML = swapConfigs.map((c: any, i: number) => {
    const escapedName = (c.name || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    return `<button class="source-btn" data-swap-name="${escapedName}" onclick="window.loadSwapConfig?.(${i})">${escapedName}</button>`;
  }).join('');
  
  // Set tooltips only for truncated buttons
  setTimeout(() => {
    const buttons = grid.querySelectorAll('.source-btn[data-swap-name]');
    buttons.forEach((btn) => {
      const button = btn as HTMLElement;
      const fullName = button.getAttribute('data-swap-name') || '';
      
      // Check if text is truncated
      if (button.scrollWidth > button.clientWidth) {
        button.title = fullName;
      } else {
        // Remove title if not truncated to avoid unnecessary tooltips
        button.removeAttribute('title');
      }
    });
  }, 0);
}

// ============ Source Swap Wrapper Functions ============
export function updateSwapDropdowns(): void {
  if ((window as any).SourceSwaps) {
    (window as any).SourceSwaps.updateSwapDropdowns();
  }
}

export async function executeSwap(sourceAOverride?: string, sourceBOverride?: string): Promise<void> {
  if ((window as any).SourceSwaps) {
    return (window as any).SourceSwaps.executeSwap(sourceAOverride, sourceBOverride);
  }
}

export function saveCurrentSwap(): void {
  if ((window as any).SourceSwaps) {
    (window as any).SourceSwaps.saveCurrentSwap();
  }
}

export function addSwapConfig(): void {
  if ((window as any).SourceSwaps) {
    (window as any).SourceSwaps.addSwapConfig();
  }
}

export function refreshSwapSources(): void {
  if ((window as any).SourceSwaps) {
    (window as any).SourceSwaps.refreshSwapSources();
  }
}

export function renderSavedSwaps(): void {
  if ((window as any).SourceSwaps) {
    (window as any).SourceSwaps.renderSavedSwaps();
  }
}

export function loadSwapConfig(index: number): void {
  if ((window as any).SourceSwaps) {
    (window as any).SourceSwaps.loadSwapConfig(index);
  }
}

export function deleteSwapConfig(index: number): void {
  if ((window as any).SourceSwaps) {
    (window as any).SourceSwaps.deleteSwapConfig(index);
  }
}

export function exportConfigs(): void {
  if ((window as any).SourceSwaps) {
    (window as any).SourceSwaps.exportConfigs();
  }
}

export function importConfigs(): void {
  if ((window as any).SourceSwaps) {
    (window as any).SourceSwaps.importConfigs();
  }
}

// ============ Layout Management Wrapper Functions ============
export function renderSavedLayouts(): void {
  if ((window as any).Layouts) {
    (window as any).Layouts.renderSavedLayouts();
  }
}

// ============ Text Cycler Wrapper Functions ============
export function renderTextCyclerConfigs(): void {
  if ((window as any).TextCycler) {
    (window as any).TextCycler.renderTextCyclerConfigs();
  }
}

export function newTextConfig(): void {
  if ((window as any).TextCycler) {
    (window as any).TextCycler.newTextConfig();
  }
}

export function loadTextConfig(index: number): void {
  if ((window as any).TextCycler) {
    (window as any).TextCycler.loadConfig(index);
  }
}

export function saveCurrentTextConfig(): void {
  if ((window as any).TextCycler) {
    (window as any).TextCycler.saveCurrentTextConfig();
  }
}

export function deleteCurrentTextConfig(): void {
  if ((window as any).TextCycler) {
    (window as any).TextCycler.deleteCurrentTextConfig();
  }
}

export function saveTextCyclerConfigs(): void {
  if ((window as any).TextCycler) {
    (window as any).TextCycler.saveTextCyclerConfigs();
  }
}

export function exportTextConfigs(): void {
  if ((window as any).TextCycler) {
    (window as any).TextCycler.exportTextConfigs();
  }
}

export function importTextConfigs(): void {
  if ((window as any).TextCycler) {
    (window as any).TextCycler.importTextConfigs();
  }
}

export function startTextCycler(): void {
  if ((window as any).TextCycler) {
    (window as any).TextCycler.startTextCycler();
  }
}

export function stopTextCycler(): void {
  if ((window as any).TextCycler) {
    (window as any).TextCycler.stopTextCycler();
  }
}

export function quickStartConfig(index: number): void {
  if ((window as any).TextCycler) {
    (window as any).TextCycler.quickStart(index);
  }
}

export function restoreRunningTextCyclers(): void {
  if ((window as any).TextCycler) {
    (window as any).TextCycler.restoreRunningTextCyclers();
  }
}

// ============ Text Cycler UI Helpers ============
export function updateTextCyclerMode(): void {
  const modeEl = document.getElementById('textCyclerMode') as HTMLSelectElement | null;
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

export function updateConfigIdPreview(): void {
  const configIdEl = document.getElementById('textConfigId') as HTMLInputElement | null;
  const previewEl = document.getElementById('configIdPreview');
  if (!configIdEl || !previewEl) return;
  const configId = configIdEl.value || 'config1';
  previewEl.textContent = configId;
}

export function getBrowserSourceUrl(configId?: string): string {
  const currentPath = window.location.pathname;
  const displayPath = currentPath.replace('control_panel.html', 'text_cycler_display.html');
  return `file://${displayPath}?id=${configId || 'config1'}`;
}

export function updateBrowserSourceUrlPreview(): void {
  const configIdEl = document.getElementById('textConfigId') as HTMLInputElement | null;
  const previewEl = document.getElementById('browserSourceUrlPreview');
  if (!configIdEl || !previewEl) return;
  const configId = configIdEl.value || 'config1';
  previewEl.textContent = getBrowserSourceUrl(configId);
}

export function copyBrowserSourceUrl(): void {
  const configIdEl = document.getElementById('textConfigId') as HTMLInputElement | null;
  if (!configIdEl) return;
  const configId = configIdEl.value || 'config1';
  const url = getBrowserSourceUrl(configId);
  
  navigator.clipboard.writeText(url).then(() => {
    log('URL copied! Add as Browser Source in OBS', 'success');
  }).catch(() => {
    prompt('Copy this URL:', url);
  });
}

export function updateTransitionMode(): void {
  const transitionEl = document.getElementById('textTransition') as HTMLSelectElement | null;
  const infoEl = document.getElementById('transitionInfo');
  if (!transitionEl || !infoEl) return;
  
  const val = transitionEl.value;
  const descriptions: Record<string, string> = {
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

export function updateTextSourceDropdown(): void {
  const select = document.getElementById('textSource') as HTMLSelectElement | null;
  if (!select) return;
  
  const savedState = (storage.get('ui_state') as Record<string, any>) || {};
  const current = select.value || savedState.textSource || '';
  
  // Access sources from store
  const currentSources = get(sources);
  const filteredTextSources = currentSources.filter(s => 
    s.inputKind && (s.inputKind.includes('text') || s.inputKind === 'text_gdiplus_v2' || s.inputKind === 'text_ft2_source_v2')
  );
  
  select.innerHTML = '<option value="">-- Select Text Source --</option>' +
    filteredTextSources.map(s => `<option value="${s.sourceName}">${s.sourceName}</option>`).join('');
  
  if (current && filteredTextSources.find(s => s.sourceName === current)) {
    select.value = current;
  }
}

export async function loadTextSource(): Promise<void> {
  const nameEl = document.getElementById('textSource') as HTMLSelectElement | null;
  const previewEl = document.getElementById('textPreview');
  if (!nameEl || !previewEl) return;
  
  const name = nameEl.value;
  if (!name) {
    previewEl.textContent = 'Select a source';
    return;
  }
  
  try {
    const data = await request('GetInputSettings', { inputName: name }) as { inputSettings: { text?: string } };
    const text = data.inputSettings.text || '';
    previewEl.textContent = text || '(empty)';
  } catch (e) {
    const error = e as Error;
    log('Error loading text: ' + error.message, 'error');
  }
}

// ============ Setup Keyboard Shortcuts ============
export function setupKeyboardShortcuts(): void {
  document.addEventListener('keydown', e => {
    if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
    
    // 1-9 triggers saved swap configs
    if (e.key >= '1' && e.key <= '9') {
      const idx = parseInt(e.key) - 1;
      const swapConfigs = (window as any).SourceSwaps ? (window as any).SourceSwaps.getConfigs() : [];
      if (idx < swapConfigs.length) loadSwapConfig(idx);
    }
    // Space toggles text cycler
    if (e.key === ' ') {
      e.preventDefault();
      // Check if text cycler is running
      if ((window as any).TextCycler) {
        const isRunning = (window as any).TextCycler.isRunning();
        if (isRunning) {
          (window as any).TextCycler.stopTextCycler();
        } else {
          (window as any).TextCycler.startTextCycler();
        }
      }
    }
  });
}

// ============ Exports ============
export const App = {
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

// Expose to window for legacy compatibility
if (typeof window !== 'undefined') {
  (window as any).App = App;
  (window as any).showPage = showPage;
  (window as any).log = log;
  (window as any).clearLog = clearLog;
  (window as any).copyUrl = copyUrl;
  (window as any).renderDashSwaps = renderDashSwaps;
  (window as any).updateTextCyclerMode = updateTextCyclerMode;
  (window as any).updateConfigIdPreview = updateConfigIdPreview;
  (window as any).getBrowserSourceUrl = getBrowserSourceUrl;
  (window as any).updateBrowserSourceUrlPreview = updateBrowserSourceUrlPreview;
  (window as any).copyBrowserSourceUrl = copyBrowserSourceUrl;
  (window as any).updateTransitionMode = updateTransitionMode;
  (window as any).updateTextSourceDropdown = updateTextSourceDropdown;
  (window as any).loadTextSource = loadTextSource;
  (window as any).updateSwapDropdowns = updateSwapDropdowns;
  (window as any).executeSwap = executeSwap;
  (window as any).saveCurrentSwap = saveCurrentSwap;
  (window as any).addSwapConfig = addSwapConfig;
  (window as any).refreshSwapSources = refreshSwapSources;
  (window as any).renderSavedSwaps = renderSavedSwaps;
  (window as any).loadSwapConfig = loadSwapConfig;
  (window as any).deleteSwapConfig = deleteSwapConfig;
  (window as any).exportConfigs = exportConfigs;
  (window as any).importConfigs = importConfigs;
  (window as any).renderSavedLayouts = renderSavedLayouts;
  (window as any).captureLayout = () => {
    if ((window as any).Layouts?.captureLayout) {
      return (window as any).Layouts.captureLayout();
    }
  };
  (window as any).refreshLayouts = () => {
    if ((window as any).Layouts?.refreshLayouts) {
      return (window as any).Layouts.refreshLayouts();
    }
  };
  // Placeholder for cycleAspect - triggers Quick Controls Lua script hotkey
  // The actual functionality is handled by the Lua script's hotkey system
  (window as any).cycleAspect = () => {
    log('Cycle Aspect: This feature requires the Quick Controls Lua script to be installed and a hotkey assigned in OBS Settings → Hotkeys', 'info');
  };
  (window as any).renderTextCyclerConfigs = renderTextCyclerConfigs;
  (window as any).newTextConfig = newTextConfig;
  (window as any).loadTextConfig = loadTextConfig;
  (window as any).saveCurrentTextConfig = saveCurrentTextConfig;
  (window as any).deleteCurrentTextConfig = deleteCurrentTextConfig;
  (window as any).saveTextCyclerConfigs = saveTextCyclerConfigs;
  (window as any).exportTextConfigs = exportTextConfigs;
  (window as any).importTextConfigs = importTextConfigs;
  (window as any).startTextCycler = startTextCycler;
  (window as any).stopTextCycler = stopTextCycler;
  (window as any).quickStartConfig = quickStartConfig;
  (window as any).restoreRunningTextCyclers = restoreRunningTextCyclers;
}

