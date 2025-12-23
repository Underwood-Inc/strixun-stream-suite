/**
 * Strixun Stream Suite - Source Swaps Module
 * 
 * Handles animated source swapping in OBS:
 * - Multiple swap configs with save/load
 * - Various animation styles (slide, arc, scale, bounce, elastic, crossfade)
 * - Enhanced easing functions
 * - Transform management (position, scale, bounds)
 * - Config import/export
 * 
 * @version 2.0.0 (TypeScript)
 */

import { storage } from './storage';
import { connected, currentScene, sources } from '../stores/connection';
import { request } from './websocket';
import { get } from 'svelte/store';
import type { SwapConfig, Source } from '../types';

// ============ Types ============
interface SourceSwapsDependencies {
  log: (msg: string, type?: string) => void;
  isOBSDock: () => boolean;
  showPage?: (page: string) => void;
  initSearchForList?: (listId: string, inputId: string, container: HTMLElement, count: number) => void;
}

interface SceneItemTransform {
  positionX?: number;
  positionY?: number;
  scaleX?: number;
  scaleY?: number;
  boundsWidth?: number;
  boundsHeight?: number;
  boundsType?: string;
  sourceWidth?: number;
  sourceHeight?: number;
  [key: string]: any;
}

// ============ State ============
let swapConfigs: SwapConfig[] = [];
let isSwapping = false;

// Dependencies (injected)
let dependencies: SourceSwapsDependencies = {
  log: (msg: string, type?: string) => console.log(`[${type || 'info'}] ${msg}`),
  isOBSDock: () => false
};

// ============ Initialization ============

/**
 * Initialize the module with required dependencies
 */
export function init(deps: Partial<SourceSwapsDependencies>): void {
  // Merge dependencies, preserving getters/setters
  Object.keys(deps).forEach(key => {
    const descriptor = Object.getOwnPropertyDescriptor(deps, key);
    if (descriptor && (descriptor.get || descriptor.set)) {
      // Preserve getters/setters
      Object.defineProperty(dependencies, key, descriptor);
    } else {
      // Regular property
      (dependencies as any)[key] = (deps as any)[key];
    }
  });
}

// ============ Transform Functions ============

/**
 * Get scene item ID for a source name
 */
async function getSceneItemId(sourceName: string): Promise<number | null> {
  // First try cached sources (fast path)
  const cached = get(sources).find(s => s.sourceName === sourceName);
  if (cached) return cached.sceneItemId;
  
  // Cache miss - query OBS directly (handles stale cache, scene changes, etc.)
  try {
    const data = await request('GetSceneItemId', {
      sceneName: get(currentScene),
      sourceName: sourceName
    });
    return (data as any).sceneItemId || null;
  } catch (e) {
    console.warn(`[Swap] Source "${sourceName}" not found in scene "${get(currentScene)}":`, e);
    return null;
  }
}

/**
 * Get transform for a scene item
 */
async function getTransform(sceneItemId: number): Promise<SceneItemTransform> {
  try {
    const data = await request('GetSceneItemTransform', {
      sceneName: get(currentScene),
      sceneItemId: sceneItemId
    });
    return (data as any).sceneItemTransform;
  } catch (e) {
    console.error(`[Swap] Failed to get transform for item ${sceneItemId}:`, e);
    throw new Error(`Failed to get transform for item ${sceneItemId}: ${e}`);
  }
}

/**
 * Set transform for a scene item (with sanitization)
 */
async function setTransform(sceneItemId: number, transform: SceneItemTransform): Promise<void> {
  try {
    // Sanitize transform values - OBS requires bounds >= 1 and scale > 0
    const sanitized = { ...transform };
    
    // Ensure bounds are at least 1 (or remove if 0/invalid)
    if (sanitized.boundsWidth !== undefined) {
      if (sanitized.boundsWidth < 1) {
        delete sanitized.boundsWidth;
      }
    }
    if (sanitized.boundsHeight !== undefined) {
      if (sanitized.boundsHeight < 1) {
        delete sanitized.boundsHeight;
      }
    }
    
    // Ensure scale is positive
    if (sanitized.scaleX !== undefined && sanitized.scaleX <= 0) {
      sanitized.scaleX = 0.001;
    }
    if (sanitized.scaleY !== undefined && sanitized.scaleY <= 0) {
      sanitized.scaleY = 0.001;
    }
    
    await request('SetSceneItemTransform', {
      sceneName: get(currentScene),
      sceneItemId: sceneItemId,
      sceneItemTransform: sanitized
    });
  } catch (e) {
    console.error(`[Swap] Failed to set transform for item ${sceneItemId}:`, e);
    throw new Error(`Failed to set transform: ${e}`);
  }
}

