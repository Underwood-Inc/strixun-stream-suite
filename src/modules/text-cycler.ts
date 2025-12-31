/**
 * Strixun Stream Suite - Text Cycler Module
 * 
 * Handles all text cycler functionality including:
 * - Multi-config text cycling with browser source and legacy modes
 * - Transition animations (obfuscate, typewriter, glitch, etc.)
 * - Style management for browser sources
 * - Remote control via OBS WebSocket
 * 
 * @version 2.0.0 (TypeScript)
 */

import { storage } from './storage';
import { connected, sources } from '../stores/connection';
import { request, getMsgId } from './websocket';
import { get } from 'svelte/store';
import type { TextCyclerConfig, TextCyclerStyles } from '../types';

// ============ Types ============
interface TextCyclerDependencies {
  log: (msg: string, type?: string) => void;
  isOBSDock: () => boolean;
  storageSyncTimer: ReturnType<typeof setTimeout> | null;
  broadcastStorage: () => void;
  STORAGE_SYNC_DEBOUNCE: number;
  showPage?: (page: string) => void;
  initSearchForList?: (listId: string, inputId: string, container: HTMLElement, count: number) => void;
  updateTextCyclerMode?: () => void;
  updateTransitionMode?: () => void;
  updateBrowserSourceUrlPreview?: () => void;
}

interface TextCyclerMessage {
  type: 'style' | 'show';
  styles?: TextCyclerStyles;
  text?: string;
  transition?: string;
  duration?: number;
}

// ============ State ============
let textCyclerConfigs: TextCyclerConfig[] = [];
let currentTextConfigIndex = -1;
let cycleIndex = 0;
let transitionInterval: ReturnType<typeof setInterval> | null = null;
let textChannels: Record<string, BroadcastChannel> = {};
let lastTextSend = 0;
const MIN_TEXT_INTERVAL = 80;

// Character sets for effects
const CHARS_ENCHANT = 'ᔑᒷᓵᒷ⊣╎⋮ꖌꖎᒲリ𝙹ᑑ∷ᓭℸ∴⨅';
const CHARS_GLITCH = '█▓▒░╔╗╚╝║═┌┐└┘│─┼▀▄▌▐■□▪▫●○';

// Dependencies (injected)
let dependencies: TextCyclerDependencies = {
  log: (msg: string, type?: string) => console.log(`[${type || 'info'}] ${msg}`),
  isOBSDock: () => false,
  storageSyncTimer: null,
  broadcastStorage: () => {},
  STORAGE_SYNC_DEBOUNCE: 500
};

// ============ Initialization ============

/**
 * Initialize the module with required dependencies
 */
export function init(deps: Partial<TextCyclerDependencies>): void {
  dependencies = { ...dependencies, ...deps };
  loadConfigs();
}

// ============ Config Management ============

/**
 * Load configs from storage
 */
export function loadConfigs(): void {
  textCyclerConfigs = (storage.get('textCyclerConfigs') as TextCyclerConfig[]) || [];
}

/**
 * Save configs to storage
 */
export function saveTextCyclerConfigs(): void {
  storage.set('textCyclerConfigs', textCyclerConfigs);
  
  // OBS dock: debounced save to persistent storage for remote clients
  if (dependencies.isOBSDock() && get(connected)) {
    if (dependencies.storageSyncTimer) clearTimeout(dependencies.storageSyncTimer);
    dependencies.storageSyncTimer = setTimeout(() => {
      dependencies.broadcastStorage();
    }, dependencies.STORAGE_SYNC_DEBOUNCE);
  }
}

/**
 * Render the list of text cycler configs
 */
export function renderTextCyclerConfigs(): void {
  const container = document.getElementById('textCyclerConfigs');
  if (!container) return;
  
  if (textCyclerConfigs.length === 0) {
    container.innerHTML = '<div class="empty-state">No configs yet. Click "New Config" to create one.</div>';
    return;
  }
  
  container.innerHTML = textCyclerConfigs.map((c, i) => `
    <div class="source-item" style="cursor:pointer" onclick="window.TextCycler?.loadConfig(${i})">
      <div>
        <div class="name">${c.name || 'Unnamed'} ${c.isRunning ? '<span class="badge badge-success">Running</span>' : ''}</div>
        <div class="type">${c.mode === 'browser' ? '[EMOJI] Browser' : '[EMOJI] Legacy'} • ${(c.textLines || []).length} lines • ${c.transition || 'none'}</div>
      </div>
      <div style="display:flex;gap:4px">
        <button onclick="event.stopPropagation(); window.TextCycler?.quickStart(${i})" title="${c.isRunning ? 'Stop' : 'Start'}">${c.isRunning ? '' : '▶'}</button>
      </div>
    </div>
  `).join('');
  
  // Initialize/refresh search for text configs
  if (dependencies.initSearchForList) {
    dependencies.initSearchForList('textConfigs', 'textConfigsSearchInput', container, textCyclerConfigs.length);
  }
}

