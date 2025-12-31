/**
 * Strixun Stream Suite - Source Management Module
 * 
 * Handles OBS scene and source management, including:
 * - Scene list and selection
 * - Source list and rendering
 * - Source visibility toggling with animations
 * - Source opacity control
 * 
 * @version 1.0.0
 */

// ============ State ============
let allScenes = []; // Cache of all scenes
let selectedScene = ''; // Currently selected scene in Sources tab (may differ from current program scene)
// Note: textSources is declared in websocket.js (global), so we don't redeclare it here

// ============ Scene Management ============

async function refreshScenes() {
    if (!connected) return;
    try {
        const data = await request('GetCurrentProgramScene');
        currentScene = data.currentProgramSceneName;
        const currentSceneEl = document.getElementById('currentScene');
        if (currentSceneEl) {
            currentSceneEl.innerHTML = `<strong>${currentScene}</strong>`;
        }
        
        // Also refresh the scene list
        await refreshSceneList();
        
        // Select current scene in dropdown if none selected
        if (!selectedScene) {
            selectedScene = currentScene;
            updateSceneSelector();
        }
        
        refreshSources();
        log('Refreshed scene: ' + currentScene);
    } catch (e) {
        log('Error: ' + e, 'error');
    }
}

async function refreshSceneList() {
    if (!connected) return;
    try {
        const data = await request('GetSceneList');
        allScenes = data.scenes || [];
        updateSceneSelector();
        log(`Found ${allScenes.length} scenes`);
    } catch (e) {
        log('Error getting scene list: ' + e, 'error');
    }
}

function updateSceneSelector() {
    renderScenesList();
}

