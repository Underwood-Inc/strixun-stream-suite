/**
 * Strixun Stream Suite - Source Management Module
 * 
 * Handles OBS scene and source management, including:
 * - Scene list and selection
 * - Source list and rendering
 * - Source visibility toggling with animations
 * - Source opacity control
 * 
 * @version 2.0.0 (TypeScript)
 */

import { get } from 'svelte/store';
import { connected, currentScene, sources, textSources } from '../stores/connection';
import type { Source } from '../types';
import { storage } from './storage';
import { initSearchForList } from './ui-utils';
import { request } from './websocket';

// ============ Types ============
interface Scene {
  sceneName: string;
  sceneIndex: number;
}

interface SceneItem {
  sourceName: string;
  sceneItemId: number;
  inputKind?: string;
  sceneItemEnabled: boolean;
}

interface Transform {
  positionX: number;
  positionY: number;
  scaleX: number;
  scaleY: number;
  boundsType?: number;
  boundsWidth?: number;
  boundsHeight?: number;
  sourceWidth?: number;
  sourceHeight?: number;
  rotation?: number;
  alignment?: number;
}

interface SourceOpacityConfigs {
  [sourceName: string]: number;
}

// ============ State ============
let allScenes: Scene[] = [];
let selectedScene = '';
let sourceOpacityConfigs: SourceOpacityConfigs = {};

// ============ Helper Functions ============

/**
 * Log function (uses global log if available, otherwise console)
 */
function log(msg: string, type: string = 'info'): void {
  if ((window as any).App?.log) {
    (window as any).App.log(msg, type);
  } else {
    console.log(`[${type}] ${msg}`);
  }
}

/**
 * Get current scene name from store
 */
function getCurrentScene(): string {
  return get(currentScene);
}

/**
 * Get sources from store
 */
function getSources(): Source[] {
  return get(sources);
}

/**
 * Get text sources from store
 */
function getTextSources(): Source[] {
  return get(textSources);
}

// ============ Scene Management ============

export async function refreshScenes(): Promise<void> {
  const isConnected = get(connected);
  if (!isConnected) return;
  
  try {
    const data = await request('GetCurrentProgramScene') as { currentProgramSceneName: string };
    currentScene.set(data.currentProgramSceneName);
    const sceneName = data.currentProgramSceneName;
    
    const currentSceneEl = document.getElementById('currentScene');
    if (currentSceneEl) {
      currentSceneEl.innerHTML = `<strong>${sceneName}</strong>`;
    }
    
    // Also refresh the scene list
    await refreshSceneList();
    
    // Select current scene in dropdown if none selected
    if (!selectedScene) {
      selectedScene = sceneName;
      updateSceneSelector();
    }
    
    refreshSources();
    log('Refreshed scene: ' + sceneName);
  } catch (e) {
    const error = e as Error;
    log('Error: ' + error.message, 'error');
  }
}

export async function refreshSceneList(): Promise<void> {
  const isConnected = get(connected);
  if (!isConnected) return;
  
  try {
    const data = await request('GetSceneList') as { scenes?: Scene[] };
    allScenes = data.scenes || [];
    updateSceneSelector();
    log(`Found ${allScenes.length} scenes`);
  } catch (e) {
    const error = e as Error;
    log('Error getting scene list: ' + error.message, 'error');
  }
}

export function updateSceneSelector(): void {
  renderScenesList();
}

