/**
 * Text Cycler Store
 * 
 * Svelte store for managing text cycler configurations.
 * Replaces the legacy window.TextCycler global pattern.
 */

import { writable, derived, get } from 'svelte/store';
import { connected } from './connection';
import { storage } from '../modules/storage';
import { request } from '../modules/websocket';

// ============================================================================
// Types
// ============================================================================

export interface TextCyclerStyles {
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  fontStyle?: string;
  color?: string;
  textAlign?: string;
  letterSpacing?: string;
  lineHeight?: string;
  textTransform?: string;
  shadow?: string;
  strokeWidth?: string;
  strokeColor?: string;
}

export interface TextCyclerConfig {
  id: string;
  name: string;
  mode: 'browser' | 'legacy';
  configId: string;
  textSource: string;
  textLines: string[];
  transition: string;
  transDuration: number;
  cycleDuration: number;
  styles: TextCyclerStyles;
  isRunning: boolean;
  cycleIndex?: number;
}

interface TextCyclerMessage {
  type: 'show' | 'clear' | 'style' | 'ping';
  text?: string;
  transition?: string;
  duration?: number;
  styles?: TextCyclerStyles;
}

// ============================================================================
// Stores
// ============================================================================

/** All text cycler configurations */
export const configs = writable<TextCyclerConfig[]>([]);

/** Currently selected config index (-1 = none) */
export const selectedIndex = writable<number>(-1);

/** Currently selected config (derived) */
export const selectedConfig = derived(
  [configs, selectedIndex],
  ([$configs, $index]) => $index >= 0 && $index < $configs.length ? $configs[$index] : null
);

/** BroadcastChannels for each config */
const channels: Record<string, BroadcastChannel> = {};

/** Interval IDs for running cyclers */
const intervals: Record<string, ReturnType<typeof setInterval>> = {};

// ============================================================================
// Initialization
// ============================================================================

/** Load configs from storage */
export function loadConfigs(): void {
  const saved = storage.get('textCyclerConfigs') as TextCyclerConfig[] | null;
  if (saved && Array.isArray(saved)) {
    configs.set(saved);
  }
}

/** Save configs to storage */
export function saveConfigs(): void {
  const current = get(configs);
  storage.set('textCyclerConfigs', current);
}

// ============================================================================
// Config Management
// ============================================================================

/** Create a new config */
export function createConfig(): void {
  const current = get(configs);
  const newConfig: TextCyclerConfig = {
    id: 'config_' + Date.now(),
    name: 'Text Cycler ' + (current.length + 1),
    mode: 'browser',
    configId: 'text' + (current.length + 1),
    textSource: '',
    textLines: ['Welcome to the stream!', "Don't forget to subscribe!", 'Thanks for watching!'],
    transition: 'obfuscate',
    transDuration: 500,
    cycleDuration: 3000,
    styles: {
      fontSize: '48px',
      fontWeight: '700',
      color: '#ffffff',
      textAlign: 'center',
      shadow: '2px 2px 4px rgba(0,0,0,0.5)'
    },
    isRunning: false
  };
  
  configs.update(c => [...c, newConfig]);
  selectedIndex.set(current.length);
  saveConfigs();
}

/** Select a config by index */
export function selectConfig(index: number): void {
  selectedIndex.set(index);
}

/** Update the selected config */
export function updateSelectedConfig(updates: Partial<TextCyclerConfig>): void {
  const index = get(selectedIndex);
  if (index < 0) return;
  
  configs.update(c => {
    const updated = [...c];
    updated[index] = { ...updated[index], ...updates };
    return updated;
  });
}

/** Update styles for the selected config */
export function updateSelectedStyles(styles: Partial<TextCyclerStyles>): void {
  const index = get(selectedIndex);
  if (index < 0) return;
  
  configs.update(c => {
    const updated = [...c];
    updated[index] = {
      ...updated[index],
      styles: { ...updated[index].styles, ...styles }
    };
    return updated;
  });
}

/** Delete the selected config */
export function deleteSelectedConfig(): void {
  const index = get(selectedIndex);
  if (index < 0) return;
  
  // Stop if running
  const config = get(configs)[index];
  if (config?.isRunning) {
    stopCycler(index);
  }
  
  configs.update(c => c.filter((_, i) => i !== index));
  selectedIndex.set(-1);
  saveConfigs();
}

/** Save current config state */
export function saveCurrentConfig(): void {
  saveConfigs();
}

// ============================================================================
// Communication
// ============================================================================

/** Get or create a BroadcastChannel for a config */
function getChannel(configId: string): BroadcastChannel | null {
  if (!channels[configId]) {
    try {
      channels[configId] = new BroadcastChannel('text_cycler_' + configId);
    } catch {
      return null;
    }
  }
  return channels[configId];
}