function renderScenesList() {
    const list = document.getElementById('scenesList');
    if (!list) return;
    
    if (allScenes.length === 0) {
        list.innerHTML = '<div class="empty-state">Connect to OBS to see scenes</div>';
        return;
    }
    
    const currentValue = selectedScene || currentScene;
    
    list.innerHTML = allScenes.map(s => {
        const name = s.sceneName;
        const isCurrent = name === currentScene;
        const isSelected = name === currentValue;
        const escapedName = name.replace(/'/g, "\\'");
        
        return `
        <div class="source-item ${isSelected ? 'selected' : ''}" 
             data-source="${escapedName}"
             style="cursor:pointer;${isSelected ? 'border-left:3px solid var(--accent);background:var(--border)' : ''}"
             onclick="onSceneSelect('${escapedName}')">
            <div>
                <div class="name">${name}</div>
                <div class="type">${isCurrent ? '[EMOJI] Live' : 'Scene'}</div>
            </div>
            ${isSelected ? '<span style="color:var(--accent)"></span>' : ''}
        </div>`;
    }).join('');
    
    // If no selection and we have scenes, select the current scene
    if (!selectedScene && allScenes.length > 0) {
        selectedScene = currentScene || allScenes[0].sceneName;
    }
    
    // Initialize search for scenes list
    if (typeof initSearchForList === 'function') {
        initSearchForList('scenes', 'scenesSearchInput', list, allScenes.length);
    }
}

async function onSceneSelect(sceneName) {
    if (!sceneName || !connected) return;
    selectedScene = sceneName;
    
    // Update scenes list to show selection
    renderScenesList();
    
    // Update sources label
    const label = document.getElementById('sourcesSceneLabel');
    if (label) {
        const isLive = sceneName === currentScene;
        label.innerHTML = `Viewing: <strong>${sceneName}</strong>${isLive ? ' <span style="color:var(--danger)">(Live)</span>' : ''}`;
    }
    
    try {
        // Load sources for the selected scene (not necessarily the current program scene)
        const data = await request('GetSceneItemList', { sceneName: selectedScene });
        sources = data.sceneItems || [];
        renderSources();
        log(`Loaded ${sources.length} sources from: ${selectedScene}`);
    } catch (e) {
        log('Error getting sources: ' + e, 'error');
    }
}

// ============ Source Management ============

async function refreshSources() {
    if (!connected) return;
    
    // Use selected scene if set, otherwise use current program scene
    const targetScene = selectedScene || currentScene;
    if (!targetScene) return;
    
    try {
        const data = await request('GetSceneItemList', { sceneName: targetScene });
        sources = data.sceneItems || [];
        renderSources();
        
        // Update dependent dropdowns if they exist
        if (typeof updateTextSourceDropdown === 'function') {
            updateTextSourceDropdown();
        }
        if (typeof updateSwapDropdowns === 'function') {
            updateSwapDropdowns();
        }
        
        log(`Found ${sources.length} sources in: ${targetScene}`);
    } catch (e) {
        log('Error getting sources: ' + e, 'error');
    }
}

function renderSources() {
    const list = document.getElementById('sourcesList');
    if (!list) return;
    
    if (sources.length === 0) {
        list.innerHTML = '<div class="empty-state">No sources in current scene</div>';
        if (typeof updateOpacitySourceDropdown === 'function') {
            updateOpacitySourceDropdown();
        }
        return;
    }
    
    list.innerHTML = sources.map(s => {
        const savedOpacity = getSourceOpacityConfig(s.sourceName);
        const opacityDisplay = savedOpacity !== null ? savedOpacity : 100;
        const hasOpacitySet = savedOpacity !== null && savedOpacity < 100;
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
                     onclick="toggleSourceWithLoader('${escapedName}', ${s.sceneItemId}, ${!s.sceneItemEnabled}, this)"></div>
            </div>
            <div class="source-item__controls">
                <div class="source-item__slider-wrap">
                    <input type="range" min="0" max="100" value="${opacityDisplay}" 
                           class="opacity-slider"
                           id="slider-${s.sceneItemId}"
                           oninput="updateSliderValue(this, 'value-${s.sceneItemId}')"
                           onchange="quickSetOpacityWithLoader('${escapedName}', this.value, this)">
                    <span class="source-item__opacity-value" id="value-${s.sceneItemId}">${opacityDisplay}%</span>
                </div>
                <button class="opacity-reset-btn" 
                        id="reset-${s.sceneItemId}"
                        onclick="resetOpacityWithLoader('${escapedName}', ${s.sceneItemId}, this)"
                        title="Reset to 100%"> Reset</button>
            </div>
        </div>
    `}).join('');
    
    // Update opacity dropdown with current sources
    if (typeof updateOpacitySourceDropdown === 'function') {
        updateOpacitySourceDropdown();
    }
    
    // Initialize/refresh search for sources list
    if (typeof initSearchForList === 'function') {
        initSearchForList('sources', 'sourcesSearchInput', list, sources.length);
    }
}

// ============ Source Visibility Control ============

async function toggleSource(name, id, enabled) {
    const animTypeEl = document.getElementById('visAnimType');
    const durationEl = document.getElementById('visAnimDuration');
    const easingEl = document.getElementById('visAnimEasing');
    
    const animType = animTypeEl ? animTypeEl.value : 'none';
    const duration = durationEl ? parseInt(durationEl.value) || 300 : 300;
    const easing = easingEl ? easingEl.value : 'ease';
    
    try {
        if (animType === 'none') {
            // Instant toggle
            await request('SetSceneItemEnabled', {
                sceneName: currentScene,
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
        log('Error: ' + e, 'error');
    }
}

// ============ Loader-Aware Control Functions ============

// Update slider value display in real-time
function updateSliderValue(slider, valueId) {
    const display = document.getElementById(valueId);
    if (display) {
        display.textContent = slider.value + '%';
    }
}

// Toggle with loading state
async function toggleSourceWithLoader(name, id, enabled, toggleEl) {
    const animTypeEl = document.getElementById('visAnimType');
    const animType = animTypeEl ? animTypeEl.value : 'none';
    const durationEl = document.getElementById('visAnimDuration');
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

// Opacity change with loading state
async function quickSetOpacityWithLoader(sourceName, opacity, sliderEl) {
    const resetBtn = sliderEl.closest('.source-item__controls')?.querySelector('.opacity-reset-btn');
    
    // Disable slider during update
    sliderEl.disabled = true;
    if (resetBtn) resetBtn.classList.add('loading');
    
    try {
        if (typeof quickSetOpacity === 'function') {
            await quickSetOpacity(sourceName, opacity);
        }
    } finally {
        // Brief loading state for feedback
        setTimeout(() => {
            sliderEl.disabled = false;
            if (resetBtn) resetBtn.classList.remove('loading');
        }, 300);
    }
}

// Reset with loading state
async function resetOpacityWithLoader(sourceName, itemId, btnEl) {
    const slider = document.getElementById(`slider-${itemId}`);
    const valueDisplay = document.getElementById(`value-${itemId}`);
    
    // Add loading state
    btnEl.classList.add('loading');
    if (slider) slider.disabled = true;
    
    try {
        if (typeof setSourceOpacity === 'function') {
            await setSourceOpacity(sourceName, 100);
        }
        
        // Update UI immediately
        if (slider) slider.value = 100;
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
let sourceOpacityConfigs = {}; // { sourceName: opacity (0-100) }

function loadSourceOpacityConfigs() {
    sourceOpacityConfigs = storage.get('sourceOpacityConfigs') || {};
}

function saveSourceOpacityConfigs() {
    storage.set('sourceOpacityConfigs', sourceOpacityConfigs);
}

function getSourceOpacityConfig(sourceName) {
    return sourceOpacityConfigs[sourceName] !== undefined ? sourceOpacityConfigs[sourceName] : null;
}

function updateOpacitySourceDropdown() {
    const select = document.getElementById('opacitySourceSelect');
    if (!select) return;
    
    const currentVal = select.value;
    select.innerHTML = '<option value="">-- Select Source --</option>';
    
    sources.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.sourceName;
        opt.textContent = s.sourceName;
        select.appendChild(opt);
    });
    
    // Restore selection if still valid
    if (currentVal && sources.find(s => s.sourceName === currentVal)) {
        select.value = currentVal;
    }
}

function updateOpacityPreview() {
    const slider = document.getElementById('opacitySlider');
    const display = document.getElementById('opacityValue');
    if (slider && display) {
        display.textContent = slider.value + '%';
    }
}

function loadSourceOpacity() {
    const select = document.getElementById('opacitySourceSelect');
    const slider = document.getElementById('opacitySlider');
    const display = document.getElementById('opacityValue');
    
    if (!select || !slider || !display) return;
    
    const sourceName = select.value;
    if (!sourceName) {
        slider.value = 100;
        display.textContent = '100%';
        return;
    }
    
    const savedOpacity = getSourceOpacityConfig(sourceName);
    const opacity = savedOpacity !== null ? savedOpacity : 100;
    slider.value = opacity;
    display.textContent = opacity + '%';
}

async function applySourceOpacity() {
    const select = document.getElementById('opacitySourceSelect');
    const slider = document.getElementById('opacitySlider');
    
    if (!select || !slider) return;
    
    const sourceName = select.value;
    const opacity = parseInt(slider.value);
    
    if (!sourceName) {
        log('Select a source first!', 'error');
        return;
    }
    
    await setSourceOpacity(sourceName, opacity);
}

async function resetSourceOpacity() {
    const select = document.getElementById('opacitySourceSelect');
    if (!select || !select.value) {
        log('Select a source first!', 'error');
        return;
    }
    
    const sourceName = select.value;
    await setSourceOpacity(sourceName, 100);
    
    // Update UI
    const slider = document.getElementById('opacitySlider');
    const display = document.getElementById('opacityValue');
    if (slider) slider.value = 100;
    if (display) display.textContent = '100%';
}

async function quickSetOpacity(sourceName, opacity) {
    await setSourceOpacity(sourceName, parseInt(opacity));
}

async function setSourceOpacity(sourceName, opacity) {
    if (!connected) {
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
        log(`Opacity error: ${e}`, 'error');
        console.error('[Opacity]', e);
    }
}

async function applyOpacityFilter(sourceName, opacity) {
    const opacityNormalized = opacity / 100;
    
    // Check if filter exists
    try {
        const filterData = await request('GetSourceFilter', {
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

async function removeOpacityFilter(sourceName) {
    try {
        await request('RemoveSourceFilter', {
            sourceName: sourceName,
            filterName: OPACITY_FILTER_NAME
        });
    } catch (e) {
        // Filter might not exist, that's fine
    }
}

async function restoreSavedOpacities() {
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

async function animateVisibility(itemId, show, animType, duration, easing) {
    // Get current transform
    const data = await request('GetSceneItemTransform', {
        sceneName: currentScene,
        sceneItemId: itemId
    });
    const original = data.sceneItemTransform;
    
    // Calculate start and end states based on animation type
    let startTransform = {...original};
    let endTransform = {...original};
    
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
            sceneName: currentScene,
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
            sceneName: currentScene,
            sceneItemId: itemId,
            sceneItemEnabled: false
        });
        // Restore original transform (for next show)
        await setTransformAwait(itemId, original);
    }
}

// Critical transform - waits for confirmation
async function setTransformAwait(itemId, transform) {
    if (!connected) return;
    
    await request('SetSceneItemTransform', {
        sceneName: currentScene,
        sceneItemId: itemId,
        sceneItemTransform: {
            positionX: transform.positionX,
            positionY: transform.positionY,
            scaleX: transform.scaleX,
            scaleY: transform.scaleY
        }
    });
}

// Fast transform for animation loop - fire and forget
function setTransformFireForget(itemId, transform) {
    if (!connected || !ws || ws.readyState !== WebSocket.OPEN) return;
    
    ws.send(JSON.stringify({
        op: 6,
        d: {
            requestType: 'SetSceneItemTransform',
            requestId: 'anim_' + (msgId++),
            requestData: {
                sceneName: currentScene,
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
}

async function animateTransform(itemId, start, end, duration, easingType) {
    return new Promise(resolve => {
        const startTime = Date.now();
        const STEP_MS = 50; // 20 updates/sec max
        
        function step() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const t = easeFunc(progress, easingType);
            
            const current = {
                positionX: lerp(start.positionX, end.positionX, t),
                positionY: lerp(start.positionY, end.positionY, t),
                scaleX: lerp(start.scaleX, end.scaleX, t),
                scaleY: lerp(start.scaleY, end.scaleY, t)
            };
            
            setTransformFireForget(itemId, current);
            
            if (progress < 1) {
                setTimeout(step, STEP_MS);
            } else {
                resolve();
            }
        }
        
        step();
    });
}

// Easing functions
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

function lerp(a, b, t) {
    return a + (b - a) * t;
}

// ============ Exports (for non-module usage) ============
// All functions are already global, but we expose them via window.Sources for clarity
if (typeof window !== 'undefined') {
    window.Sources = {
        refreshScenes,
        refreshSceneList,
        renderScenesList,
        onSceneSelect,
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
        set selectedScene(val) { selectedScene = val; },
        get textSources() { return typeof textSources !== 'undefined' ? textSources : []; },
        get sourceOpacityConfigs() { return sourceOpacityConfigs; }
    };
}