export function renderScenesList(): void {
  const list = document.getElementById('scenesList');
  if (!list) return;
  
  if (allScenes.length === 0) {
    list.innerHTML = '<div class="empty-state">Connect to OBS to see scenes</div>';
    return;
  }
  
  const currentValue = selectedScene || getCurrentScene();
  const currentSceneName = getCurrentScene();
  
  list.innerHTML = allScenes.map(s => {
    const name = s.sceneName;
    const isCurrent = name === currentSceneName;
    const isSelected = name === currentValue;
    const escapedName = name.replace(/'/g, "\\'");
    
    return `
      <div class="source-item ${isSelected ? 'selected' : ''}" 
           data-source="${escapedName}"
           style="cursor:pointer;${isSelected ? 'border-left:3px solid var(--accent);background:var(--border)' : ''}"
           onclick="window.Sources?.onSceneSelect('${escapedName}')">
        <div>
          <div class="name">${name}</div>
          <div class="type">${isCurrent ? ' ★ Live' : 'Scene'}</div>
        </div>
        ${isSelected ? '<span style="color:var(--accent)"></span>' : ''}
      </div>`;
  }).join('');
  
  // If no selection and we have scenes, select the current scene
  if (!selectedScene && allScenes.length > 0) {
    selectedScene = getCurrentScene() || allScenes[0].sceneName;
  }
  
  // Initialize search for scenes list
  if (typeof initSearchForList === 'function') {
    initSearchForList('scenes', 'scenesSearchInput', list, allScenes.length);
  }
}

export async function onSceneSelect(sceneName: string): Promise<void> {
  if (!sceneName || !get(connected)) return;
  selectedScene = sceneName;
  
  // Update scenes list to show selection
  renderScenesList();
  
  // Update sources label
  const label = document.getElementById('sourcesSceneLabel');
  if (label) {
    const isLive = sceneName === getCurrentScene();
    label.innerHTML = `Viewing: <strong>${sceneName}</strong>${isLive ? ' <span style="color:var(--danger)">(Live)</span>' : ''}`;
  }
  
  try {
    // Load sources for the selected scene (not necessarily the current program scene)
    const data = await request('GetSceneItemList', { sceneName: selectedScene }) as { sceneItems?: SceneItem[] };
    const sceneItems = data.sceneItems || [];
    sources.set(sceneItems.map(item => ({
      sourceName: item.sourceName,
      sceneItemId: item.sceneItemId,
      inputKind: item.inputKind,
      sceneItemEnabled: item.sceneItemEnabled
    })));
    renderSources();
    log(`Loaded ${sceneItems.length} sources from: ${selectedScene}`);
  } catch (e) {
    const error = e as Error;
    log('Error getting sources: ' + error.message, 'error');
  }
}

/**
 * Switch to a scene (change program scene)
 */
export async function switchToScene(sceneName: string): Promise<void> {
  const isConnected = get(connected);
  if (!isConnected) {
    log('Connect to OBS first', 'error');
    return;
  }
  
  if (!sceneName) {
    log('Scene name required', 'error');
    return;
  }
  
  try {
    await request('SetCurrentProgramScene', { sceneName });
    log(`Switched to scene: ${sceneName}`, 'success');
    // The scene change will trigger CurrentProgramSceneChanged event which updates the store
  } catch (e) {
    const error = e as Error;
    log(`Error switching scene: ${error.message}`, 'error');
  }
}

// ============ Source Management ============

export async function refreshSources(): Promise<void> {
  const isConnected = get(connected);
  if (!isConnected) return;
  
  // Use selected scene if set, otherwise use current program scene
  const targetScene = selectedScene || getCurrentScene();
  if (!targetScene) return;
  
  try {
    const data = await request('GetSceneItemList', { sceneName: targetScene }) as { sceneItems?: SceneItem[] };
    const sceneItems = data.sceneItems || [];
    sources.set(sceneItems.map(item => ({
      sourceName: item.sourceName,
      sceneItemId: item.sceneItemId,
      inputKind: item.inputKind,
      sceneItemEnabled: item.sceneItemEnabled
    })));
    renderSources();
    
    // Update dependent dropdowns if they exist
    if (typeof (window as any).updateTextSourceDropdown === 'function') {
      (window as any).updateTextSourceDropdown();
    }
    if (typeof (window as any).SourceSwaps?.updateSwapDropdowns === 'function') {
      (window as any).SourceSwaps.updateSwapDropdowns();
    }
    
    log(`Found ${sceneItems.length} sources in: ${targetScene}`);
  } catch (e) {
    const error = e as Error;
    log('Error getting sources: ' + error.message, 'error');
  }
}

export function renderSources(): void {
  const list = document.getElementById('sourcesList');
  if (!list) return;
  
  const currentSources = getSources();
  
  if (currentSources.length === 0) {
    list.innerHTML = '<div class="empty-state">No sources in current scene</div>';
    if (typeof (window as any).updateOpacitySourceDropdown === 'function') {
      (window as any).updateOpacitySourceDropdown();
    }
    return;
  }
  
  list.innerHTML = currentSources.map(s => {
    const savedOpacity = getSourceOpacityConfig(s.sourceName);
    const opacityDisplay = savedOpacity !== null ? savedOpacity : 100;
    const escapedName = s.sourceName.replace(/'/g, "\\'");
    const itemId = `source-item-${s.sceneItemId}`;
    
    return `
      <div class="source-item" id="${itemId}" data-source="${escapedName}" data-item-id="${s.sceneItemId}">
        <div class="source-item__header">
          <div class="source-item__info">
            <div class="name">${s.sourceName}</div>
            <div class="type">${s.inputKind || 'scene'}</div>
          </div>
          <div class="toggle ${s.sceneItemEnabled ? 'on' : ''}" 
               id="toggle-${s.sceneItemId}"
               onclick="window.Sources?.toggleSourceWithLoader('${escapedName}', ${s.sceneItemId}, ${!s.sceneItemEnabled}, this)"></div>
        </div>
        <div class="source-item__controls">
          <div class="source-item__slider-wrap">
            <input type="range" min="0" max="100" value="${opacityDisplay}" 
                   class="opacity-slider"
                   id="slider-${s.sceneItemId}"
                   oninput="window.Sources?.updateSliderValue(this, 'value-${s.sceneItemId}')"
                   onchange="window.Sources?.quickSetOpacityWithLoader('${escapedName}', this.value, this)">
            <span class="source-item__opacity-value" id="value-${s.sceneItemId}">${opacityDisplay}%</span>
          </div>
          <button class="opacity-reset-btn" 
                  id="reset-${s.sceneItemId}"
                  onclick="window.Sources?.resetOpacityWithLoader('${escapedName}', ${s.sceneItemId}, this)"
                  title="Reset to 100%"> Reset</button>
        </div>
      </div>
    `}).join('');
  
  // Update opacity dropdown with current sources
  if (typeof (window as any).updateOpacitySourceDropdown === 'function') {
    (window as any).updateOpacitySourceDropdown();
  }
  
  // Initialize/refresh search for sources list
  if (typeof initSearchForList === 'function') {
    initSearchForList('sources', 'sourcesSearchInput', list, currentSources.length);
  }
}

// ============ Source Visibility Control ============

export async function toggleSource(name: string, id: number, enabled: boolean): Promise<void> {
  const animTypeEl = document.getElementById('visAnimType') as HTMLSelectElement | null;
  const durationEl = document.getElementById('visAnimDuration') as HTMLInputElement | null;
  const easingEl = document.getElementById('visAnimEasing') as HTMLSelectElement | null;
  
  const animType = animTypeEl ? animTypeEl.value : 'none';
  const duration = durationEl ? parseInt(durationEl.value) || 300 : 300;
  const easing = easingEl ? easingEl.value : 'ease';
  
  try {
    if (animType === 'none') {
      // Instant toggle
      await request('SetSceneItemEnabled', {
        sceneName: getCurrentScene(),
        sceneItemId: id,
        sceneItemEnabled: enabled
      });
    } else {
      // Animated toggle
      await animateVisibility(id, enabled, animType, duration, easing);
    }
    log(`${name}: ${enabled ? 'shown' : 'hidden'}`, 'success');
    refreshSources();
  } catch (e) {
    const error = e as Error;
    log('Error: ' + error.message, 'error');
  }
}

// ============ Loader-Aware Control Functions ============

export function updateSliderValue(slider: HTMLInputElement, valueId: string): void {
  const display = document.getElementById(valueId);
  if (display) {
    display.textContent = slider.value + '%';
  }
}

export async function toggleSourceWithLoader(name: string, id: number, enabled: boolean, toggleEl: HTMLElement): Promise<void> {
  const animTypeEl = document.getElementById('visAnimType') as HTMLSelectElement | null;
  const animType = animTypeEl ? animTypeEl.value : 'none';
  const durationEl = document.getElementById('visAnimDuration') as HTMLInputElement | null;
  const duration = durationEl ? parseInt(durationEl.value) || 300 : 300;
  
  // Add loading state
  toggleEl.classList.add('loading');
  
  try {
    await toggleSource(name, id, enabled);
  } finally {
    // Remove loading state after animation duration (or immediately if instant)
    const loadDuration = animType === 'none' ? 100 : duration + 100;
    setTimeout(() => {
      toggleEl.classList.remove('loading');
    }, loadDuration);
  }
}

export async function quickSetOpacityWithLoader(sourceName: string, opacity: string, sliderEl: HTMLInputElement): Promise<void> {
  const resetBtn = sliderEl.closest('.source-item__controls')?.querySelector('.opacity-reset-btn') as HTMLElement | null;
  
  // Disable slider during update
  sliderEl.disabled = true;
  if (resetBtn) resetBtn.classList.add('loading');
  
  try {
    await quickSetOpacity(sourceName, parseInt(opacity));
  } finally {
    // Brief loading state for feedback
    setTimeout(() => {
      sliderEl.disabled = false;
      if (resetBtn) resetBtn.classList.remove('loading');
    }, 300);
  }
}

export async function resetOpacityWithLoader(sourceName: string, itemId: number, btnEl: HTMLElement): Promise<void> {
  const slider = document.getElementById(`slider-${itemId}`) as HTMLInputElement | null;
  const valueDisplay = document.getElementById(`value-${itemId}`);
  
  // Add loading state
  btnEl.classList.add('loading');
  if (slider) slider.disabled = true;
  
  try {
    await setSourceOpacity(sourceName, 100);
    
    // Update UI immediately
    if (slider) slider.value = '100';
    if (valueDisplay) valueDisplay.textContent = '100%';
  } finally {
    setTimeout(() => {
      btnEl.classList.remove('loading');
      if (slider) slider.disabled = false;
    }, 400);
  }
}

// ============ Opacity Control ============
const OPACITY_FILTER_NAME = '_panel_opacity_control';

export function loadSourceOpacityConfigs(): void {
  sourceOpacityConfigs = (storage.get('sourceOpacityConfigs') as SourceOpacityConfigs) || {};
}

export function saveSourceOpacityConfigs(): void {
  storage.set('sourceOpacityConfigs', sourceOpacityConfigs);
}

export function getSourceOpacityConfig(sourceName: string): number | null {
  return sourceOpacityConfigs[sourceName] !== undefined ? sourceOpacityConfigs[sourceName] : null;
}

export function updateOpacitySourceDropdown(): void {
  const select = document.getElementById('opacitySourceSelect') as HTMLSelectElement | null;
  if (!select) return;
  
  const currentVal = select.value;
  select.innerHTML = '<option value="">-- Select Source --</option>';
  
  const currentSources = getSources();
  currentSources.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.sourceName;
    opt.textContent = s.sourceName;
    select.appendChild(opt);
  });
  
  // Restore selection if still valid
  if (currentVal && currentSources.find(s => s.sourceName === currentVal)) {
    select.value = currentVal;
  }
}

