/**
 * Strixun Stream Suite - Layout Management Module
 * 
 * Handles layout presets for OBS scenes, including:
 * - Capturing current scene state as a layout
 * - Applying saved layouts with animation
 * - Managing layout presets (save, delete, preview)
 * 
 * @version 1.0.0
 */

// ============ State ============
let layoutPresets = []; // Loaded async from storage on init
let isApplyingLayout = false;

/**
 * Capture the current scene state as a layout preset
 */
async function captureLayout() {
    if (!connected) {
        log('Connect to OBS first', 'error');
        if (typeof showPage === 'function') {
            showPage('setup');
        }
        return;
    }
    
    const layoutNameEl = document.getElementById('layoutName');
    if (!layoutNameEl) return;
    
    const layoutName = layoutNameEl.value.trim();
    if (!layoutName) {
        log('Enter a layout name first!', 'error');
        return;
    }
    
    try {
        // Get current scene
        const sceneData = await request('GetCurrentProgramScene', {});
        const sceneName = sceneData.currentProgramSceneName;
        
        // Get all scene items
        const itemsData = await request('GetSceneItemList', { sceneName });
        const items = itemsData.sceneItems || [];
        
        if (items.length === 0) {
            log('No sources found in scene', 'error');
            return;
        }
        
        // Capture transform for each source
        const sources = {};
        for (const item of items) {
            const sourceName = item.sourceName;
            const sceneItemId = item.sceneItemId;
            
            try {
                // Get transform
                const transformData = await request('GetSceneItemTransform', {
                    sceneName,
                    sceneItemId
                });
                const t = transformData.sceneItemTransform;
                
                // Get visibility
                const enabledData = await request('GetSceneItemEnabled', {
                    sceneName,
                    sceneItemId
                });
                
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
        const durationEl = document.getElementById('layoutDuration');
        const easingEl = document.getElementById('layoutEasing');
        const staggerEl = document.getElementById('layoutStagger');
        const applyVisibilityEl = document.getElementById('layoutApplyVisibility');
        
        const duration = durationEl ? parseInt(durationEl.value) || 500 : 500;
        const easing = easingEl ? easingEl.value || 'ease_out' : 'ease_out';
        const stagger = staggerEl ? parseInt(staggerEl.value) || 0 : 0;
        const applyVisibility = applyVisibilityEl ? applyVisibilityEl.checked : true;
        
        // Create the preset
        const now = new Date().toISOString();
        const existingIndex = layoutPresets.findIndex(p => p.name === layoutName && p.sceneName === sceneName);
        
        const preset = {
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
        if (typeof isOBSDock === 'function' && isOBSDock() && connected) {
            if (window.StorageSync) {
                window.StorageSync.scheduleBroadcast();
            }
        }
        
    } catch (e) {
        log('Failed to capture layout: ' + e, 'error');
        console.error('Capture layout error:', e);
    }
}

function generateLayoutId() {
    return 'layout_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Apply a saved layout preset with animation
 */
async function applyLayout(index) {
    if (!connected) {
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
    const sceneData = await request('GetCurrentProgramScene', {});
    const currentSceneName = sceneData.currentProgramSceneName;
    
    if (currentSceneName !== preset.sceneName) {
        log(`Warning: Layout was saved for "${preset.sceneName}" but you're on "${currentSceneName}"`, 'error');
        // Continue anyway - user might want to apply cross-scene
    }
    
    isApplyingLayout = true;
    log(`Applying layout: ${preset.name}...`, 'info');
    
    try {
        // Get current scene items
        const itemsData = await request('GetSceneItemList', { sceneName: currentSceneName });
        const currentItems = itemsData.sceneItems || [];
        
        // Build animation plan
        const animations = [];
        const missingFromScene = [];
        const missingFromPreset = [];
        
        // Create map of current items for quick lookup
        const currentItemsMap = {};
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
            });
            const currentTransform = transformData.sceneItemTransform;
            
            // Get current visibility
            const enabledData = await request('GetSceneItemEnabled', {
                sceneName: currentSceneName,
                sceneItemId: currentItem.sceneItemId
            });
            
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
        
        // Hide sources that need hiding (before animation)
        if (applyVisibility) {
            for (const anim of animations) {
                if (anim.currentVisible && !anim.targetVisible) {
                    // Will hide after animation
                }
            }
        }
        
        // Animate!
        const startTime = performance.now();
        
        await new Promise((resolve) => {
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
                    // Use global easeFunc from sources.js
                    const t = typeof easeFunc === 'function' ? easeFunc(rawT, easingType) : rawT;
                    
                    const current = {
                        positionX: typeof lerp === 'function' ? lerp(anim.from.positionX, anim.to.positionX, t) : anim.from.positionX + (anim.to.positionX - anim.from.positionX) * t,
                        positionY: typeof lerp === 'function' ? lerp(anim.from.positionY, anim.to.positionY, t) : anim.from.positionY + (anim.to.positionY - anim.from.positionY) * t,
                        rotation: typeof lerp === 'function' ? lerp(anim.from.rotation, anim.to.rotation, t) : anim.from.rotation + (anim.to.rotation - anim.from.rotation) * t
                    };
                    
                    // Handle bounds vs scale
                    if (anim.to.boundsType && anim.to.boundsType !== 'OBS_BOUNDS_NONE') {
                        const fromBoundsW = anim.from.boundsWidth || anim.from.scaleX * 1920;
                        const fromBoundsH = anim.from.boundsHeight || anim.from.scaleY * 1080;
                        current.boundsWidth = typeof lerp === 'function' ? lerp(fromBoundsW, anim.to.boundsWidth, t) : fromBoundsW + (anim.to.boundsWidth - fromBoundsW) * t;
                        current.boundsHeight = typeof lerp === 'function' ? lerp(fromBoundsH, anim.to.boundsHeight, t) : fromBoundsH + (anim.to.boundsHeight - fromBoundsH) * t;
                        current.boundsType = anim.to.boundsType;
                    } else {
                        current.scaleX = typeof lerp === 'function' ? lerp(anim.from.scaleX, anim.to.scaleX, t) : anim.from.scaleX + (anim.to.scaleX - anim.from.scaleX) * t;
                        current.scaleY = typeof lerp === 'function' ? lerp(anim.from.scaleY, anim.to.scaleY, t) : anim.from.scaleY + (anim.to.scaleY - anim.from.scaleY) * t;
                    }
                    
                    setLayoutTransform(currentSceneName, anim.sceneItemId, current);
                }
                
                requestAnimationFrame(animate);
            }
            
            requestAnimationFrame(animate);
        });
        
        log(`Layout applied: ${preset.name}`, 'success');
        
    } catch (e) {
        log('Failed to apply layout: ' + e, 'error');
        console.error('Apply layout error:', e);
    } finally {
        isApplyingLayout = false;
    }
}

async function setLayoutTransform(sceneName, sceneItemId, transform) {
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

async function setSceneItemEnabled(sceneName, sceneItemId, enabled) {
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

function deleteLayout(index) {
    const preset = layoutPresets[index];
    if (!preset) return;
    
    if (confirm(`Delete layout "${preset.name}"?`)) {
        layoutPresets.splice(index, 1);
        storage.set('layoutPresets', layoutPresets);
        renderSavedLayouts();
        log(`Deleted layout: ${preset.name}`, 'info');
        
        // OBS dock: debounced save to persistent storage
        if (typeof isOBSDock === 'function' && isOBSDock() && connected) {
            if (window.StorageSync) {
                window.StorageSync.scheduleBroadcast();
            }
        }
    }
}

function renderSavedLayouts() {
    const container = document.getElementById('savedLayouts');
    if (!container) return;
    
    const searchInput = document.getElementById('layoutSearchInput');
    const searchTerm = searchInput?.value?.toLowerCase() || '';
    
    // Update current scene display
    const sceneEl = document.getElementById('layoutCurrentScene');
    if (sceneEl) {
        sceneEl.textContent = currentScene || '-';
    }
    
    // Filter by current scene and search term
    const filteredLayouts = layoutPresets.filter((p, i) => {
        const matchesScene = !currentScene || p.sceneName === currentScene;
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
                    <span class="config-item__name">❓ ${preset.name.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
                    <span class="config-item__meta">${sourceCount} sources • ${age}</span>
                </div>
                <div class="config-item__actions">
                    <button onclick="applyLayout(${originalIndex})" class="btn-primary btn-sm">▶❓ Apply</button>
                    <button onclick="previewLayout(${originalIndex})" class="btn-secondary btn-sm">❓❓</button>
                    <button onclick="deleteLayout(${originalIndex})" class="btn-danger btn-sm">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
}

function previewLayout(index) {
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
        log(`  • ${name}: (${Math.round(s.positionX)}, ${Math.round(s.positionY)}) ${s.visible ? '❓❓' : '❓'}`, 'info');
    }
    if (sourceNames.length > 5) {
        log(`  ... and ${sourceNames.length - 5} more`, 'info');
    }
}

function refreshLayouts() {
    renderSavedLayouts();
    log('Layouts refreshed', 'info');
}

function getRelativeTime(isoString) {
    if (!isoString) return 'unknown';
    
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

// Initialize layouts on page load
function initLayouts() {
    layoutPresets = storage.get('layoutPresets') || [];
    renderSavedLayouts();
    
    // Setup search
    const searchInput = document.getElementById('layoutSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', renderSavedLayouts);
    }
}

// ============ Exports (for non-module usage) ============
// All functions are already global, but we expose them via window.Layouts for clarity
if (typeof window !== 'undefined') {
    window.Layouts = {
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
        set layoutPresets(val) { layoutPresets = val; },
        get isApplyingLayout() { return isApplyingLayout; }
    };
}