// ============ Easing Functions ============

/**
 * Enhanced easing function
 */
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

/**
 * Linear interpolation
 */
function lerp(a: number, b: number, t: number): number { 
  return a + (b - a) * t; 
}

// ============ Animation Functions ============

/**
 * Animate slide swap
 */
async function animateSlide(
  idA: number, 
  idB: number, 
  startA: SceneItemTransform, 
  startB: SceneItemTransform, 
  endA: SceneItemTransform, 
  endB: SceneItemTransform, 
  duration: number, 
  easing: string, 
  propsToSwap: string[]
): Promise<void> {
  const startTime = performance.now();
  
  await new Promise<void>((resolve, reject) => {
    function animate(): void {
      const elapsed = performance.now() - startTime;
      const rawT = Math.min(elapsed / duration, 1);
      const t = easeFunc(rawT, easing);
      
      // Lerp each source's own properties (they may differ in mixed bounds/scale case)
      const currentA: SceneItemTransform = {};
      const currentB: SceneItemTransform = {};
      
      for (const p of Object.keys(startA)) {
        if (endA[p] !== undefined) {
          currentA[p] = lerp(startA[p] as number, endA[p] as number, t);
        }
      }
      for (const p of Object.keys(startB)) {
        if (endB[p] !== undefined) {
          currentB[p] = lerp(startB[p] as number, endB[p] as number, t);
        }
      }
      
      Promise.all([
        setTransform(idA, currentA),
        setTransform(idB, currentB)
      ]).then(() => {
        if (rawT < 1) requestAnimationFrame(animate);
        else resolve();
      }).catch(err => {
        console.error('[Swap] animateSlide error:', err);
        reject(err);
      });
    }
    requestAnimationFrame(animate);
  });
}

/**
 * Animate arc swap
 */
async function animateArc(
  idA: number, 
  idB: number, 
  startA: SceneItemTransform, 
  startB: SceneItemTransform, 
  endA: SceneItemTransform, 
  endB: SceneItemTransform, 
  duration: number, 
  easing: string
): Promise<void> {
  const startTime = performance.now();
  const arcHeight = 100; // Pixels to arc upward
  
  await new Promise<void>((resolve, reject) => {
    function animate(): void {
      const elapsed = performance.now() - startTime;
      const rawT = Math.min(elapsed / duration, 1);
      const t = easeFunc(rawT, easing);
      
      // Parabolic arc: peaks at t=0.5
      const arcOffset = -4 * arcHeight * rawT * (rawT - 1);
      
      // Only animate properties that exist in start/end objects
      const currentA: SceneItemTransform = {
        positionX: lerp(startA.positionX || 0, endA.positionX || 0, t),
        positionY: lerp(startA.positionY || 0, endA.positionY || 0, t) - arcOffset
      };
      const currentB: SceneItemTransform = {
        positionX: lerp(startB.positionX || 0, endB.positionX || 0, t),
        positionY: lerp(startB.positionY || 0, endB.positionY || 0, t) - arcOffset
      };
      
      // Add scale if present
      if (startA.scaleX !== undefined) {
        currentA.scaleX = lerp(startA.scaleX, endA.scaleX || startA.scaleX, t);
        currentA.scaleY = lerp(startA.scaleY || startA.scaleX, endA.scaleY || endA.scaleX || startA.scaleY || startA.scaleX, t);
      }
      if (startB.scaleX !== undefined) {
        currentB.scaleX = lerp(startB.scaleX, endB.scaleX || startB.scaleX, t);
        currentB.scaleY = lerp(startB.scaleY || startB.scaleX, endB.scaleY || endB.scaleX || startB.scaleY || startB.scaleX, t);
      }
      
      // Add bounds if present
      if (startA.boundsWidth !== undefined) {
        currentA.boundsWidth = lerp(startA.boundsWidth, endA.boundsWidth || startA.boundsWidth, t);
        currentA.boundsHeight = lerp(startA.boundsHeight || startA.boundsWidth, endA.boundsHeight || endA.boundsWidth || startA.boundsHeight || startA.boundsWidth, t);
      }
      if (startB.boundsWidth !== undefined) {
        currentB.boundsWidth = lerp(startB.boundsWidth, endB.boundsWidth || startB.boundsWidth, t);
        currentB.boundsHeight = lerp(startB.boundsHeight || startB.boundsWidth, endB.boundsHeight || endB.boundsWidth || startB.boundsHeight || startB.boundsWidth, t);
      }
      
      Promise.all([
        setTransform(idA, currentA),
        setTransform(idB, currentB)
      ]).then(() => {
        if (rawT < 1) requestAnimationFrame(animate);
        else resolve();
      }).catch(err => {
        console.error('[Swap] animateArc error:', err);
        reject(err);
      });
    }
    requestAnimationFrame(animate);
  });
}