export function updateOpacityPreview(): void {
  const slider = document.getElementById('opacitySlider') as HTMLInputElement | null;
  const display = document.getElementById('opacityValue');
  if (slider && display) {
    display.textContent = slider.value + '%';
  }
}

/**
 * Load source opacity value (for reactive components)
 * Returns the opacity value for the given source, or 100 if not set
 */
export function loadSourceOpacity(sourceName: string | null): number {
  if (!sourceName) {
    return 100;
  }
  
  const savedOpacity = getSourceOpacityConfig(sourceName);
  return savedOpacity !== null ? savedOpacity : 100;
}

/**
 * Legacy function for DOM-based components
 * @deprecated Use loadSourceOpacity(sourceName) instead
 */
export function loadSourceOpacityLegacy(): void {
  const select = document.getElementById('opacitySourceSelect') as HTMLSelectElement | null;
  const slider = document.getElementById('opacitySlider') as HTMLInputElement | null;
  const display = document.getElementById('opacityValue');
  
  if (!select || !slider || !display) return;
  
  const sourceName = select.value;
  if (!sourceName) {
    slider.value = '100';
    display.textContent = '100%';
    return;
  }
  
  const savedOpacity = getSourceOpacityConfig(sourceName);
  const opacity = savedOpacity !== null ? savedOpacity : 100;
  slider.value = opacity.toString();
  display.textContent = opacity + '%';
}

