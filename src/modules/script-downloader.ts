/**
 * Script Downloader Module
 * 
 * Provides download functionality for Lua scripts with version tracking
 * 
 * @version 1.0.0
 */

import { log } from './app';

// ============ Types ============
export interface LuaScript {
  id: string;
  name: string;
  file: string;
  version: string;
  icon: string;
  description: string;
  features: string[];
  changelog?: string;
}

// ============ Available Scripts ============
export const AVAILABLE_SCRIPTS: LuaScript[] = [
  {
    id: 'source_animations',
    name: 'Source Animations',
    file: 'source_animations.lua',
    version: '2.8.2',
    icon: '🎬',
    description: 'Animates sources when visibility is toggled. Supports fade, slide, zoom, and pop animations with customizable easing.',
    features: ['Fade In/Out', 'Slide animations', 'Zoom effects', 'Pop animations', 'Per-source config', 'No flicker!'],
    changelog: '✨ v2.8.2: Fixed instant pop bug when showing sources'
  },
  {
    id: 'source_swap',
    name: 'Source Swap',
    file: 'source_swap.lua',
    version: '3.2.0',
    icon: '🔄',
    description: 'Smoothly swap position and size of two sources with animation. Supports multiple swap configs with hotkeys.',
    features: ['Animated swaps', 'Multiple configs', 'Hotkey support', 'Aspect ratio control', 'Works with groups'],
    changelog: '✨ v3.2.0: Streamlined UI, inline delete buttons, 40% less space'
  },
  {
    id: 'text_cycler',
    name: 'Text Cycler',
    file: 'text_cycler.lua',
    version: '1.0.0',
    icon: '📝',
    description: 'Cycles through text strings with optional transition animations like obfuscate, typewriter, and glitch effects.',
    features: ['Text cycling', 'Obfuscate effect', 'Typewriter effect', 'Glitch effect', 'Hotkey support']
  },
  {
    id: 'quick_controls',
    name: 'Quick Controls',
    file: 'quick_controls.lua',
    version: '1.0.0',
    icon: '⚡',
    description: 'Hotkey to cycle aspect ratio override mode for source swaps.',
    features: ['Aspect cycle hotkey', 'Quick access']
  },
  {
    id: 'source_opacity',
    name: 'Source Opacity Control',
    file: 'source_opacity.lua',
    version: '1.0.0',
    icon: '👁️',
    description: 'Direct opacity control for sources using color filter.',
    features: ['Opacity slider', 'Color filter management', 'Per-source control']
  },
  {
    id: 'source_layouts',
    name: 'Source Layouts',
    file: 'source_layouts.lua',
    version: '1.0.0',
    icon: '📐',
    description: 'Save and restore source positions and sizes with hotkeys.',
    features: ['Layout presets', 'Hotkey support', 'Quick switching']
  }
];

// ============ Helper Functions ============

/**
 * Check if running in OBS dock
 */
function isOBSDock(): boolean {
  const isFileProtocol = window.location.protocol === 'file:';
  const isEmbedded = !window.opener && window.parent === window;
  return isFileProtocol && isEmbedded;
}

/**
 * Download a single Lua script file
 */
export async function downloadScript(scriptId: string): Promise<void> {
  const script = AVAILABLE_SCRIPTS.find(s => s.id === scriptId);
  if (!script) {
    log(`Script not found: ${scriptId}`, 'error');
    return;
  }

  try {
    // Fetch the Lua file from the project root
    const response = await fetch(`/${script.file}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch ${script.file}: ${response.statusText}`);
    }

    const luaContent = await response.text();

    // Create blob and download
    const blob = new Blob([luaContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = script.file;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    log(`📥 Downloaded ${script.file} (v${script.version})`, 'success');

    // In OBS dock, download might not work - offer clipboard fallback
    if (isOBSDock()) {
      setTimeout(() => {
        if (confirm(`Download may not work in OBS dock.\n\nCopy script content to clipboard instead?`)) {
          navigator.clipboard.writeText(luaContent).then(() => {
            log(`${script.file} copied to clipboard`, 'success');
          }).catch(() => {
            prompt(`Copy this content and save as ${script.file}:`, luaContent);
          });
        }
      }, 500);
    }
  } catch (error) {
    const err = error as Error;
    log(`Error downloading ${script.file}: ${err.message}`, 'error');
    alert(`Failed to download ${script.file}.\n\nMake sure:\n- Dev server is running, or\n- File exists in project root`);
  }
}

/**
 * Copy script filename to clipboard
 */
export function copyScriptPath(filename: string): void {
  navigator.clipboard.writeText(filename).then(() => {
    log(`📋 Copied: ${filename}`, 'success');
  }).catch(() => {
    prompt('Copy this filename:', filename);
  });
}

/**
 * Download all scripts as a zip (future enhancement)
 */
export async function downloadAllScripts(): Promise<void> {
  log('Downloading all scripts...', 'info');
  
  for (const script of AVAILABLE_SCRIPTS) {
    await downloadScript(script.id);
    // Small delay between downloads
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  log(`Downloaded ${AVAILABLE_SCRIPTS.length} scripts`, 'success');
}

/**
 * Render scripts list with download buttons
 */
export function renderScriptsListWithDownload(): void {
  const container = document.getElementById('scriptsList');
  if (!container) return;

  container.innerHTML = AVAILABLE_SCRIPTS.map(script => `
    <div class="script-card">
      <div class="script-card__header">
        <span class="script-card__icon">${script.icon}</span>
        <div style="flex: 1;">
          <div class="script-card__name">${script.name}</div>
          <div class="script-card__version">v${script.version}</div>
        </div>
      </div>
      <p class="script-card__desc">${script.description}</p>
      ${script.changelog ? `<p class="script-card__changelog">${script.changelog}</p>` : ''}
      <div class="script-card__file">${script.file}</div>
      <div class="script-card__actions">
        <button class="btn btn-primary" onclick="window.ScriptDownloader?.downloadScript('${script.id}')" title="Download ${script.file}">
          💾 Download
        </button>
        <button class="btn btn-secondary" onclick="window.ScriptDownloader?.copyScriptPath('${script.file}')" title="Copy filename">
          📋 Copy Name
        </button>
      </div>
    </div>
  `).join('');
}

// ============ Exports ============
export const ScriptDownloader = {
  downloadScript,
  copyScriptPath,
  downloadAllScripts,
  renderScriptsListWithDownload,
  getAvailableScripts: () => AVAILABLE_SCRIPTS
};

// Expose to window for onclick handlers
if (typeof window !== 'undefined') {
  (window as any).ScriptDownloader = ScriptDownloader;
}