/**
 * Animate scale swap
 */
async function animateScale(
  idA: number, 
  idB: number, 
  startA: SceneItemTransform, 
  startB: SceneItemTransform, 
  endA: SceneItemTransform, 
  endB: SceneItemTransform, 
  duration: number, 
  easing: string
): Promise<void> {
  const startTime = performance.now();
  
  await new Promise<void>((resolve, reject) => {
    function animate(): void {
      const elapsed = performance.now() - startTime;
      const rawT = Math.min(elapsed / duration, 1);
      
      // Shrink in first half, grow in second half (shrink to 30%)
      let scaleMod: number;
      if (rawT < 0.5) {
        scaleMod = 1 - (rawT * 2) * 0.7; // Shrink from 1.0 to 0.3
      } else {
        scaleMod = 0.3 + ((rawT - 0.5) * 2) * 0.7; // Grow from 0.3 back to 1.0
      }
      
      // Position JUMPS at midpoint (not smooth slide!)
      const posT = rawT < 0.5 ? 0 : 1;
      
      const currentA: SceneItemTransform = {
        positionX: lerp(startA.positionX || 0, endA.positionX || 0, posT),
        positionY: lerp(startA.positionY || 0, endA.positionY || 0, posT)
      };
      const currentB: SceneItemTransform = {
        positionX: lerp(startB.positionX || 0, endB.positionX || 0, posT),
        positionY: lerp(startB.positionY || 0, endB.positionY || 0, posT)
      };
      
      // Add scale with modifier if using scale
      if (startA.scaleX !== undefined) {
        currentA.scaleX = (startA.scaleX || 1) * scaleMod;
        currentA.scaleY = (startA.scaleY || startA.scaleX || 1) * scaleMod;
      }
      if (startB.scaleX !== undefined) {
        currentB.scaleX = (startB.scaleX || 1) * scaleMod;
        currentB.scaleY = (startB.scaleY || startB.scaleX || 1) * scaleMod;
      }
      
      // Add bounds if present (jump at midpoint, no scale mod)
      if (startA.boundsWidth !== undefined) {
        currentA.boundsWidth = lerp(startA.boundsWidth, endA.boundsWidth || startA.boundsWidth, posT);
        currentA.boundsHeight = lerp(startA.boundsHeight || startA.boundsWidth, endA.boundsHeight || endA.boundsWidth || startA.boundsHeight || startA.boundsWidth, posT);
      }
      if (startB.boundsWidth !== undefined) {
        currentB.boundsWidth = lerp(startB.boundsWidth, endB.boundsWidth || startB.boundsWidth, posT);
        currentB.boundsHeight = lerp(startB.boundsHeight || startB.boundsWidth, endB.boundsHeight || endB.boundsWidth || startB.boundsHeight || startB.boundsWidth, posT);
      }
      
      Promise.all([
        setTransform(idA, currentA),
        setTransform(idB, currentB)
      ]).then(() => {
        if (rawT < 1) requestAnimationFrame(animate);
        else resolve();
      }).catch(err => {
        console.error('[Swap] animateScale error:', err);
        reject(err);
      });
    }
    requestAnimationFrame(animate);
  });
}

/**
 * Animate crossfade swap
 */
async function animateCrossfade(
  idA: number, 
  idB: number, 
  nameA: string, 
  nameB: string, 
  endA: SceneItemTransform, 
  endB: SceneItemTransform, 
  duration: number
): Promise<void> {
  // Fade out both, swap positions, fade in both
  const startTime = performance.now();
  
  await new Promise<void>((resolve, reject) => {
    function animate(): void {
      const elapsed = performance.now() - startTime;
      const rawT = Math.min(elapsed / duration, 1);
      
      // Opacity simulation via scale (0.5 at midpoint)
      let opacityScale: number;
      if (rawT < 0.5) {
        opacityScale = 1 - rawT; // Fade out
      } else {
        opacityScale = rawT; // Fade in
      }
      
      // Position jumps at midpoint
      const posT = rawT < 0.5 ? 0 : 1;
      
      Promise.all([
        setTransform(idA, { 
          scaleX: (endA.scaleX || 1) * opacityScale, 
          scaleY: (endA.scaleY || endA.scaleX || 1) * opacityScale,
          positionX: lerp(endA.positionX || 0, endB.positionX || 0, posT),
          positionY: lerp(endA.positionY || 0, endB.positionY || 0, posT)
        }),
        setTransform(idB, { 
          scaleX: (endB.scaleX || 1) * opacityScale, 
          scaleY: (endB.scaleY || endB.scaleX || 1) * opacityScale,
          positionX: lerp(endB.positionX || 0, endA.positionX || 0, posT),
          positionY: lerp(endB.positionY || 0, endA.positionY || 0, posT)
        })
      ]).then(() => {
        if (rawT < 1) requestAnimationFrame(animate);
        else resolve();
      }).catch(err => {
        console.error('[Swap] animateCrossfade error:', err);
        reject(err);
      });
    }
    requestAnimationFrame(animate);
  });
}