/**
 * Apply source opacity (for reactive components)
 */
export async function applySourceOpacity(sourceName: string, opacity: number): Promise<void> {
  if (!sourceName) {
    log('Select a source first!', 'error');
    return;
  }
  
  await setSourceOpacity(sourceName, opacity);
}

/**
 * Legacy function for DOM-based components
 * @deprecated Use applySourceOpacity(sourceName, opacity) instead
 */
export async function applySourceOpacityLegacy(): Promise<void> {
  const select = document.getElementById('opacitySourceSelect') as HTMLSelectElement | null;
  const slider = document.getElementById('opacitySlider') as HTMLInputElement | null;
  
  if (!select || !slider) return;
  
  const sourceName = select.value;
  const opacity = parseInt(slider.value);
  
  if (!sourceName) {
    log('Select a source first!', 'error');
    return;
  }
  
  await setSourceOpacity(sourceName, opacity);
}

/**
 * Reset source opacity to 100% (for reactive components)
 */
export async function resetSourceOpacity(sourceName: string): Promise<void> {
  if (!sourceName) {
    log('Select a source first!', 'error');
    return;
  }
  
  await setSourceOpacity(sourceName, 100);
}

/**
 * Legacy function for DOM-based components
 * @deprecated Use resetSourceOpacity(sourceName) instead
 */