/**
 * Create a new text cycler config
 */
export function newTextConfig(): void {
  const config: TextCyclerConfig = {
    id: 'config_' + Date.now(),
    name: 'Text Cycler ' + (textCyclerConfigs.length + 1),
    mode: 'browser',
    configId: 'text' + (textCyclerConfigs.length + 1),
    textSource: '',
    textLines: ['Welcome to the stream!', 'Don\'t forget to subscribe!', 'Thanks for watching!'],
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
  
  textCyclerConfigs.push(config);
  saveTextCyclerConfigs();
  renderTextCyclerConfigs();
  loadConfig(textCyclerConfigs.length - 1);
  dependencies.log('Created new text config', 'success');
}

/**
 * Load a config into the editor
 */
export function loadConfig(index: number): void {
  currentTextConfigIndex = index;
  const config = textCyclerConfigs[index];
  if (!config) return;
  
  // Show editor cards
  const editor = document.getElementById('textConfigEditor');
  if (editor) editor.style.display = 'block';
  const linesCard = document.getElementById('textLinesCard');
  if (linesCard) linesCard.style.display = 'block';
  const animCard = document.getElementById('textAnimationCard');
  if (animCard) animCard.style.display = 'block';
  const previewCard = document.getElementById('textPreviewCard');
  if (previewCard) previewCard.style.display = 'block';
  const controls = document.getElementById('textControls');
  if (controls) controls.style.display = 'block';
  
  // Load values
  const nameEl = document.getElementById('textConfigName') as HTMLInputElement | null;
  if (nameEl) nameEl.value = config.name || '';
  const modeEl = document.getElementById('textCyclerMode') as HTMLSelectElement | null;
  if (modeEl) modeEl.value = config.mode || 'browser';
  const configIdEl = document.getElementById('textConfigId') as HTMLInputElement | null;
  if (configIdEl) configIdEl.value = config.configId || config.id;
  const sourceEl = document.getElementById('textSource') as HTMLSelectElement | null;
  if (sourceEl) sourceEl.value = config.textSource || '';
  const linesEl = document.getElementById('textLines') as HTMLTextAreaElement | null;
  if (linesEl) linesEl.value = (config.textLines || []).join('\n');
  const transitionEl = document.getElementById('textTransition') as HTMLSelectElement | null;
  if (transitionEl) transitionEl.value = config.transition || 'none';
  const transDurationEl = document.getElementById('transDuration') as HTMLInputElement | null;
  if (transDurationEl) transDurationEl.value = String(config.transDuration || 500);
  const durationEl = document.getElementById('textDuration') as HTMLInputElement | null;
  if (durationEl) durationEl.value = String(config.cycleDuration || 3000);
  
  // Style settings
  if (config.styles) {
    const fontFamily = config.styles.fontFamily || "'Segoe UI', system-ui, sans-serif";
    const fontSelect = document.getElementById('textFontFamily') as HTMLSelectElement | null;
    const fontCustom = document.getElementById('textFontFamilyCustom') as HTMLInputElement | null;
    if (fontSelect && fontCustom) {
      let isPreset = false;
      for (let i = 0; i < fontSelect.options.length; i++) {
        const opt = fontSelect.options[i];
        if (opt.value === fontFamily) {
          fontSelect.value = fontFamily;
          fontCustom.value = '';
          isPreset = true;
          break;
        }
      }
      if (!isPreset) {
        fontSelect.selectedIndex = 0;
        fontCustom.value = fontFamily;
      }
    }
    
    const fontSizeEl = document.getElementById('textFontSize') as HTMLInputElement | null;
    if (fontSizeEl) fontSizeEl.value = config.styles.fontSize || '48px';
    const fontWeightEl = document.getElementById('textFontWeight') as HTMLSelectElement | null;
    if (fontWeightEl) fontWeightEl.value = config.styles.fontWeight || '700';
    const fontStyleEl = document.getElementById('textFontStyle') as HTMLSelectElement | null;
    if (fontStyleEl) fontStyleEl.value = config.styles.fontStyle || 'normal';
    const colorEl = document.getElementById('textColor') as HTMLInputElement | null;
    if (colorEl) colorEl.value = config.styles.color || '#ffffff';
    const colorPickerEl = document.getElementById('textColorPicker') as HTMLInputElement | null;
    if (colorPickerEl) colorPickerEl.value = config.styles.color || '#ffffff';
    const alignEl = document.getElementById('textAlign') as HTMLSelectElement | null;
    if (alignEl) alignEl.value = config.styles.textAlign || 'center';
    const letterSpacingEl = document.getElementById('textLetterSpacing') as HTMLInputElement | null;
    if (letterSpacingEl) letterSpacingEl.value = config.styles.letterSpacing || 'normal';
    const lineHeightEl = document.getElementById('textLineHeight') as HTMLInputElement | null;
    if (lineHeightEl) lineHeightEl.value = config.styles.lineHeight || '1.2';
    const textTransformEl = document.getElementById('textTransform') as HTMLSelectElement | null;
    if (textTransformEl) textTransformEl.value = config.styles.textTransform || 'none';
    const shadowEl = document.getElementById('textShadow') as HTMLInputElement | null;
    if (shadowEl) shadowEl.value = config.styles.shadow || '';
    const strokeWidthEl = document.getElementById('textStrokeWidth') as HTMLInputElement | null;
    if (strokeWidthEl) strokeWidthEl.value = config.styles.strokeWidth || '0';
    const strokeColorEl = document.getElementById('textStrokeColor') as HTMLInputElement | null;
    if (strokeColorEl) strokeColorEl.value = config.styles.strokeColor || '#000000';
    const strokeColorPickerEl = document.getElementById('textStrokeColorPicker') as HTMLInputElement | null;
    if (strokeColorPickerEl) strokeColorPickerEl.value = config.styles.strokeColor || '#000000';
  }
  
  if (dependencies.updateTextCyclerMode) dependencies.updateTextCyclerMode();
  if (dependencies.updateTransitionMode) dependencies.updateTransitionMode();
  if (dependencies.updateBrowserSourceUrlPreview) dependencies.updateBrowserSourceUrlPreview();
  
  // Reset preview
  const preview = document.getElementById('textPreview');
  if (preview) {
    if (config.isRunning && config.textLines && config.textLines.length > 0) {
      const currentIndex = config.cycleIndex || 0;
      preview.textContent = config.textLines[currentIndex] || config.textLines[0];
    } else if (config.textLines && config.textLines.length > 0) {
      preview.textContent = config.textLines[0];
    } else {
      preview.textContent = '(no text lines)';
    }
  }
  
  // Update button states
  const startBtn = document.getElementById('startCycleBtn') as HTMLButtonElement | null;
  if (startBtn) startBtn.disabled = config.isRunning || false;
  const stopBtn = document.getElementById('stopCycleBtn') as HTMLButtonElement | null;
  if (stopBtn) stopBtn.disabled = !config.isRunning;
  
  dependencies.log('Loaded config: ' + config.name, 'info');
}

/**
 * Save the currently loaded config
 */
export function saveCurrentTextConfig(): void {
  if (currentTextConfigIndex < 0) return;
  
  const config = textCyclerConfigs[currentTextConfigIndex];
  const nameEl = document.getElementById('textConfigName') as HTMLInputElement | null;
  if (nameEl) config.name = nameEl.value || 'Unnamed';
  const modeEl = document.getElementById('textCyclerMode') as HTMLSelectElement | null;
  if (modeEl) config.mode = modeEl.value as 'browser' | 'legacy';
  const configIdEl = document.getElementById('textConfigId') as HTMLInputElement | null;
  if (configIdEl) config.configId = configIdEl.value || config.id;
  const sourceEl = document.getElementById('textSource') as HTMLSelectElement | null;
  if (sourceEl) config.textSource = sourceEl.value;
  const linesEl = document.getElementById('textLines') as HTMLTextAreaElement | null;
  if (linesEl) {
    config.textLines = linesEl.value.split('\n').map(l => l.trim()).filter(l => l);
  }
  const transitionEl = document.getElementById('textTransition') as HTMLSelectElement | null;
  if (transitionEl) config.transition = transitionEl.value;
  const transDurationEl = document.getElementById('transDuration') as HTMLInputElement | null;
  if (transDurationEl) config.transDuration = parseInt(transDurationEl.value) || 500;
  const durationEl = document.getElementById('textDuration') as HTMLInputElement | null;
  if (durationEl) config.cycleDuration = parseInt(durationEl.value) || 3000;
  
  const fontFamilyCustomEl = document.getElementById('textFontFamilyCustom') as HTMLInputElement | null;
  const fontFamilyEl = document.getElementById('textFontFamily') as HTMLSelectElement | null;
  config.styles = {
    fontFamily: (fontFamilyCustomEl && fontFamilyCustomEl.value) || (fontFamilyEl && fontFamilyEl.value),
    fontSize: (document.getElementById('textFontSize') as HTMLInputElement)?.value || '48px',
    fontWeight: (document.getElementById('textFontWeight') as HTMLSelectElement)?.value || '700',
    fontStyle: (document.getElementById('textFontStyle') as HTMLSelectElement)?.value || 'normal',
    color: (document.getElementById('textColor') as HTMLInputElement)?.value || '#ffffff',
    textAlign: (document.getElementById('textAlign') as HTMLSelectElement)?.value || 'center',
    letterSpacing: (document.getElementById('textLetterSpacing') as HTMLInputElement)?.value || 'normal',
    lineHeight: (document.getElementById('textLineHeight') as HTMLInputElement)?.value || '1.2',
    textTransform: (document.getElementById('textTransform') as HTMLSelectElement)?.value || 'none',
    shadow: (document.getElementById('textShadow') as HTMLInputElement)?.value || '',
    strokeWidth: (document.getElementById('textStrokeWidth') as HTMLInputElement)?.value || '0',
    strokeColor: (document.getElementById('textStrokeColor') as HTMLInputElement)?.value || '#000000'
  };
  
  saveTextCyclerConfigs();
  renderTextCyclerConfigs();
  dependencies.log('Saved config: ' + config.name, 'success');
}

/**
 * Delete the current config
 */
export function deleteCurrentTextConfig(): void {
  if (currentTextConfigIndex < 0) return;
  if (!confirm('Delete this config?')) return;
  
  const config = textCyclerConfigs[currentTextConfigIndex];
  if (config.isRunning) stopConfigCycling(currentTextConfigIndex);
  
  textCyclerConfigs.splice(currentTextConfigIndex, 1);
  saveTextCyclerConfigs();
  renderTextCyclerConfigs();
  
  // Hide editor
  const editor = document.getElementById('textConfigEditor');
  if (editor) editor.style.display = 'none';
  const linesCard = document.getElementById('textLinesCard');
  if (linesCard) linesCard.style.display = 'none';
  const animCard = document.getElementById('textAnimationCard');
  if (animCard) animCard.style.display = 'none';
  const styleCard = document.getElementById('textStyleCard');
  if (styleCard) styleCard.style.display = 'none';
  const previewCard = document.getElementById('textPreviewCard');
  if (previewCard) previewCard.style.display = 'none';
  const controls = document.getElementById('textControls');
  if (controls) controls.style.display = 'none';
  
  currentTextConfigIndex = -1;
  dependencies.log('Config deleted', 'info');
}

/**
 * Export configs as JSON
 */
export function exportTextConfigs(): void {
  if (textCyclerConfigs.length === 0) {
    dependencies.log('No configs to export', 'error');
    return;
  }
  const json = JSON.stringify(textCyclerConfigs, null, 2);
  navigator.clipboard.writeText(json).then(() => {
    dependencies.log('Configs copied to clipboard!', 'success');
  }).catch(() => {
    prompt('Copy this JSON:', json);
  });
}

/**
 * Import configs from JSON
 */
export function importTextConfigs(): void {
  const json = prompt('Paste config JSON:');
  if (!json) return;
  
  try {
    const imported = JSON.parse(json) as TextCyclerConfig[];
    if (!Array.isArray(imported)) throw new Error('Must be array');
    
    const merge = textCyclerConfigs.length > 0 && confirm('Merge with existing? (Cancel to replace)');
    if (merge) {
      textCyclerConfigs = [...textCyclerConfigs, ...imported];
    } else {
      textCyclerConfigs = imported;
    }
    
    saveTextCyclerConfigs();
    renderTextCyclerConfigs();
    dependencies.log(`Imported ${imported.length} configs`, 'success');
  } catch (e) {
    const error = e as Error;
    dependencies.log('Invalid JSON: ' + error.message, 'error');
  }
}

// ============ Communication ============

/**
 * Get or create a BroadcastChannel for a config
 */
function getOrCreateChannel(configId: string): BroadcastChannel | null {
  if (!textChannels[configId]) {
    try {
      textChannels[configId] = new BroadcastChannel('text_cycler_' + configId);
    } catch (e) {
      console.warn('BroadcastChannel not supported');
      return null;
    }
  }
  return textChannels[configId];
}

/**
 * Send message to display (browser source or legacy)
 */
async function sendToDisplay(configId: string, message: TextCyclerMessage): Promise<void> {
  // Same-origin mode (OBS dock): use BroadcastChannel and localStorage
  const channel = getOrCreateChannel(configId);
  if (channel) {
    channel.postMessage(message);
  }
  
  const messageData = {
    message: message,
    timestamp: Date.now()
  };
  localStorage.setItem('text_cycler_msg_' + configId, JSON.stringify(messageData));
  
  // Remote mode: send via OBS WebSocket API (same as quick swaps)
  // OBS dock will receive via CustomEvent and forward to localStorage
  const isConnected = get(connected);
  const isDock = dependencies.isOBSDock();
  
  if (isConnected && !isDock) {
    try {
      await request('BroadcastCustomEvent', {
        eventData: {
          type: 'strixun_text_cycler_msg',
          configId: configId,
          message: message,
          timestamp: messageData.timestamp
        }
      });
      console.log('[Text Cycler] Sent via WebSocket:', configId, message.type);
    } catch (e) {
      console.warn('[Text Cycler] Failed to send via WebSocket:', e);
      dependencies.log(`Failed to send text cycler message: ${e}`, 'error');
    }
  } else if (!isConnected && !isDock) {
    // Silently skip - connection is already validated in startTextCycler()
    // Don't log warnings here - this is expected during restore when OBS isn't connected yet
    // Only log if this is an actual user action, not a restore operation
  }
}

// ============ Cycling Engine ============

/**
 * Start the text cycler for the current config
 */
export function startTextCycler(): void {
  saveCurrentTextConfig();
  
  if (currentTextConfigIndex < 0) {
    dependencies.log('No config selected', 'error');
    return;
  }
  
  const config = textCyclerConfigs[currentTextConfigIndex];
  if (!config) {
    dependencies.log('Config not found', 'error');
    return;
  }
  
  if (!config.textLines || config.textLines.length === 0) {
    dependencies.log('Enter at least one text line', 'error');
    return;
  }
  
  if (config.mode === 'legacy' && !config.textSource) {
    dependencies.log('Select a text source first', 'error');
    return;
  }
  
  const isConnected = get(connected);
  if (config.mode === 'legacy' && !isConnected) {
    dependencies.log('Connect to OBS first for legacy mode', 'error');
    if (dependencies.showPage) dependencies.showPage('setup');
    return;
  }
  
  if (config.mode === 'browser' && !isConnected && !dependencies.isOBSDock()) {
    dependencies.log('Connect to OBS first for browser mode (remote)', 'error');
    if (dependencies.showPage) dependencies.showPage('setup');
    return;
  }
  
  startConfigCycling(currentTextConfigIndex);
}

/**
 * Start cycling for a specific config
 */
function startConfigCycling(index: number): void {
  const config = textCyclerConfigs[index];
  if (!config) return;
  
  // Stop if already running
  if (config.isRunning) {
    stopConfigCycling(index);
  }
  
  config.isRunning = true;
  config.cycleIndex = 0;
  
  // Send styles first (browser mode only)
  if (config.mode === 'browser' && config.styles) {
    sendToDisplay(config.configId || config.id, {
      type: 'style',
      styles: config.styles
    });
  }
  
  // Send initial text
  showConfigText(index, config.textLines[0]);
  
  // Start interval
  (config as any).intervalId = setInterval(() => {
    config.cycleIndex = ((config.cycleIndex || 0) + 1) % config.textLines.length;
    showConfigText(index, config.textLines[config.cycleIndex || 0]);
  }, config.cycleDuration || 3000);
  
  saveTextCyclerConfigs();
  renderTextCyclerConfigs();
  
  // Update UI if this is current config
  if (index === currentTextConfigIndex) {
    const startBtn = document.getElementById('startCycleBtn') as HTMLButtonElement | null;
    if (startBtn) startBtn.disabled = true;
    const stopBtn = document.getElementById('stopCycleBtn') as HTMLButtonElement | null;
    if (stopBtn) stopBtn.disabled = false;
  }
  
  dependencies.log(`Started: ${config.name} (${config.textLines.length} lines)`, 'success');
}

/**
 * Show text for a config
 */
function showConfigText(index: number, text: string): void {
  const config = textCyclerConfigs[index];
  if (!config) return;
  
  if (config.mode === 'browser') {
    // Send to browser source
    sendToDisplay(config.configId || config.id, {
      type: 'show',
      text: text,
      transition: config.transition,
      duration: config.transDuration
    });
    
    // Only update preview if this is the currently selected config
    if (index === currentTextConfigIndex) {
      const preview = document.getElementById('textPreview');
      if (preview) preview.textContent = text;
    }
  } else {
    // Legacy: update OBS text source directly
    showTextWithTransitionLegacy(text, config, index);
  }
}

/**
 * Show text with transition (legacy mode)
 */
function showTextWithTransitionLegacy(targetText: string, config: TextCyclerConfig, configIndex: number): void {
  const transition = config.transition;
  const transDuration = config.transDuration || 500;
  
  if (transitionInterval) {
    clearInterval(transitionInterval);
    transitionInterval = null;
  }
  
  if (transition === 'none') {
    setTextFast(targetText, config.textSource || '', configIndex);
    return;
  }
  
  const STEP_MS = 100;
  const totalSteps = Math.max(Math.floor(transDuration / STEP_MS), 1);
  let currentStep = 0;
  
  function doStep(): void {
    currentStep++;
    const progress = currentStep / totalSteps;
    
    let displayText = targetText;
    
    if (transition === 'typewriter') {
      const chars = Math.ceil(progress * targetText.length);
      displayText = targetText.substring(0, chars);
    } else if (transition === 'glitch' || transition === 'obfuscate') {
      if (progress < 0.6) {
        displayText = scrambleTextLegacy(targetText);
      } else {
        displayText = revealTextLegacy(targetText, (progress - 0.6) / 0.4);
      }
    } else if (transition === 'scramble') {
      if (progress < 0.9) {
        displayText = scrambleTextLegacy(targetText);
      }
    } else if (transition === 'wave') {
      displayText = waveTextLegacy(targetText, progress);
    }
    
    setTextFast(displayText, config.textSource || '', configIndex);
    
    if (currentStep >= totalSteps) {
      if (transitionInterval) {
        clearInterval(transitionInterval);
        transitionInterval = null;
      }
      setTextFast(targetText, config.textSource || '', configIndex);
    }
  }
  
  doStep();
  if (totalSteps > 1) {
    transitionInterval = setInterval(doStep, STEP_MS);
  }
}

/**
 * Set text on OBS source (legacy mode)
 */
function setTextFast(text: string, sourceName: string, configIndex: number): void {
  if (!sourceName) {
    console.warn('[Text Cycler] No source name provided');
    return;
  }
  
  const isConnected = get(connected);
  if (!isConnected) {
    console.warn('[Text Cycler] Not connected to OBS - cannot set text');
    return;
  }
  
  const now = Date.now();
  if (now - lastTextSend < MIN_TEXT_INTERVAL) {
    if (configIndex === currentTextConfigIndex) {
      const preview = document.getElementById('textPreview');
      if (preview) preview.textContent = text;
    }
    return;
  }
  lastTextSend = now;
  
  // Use websocket module's request function
  request('SetInputSettings', {
    inputName: sourceName,
    inputSettings: { text: text }
  }).catch((e) => {
    console.error('[Text Cycler] Failed to set text on source:', sourceName, e);
    dependencies.log(`Failed to update text source "${sourceName}": ${e}`, 'error');
  });
  
  if (configIndex === currentTextConfigIndex) {
    const preview = document.getElementById('textPreview');
    if (preview) preview.textContent = text;
  }
}

/**
 * Scramble text (legacy)
 */
function scrambleTextLegacy(text: string): string {
  const chars = '#$%&*@!?+=~<>[]{}';
  return text.split('').map(c => c === ' ' ? ' ' : chars[Math.floor(Math.random() * chars.length)]).join('');
}

/**
 * Reveal text progressively (legacy)
 */
function revealTextLegacy(target: string, progress: number): string {
  const chars = '#$%&*@!?+=~<>[]{}';
  const revealed = Math.ceil(progress * target.length);
  return target.split('').map((c, i) => i < revealed ? c : (c === ' ' ? ' ' : chars[Math.floor(Math.random() * chars.length)])).join('');
}

/**
 * Wave text effect (legacy)
 */
function waveTextLegacy(target: string, progress: number): string {
  const waveWidth = 3;
  const center = progress * (target.length + waveWidth);
  return target.split('').map((c, i) => {
    if (Math.abs(i - center) < waveWidth && c !== ' ') return CHARS_ENCHANT[Math.floor(Math.random() * CHARS_ENCHANT.length)];
    if (i < center - waveWidth) return c;
    return ' ';
  }).join('');
}

/**
 * Stop the text cycler for current config
 */
export function stopTextCycler(): void {
  if (currentTextConfigIndex >= 0) {
    stopConfigCycling(currentTextConfigIndex);
  }
}

/**
 * Stop cycling for a specific config
 */
function stopConfigCycling(index: number): void {
  const config = textCyclerConfigs[index];
  if (!config) return;
  
  const intervalId = (config as any).intervalId;
  if (intervalId) {
    clearInterval(intervalId);
    (config as any).intervalId = null;
  }
  
  config.isRunning = false;
  saveTextCyclerConfigs();
  renderTextCyclerConfigs();
  
  if (index === currentTextConfigIndex) {
    const startBtn = document.getElementById('startCycleBtn') as HTMLButtonElement | null;
    if (startBtn) startBtn.disabled = false;
    const stopBtn = document.getElementById('stopCycleBtn') as HTMLButtonElement | null;
    if (stopBtn) stopBtn.disabled = true;
  }
  
  dependencies.log(`Stopped: ${config.name}`, 'info');
}

/**
 * Quick start/stop for a config
 */
export function quickStart(index: number): void {
  const config = textCyclerConfigs[index];
  if (!config) return;
  
  if (config.isRunning) {
    stopConfigCycling(index);
  } else {
    startConfigCycling(index);
  }
}

/**
 * Restore running configs on load
 * Only restores if OBS is connected (for browser mode) or if in dock (local mode)
 */
export function restoreRunningTextCyclers(): void {
  const isConnected = get(connected);
  const isDock = dependencies.isOBSDock();
  
  textCyclerConfigs.forEach((config, index) => {
    if (config.isRunning) {
      // Only restore if:
      // 1. Browser mode: OBS is connected OR we're in dock (local mode)
      // 2. Legacy mode: OBS is connected
      const canRestore = config.mode === 'browser' 
        ? (isConnected || isDock)
        : isConnected;
      
      if (canRestore) {
        config.isRunning = false;
        startConfigCycling(index);
      } else {
        // Don't restore if not connected - just mark as not running
        config.isRunning = false;
        saveTextCyclerConfigs();
      }
    }
  });
}

/**
 * Set configs (for import/restore operations)
 */
export function setConfigs(configs: TextCyclerConfig[]): void {
  textCyclerConfigs = configs || [];
  saveTextCyclerConfigs();
  renderTextCyclerConfigs();
}

/**
 * Add configs (for merge operations)
 */
export function addConfigs(newConfigs: TextCyclerConfig[]): void {
  textCyclerConfigs = [...textCyclerConfigs, ...newConfigs];
  saveTextCyclerConfigs();
  renderTextCyclerConfigs();
}

/**
 * Check if text cycler is currently running
 */
export function isRunning(): boolean {
  return textCyclerConfigs.some(config => config.isRunning === true);
}

/**
 * Get all configs
 */
export function getConfigs(): TextCyclerConfig[] {
  return textCyclerConfigs;
}

/**
 * Get current config index
 */
export function getCurrentIndex(): number {
  return currentTextConfigIndex;
}

/**
 * Set current config index
 */
export function setCurrentIndex(index: number): void {
  currentTextConfigIndex = index;
}