// ============ Core Swap Function ============

/**
 * Execute a swap between two sources
 */
export async function executeSwap(sourceAOverride?: string, sourceBOverride?: string): Promise<void> {
  if (!get(connected)) { 
    dependencies.log('Connect to OBS first', 'error'); 
    if (dependencies.showPage) dependencies.showPage('setup');
    return; 
  }
  if (isSwapping) { 
    dependencies.log('Swap in progress', 'error'); 
    return; 
  }
  
  // Use override params if provided (from loadSwapConfig), otherwise read from dropdowns
  const nameA = sourceAOverride || (document.getElementById('swapSourceA') as HTMLSelectElement)?.value;
  const nameB = sourceBOverride || (document.getElementById('swapSourceB') as HTMLSelectElement)?.value;
  
  if (!nameA || !nameB) { 
    dependencies.log('Select both sources', 'error'); 
    return; 
  }
  if (nameA === nameB) { 
    dependencies.log('Select different sources', 'error'); 
    return; 
  }
  
  const idA = await getSceneItemId(nameA);
  const idB = await getSceneItemId(nameB);
  
  if (!idA) { 
    dependencies.log(`Source not found: "${nameA}" - not in current scene "${get(currentScene)}"`, 'error'); 
    return; 
  }
  if (!idB) { 
    dependencies.log(`Source not found: "${nameB}" - not in current scene "${get(currentScene)}"`, 'error'); 
    return; 
  }
  
  isSwapping = true;
  const style = (document.getElementById('swapStyle') as HTMLSelectElement)?.value || 'slide';
  dependencies.log(`Swapping ${nameA} ↔ ${nameB} (${style})...`, 'info');
  
  try {
    const tA = await getTransform(idA);
    const tB = await getTransform(idB);
    
    const duration = parseInt((document.getElementById('swapDuration') as HTMLInputElement)?.value || '400') || 400;
    const easing = (document.getElementById('swapEasing') as HTMLSelectElement)?.value || 'ease';
    
    // Read control panel settings
    const preserveAspect = (document.getElementById('swapPreserveAspect') as HTMLInputElement)?.checked ?? true;
    const debugLogging = (document.getElementById('swapDebugLogging') as HTMLInputElement)?.checked ?? false;
    const tempOverride = (document.getElementById('swapTempOverride') as HTMLSelectElement)?.value || 'off';
    
    if (debugLogging) {
      console.log('[Swap Debug] Transform A:', JSON.stringify(tA, null, 2));
      console.log('[Swap Debug] Transform B:', JSON.stringify(tB, null, 2));
      console.log('[Swap Debug] Settings - preserveAspect:', preserveAspect, 'tempOverride:', tempOverride);
    }
    
    // Calculate visual sizes for each source
    // Bounds mode: visual size = bounds
    // Scale mode: visual size = sourceWidth * scaleX, sourceHeight * scaleY
    const aUsesBounds = (tA.boundsWidth || 0) >= 1 && (tA.boundsHeight || 0) >= 1;
    const bUsesBounds = (tB.boundsWidth || 0) >= 1 && (tB.boundsHeight || 0) >= 1;
    
    // Get visual sizes
    const sizeA = {
      width: aUsesBounds ? (tA.boundsWidth || 0) : ((tA.sourceWidth || 0) * (tA.scaleX || 1)),
      height: aUsesBounds ? (tA.boundsHeight || 0) : ((tA.sourceHeight || 0) * (tA.scaleY || tA.scaleX || 1))
    };
    const sizeB = {
      width: bUsesBounds ? (tB.boundsWidth || 0) : ((tB.sourceWidth || 0) * (tB.scaleX || 1)),
      height: bUsesBounds ? (tB.boundsHeight || 0) : ((tB.sourceHeight || 0) * (tB.scaleY || tB.scaleX || 1))
    };
    
    if (debugLogging) {
      console.log('[Swap Debug] A uses bounds:', aUsesBounds, 'size:', sizeA);
      console.log('[Swap Debug] B uses bounds:', bUsesBounds, 'size:', sizeB);
    }
    
    // Build start and end states - swap positions and visual sizes
    const startA: SceneItemTransform = {
      positionX: tA.positionX,
      positionY: tA.positionY
    };
    const startB: SceneItemTransform = {
      positionX: tB.positionX,
      positionY: tB.positionY
    };
    
    // End positions: swap them
    const endA: SceneItemTransform = {
      positionX: tB.positionX,
      positionY: tB.positionY
    };
    const endB: SceneItemTransform = {
      positionX: tA.positionX,
      positionY: tA.positionY
    };
    
    // Handle sizing based on what each source uses
    // A should end up with B's visual size, and vice versa
    if (aUsesBounds) {
      startA.boundsWidth = tA.boundsWidth;
      startA.boundsHeight = tA.boundsHeight;
      endA.boundsWidth = sizeB.width;
      endA.boundsHeight = sizeB.height;
    } else {
      startA.scaleX = tA.scaleX;
      startA.scaleY = tA.scaleY;
      // Convert B's size to scale for A
      endA.scaleX = sizeB.width / ((tA.sourceWidth || sizeA.width / (tA.scaleX || 1)) || 1);
      endA.scaleY = sizeB.height / ((tA.sourceHeight || sizeA.height / (tA.scaleY || tA.scaleX || 1)) || 1);
    }
    
    if (bUsesBounds) {
      startB.boundsWidth = tB.boundsWidth;
      startB.boundsHeight = tB.boundsHeight;
      endB.boundsWidth = sizeA.width;
      endB.boundsHeight = sizeA.height;
    } else {
      startB.scaleX = tB.scaleX;
      startB.scaleY = tB.scaleY;
      // Convert A's size to scale for B
      endB.scaleX = sizeA.width / ((tB.sourceWidth || sizeB.width / (tB.scaleX || 1)) || 1);
      endB.scaleY = sizeA.height / ((tB.sourceHeight || sizeB.height / (tB.scaleY || tB.scaleX || 1)) || 1);
    }
    
    // Build propsToSwap for animation functions
    const propsToSwap = ['positionX', 'positionY'];
    if (aUsesBounds || bUsesBounds) {
      if (startA.boundsWidth !== undefined) propsToSwap.push('boundsWidth', 'boundsHeight');
      if (startA.scaleX !== undefined) propsToSwap.push('scaleX', 'scaleY');
    } else {
      propsToSwap.push('scaleX', 'scaleY');
    }
    
    if (debugLogging) {
      console.log('[Swap Debug] startA:', startA, 'endA:', endA);
      console.log('[Swap Debug] startB:', startB, 'endB:', endB);
      console.log('[Swap Debug] propsToSwap:', propsToSwap);
    }
    
    if (style === 'teleport' || duration <= 0) {
      // Instant swap
      await setTransform(idA, endA);
      await setTransform(idB, endB);
    } else if (style === 'arc') {
      await animateArc(idA, idB, startA, startB, endA, endB, duration, easing);
      await setTransform(idA, endA);
      await setTransform(idB, endB);
    } else if (style === 'scale') {
      await animateScale(idA, idB, startA, startB, endA, endB, duration, easing);
      await setTransform(idA, endA);
      await setTransform(idB, endB);
    } else if (style === 'bounce') {
      await animateSlide(idA, idB, startA, startB, endA, endB, duration, 'bounce', propsToSwap);
    } else if (style === 'elastic') {
      await animateSlide(idA, idB, startA, startB, endA, endB, duration, 'elastic', propsToSwap);
    } else {
      // Default slide
      const startTime = performance.now();
      
      await new Promise<void>((resolve, reject) => {
        function animate(): void {
          const elapsed = performance.now() - startTime;
          const rawT = Math.min(elapsed / duration, 1);
          const t = easeFunc(rawT, easing);
          
          // Lerp each source's own properties (they may differ)
          const currentA: SceneItemTransform = {};
          const currentB: SceneItemTransform = {};
          
          for (const p of Object.keys(startA)) {
            if (endA[p] !== undefined) {
              currentA[p] = lerp(startA[p] as number, endA[p] as number, t);
            }
          }
          for (const p of Object.keys(startB)) {
            if (endB[p] !== undefined) {
              currentB[p] = lerp(startB[p] as number, endB[p] as number, t);
            }
          }
          
          Promise.all([
            setTransform(idA, currentA),
            setTransform(idB, currentB)
          ]).then(() => {
            if (rawT < 1) {
              requestAnimationFrame(animate);
            } else {
              resolve();
            }
          }).catch(err => {
            console.error('[Swap] Default slide error:', err);
            reject(err);
          });
        }
        requestAnimationFrame(animate);
      });
    }
    
    // Apply bounds type if using bounds (based on settings)
    if (aUsesBounds) {
      let boundsType = preserveAspect ? 'OBS_BOUNDS_SCALE_INNER' : 'OBS_BOUNDS_STRETCH';
      if (tempOverride === 'preserve') boundsType = 'OBS_BOUNDS_SCALE_INNER';
      else if (tempOverride === 'stretch') boundsType = 'OBS_BOUNDS_STRETCH';
      
      await request('SetSceneItemTransform', {
        sceneName: get(currentScene),
        sceneItemId: idA,
        sceneItemTransform: { boundsType }
      }).catch(e => console.warn('[Swap] Could not set bounds type for A:', e));
    }
    if (bUsesBounds) {
      let boundsType = preserveAspect ? 'OBS_BOUNDS_SCALE_INNER' : 'OBS_BOUNDS_STRETCH';
      if (tempOverride === 'preserve') boundsType = 'OBS_BOUNDS_SCALE_INNER';
      else if (tempOverride === 'stretch') boundsType = 'OBS_BOUNDS_STRETCH';
      
      await request('SetSceneItemTransform', {
        sceneName: get(currentScene),
        sceneItemId: idB,
        sceneItemTransform: { boundsType }
      }).catch(e => console.warn('[Swap] Could not set bounds type for B:', e));
    }
    
    dependencies.log(`Swapped ${nameA} ↔ ${nameB}`, 'success');
  } catch (e) {
    const error = e as Error;
    dependencies.log('Swap error: ' + error.message, 'error');
  }
  
  isSwapping = false;
}

