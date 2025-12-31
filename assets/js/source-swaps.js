/**
 * Source Swaps Module
 * 
 * Handles animated source swapping in OBS:
 * - Multiple swap configs with save/load
 * - Various animation styles (slide, arc, scale, bounce, elastic, crossfade)
 * - Enhanced easing functions
 * - Transform management (position, scale, bounds)
 * - Config import/export
 * 
 * @module SourceSwaps
 */

(function() {
    'use strict';

    // ============ Dependencies (injected) ============
    let dependencies = {
        storage: null,
        log: null,
        get connected() { return false; },
        get currentScene() { return ''; },
        get sources() { return []; },
        request: null,
        isOBSDock: null,
        showPage: null,
        initSearchForList: null
    };

    /**
     * Initialize the module with required dependencies
     * @param {Object} deps - Dependency object
     */
    function init(deps) {
        // Merge dependencies, preserving getters/setters
        Object.keys(deps).forEach(key => {
            const descriptor = Object.getOwnPropertyDescriptor(deps, key);
            if (descriptor && (descriptor.get || descriptor.set)) {
                // Preserve getters/setters
                Object.defineProperty(dependencies, key, descriptor);
            } else {
                // Regular property
                dependencies[key] = deps[key];
            }
        });
    }

    // ============ State ============
    let swapConfigs = [];
    let isSwapping = false;

    // ============ Transform Functions ============

    /**
     * Get scene item ID for a source name
     * @param {string} sourceName - Name of the source
     * @returns {Promise<number|null>}
     */
    async function getSceneItemId(sourceName) {
        // First try cached sources (fast path)
        const cached = dependencies.sources.find(s => s.sourceName === sourceName);
        if (cached) return cached.sceneItemId;
        
        // Cache miss - query OBS directly (handles stale cache, scene changes, etc.)
        try {
            const data = await dependencies.request('GetSceneItemId', {
                sceneName: dependencies.currentScene,
                sourceName: sourceName
            });
            return data.sceneItemId || null;
        } catch (e) {
            console.warn(`[Swap] Source "${sourceName}" not found in scene "${dependencies.currentScene}":`, e);
            return null;
        }
    }

    /**
     * Get transform for a scene item
     * @param {number} sceneItemId - Scene item ID
     * @returns {Promise<Object>}
     */
    async function getTransform(sceneItemId) {
        try {
            const data = await dependencies.request('GetSceneItemTransform', {
                sceneName: dependencies.currentScene,
                sceneItemId: sceneItemId
            });
            return data.sceneItemTransform;
        } catch (e) {
            console.error(`[Swap] Failed to get transform for item ${sceneItemId}:`, e);
            throw new Error(`Failed to get transform for item ${sceneItemId}: ${e}`);
        }
    }

    /**
     * Set transform for a scene item (with sanitization)
     * @param {number} sceneItemId - Scene item ID
     * @param {Object} transform - Transform object
     * @returns {Promise<void>}
     */
    async function setTransform(sceneItemId, transform) {
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
            
            await dependencies.request('SetSceneItemTransform', {
                sceneName: dependencies.currentScene,
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
     * @param {number} t - Time value (0-1)
     * @param {string} type - Easing type
     * @returns {number}
     */
    function easeFunc(t, type) {
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
     * @param {number} a - Start value
     * @param {number} b - End value
     * @param {number} t - Interpolation factor (0-1)
     * @returns {number}
     */
    function lerp(a, b, t) { 
        return a + (b - a) * t; 
    }

    // ============ Animation Functions ============

    /**
     * Animate slide swap
     */
    async function animateSlide(idA, idB, startA, startB, endA, endB, duration, easing, propsToSwap) {
        const startTime = performance.now();
        
        await new Promise((resolve, reject) => {
            function animate() {
                const elapsed = performance.now() - startTime;
                const rawT = Math.min(elapsed / duration, 1);
                const t = easeFunc(rawT, easing);
                
                // Lerp each source's own properties (they may differ in mixed bounds/scale case)
                const currentA = {};
                const currentB = {};
                
                for (const p of Object.keys(startA)) {
                    if (endA[p] !== undefined) {
                        currentA[p] = lerp(startA[p], endA[p], t);
                    }
                }
                for (const p of Object.keys(startB)) {
                    if (endB[p] !== undefined) {
                        currentB[p] = lerp(startB[p], endB[p], t);
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
    async function animateArc(idA, idB, startA, startB, endA, endB, duration, easing) {
        const startTime = performance.now();
        const arcHeight = 100; // Pixels to arc upward
        
        await new Promise((resolve, reject) => {
            function animate() {
                const elapsed = performance.now() - startTime;
                const rawT = Math.min(elapsed / duration, 1);
                const t = easeFunc(rawT, easing);
                
                // Parabolic arc: peaks at t=0.5
                const arcOffset = -4 * arcHeight * rawT * (rawT - 1);
                
                // Only animate properties that exist in start/end objects
                const currentA = {
                    positionX: lerp(startA.positionX, endA.positionX, t),
                    positionY: lerp(startA.positionY, endA.positionY, t) - arcOffset
                };
                const currentB = {
                    positionX: lerp(startB.positionX, endB.positionX, t),
                    positionY: lerp(startB.positionY, endB.positionY, t) - arcOffset
                };
                
                // Add scale if present
                if (startA.scaleX !== undefined) {
                    currentA.scaleX = lerp(startA.scaleX, endA.scaleX, t);
                    currentA.scaleY = lerp(startA.scaleY, endA.scaleY, t);
                }
                if (startB.scaleX !== undefined) {
                    currentB.scaleX = lerp(startB.scaleX, endB.scaleX, t);
                    currentB.scaleY = lerp(startB.scaleY, endB.scaleY, t);
                }
                
                // Add bounds if present
                if (startA.boundsWidth !== undefined) {
                    currentA.boundsWidth = lerp(startA.boundsWidth, endA.boundsWidth, t);
                    currentA.boundsHeight = lerp(startA.boundsHeight, endA.boundsHeight, t);
                }
                if (startB.boundsWidth !== undefined) {
                    currentB.boundsWidth = lerp(startB.boundsWidth, endB.boundsWidth, t);
                    currentB.boundsHeight = lerp(startB.boundsHeight, endB.boundsHeight, t);
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
    async function animateScale(idA, idB, startA, startB, endA, endB, duration, easing) {
        const startTime = performance.now();
        
        await new Promise((resolve, reject) => {
            function animate() {
                const elapsed = performance.now() - startTime;
                const rawT = Math.min(elapsed / duration, 1);
                
                // Shrink in first half, grow in second half (shrink to 30%)
                let scaleMod;
                if (rawT < 0.5) {
                    scaleMod = 1 - (rawT * 2) * 0.7; // Shrink from 1.0 to 0.3
                } else {
                    scaleMod = 0.3 + ((rawT - 0.5) * 2) * 0.7; // Grow from 0.3 back to 1.0
                }
                
                // Position JUMPS at midpoint (not smooth slide!)
                const posT = rawT < 0.5 ? 0 : 1;
                
                const currentA = {
                    positionX: lerp(startA.positionX, endA.positionX, posT),
                    positionY: lerp(startA.positionY, endA.positionY, posT)
                };
                const currentB = {
                    positionX: lerp(startB.positionX, endB.positionX, posT),
                    positionY: lerp(startB.positionY, endB.positionY, posT)
                };
                
                // Add scale with modifier if using scale
                if (startA.scaleX !== undefined) {
                    currentA.scaleX = (startA.scaleX || 1) * scaleMod;
                    currentA.scaleY = (startA.scaleY || 1) * scaleMod;
                }
                if (startB.scaleX !== undefined) {
                    currentB.scaleX = (startB.scaleX || 1) * scaleMod;
                    currentB.scaleY = (startB.scaleY || 1) * scaleMod;
                }
                
                // Add bounds if present (jump at midpoint, no scale mod)
                if (startA.boundsWidth !== undefined) {
                    currentA.boundsWidth = lerp(startA.boundsWidth, endA.boundsWidth, posT);
                    currentA.boundsHeight = lerp(startA.boundsHeight, endA.boundsHeight, posT);
                }
                if (startB.boundsWidth !== undefined) {
                    currentB.boundsWidth = lerp(startB.boundsWidth, endB.boundsWidth, posT);
                    currentB.boundsHeight = lerp(startB.boundsHeight, endB.boundsHeight, posT);
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
    async function animateCrossfade(idA, idB, nameA, nameB, endA, endB, duration) {
        // Fade out both, swap positions, fade in both
        const startTime = performance.now();
        
        await new Promise((resolve, reject) => {
            function animate() {
                const elapsed = performance.now() - startTime;
                const rawT = Math.min(elapsed / duration, 1);
                
                // Opacity simulation via scale (0.5 at midpoint)
                let opacityScale;
                if (rawT < 0.5) {
                    opacityScale = 1 - rawT; // Fade out
                } else {
                    opacityScale = rawT; // Fade in
                }
                
                // Position jumps at midpoint
                const posT = rawT < 0.5 ? 0 : 1;
                
                Promise.all([
                    setTransform(idA, { scaleX: endA.scaleX * opacityScale, scaleY: endA.scaleY * opacityScale }),
                    setTransform(idB, { scaleX: endB.scaleX * opacityScale, scaleY: endB.scaleY * opacityScale })
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
     * @param {string} sourceAOverride - Optional override for source A
     * @param {string} sourceBOverride - Optional override for source B
     */
    async function executeSwap(sourceAOverride, sourceBOverride) {
        if (!dependencies.connected) { 
            dependencies.log('Connect to OBS first', 'error'); 
            if (dependencies.showPage) dependencies.showPage('setup');
            return; 
        }
        if (isSwapping) { 
            dependencies.log('Swap in progress', 'error'); 
            return; 
        }
        
        // Use override params if provided (from loadSwapConfig), otherwise read from dropdowns
        const nameA = sourceAOverride || document.getElementById('swapSourceA').value;
        const nameB = sourceBOverride || document.getElementById('swapSourceB').value;
        
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
            dependencies.log(`Source not found: "${nameA}" - not in current scene "${dependencies.currentScene}"`, 'error'); 
            return; 
        }
        if (!idB) { 
            dependencies.log(`Source not found: "${nameB}" - not in current scene "${dependencies.currentScene}"`, 'error'); 
            return; 
        }
        
        isSwapping = true;
        const style = document.getElementById('swapStyle').value;
        dependencies.log(`Swapping ${nameA}  ${nameB} (${style})...`, 'info');
        
        try {
            const tA = await getTransform(idA);
            const tB = await getTransform(idB);
            
            const duration = parseInt(document.getElementById('swapDuration').value) || 400;
            const easing = document.getElementById('swapEasing').value;
            
            // Read control panel settings
            const preserveAspect = document.getElementById('swapPreserveAspect')?.checked ?? true;
            const debugLogging = document.getElementById('swapDebugLogging')?.checked ?? false;
            const tempOverride = document.getElementById('swapTempOverride')?.value || 'off';
            
            if (debugLogging) {
                console.log('[Swap Debug] Transform A:', JSON.stringify(tA, null, 2));
                console.log('[Swap Debug] Transform B:', JSON.stringify(tB, null, 2));
                console.log('[Swap Debug] Settings - preserveAspect:', preserveAspect, 'tempOverride:', tempOverride);
            }
            
            // Calculate visual sizes for each source
            // Bounds mode: visual size = bounds
            // Scale mode: visual size = sourceWidth * scaleX, sourceHeight * scaleY
            const aUsesBounds = tA.boundsWidth >= 1 && tA.boundsHeight >= 1;
            const bUsesBounds = tB.boundsWidth >= 1 && tB.boundsHeight >= 1;
            
            // Get visual sizes
            const sizeA = {
                width: aUsesBounds ? tA.boundsWidth : (tA.sourceWidth * tA.scaleX),
                height: aUsesBounds ? tA.boundsHeight : (tA.sourceHeight * tA.scaleY)
            };
            const sizeB = {
                width: bUsesBounds ? tB.boundsWidth : (tB.sourceWidth * tB.scaleX),
                height: bUsesBounds ? tB.boundsHeight : (tB.sourceHeight * tB.scaleY)
            };
            
            if (debugLogging) {
                console.log('[Swap Debug] A uses bounds:', aUsesBounds, 'size:', sizeA);
                console.log('[Swap Debug] B uses bounds:', bUsesBounds, 'size:', sizeB);
            }
            
            // Build start and end states - swap positions and visual sizes
            const startA = {
                positionX: tA.positionX,
                positionY: tA.positionY
            };
            const startB = {
                positionX: tB.positionX,
                positionY: tB.positionY
            };
            
            // End positions: swap them
            const endA = {
                positionX: tB.positionX,
                positionY: tB.positionY
            };
            const endB = {
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
                endA.scaleX = sizeB.width / (tA.sourceWidth || sizeA.width / tA.scaleX);
                endA.scaleY = sizeB.height / (tA.sourceHeight || sizeA.height / tA.scaleY);
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
                endB.scaleX = sizeA.width / (tB.sourceWidth || sizeB.width / tB.scaleX);
                endB.scaleY = sizeA.height / (tB.sourceHeight || sizeB.height / tB.scaleY);
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
                
                await new Promise((resolve, reject) => {
                    function animate() {
                        const elapsed = performance.now() - startTime;
                        const rawT = Math.min(elapsed / duration, 1);
                        const t = easeFunc(rawT, easing);
                        
                        // Lerp each source's own properties (they may differ)
                        const currentA = {};
                        const currentB = {};
                        
                        for (const p of Object.keys(startA)) {
                            if (endA[p] !== undefined) {
                                currentA[p] = lerp(startA[p], endA[p], t);
                            }
                        }
                        for (const p of Object.keys(startB)) {
                            if (endB[p] !== undefined) {
                                currentB[p] = lerp(startB[p], endB[p], t);
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
                
                await dependencies.request('SetSceneItemTransform', {
                    sceneName: dependencies.currentScene,
                    sceneItemId: idA,
                    sceneItemTransform: { boundsType }
                }).catch(e => console.warn('[Swap] Could not set bounds type for A:', e));
            }
            if (bUsesBounds) {
                let boundsType = preserveAspect ? 'OBS_BOUNDS_SCALE_INNER' : 'OBS_BOUNDS_STRETCH';
                if (tempOverride === 'preserve') boundsType = 'OBS_BOUNDS_SCALE_INNER';
                else if (tempOverride === 'stretch') boundsType = 'OBS_BOUNDS_STRETCH';
                
                await dependencies.request('SetSceneItemTransform', {
                    sceneName: dependencies.currentScene,
                    sceneItemId: idB,
                    sceneItemTransform: { boundsType }
                }).catch(e => console.warn('[Swap] Could not set bounds type for B:', e));
            }
            
            dependencies.log(`Swapped ${nameA}  ${nameB}`, 'success');
        } catch (e) {
            dependencies.log('Swap error: ' + e, 'error');
        }
        
        isSwapping = false;
    }

    // ============ Config Management ============

    /**
     * Save current swap as a config
     */
    function saveCurrentSwap() {
        const nameA = document.getElementById('swapSourceA').value;
        const nameB = document.getElementById('swapSourceB').value;
        if (!nameA || !nameB) { 
            dependencies.log('Select both sources first', 'error'); 
            return; 
        }
        
        const name = prompt('Config name:', `${nameA}  ${nameB}`);
        if (!name) return;
        
        swapConfigs.push({ name, sourceA: nameA, sourceB: nameB });
        dependencies.storage.set('swapConfigs', swapConfigs);
        renderSavedSwaps();
        dependencies.log(`Saved config: ${name}`, 'success');
        
        // OBS dock: debounced save to persistent storage
        if (dependencies.isOBSDock() && dependencies.connected) {
            if (window.StorageSync) {
                window.StorageSync.scheduleBroadcast();
            }
        }
    }

    /**
     * Add a new swap config
     */
    function addSwapConfig() {
        const configName = document.getElementById('swapConfigName').value.trim();
        const sourceA = document.getElementById('swapNewSourceA').value;
        const sourceB = document.getElementById('swapNewSourceB').value;
        
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
        dependencies.storage.set('swapConfigs', swapConfigs);
        renderSavedSwaps();
        
        // Clear the form
        document.getElementById('swapConfigName').value = '';
        dependencies.log(`Added config: ${configName}`, 'success');
    }

    /**
     * Delete a swap config
     * @param {number} index - Config index
     */
    function deleteSwapConfig(index) {
        swapConfigs.splice(index, 1);
        dependencies.storage.set('swapConfigs', swapConfigs);
        renderSavedSwaps();
        
        // OBS dock: debounced save to persistent storage
        if (dependencies.isOBSDock() && dependencies.connected) {
            if (window.StorageSync) {
                window.StorageSync.scheduleBroadcast();
            }
        }
    }

    /**
     * Load a swap config and execute it
     * @param {number} index - Config index
     */
    function loadSwapConfig(index) {
        const c = swapConfigs[index];
        if (!c) {
            dependencies.log('Config not found', 'error');
            return;
        }
        // Pass sources directly to executeSwap, bypassing dropdown dependency
        // Also update dropdowns if possible (for visual feedback)
        const selA = document.getElementById('swapSourceA');
        const selB = document.getElementById('swapSourceB');
        if (selA) selA.value = c.sourceA;
        if (selB) selB.value = c.sourceB;
        executeSwap(c.sourceA, c.sourceB);
    }

    /**
     * Export configs to clipboard
     */
    function exportConfigs() {
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
    function importConfigs() {
        const json = prompt('Paste config JSON:');
        if (!json) return;
        
        try {
            const imported = JSON.parse(json);
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
            
            dependencies.storage.set('swapConfigs', swapConfigs);
            renderSavedSwaps();
            dependencies.log(`Imported ${imported.length} configs`, 'success');
        } catch (e) {
            dependencies.log('Invalid JSON: ' + e.message, 'error');
        }
    }

    // ============ UI Functions ============

    /**
     * Update swap dropdowns with current sources
     */
    function updateSwapDropdowns() {
        const selA = document.getElementById('swapSourceA');
        const selB = document.getElementById('swapSourceB');
        const newSelA = document.getElementById('swapNewSourceA');
        const newSelB = document.getElementById('swapNewSourceB');
        
        if (!selA || !selB) return; // Dropdowns don't exist yet
        
        // Get current sources (using getter)
        const sources = dependencies.sources || [];
        
        // Preserve current selections or load from saved state
        const savedState = dependencies.storage.get('ui_state') || {};
        const currentA = selA.value || savedState.swapSourceA || '';
        const currentB = selB.value || savedState.swapSourceB || '';
        
        const opts = '<option value="">-- Select --</option>' + 
            sources.map(s => `<option value="${s.sourceName}">${s.sourceName}</option>`).join('');
        selA.innerHTML = opts;
        selB.innerHTML = opts;
        
        // Also populate the "Add Config" dropdowns
        if (newSelA) newSelA.innerHTML = opts;
        if (newSelB) newSelB.innerHTML = opts;
        
        // Restore selections if sources still exist
        if (currentA && sources.find(s => s.sourceName === currentA)) selA.value = currentA;
        if (currentB && sources.find(s => s.sourceName === currentB)) selB.value = currentB;
    }

    /**
     * Refresh swap source dropdowns
     */
    function refreshSwapSources() {
        // Populate the new source dropdowns for adding configs
        const sourceASelect = document.getElementById('swapNewSourceA');
        const sourceBSelect = document.getElementById('swapNewSourceB');
        const quickSourceA = document.getElementById('swapSourceA');
        const quickSourceB = document.getElementById('swapSourceB');
        
        if (quickSourceA && sourceASelect) {
            sourceASelect.innerHTML = quickSourceA.innerHTML;
        }
        if (quickSourceB && sourceBSelect) {
            sourceBSelect.innerHTML = quickSourceB.innerHTML;
        }
        dependencies.log('Sources refreshed', 'info');
    }

    /**
     * Render saved swap configs
     */
    function renderSavedSwaps() {
        const container = document.getElementById('savedSwaps');
        if (swapConfigs.length === 0) {
            container.innerHTML = '<div class="empty-state" style="padding:15px">No saved configs</div>';
        } else {
            container.innerHTML = swapConfigs.map((c, i) => `
                <div class="source-item">
                    <div>
                        <div class="name">${c.name}</div>
                        <div class="type">${c.sourceA}  ${c.sourceB}</div>
                    </div>
                    <div style="display:flex;gap:4px">
                        <button onclick="loadSwapConfig(${i})">▶</button>
                        <button onclick="deleteSwapConfig(${i})"></button>
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
    function renderDashSwaps() {
        const grid = document.getElementById('dashSwapGrid');
        if (!grid) return;
        
        if (swapConfigs.length === 0) {
            grid.innerHTML = '<div class="empty-state" style="padding:10px;grid-column:1/-1">No saved swaps. Go to ★ tab to create one.</div>';
            return;
        }
        grid.innerHTML = swapConfigs.map((c, i) => 
            `<button class="source-btn" onclick="loadSwapConfig(${i})">${c.name}</button>`
        ).join('');
    }

    /**
     * Load configs from storage
     */
    function loadConfigs() {
        swapConfigs = dependencies.storage.get('swapConfigs') || [];
    }

    /**
     * Get configs array
     * @returns {Array}
     */
    function getConfigs() {
        return swapConfigs;
    }

    /**
     * Set configs array
     * @param {Array} configs - Configs array
     */
    function setConfigs(configs) {
        swapConfigs = configs || [];
    }

    // ============ Public API ============
    window.SourceSwaps = {
        init,
        loadConfigs,
        getConfigs,
        setConfigs,
        executeSwap,
        saveCurrentSwap,
        addSwapConfig,
        deleteSwapConfig,
        loadSwapConfig,
        exportConfigs,
        importConfigs,
        updateSwapDropdowns,
        refreshSwapSources,
        renderSavedSwaps,
        renderDashSwaps
    };

})();