export async function resetSourceOpacityLegacy(): Promise<void> {
  const select = document.getElementById('opacitySourceSelect') as HTMLSelectElement | null;
  if (!select || !select.value) {
    log('Select a source first!', 'error');
    return;
  }
  
  const sourceName = select.value;
  await setSourceOpacity(sourceName, 100);
  
  // Update UI
  const slider = document.getElementById('opacitySlider') as HTMLInputElement | null;
  const display = document.getElementById('opacityValue');
  if (slider) slider.value = '100';
  if (display) display.textContent = '100%';
}

export async function quickSetOpacity(sourceName: string, opacity: number): Promise<void> {
  await setSourceOpacity(sourceName, opacity);
}

export async function setSourceOpacity(sourceName: string, opacity: number): Promise<void> {
  const isConnected = get(connected);
  if (!isConnected) {
    log('Not connected to OBS', 'error');
    return;
  }
  
  opacity = Math.max(0, Math.min(100, opacity));
  
  try {
    if (opacity >= 100) {
      // Remove filter if it exists (no overhead at 100%)
      await removeOpacityFilter(sourceName);
      delete sourceOpacityConfigs[sourceName];
      log(`${sourceName}: opacity reset to 100% (filter removed)`, 'success');
    } else {
      // Apply or update opacity filter
      await applyOpacityFilter(sourceName, opacity);
      sourceOpacityConfigs[sourceName] = opacity;
      log(`${sourceName}: opacity set to ${opacity}%`, 'success');
    }
    
    saveSourceOpacityConfigs();
    refreshSources();
  } catch (e) {
    const error = e as Error;
    log(`Opacity error: ${error.message}`, 'error');
    console.error('[Opacity]', e);
  }
}

export async function applyOpacityFilter(sourceName: string, opacity: number): Promise<void> {
  const opacityNormalized = opacity / 100;
  
  // Check if filter exists
  try {
    await request('GetSourceFilter', {
      sourceName: sourceName,
      filterName: OPACITY_FILTER_NAME
    });
    
    // Filter exists, update it
    await request('SetSourceFilterSettings', {
      sourceName: sourceName,
      filterName: OPACITY_FILTER_NAME,
      filterSettings: { opacity: opacityNormalized }
    });
  } catch (e) {
    // Filter doesn't exist, create it
    await request('CreateSourceFilter', {
      sourceName: sourceName,
      filterName: OPACITY_FILTER_NAME,
      filterKind: 'color_filter_v2',
      filterSettings: { opacity: opacityNormalized }
    });
  }
}

export async function removeOpacityFilter(sourceName: string): Promise<void> {
  try {
    await request('RemoveSourceFilter', {
      sourceName: sourceName,
      filterName: OPACITY_FILTER_NAME
    });
  } catch (e) {
    // Filter might not exist, that's fine
  }
}