/** Send a message to the display */
async function sendToDisplay(configId: string, message: TextCyclerMessage): Promise<void> {
  const isConnected = get(connected);
  
  const messageData = {
    message: message,
    timestamp: Date.now()
  };
  
  // BROWSER MODE: BroadcastChannel for same-origin (preview, same browser tab)
  const channel = getChannel(configId);
  if (channel) {
    channel.postMessage(message);
  }
  
  // OBS MODE: Send via WebSocket - OBS broadcasts to all connected clients
  // Browser sources receive this via their WebSocket connection
  if (isConnected) {
    try {
      await request('BroadcastCustomEvent', {
        eventData: {
          type: 'strixun_text_cycler_msg',
          configId: configId,
          message: message,
          timestamp: messageData.timestamp
        }
      });
    } catch (e) {
      console.error('[TextCycler] BroadcastCustomEvent failed:', e);
    }
  }
}

// ============================================================================
// Cycling Control
// ============================================================================

/** Start cycling for a config */
export function startCycler(index?: number): void {
  const idx = index ?? get(selectedIndex);
  if (idx < 0) return;
  
  const allConfigs = get(configs);
  const config = allConfigs[idx];
  if (!config) return;
  
  if (!config.textLines || config.textLines.length === 0) return;
  
  // Stop if already running
  if (config.isRunning) {
    stopCycler(idx);
  }
  
  // Update state
  configs.update(c => {
    const updated = [...c];
    updated[idx] = { ...updated[idx], isRunning: true, cycleIndex: 0 };
    return updated;
  });
  
  const configId = config.configId || config.id;
  
  // Send initial styles
  if (config.mode === 'browser' && config.styles) {
    sendToDisplay(configId, { type: 'style', styles: config.styles });
  }
  
  // Send initial text
  sendToDisplay(configId, {
    type: 'show',
    text: config.textLines[0],
    transition: config.transition,
    duration: config.transDuration,
    styles: config.styles
  });
  
  // Start interval
  let cycleIndex = 0;
  intervals[config.id] = setInterval(() => {
    cycleIndex = (cycleIndex + 1) % config.textLines.length;
    
    configs.update(c => {
      const updated = [...c];
      if (updated[idx]) {
        updated[idx] = { ...updated[idx], cycleIndex };
      }
      return updated;
    });
    
    sendToDisplay(configId, {
      type: 'show',
      text: config.textLines[cycleIndex],
      transition: config.transition,
      duration: config.transDuration,
      styles: config.styles
    });
  }, config.cycleDuration || 3000);
  
  saveConfigs();
}

/** Stop cycling for a config */
export function stopCycler(index?: number): void {
  const idx = index ?? get(selectedIndex);
  if (idx < 0) return;
  
  const allConfigs = get(configs);
  const config = allConfigs[idx];
  if (!config) return;
  
  // Clear interval
  if (intervals[config.id]) {
    clearInterval(intervals[config.id]);
    delete intervals[config.id];
  }
  
  // Update state
  configs.update(c => {
    const updated = [...c];
    updated[idx] = { ...updated[idx], isRunning: false };
    return updated;
  });
  
  saveConfigs();
}

/** Quick start/stop toggle */
export function toggleCycler(index: number): void {
  const allConfigs = get(configs);
  const config = allConfigs[index];
  if (!config) return;
  
  if (config.isRunning) {
    stopCycler(index);
  } else {
    startCycler(index);
  }
}

// ============================================================================
// Export/Import
// ============================================================================

/** Export configs to clipboard */
export async function exportConfigs(): Promise<boolean> {
  const allConfigs = get(configs);
  if (allConfigs.length === 0) return false;
  
  try {
    await navigator.clipboard.writeText(JSON.stringify(allConfigs, null, 2));
    return true;
  } catch {
    return false;
  }
}

/** Import configs from clipboard */
export async function importConfigs(): Promise<number> {
  try {
    const text = await navigator.clipboard.readText();
    const imported = JSON.parse(text) as TextCyclerConfig[];
    
    if (!Array.isArray(imported)) return 0;
    
    configs.update(c => [...c, ...imported]);
    saveConfigs();
    return imported.length;
  } catch {
    return 0;
  }
}

// ============================================================================
// Utility
// ============================================================================

/** Get browser source URL for a config */
export function getBrowserSourceUrl(configId: string): string {
  const baseUrl = window.location.origin + window.location.pathname;
  return `${baseUrl}#/text-cycler-display?id=${encodeURIComponent(configId)}`;
}

/** Copy browser source URL to clipboard */
export async function copyBrowserSourceUrl(configId: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(getBrowserSourceUrl(configId));
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Compatibility API (for storageSync, app.ts)
// ============================================================================

/** Get all configs (for external use) */
export function getConfigs(): TextCyclerConfig[] {
  return get(configs);
}

/** Set all configs (for import/restore) */
export function setConfigs(newConfigs: TextCyclerConfig[]): void {
  configs.set(newConfigs || []);
  saveConfigs();
}

/** Add configs (for merge operations) */
export function addConfigs(newConfigs: TextCyclerConfig[]): void {
  configs.update(c => [...c, ...newConfigs]);
  saveConfigs();
}

/** Check if any cycler is running */
export function isRunning(): boolean {
  return get(configs).some(c => c.isRunning);
}

// Initialize on import
loadConfigs();
