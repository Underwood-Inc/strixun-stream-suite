/**
 * Strixun Stream Suite - Layout Management Module
 * 
 * Handles layout presets for OBS scenes, including:
 * - Capturing current scene state as a layout
 * - Applying saved layouts with animation
 * - Managing layout presets (save, delete, preview)
 * 
 * @version 2.0.0 (TypeScript)
 */

import { connected, currentScene } from '../stores/connection';
import { get } from 'svelte/store';
import { request } from './websocket';
import { storage } from './storage';
import { isOBSDock } from './script-status';
import { easeFunc, lerp } from './sources';

// ============ Types ============
interface LayoutPreset {
  id: string;
  name: string;
  sceneName: string;
  createdAt: string;
  updatedAt: string;
  animation: {
    duration: number;
    easing: string;
    stagger: number;
  };
  options: {
    applyVisibility: boolean;
    warnOnMissing: boolean;
    ignoreNewSources: boolean;
  };
  sources: Record<string, LayoutSource>;
  sourceCount: number;
}

interface LayoutSource {
  sourceName: string;
  sceneItemId: number;
  visible: boolean;
  positionX: number;
  positionY: number;
  scaleX: number;
  scaleY: number;
  boundsType?: number;
  boundsWidth?: number;
  boundsHeight?: number;
  sourceWidth?: number;
  sourceHeight?: number;
  rotation: number;
  alignment?: number;
}

interface SceneItem {
  sourceName: string;
  sceneItemId: number;
}

interface Transform {
  positionX: number;
  positionY: number;
  scaleX: number;
  scaleY: number;
  boundsWidth?: number;
  boundsHeight?: number;
  boundsType?: number;
  rotation?: number;
}

interface AnimationPlan {
  sourceName: string;
  sceneItemId: number;
  from: Transform & { rotation: number };
  to: Transform & { rotation: number; boundsType?: number };
  currentVisible: boolean;
  targetVisible: boolean;
}

// ============ State ============
let layoutPresets: LayoutPreset[] = [];
let isApplyingLayout = false;

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

// ============ Layout Functions ============

export async function captureLayout(): Promise<void> {
  const isConnected = get(connected);
  if (!isConnected) {
    log('Connect to OBS first', 'error');
    if (typeof (window as any).showPage === 'function') {
      (window as any).showPage('setup');
    }
    return;
  }
  
  const layoutNameEl = document.getElementById('layoutName') as HTMLInputElement | null;
  if (!layoutNameEl) return;
  
  const layoutName = layoutNameEl.value.trim();
  if (!layoutName) {
    log('Enter a layout name first!', 'error');
    return;
  }
  
  try {
    // Get current scene
    const sceneData = await request('GetCurrentProgramScene', {}) as { currentProgramSceneName: string };
    const sceneName = sceneData.currentProgramSceneName;
    
    // Get all scene items
    const itemsData = await request('GetSceneItemList', { sceneName }) as { sceneItems?: SceneItem[] };
    const items = itemsData.sceneItems || [];
    
    if (items.length === 0) {
      log('No sources found in scene', 'error');
      return;
    }
    
    // Capture transform for each source
    const sources: Record<string, LayoutSource> = {};
    for (const item of items) {
      const sourceName = item.sourceName;
      const sceneItemId = item.sceneItemId;
      
      try {
        // Get transform
        const transformData = await request('GetSceneItemTransform', {
          sceneName,
          sceneItemId
        }) as { sceneItemTransform: Transform & { rotation?: number; alignment?: number; sourceWidth?: number; sourceHeight?: number } };
        const t = transformData.sceneItemTransform;
        
        // Get visibility
        const enabledData = await request('GetSceneItemEnabled', {
          sceneName,
          sceneItemId
        }) as { sceneItemEnabled: boolean };
        
        sources[sourceName] = {
          sourceName,
          sceneItemId,
          visible: enabledData.sceneItemEnabled,
          positionX: t.positionX,
          positionY: t.positionY,
          scaleX: t.scaleX,
          scaleY: t.scaleY,
          boundsType: t.boundsType,
          boundsWidth: t.boundsWidth,
          boundsHeight: t.boundsHeight,
          sourceWidth: t.sourceWidth,
          sourceHeight: t.sourceHeight,
          rotation: t.rotation || 0,
          alignment: t.alignment
        };
      } catch (e) {
        console.warn('Could not capture transform for:', sourceName, e);
      }
    }
    
    // Get animation settings
    const durationEl = document.getElementById('layoutDuration') as HTMLInputElement | null;
    const easingEl = document.getElementById('layoutEasing') as HTMLSelectElement | null;
    const staggerEl = document.getElementById('layoutStagger') as HTMLInputElement | null;
    const applyVisibilityEl = document.getElementById('layoutApplyVisibility') as HTMLInputElement | null;
    
    const duration = durationEl ? parseInt(durationEl.value) || 500 : 500;
    const easing = easingEl ? easingEl.value || 'ease_out' : 'ease_out';
    const stagger = staggerEl ? parseInt(staggerEl.value) || 0 : 0;
    const applyVisibility = applyVisibilityEl ? applyVisibilityEl.checked : true;
    
    // Create the preset
    const now = new Date().toISOString();
    const existingIndex = layoutPresets.findIndex(p => p.name === layoutName && p.sceneName === sceneName);
    
    const preset: LayoutPreset = {
      id: existingIndex >= 0 ? layoutPresets[existingIndex].id : generateLayoutId(),
      name: layoutName,
      sceneName,
      createdAt: existingIndex >= 0 ? layoutPresets[existingIndex].createdAt : now,
      updatedAt: now,
      animation: { duration, easing, stagger },
      options: { applyVisibility, warnOnMissing: true, ignoreNewSources: true },
      sources,
      sourceCount: Object.keys(sources).length
    };
    
    if (existingIndex >= 0) {
      layoutPresets[existingIndex] = preset;
      log(`Updated layout: ${layoutName} (${preset.sourceCount} sources)`, 'success');
    } else {
      layoutPresets.push(preset);
      log(`Saved layout: ${layoutName} (${preset.sourceCount} sources)`, 'success');
    }
    
    // Save and refresh
    storage.set('layoutPresets', layoutPresets);
    if (layoutNameEl) layoutNameEl.value = '';
    renderSavedLayouts();
    
    // OBS dock: debounced save to persistent storage
    if (isOBSDock() && isConnected) {
      if ((window as any).StorageSync) {
        (window as any).StorageSync.scheduleBroadcast();
      }
    }
    
  } catch (e) {
    const error = e as Error;
    log('Failed to capture layout: ' + error.message, 'error');
    console.error('Capture layout error:', e);
  }
}