export async function restoreSavedOpacities(): Promise<void> {
  // Restore all saved opacity settings on connect
  for (const [sourceName, opacity] of Object.entries(sourceOpacityConfigs)) {
    if (opacity < 100) {
      try {
        await applyOpacityFilter(sourceName, opacity);
      } catch (e) {
        console.warn(`[Opacity] Could not restore ${sourceName}:`, e);
      }
    }
  }
}

// ============ Source Visibility Animation ============

async function animateVisibility(itemId: number, show: boolean, animType: string, duration: number, easing: string): Promise<void> {
  // Get current transform
  const data = await request('GetSceneItemTransform', {
    sceneName: getCurrentScene(),
    sceneItemId: itemId
  }) as { sceneItemTransform: Transform };
  const original = data.sceneItemTransform;
  
  // Calculate start and end states based on animation type
  let startTransform: Transform = {...original};
  let endTransform: Transform = {...original};
  
  const offscreenX = 200; // Pixels to slide
  const offscreenY = 200;
  
  if (animType === 'fade') {
    // For fade, we'll use scale as a proxy (0.01 to 1)
    if (show) {
      startTransform.scaleX = 0.01;
      startTransform.scaleY = 0.01;
    } else {
      endTransform.scaleX = 0.01;
      endTransform.scaleY = 0.01;
    }
  } else if (animType === 'slide_left') {
    if (show) {
      startTransform.positionX = original.positionX - offscreenX;
    } else {
      endTransform.positionX = original.positionX - offscreenX;
    }
  } else if (animType === 'slide_right') {
    if (show) {
      startTransform.positionX = original.positionX + offscreenX;
    } else {
      endTransform.positionX = original.positionX + offscreenX;
    }
  } else if (animType === 'slide_up') {
    if (show) {
      startTransform.positionY = original.positionY - offscreenY;
    } else {
      endTransform.positionY = original.positionY - offscreenY;
    }
  } else if (animType === 'slide_down') {
    if (show) {
      startTransform.positionY = original.positionY + offscreenY;
    } else {
      endTransform.positionY = original.positionY + offscreenY;
    }
  } else if (animType === 'zoom') {
    if (show) {
      startTransform.scaleX = 0.01;
      startTransform.scaleY = 0.01;
    } else {
      endTransform.scaleX = 0.01;
      endTransform.scaleY = 0.01;
    }
  } else if (animType === 'pop') {
    if (show) {
      startTransform.scaleX = 0.01;
      startTransform.scaleY = 0.01;
    } else {
      endTransform.scaleX = 1.2;
      endTransform.scaleY = 1.2;
    }
  }
  
  // If showing, enable first then animate
  if (show) {
    // Set to start state
    await setTransformAwait(itemId, startTransform);
    // Enable visibility
    await request('SetSceneItemEnabled', {
      sceneName: getCurrentScene(),
      sceneItemId: itemId,
      sceneItemEnabled: true
    });
    // Animate to end state
    await animateTransform(itemId, startTransform, endTransform, duration, easing);
    // Restore original
    await setTransformAwait(itemId, original);
  } else {
    // If hiding, animate first then disable
    await animateTransform(itemId, startTransform, endTransform, duration, easing);
    // Disable visibility
    await request('SetSceneItemEnabled', {
      sceneName: getCurrentScene(),
      sceneItemId: itemId,
      sceneItemEnabled: false
    });
    // Restore original transform (for next show)
    await setTransformAwait(itemId, original);
  }
}

async function setTransformAwait(itemId: number, transform: Transform): Promise<void> {
  const isConnected = get(connected);
  if (!isConnected) return;
  
  await request('SetSceneItemTransform', {
    sceneName: getCurrentScene(),
    sceneItemId: itemId,
    sceneItemTransform: {
      positionX: transform.positionX,
      positionY: transform.positionY,
      scaleX: transform.scaleX,
      scaleY: transform.scaleY
    }
  });
}