// ============ Config Management ============

/**
 * Save current swap as a config
 */
export function saveCurrentSwap(): void {
  const nameA = (document.getElementById('swapSourceA') as HTMLSelectElement)?.value;
  const nameB = (document.getElementById('swapSourceB') as HTMLSelectElement)?.value;
  if (!nameA || !nameB) { 
    dependencies.log('Select both sources first', 'error'); 
    return; 
  }
  
  const name = prompt('Config name:', `${nameA} ↔ ${nameB}`);
  if (!name) return;
  
  swapConfigs.push({ name, sourceA: nameA, sourceB: nameB });
  storage.set('swapConfigs', swapConfigs);
  renderSavedSwaps();
  
  // Emit EventBus event (new architecture)
  import('../core/events/EventBus').then(({ EventBus }) => {
    EventBus.emitSync('source-swaps:configs-changed', { configs: swapConfigs });
  });
  
  // Legacy window event (for backward compatibility)
  window.dispatchEvent(new CustomEvent('swapConfigsChanged'));
  
  dependencies.log(`Saved config: ${name}`, 'success');
  
  // OBS dock: debounced save to persistent storage
  if (dependencies.isOBSDock() && get(connected)) {
    if ((window as any).StorageSync) {
      (window as any).StorageSync.scheduleBroadcast();
    }
  }
}