export function generateLayoutId(): string {
  return 'layout_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

export async function applyLayout(index: number): Promise<void> {
  const isConnected = get(connected);
  if (!isConnected) {
    log('Connect to OBS first', 'error');
    return;
  }
  
  if (isApplyingLayout) {
    log('Layout animation in progress', 'error');
    return;
  }
  
  const preset = layoutPresets[index];
  if (!preset) {
    log('Layout not found', 'error');
    return;
  }
  
  // Verify we're on the right scene (or warn)
  const sceneData = await request('GetCurrentProgramScene', {}) as { currentProgramSceneName: string };
  const currentSceneName = sceneData.currentProgramSceneName;
  
  if (currentSceneName !== preset.sceneName) {
    log(`Warning: Layout was saved for "${preset.sceneName}" but you're on "${currentSceneName}"`, 'error');
    // Continue anyway - user might want to apply cross-scene
  }
  
  isApplyingLayout = true;
  log(`Applying layout: ${preset.name}...`, 'info');
  
  try {
    // Get current scene items
    const itemsData = await request('GetSceneItemList', { sceneName: currentSceneName }) as { sceneItems?: SceneItem[] };
    const currentItems = itemsData.sceneItems || [];
    
    // Build animation plan
    const animations: AnimationPlan[] = [];
    const missingFromScene: string[] = [];
    const missingFromPreset: string[] = [];
    
    // Create map of current items for quick lookup
    const currentItemsMap: Record<string, SceneItem> = {};
    for (const item of currentItems) {
      currentItemsMap[item.sourceName] = item;
    }
    
    // Check each source in preset
    for (const [sourceName, targetState] of Object.entries(preset.sources)) {
      const currentItem = currentItemsMap[sourceName];
      
      if (!currentItem) {
        missingFromScene.push(sourceName);
        continue;
      }
      
      // Get current transform
      const transformData = await request('GetSceneItemTransform', {
        sceneName: currentSceneName,
        sceneItemId: currentItem.sceneItemId
      }) as { sceneItemTransform: Transform & { rotation?: number } };
      const currentTransform = transformData.sceneItemTransform;
      
      // Get current visibility
      const enabledData = await request('GetSceneItemEnabled', {
        sceneName: currentSceneName,
        sceneItemId: currentItem.sceneItemId
      }) as { sceneItemEnabled: boolean };
      
      animations.push({
        sourceName,
        sceneItemId: currentItem.sceneItemId,
        from: {
          positionX: currentTransform.positionX,
          positionY: currentTransform.positionY,
          scaleX: currentTransform.scaleX,
          scaleY: currentTransform.scaleY,
          boundsWidth: currentTransform.boundsWidth,
          boundsHeight: currentTransform.boundsHeight,
          rotation: currentTransform.rotation || 0
        },
        to: {
          positionX: targetState.positionX,
          positionY: targetState.positionY,
          scaleX: targetState.scaleX,
          scaleY: targetState.scaleY,
          boundsWidth: targetState.boundsWidth,
          boundsHeight: targetState.boundsHeight,
          boundsType: targetState.boundsType,
          rotation: targetState.rotation || 0
        },
        currentVisible: enabledData.sceneItemEnabled,
        targetVisible: targetState.visible
      });
    }
    
    // Find sources in scene but not in preset
    for (const item of currentItems) {
      if (!preset.sources[item.sourceName]) {
        missingFromPreset.push(item.sourceName);
      }
    }
    
    // Log warnings
    if (missingFromScene.length > 0) {
      log(`Missing sources: ${missingFromScene.join(', ')}`, 'error');
    }
    if (missingFromPreset.length > 0) {
      console.log('[Layouts] Sources not in preset (leaving alone):', missingFromPreset);
    }
    
    if (animations.length === 0) {
      log('No sources to animate', 'error');
      isApplyingLayout = false;
      return;
    }
    
    // Animation settings
    const duration = preset.animation.duration || 500;
    const easingType = preset.animation.easing || 'ease_out';
    const stagger = preset.animation.stagger || 0;
    const applyVisibility = preset.options.applyVisibility !== false;
    
    // Animate!
    const startTime = performance.now();
    
    await new Promise<void>((resolve) => {
      function animate() {
        const elapsed = performance.now() - startTime;
        const maxDuration = duration + (stagger * animations.length);
        
        if (elapsed >= maxDuration) {
          // Final frame - apply exact end values
          for (const anim of animations) {
            setLayoutTransform(currentSceneName, anim.sceneItemId, anim.to);
            
            // Apply visibility
            if (applyVisibility && anim.currentVisible !== anim.targetVisible) {
              setSceneItemEnabled(currentSceneName, anim.sceneItemId, anim.targetVisible);
            }
          }
          resolve();
          return;
        }
        
        // Animate each source (with stagger)
        for (let i = 0; i < animations.length; i++) {
          const anim = animations[i];
          const sourceDelay = i * stagger;
          const sourceElapsed = elapsed - sourceDelay;
          
          if (sourceElapsed < 0) continue; // Not started yet
          
          const rawT = Math.min(sourceElapsed / duration, 1);
          const t = easeFunc(rawT, easingType);
          
          const current: Transform & { rotation: number; boundsType?: number } = {
            positionX: lerp(anim.from.positionX, anim.to.positionX, t),
            positionY: lerp(anim.from.positionY, anim.to.positionY, t),
            rotation: lerp(anim.from.rotation, anim.to.rotation, t)
          };
          
          // Handle bounds vs scale
          if (anim.to.boundsType && anim.to.boundsType !== 0) { // OBS_BOUNDS_NONE = 0
            const fromBoundsW = anim.from.boundsWidth || anim.from.scaleX * 1920;
            const fromBoundsH = anim.from.boundsHeight || anim.from.scaleY * 1080;
            current.boundsWidth = lerp(fromBoundsW, anim.to.boundsWidth || 0, t);
            current.boundsHeight = lerp(fromBoundsH, anim.to.boundsHeight || 0, t);
            current.boundsType = anim.to.boundsType;
          } else {
            current.scaleX = lerp(anim.from.scaleX, anim.to.scaleX, t);
            current.scaleY = lerp(anim.from.scaleY, anim.to.scaleY, t);
          }
          
          setLayoutTransform(currentSceneName, anim.sceneItemId, current);
        }
        
        requestAnimationFrame(animate);
      }
      
      requestAnimationFrame(animate);
    });
    
    log(`Layout applied: ${preset.name}`, 'success');
    
  } catch (e) {
    const error = e as Error;
    log('Failed to apply layout: ' + error.message, 'error');
    console.error('Apply layout error:', e);
  } finally {
    isApplyingLayout = false;
  }
}

export async function setLayoutTransform(sceneName: string, sceneItemId: number, transform: Transform & { rotation?: number; boundsType?: number }): Promise<void> {
  try {
    await request('SetSceneItemTransform', {
      sceneName,
      sceneItemId,
      sceneItemTransform: transform
    });
  } catch (e) {
    console.warn('Failed to set transform:', sceneItemId, e);
  }
}

export async function setSceneItemEnabled(sceneName: string, sceneItemId: number, enabled: boolean): Promise<void> {
  try {
    await request('SetSceneItemEnabled', {
      sceneName,
      sceneItemId,
      sceneItemEnabled: enabled
    });
  } catch (e) {
    console.warn('Failed to set visibility:', sceneItemId, e);
  }
}

export function deleteLayout(index: number): void {
  const preset = layoutPresets[index];
  if (!preset) return;
  
  if (confirm(`Delete layout "${preset.name}"?`)) {
    layoutPresets.splice(index, 1);
    storage.set('layoutPresets', layoutPresets);
    renderSavedLayouts();
    log(`Deleted layout: ${preset.name}`, 'info');
    
    // OBS dock: debounced save to persistent storage
    const isConnected = get(connected);
    if (isOBSDock() && isConnected) {
      if ((window as any).StorageSync) {
        (window as any).StorageSync.scheduleBroadcast();
      }
    }
  }
}

export function renderSavedLayouts(): void {
  const container = document.getElementById('savedLayouts');
  if (!container) return;
  
  const searchInput = document.getElementById('layoutSearchInput') as HTMLInputElement | null;
  const searchTerm = searchInput?.value?.toLowerCase() || '';
  
  // Update current scene display
  const sceneEl = document.getElementById('layoutCurrentScene');
  if (sceneEl) {
    sceneEl.textContent = getCurrentScene() || '-';
  }
  
  const currentSceneName = getCurrentScene();
  
  // Filter by current scene and search term
  const filteredLayouts = layoutPresets.filter((p) => {
    const matchesScene = !currentSceneName || p.sceneName === currentSceneName;
    const matchesSearch = !searchTerm || p.name.toLowerCase().includes(searchTerm);
    return matchesScene && matchesSearch;
  });
  
  if (filteredLayouts.length === 0) {
    container.innerHTML = '<div class="empty-state">No layouts saved for this scene</div>';
    return;
  }
  
  container.innerHTML = filteredLayouts.map((preset) => {
    const originalIndex = layoutPresets.indexOf(preset);
    const sourceCount = preset.sourceCount || Object.keys(preset.sources || {}).length;
    const age = getRelativeTime(preset.updatedAt);
    
    return `
      <div class="config-item">
        <div class="config-item__header">
          <span class="config-item__name"> ${preset.name.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
          <span class="config-item__meta">${sourceCount} sources • ${age}</span>
        </div>
        <div class="config-item__actions">
          <button onclick="window.Layouts?.applyLayout(${originalIndex})" class="btn-primary btn-sm">▶ Apply</button>
          <button onclick="window.Layouts?.previewLayout(${originalIndex})" class="btn-secondary btn-sm"></button>
          <button onclick="window.Layouts?.deleteLayout(${originalIndex})" class="btn-danger btn-sm">[EMOJI]️</button>
        </div>
      </div>
    `;
  }).join('');
}

export function previewLayout(index: number): void {
  const preset = layoutPresets[index];
  if (!preset) return;
  
  // Log the layout details
  log(`=== Layout: ${preset.name} ===`, 'info');
  log(`Scene: ${preset.sceneName}`, 'info');
  log(`Sources: ${Object.keys(preset.sources).length}`, 'info');
  log(`Animation: ${preset.animation.duration}ms, ${preset.animation.easing}`, 'info');
  
  const sourceNames = Object.keys(preset.sources);
  for (const name of sourceNames.slice(0, 5)) {
    const s = preset.sources[name];
    log(`  • ${name}: (${Math.round(s.positionX)}, ${Math.round(s.positionY)}) ${s.visible ? '' : ''}`, 'info');
  }
  if (sourceNames.length > 5) {
    log(`  ... and ${sourceNames.length - 5} more`, 'info');
  }
}

export function refreshLayouts(): void {
  renderSavedLayouts();
  log('Layouts refreshed', 'info');
}

export function getRelativeTime(isoString: string): string {
  if (!isoString) return 'unknown';
  
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function initLayouts(): void {
  layoutPresets = (storage.get('layoutPresets') as LayoutPreset[]) || [];
  renderSavedLayouts();
  
  // Setup search
  const searchInput = document.getElementById('layoutSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', renderSavedLayouts);
  }
}

// ============ Exports ============
export const Layouts = {
  captureLayout,
  applyLayout,
  deleteLayout,
  renderSavedLayouts,
  previewLayout,
  refreshLayouts,
  initLayouts,
  getRelativeTime,
  generateLayoutId,
  setLayoutTransform,
  setSceneItemEnabled,
  // State getters
  get layoutPresets() { return layoutPresets; },
  set layoutPresets(val: LayoutPreset[]) { layoutPresets = val; },
  get isApplyingLayout() { return isApplyingLayout; }
};

// Expose to window for legacy compatibility
if (typeof window !== 'undefined') {
  (window as any).Layouts = Layouts;
}