function setTransformFireForget(itemId: number, transform: Transform): void {
  const isConnected = get(connected);
  const ws = (window as any).ws as WebSocket | null;
  const msgId = (window as any).msgId as number;
  
  if (!isConnected || !ws || ws.readyState !== WebSocket.OPEN) return;
  
  ws.send(JSON.stringify({
    op: 6,
    d: {
      requestType: 'SetSceneItemTransform',
      requestId: 'anim_' + msgId,
      requestData: {
        sceneName: getCurrentScene(),
        sceneItemId: itemId,
        sceneItemTransform: {
          positionX: transform.positionX,
          positionY: transform.positionY,
          scaleX: transform.scaleX,
          scaleY: transform.scaleY
        }
      }
    }
  }));
  
  // Increment msgId (this is a hack but matches original behavior)
  (window as any).msgId = msgId + 1;
}

async function animateTransform(itemId: number, start: Transform, end: Transform, duration: number, easingType: string): Promise<void> {
  return new Promise(resolve => {
    const startTime = Date.now();
    const STEP_MS = 50; // 20 updates/sec max
    
    function step() {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const t = easeFunc(progress, easingType);
      
      const current: Transform = {
        positionX: lerp(start.positionX, end.positionX, t),
        positionY: lerp(start.positionY, end.positionY, t),
        scaleX: lerp(start.scaleX, end.scaleX, t),
        scaleY: lerp(start.scaleY, end.scaleY, t)
      };
      
      setTransformFireForget(itemId, current);
      
      if (progress < 1) {
        setTimeout(step, STEP_MS);
      } else {
        resolve(undefined);
      }
    }
    
    step();
  });
}

// Easing functions
function easeFunc(t: number, type: string): number {
  switch(type) {
    case 'easeIn': return t * t * t;
    case 'easeOut': return 1 - Math.pow(1 - t, 3);
    case 'ease': return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;
    case 'back': {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return t < 0.5
        ? (Math.pow(2*t, 2) * ((c3 + 1) * 2*t - c3)) / 2
        : (Math.pow(2*t - 2, 2) * ((c3 + 1) * (t*2 - 2) + c3) + 2) / 2;
    }
    case 'bounce': {
      const n1 = 7.5625, d1 = 2.75;
      let x = t;
      if (x < 1/d1) return n1 * x * x;
      if (x < 2/d1) return n1 * (x -= 1.5/d1) * x + 0.75;
      if (x < 2.5/d1) return n1 * (x -= 2.25/d1) * x + 0.9375;
      return n1 * (x -= 2.625/d1) * x + 0.984375;
    }
    case 'elastic': {
      const c4 = (2 * Math.PI) / 3;
      return t === 0 ? 0 : t === 1 ? 1 :
        t < 0.5
          ? -(Math.pow(2, 20*t - 10) * Math.sin((20*t - 11.125) * c4)) / 2
          : (Math.pow(2, -20*t + 10) * Math.sin((20*t - 11.125) * c4)) / 2 + 1;
    }
    default: return t; // linear
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Export easing functions for use by layouts module
export { easeFunc, lerp };

// ============ Exports ============
export const Sources = {
  refreshScenes,
  refreshSceneList,
  renderScenesList,
  onSceneSelect,
  switchToScene,
  updateSceneSelector,
  refreshSources,
  renderSources,
  toggleSource,
  toggleSourceWithLoader,
  updateSliderValue,
  quickSetOpacityWithLoader,
  resetOpacityWithLoader,
  // Opacity functions
  loadSourceOpacityConfigs,
  saveSourceOpacityConfigs,
  getSourceOpacityConfig,
  updateOpacitySourceDropdown,
  updateOpacityPreview,
  loadSourceOpacity,
  applySourceOpacity,
  resetSourceOpacity,
  quickSetOpacity,
  setSourceOpacity,
  applyOpacityFilter,
  removeOpacityFilter,
  restoreSavedOpacities,
  // State getters
  get allScenes() { return allScenes; },
  get selectedScene() { return selectedScene; },
  set selectedScene(val: string) { selectedScene = val; },
  get textSources() { return getTextSources(); },
  get sourceOpacityConfigs() { return sourceOpacityConfigs; }
};

// Expose to window for legacy compatibility
if (typeof window !== 'undefined') {
  (window as any).Sources = Sources;
  (window as any).easeFunc = easeFunc;
  (window as any).lerp = lerp;
}