/**
 * Add a new swap config
 */
/**
 * Add swap config (for reactive components)
 */
export function addSwapConfig(
  configName: string,
  sourceA: string,
  sourceB: string,
  options?: { style?: string; duration?: number; easing?: string; preserveAspect?: boolean }
): void {
  const trimmedName = configName?.trim();
  
  if (!trimmedName) { 
    dependencies.log('Enter a config name', 'error'); 
    return; 
  }
  if (!sourceA || !sourceB) { 
    dependencies.log('Select both sources', 'error'); 
    return; 
  }
  if (sourceA === sourceB) { 
    dependencies.log('Select different sources', 'error'); 
    return; 
  }
  
  const config: SwapConfig = { 
    name: trimmedName, 
    sourceA, 
    sourceB,
    ...options
  };
  
  swapConfigs.push(config);
  storage.set('swapConfigs', swapConfigs);
  renderSavedSwaps();
}

/**
 * Legacy function for DOM-based components
 * @deprecated Use addSwapConfig(configName, sourceA, sourceB, options) instead
 */
export function addSwapConfigLegacy(): void {
  const configName = (document.getElementById('swapConfigName') as HTMLInputElement)?.value.trim();
  const sourceA = (document.getElementById('swapNewSourceA') as HTMLSelectElement)?.value;
  const sourceB = (document.getElementById('swapNewSourceB') as HTMLSelectElement)?.value;
  
  if (!configName) { 
    dependencies.log('Enter a config name', 'error'); 
    return; 
  }
  if (!sourceA || !sourceB) { 
    dependencies.log('Select both sources', 'error'); 
    return; 
  }
  if (sourceA === sourceB) { 
    dependencies.log('Select different sources', 'error'); 
    return; 
  }
  
  swapConfigs.push({ name: configName, sourceA, sourceB });
  storage.set('swapConfigs', swapConfigs);
  renderSavedSwaps();
  
  // Emit EventBus event (new architecture)
  import('../core/events/EventBus').then(({ EventBus }) => {
    EventBus.emitSync('source-swaps:configs-changed', { configs: swapConfigs });
  });
  
  // Legacy window event (for backward compatibility)
  window.dispatchEvent(new CustomEvent('swapConfigsChanged'));
  
  // Clear the form
  const nameInput = document.getElementById('swapConfigName') as HTMLInputElement;
  if (nameInput) nameInput.value = '';
  dependencies.log(`Added config: ${configName}`, 'success');
}

/**
 * Delete a swap config
 */
export function deleteSwapConfig(index: number): void {
  swapConfigs.splice(index, 1);
  storage.set('swapConfigs', swapConfigs);
  renderSavedSwaps();
  
  // Emit EventBus event (new architecture)
  import('../core/events/EventBus').then(({ EventBus }) => {
    EventBus.emitSync('source-swaps:configs-changed', { configs: swapConfigs });
  });
  
  // Legacy window event (for backward compatibility)
  window.dispatchEvent(new CustomEvent('swapConfigsChanged'));
  
  // OBS dock: debounced save to persistent storage
  if (dependencies.isOBSDock() && get(connected)) {
    if ((window as any).StorageSync) {
      (window as any).StorageSync.scheduleBroadcast();
    }
  }
}

/**
 * Load a swap config and execute it
 */
export function loadSwapConfig(index: number): void {
  const c = swapConfigs[index];
  if (!c) {
    dependencies.log('Config not found', 'error');
    return;
  }
  // Pass sources directly to executeSwap, bypassing dropdown dependency
  // Also update dropdowns if possible (for visual feedback)
  const selA = document.getElementById('swapSourceA') as HTMLSelectElement;
  const selB = document.getElementById('swapSourceB') as HTMLSelectElement;
  if (selA) selA.value = c.sourceA;
  if (selB) selB.value = c.sourceB;
  executeSwap(c.sourceA, c.sourceB);
}

/**
 * Export configs to clipboard
 */
export function exportConfigs(): void {
  if (swapConfigs.length === 0) {
    dependencies.log('No configs to export', 'error');
    return;
  }
  const json = JSON.stringify(swapConfigs, null, 2);
  navigator.clipboard.writeText(json).then(() => {
    dependencies.log('Configs copied to clipboard!', 'success');
  }).catch(() => {
    // Fallback: show in prompt
    prompt('Copy this JSON:', json);
  });
}

/**
 * Import configs from JSON
 */
export function importConfigs(): void {
  const json = prompt('Paste config JSON:');
  if (!json) return;
  
  try {
    const imported = JSON.parse(json) as SwapConfig[];
    if (!Array.isArray(imported)) throw new Error('Must be array');
    
    // Validate structure
    for (const c of imported) {
      if (!c.name || !c.sourceA || !c.sourceB) {
        throw new Error('Invalid config structure');
      }
    }
    
    // Merge or replace?
    const merge = swapConfigs.length > 0 && confirm('Merge with existing? (Cancel to replace)');
    if (merge) {
      swapConfigs = [...swapConfigs, ...imported];
    } else {
      swapConfigs = imported;
    }
    
    storage.set('swapConfigs', swapConfigs);
    renderSavedSwaps();
    
    // Emit EventBus event (new architecture)
    import('../core/events/EventBus').then(({ EventBus }) => {
      EventBus.emitSync('source-swaps:configs-changed', { configs: swapConfigs });
    });
    
    // Legacy window event (for backward compatibility)
    window.dispatchEvent(new CustomEvent('swapConfigsChanged'));
    
    dependencies.log(`Imported ${imported.length} configs`, 'success');
  } catch (e) {
    const error = e as Error;
    dependencies.log('Invalid JSON: ' + error.message, 'error');
  }
}

// ============ UI Functions ============

/**
 * Update swap dropdowns with current sources
 */
export function updateSwapDropdowns(): void {
  const selA = document.getElementById('swapSourceA') as HTMLSelectElement;
  const selB = document.getElementById('swapSourceB') as HTMLSelectElement;
  const newSelA = document.getElementById('swapNewSourceA') as HTMLSelectElement;
  const newSelB = document.getElementById('swapNewSourceB') as HTMLSelectElement;
  
  if (!selA || !selB) return; // Dropdowns don't exist yet
  
  // Get current sources (using getter)
  const currentSources = get(sources);
  
  // Preserve current selections or load from saved state
  const savedState = (storage.get('ui_state') as Record<string, any>) || {};
  const currentA = selA.value || savedState.swapSourceA || '';
  const currentB = selB.value || savedState.swapSourceB || '';
  
  const opts = '<option value="">-- Select --</option>' + 
    currentSources.map(s => `<option value="${s.sourceName}">${s.sourceName}</option>`).join('');
  selA.innerHTML = opts;
  selB.innerHTML = opts;
  
  // Also populate the "Add Config" dropdowns
  if (newSelA) newSelA.innerHTML = opts;
  if (newSelB) newSelB.innerHTML = opts;
  
  // Restore selections if sources still exist
  if (currentA && currentSources.find(s => s.sourceName === currentA)) selA.value = currentA;
  if (currentB && currentSources.find(s => s.sourceName === currentB)) selB.value = currentB;
}

/**
 * Refresh swap source dropdowns
 */
export function refreshSwapSources(): void {
  // Update all swap dropdowns with current sources
  updateSwapDropdowns();
  dependencies.log('Sources refreshed', 'info');
}

/**
 * Render saved swap configs
 */
export function renderSavedSwaps(): void {
  const container = document.getElementById('savedSwaps');
  if (!container) return;
  
  if (swapConfigs.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:15px">No saved configs</div>';
  } else {
    container.innerHTML = swapConfigs.map((c, i) => `
      <div class="source-item">
        <div>
          <div class="name">${c.name}</div>
          <div class="type">${c.sourceA} ↔ ${c.sourceB}</div>
        </div>
        <div style="display:flex;gap:4px">
          <button onclick="window.SourceSwaps?.loadSwapConfig(${i})">▶</button>
          <button onclick="window.SourceSwaps?.deleteSwapConfig(${i})">✕</button>
        </div>
      </div>
    `).join('');
  }
  renderDashSwaps();
  
  // Initialize/refresh search for swap configs
  if (dependencies.initSearchForList) {
    dependencies.initSearchForList('swapConfigs', 'swapConfigsSearchInput', container, swapConfigs.length);
  }
}

/**
 * Render dashboard swap quick buttons
 */
export function renderDashSwaps(): void {
  const grid = document.getElementById('dashSwapGrid');
  if (!grid) return;
  
  if (swapConfigs.length === 0) {
    grid.innerHTML = '<div class="empty-state" style="padding:10px;grid-column:1/-1">No saved swaps. Go to 🔄 tab to create one.</div>';
    return;
  }
  
  // Check connection state
  const isConnected = get(connected);
  
  // Render buttons with proper escaping
  grid.innerHTML = swapConfigs.map((c, i) => {
    const escapedName = c.name.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const disabledAttr = !isConnected ? 'disabled' : '';
    const connectionClass = !isConnected ? 'requires-connection' : '';
    return `<button class="source-btn ${connectionClass}" data-swap-name="${escapedName}" ${disabledAttr} onclick="window.SourceSwaps?.loadSwapConfig(${i})">${escapedName}</button>`;
  }).join('');
  
  // Set tooltips for truncated buttons or connection state
  setTimeout(() => {
    const buttons = grid.querySelectorAll('.source-btn[data-swap-name]');
    buttons.forEach((btn) => {
      const button = btn as HTMLButtonElement;
      const fullName = button.getAttribute('data-swap-name') || '';
      const isDisabled = button.disabled;
      
      // Always set tooltip if disabled (connection required)
      if (isDisabled) {
        button.title = 'Connect to OBS first to use quick swaps';
      } else {
        // For enabled buttons, only show tooltip if text is truncated
        if (button.scrollWidth > button.clientWidth) {
          button.title = fullName;
        } else {
          // Remove title if not truncated to avoid unnecessary tooltips
          button.removeAttribute('title');
        }
      }
    });
  }, 0);
}

/**
 * Load configs from storage
 */
export function loadConfigs(): void {
  swapConfigs = (storage.get('swapConfigs') as SwapConfig[]) || [];
}

/**
 * Get configs array
 */
export function getConfigs(): SwapConfig[] {
  return swapConfigs;
}

/**
 * Set configs array
 */
export function setConfigs(configs: SwapConfig[]): void {
  swapConfigs = configs || [];
}

