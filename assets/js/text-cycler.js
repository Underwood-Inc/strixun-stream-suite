/**
 * Text Cycler Module
 * 
 * Handles all text cycler functionality including:
 * - Multi-config text cycling with browser source and legacy modes
 * - Transition animations (obfuscate, typewriter, glitch, etc.)
 * - Style management for browser sources
 * - Remote control via OBS WebSocket
 * 
 * @module TextCycler
 */

(function() {
    'use strict';

    // ============ Dependencies (injected) ============
    // These will be provided by the main control panel
    let dependencies = {
        storage: null,
        log: null,
        connected: false,
        ws: null,
        msgId: 0,
        isOBSDock: null,
        request: null,
        sources: [],
        storageSyncTimer: null,
        broadcastStorage: null,
        STORAGE_SYNC_DEBOUNCE: 500
    };

    /**
     * Initialize the module with required dependencies
     * @param {Object} deps - Dependency object
     */
    function init(deps) {
        dependencies = { ...dependencies, ...deps };
        loadConfigs();
    }

    // ============ State ============
    let textCyclerConfigs = [];
    let currentTextConfigIndex = -1;
    let cycleInterval = null;
    let cycleIndex = 0;
    let transitionInterval = null;
    let textChannels = {};
    let lastTextSend = 0;
    const MIN_TEXT_INTERVAL = 80;

    // Character sets for effects
    const CHARS_ENCHANT = 'ᔑᒷᓵ↸ᒷ⎓⊣⍑╎⋮ꖌꖎᒲリ𝙹ᑑ∷ᓭℸ⚍⍊∴⨅';
    const CHARS_GLITCH = '█▓▒░╔╗╚╝║═┌┐└┘│─┼▀▄▌▐■□▪▫●○';

    // ============ Config Management ============

    /**
     * Load configs from storage
     */
    function loadConfigs() {
        textCyclerConfigs = dependencies.storage.get('textCyclerConfigs') || [];
    }

    /**
     * Save configs to storage
     */
    function saveTextCyclerConfigs() {
        dependencies.storage.set('textCyclerConfigs', textCyclerConfigs);
        
        // OBS dock: debounced save to persistent storage for remote clients
        if (dependencies.isOBSDock() && dependencies.connected) {
            if (dependencies.storageSyncTimer) clearTimeout(dependencies.storageSyncTimer);
            dependencies.storageSyncTimer = setTimeout(() => {
                dependencies.broadcastStorage();
            }, dependencies.STORAGE_SYNC_DEBOUNCE);
        }
    }

    /**
     * Render the list of text cycler configs
     */
    function renderTextCyclerConfigs() {
        const container = document.getElementById('textCyclerConfigs');
        if (!container) return;
        
        if (textCyclerConfigs.length === 0) {
            container.innerHTML = '<div class="empty-state">No configs yet. Click "New Config" to create one.</div>';
            return;
        }
        
        container.innerHTML = textCyclerConfigs.map((c, i) => `
            <div class="source-item" style="cursor:pointer" onclick="TextCycler.loadConfig(${i})">
                <div>
                    <div class="name">${c.name || 'Unnamed'} ${c.isRunning ? '<span class="badge badge-success">Running</span>' : ''}</div>
                    <div class="type">${c.mode === 'browser' ? '🌐 Browser' : '📝 Legacy'} • ${(c.textLines || []).length} lines • ${c.transition || 'none'}</div>
                </div>
                <div style="display:flex;gap:4px">
                    <button onclick="event.stopPropagation(); TextCycler.quickStart(${i})" title="${c.isRunning ? 'Stop' : 'Start'}">${c.isRunning ? '⏹' : '▶'}</button>
                </div>
            </div>
        `).join('');
        
        // Initialize/refresh search for text configs
        if (typeof initSearchForList === 'function') {
            initSearchForList('textConfigs', 'textConfigsSearchInput', container, textCyclerConfigs.length);
        }
    }

    /**
     * Create a new text cycler config
     */
    function newTextConfig() {
        const config = {
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
                align: 'center',
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
     * @param {number} index - Config index
     */
    function loadConfig(index) {
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
        const nameEl = document.getElementById('textConfigName');
        if (nameEl) nameEl.value = config.name || '';
        const modeEl = document.getElementById('textCyclerMode');
        if (modeEl) modeEl.value = config.mode || 'browser';
        const configIdEl = document.getElementById('textConfigId');
        if (configIdEl) configIdEl.value = config.configId || config.id;
        const sourceEl = document.getElementById('textSource');
        if (sourceEl) sourceEl.value = config.textSource || '';
        const linesEl = document.getElementById('textLines');
        if (linesEl) linesEl.value = (config.textLines || []).join('\n');
        const transitionEl = document.getElementById('textTransition');
        if (transitionEl) transitionEl.value = config.transition || 'none';
        const transDurationEl = document.getElementById('transDuration');
        if (transDurationEl) transDurationEl.value = config.transDuration || 500;
        const durationEl = document.getElementById('textDuration');
        if (durationEl) durationEl.value = config.cycleDuration || 3000;
        
        // Style settings
        if (config.styles) {
            const fontFamily = config.styles.fontFamily || "'Segoe UI', system-ui, sans-serif";
            const fontSelect = document.getElementById('textFontFamily');
            const fontCustom = document.getElementById('textFontFamilyCustom');
            if (fontSelect && fontCustom) {
                let isPreset = false;
                for (let opt of fontSelect.options) {
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
            
            const setValue = (id, defaultValue) => {
                const el = document.getElementById(id);
                if (el) el.value = config.styles[id.replace('text', '').replace(/([A-Z])/g, (m, p1) => p1.toLowerCase())] || defaultValue;
            };
            
            const fontSizeEl = document.getElementById('textFontSize');
            if (fontSizeEl) fontSizeEl.value = config.styles.fontSize || '48px';
            const fontWeightEl = document.getElementById('textFontWeight');
            if (fontWeightEl) fontWeightEl.value = config.styles.fontWeight || '700';
            const fontStyleEl = document.getElementById('textFontStyle');
            if (fontStyleEl) fontStyleEl.value = config.styles.fontStyle || 'normal';
            const colorEl = document.getElementById('textColor');
            if (colorEl) colorEl.value = config.styles.color || '#ffffff';
            const colorPickerEl = document.getElementById('textColorPicker');
            if (colorPickerEl) colorPickerEl.value = config.styles.color || '#ffffff';
            const alignEl = document.getElementById('textAlign');
            if (alignEl) alignEl.value = config.styles.align || 'center';
            const letterSpacingEl = document.getElementById('textLetterSpacing');
            if (letterSpacingEl) letterSpacingEl.value = config.styles.letterSpacing || 'normal';
            const lineHeightEl = document.getElementById('textLineHeight');
            if (lineHeightEl) lineHeightEl.value = config.styles.lineHeight || '1.2';
            const textTransformEl = document.getElementById('textTransform');
            if (textTransformEl) textTransformEl.value = config.styles.textTransform || 'none';
            const shadowEl = document.getElementById('textShadow');
            if (shadowEl) shadowEl.value = config.styles.shadow || '';
            const strokeWidthEl = document.getElementById('textStrokeWidth');
            if (strokeWidthEl) strokeWidthEl.value = config.styles.strokeWidth || '0';
            const strokeColorEl = document.getElementById('textStrokeColor');
            if (strokeColorEl) strokeColorEl.value = config.styles.strokeColor || '#000000';
            const strokeColorPickerEl = document.getElementById('textStrokeColorPicker');
            if (strokeColorPickerEl) strokeColorPickerEl.value = config.styles.strokeColor || '#000000';
        }
        
        if (typeof updateTextCyclerMode === 'function') updateTextCyclerMode();
        if (typeof updateTransitionMode === 'function') updateTransitionMode();
        if (typeof updateBrowserSourceUrlPreview === 'function') updateBrowserSourceUrlPreview();
        
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
        const startBtn = document.getElementById('startCycleBtn');
        if (startBtn) startBtn.disabled = config.isRunning;
        const stopBtn = document.getElementById('stopCycleBtn');
        if (stopBtn) stopBtn.disabled = !config.isRunning;
        
        dependencies.log('Loaded config: ' + config.name, 'info');
    }

    /**
     * Save the currently loaded config
     */
    function saveCurrentTextConfig() {
        if (currentTextConfigIndex < 0) return;
        
        const config = textCyclerConfigs[currentTextConfigIndex];
        const nameEl = document.getElementById('textConfigName');
        if (nameEl) config.name = nameEl.value || 'Unnamed';
        const modeEl = document.getElementById('textCyclerMode');
        if (modeEl) config.mode = modeEl.value;
        const configIdEl = document.getElementById('textConfigId');
        if (configIdEl) config.configId = configIdEl.value || config.id;
        const sourceEl = document.getElementById('textSource');
        if (sourceEl) config.textSource = sourceEl.value;
        const linesEl = document.getElementById('textLines');
        if (linesEl) {
            config.textLines = linesEl.value.split('\n').map(l => l.trim()).filter(l => l);
        }
        const transitionEl = document.getElementById('textTransition');
        if (transitionEl) config.transition = transitionEl.value;
        const transDurationEl = document.getElementById('transDuration');
        if (transDurationEl) config.transDuration = parseInt(transDurationEl.value) || 500;
        const durationEl = document.getElementById('textDuration');
        if (durationEl) config.cycleDuration = parseInt(durationEl.value) || 3000;
        
        const fontFamilyCustomEl = document.getElementById('textFontFamilyCustom');
        const fontFamilyEl = document.getElementById('textFontFamily');
        config.styles = {
            fontFamily: (fontFamilyCustomEl && fontFamilyCustomEl.value) || (fontFamilyEl && fontFamilyEl.value),
            fontSize: document.getElementById('textFontSize')?.value || '48px',
            fontWeight: document.getElementById('textFontWeight')?.value || '700',
            fontStyle: document.getElementById('textFontStyle')?.value || 'normal',
            color: document.getElementById('textColor')?.value || '#ffffff',
            align: document.getElementById('textAlign')?.value || 'center',
            letterSpacing: document.getElementById('textLetterSpacing')?.value || 'normal',
            lineHeight: document.getElementById('textLineHeight')?.value || '1.2',
            textTransform: document.getElementById('textTransform')?.value || 'none',
            shadow: document.getElementById('textShadow')?.value || '',
            strokeWidth: document.getElementById('textStrokeWidth')?.value || '0',
            strokeColor: document.getElementById('textStrokeColor')?.value || '#000000'
        };
        
        saveTextCyclerConfigs();
        renderTextCyclerConfigs();
        dependencies.log('Saved config: ' + config.name, 'success');
    }

    /**
     * Delete the current config
     */
    function deleteCurrentTextConfig() {
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
    function exportTextConfigs() {
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
    function importTextConfigs() {
        const json = prompt('Paste config JSON:');
        if (!json) return;
        
        try {
            const imported = JSON.parse(json);
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
            dependencies.log('Invalid JSON: ' + e.message, 'error');
        }
    }

    // ============ Communication ============

    /**
     * Get or create a BroadcastChannel for a config
     * @param {string} configId - Config ID
     * @returns {BroadcastChannel|null}
     */
    function getOrCreateChannel(configId) {
        if (!textChannels[configId]) {
            try {
                textChannels[configId] = new BroadcastChannel('text_cycler_' + configId);
            } catch (e) {
                console.warn('BroadcastChannel not supported');
            }
        }
        return textChannels[configId];
    }

    /**
     * Send message to display (browser source or legacy)
     * @param {string} configId - Config ID
     * @param {Object} message - Message object
     */
    async function sendToDisplay(configId, message) {
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
        if (dependencies.connected && !dependencies.isOBSDock()) {
            try {
                await dependencies.request('BroadcastCustomEvent', {
                    eventData: {
                        type: 'strixun_text_cycler_msg',
                        configId: configId,
                        message: message,
                        timestamp: messageData.timestamp
                    }
                });
                console.log('[Text Cycler] Sent via WebSocket:', configId, message.type);
            } catch (e) {
                console.warn('[Text Cycler] Failed to send:', e);
            }
        }
    }

    // ============ Cycling Engine ============

    /**
     * Start the text cycler for the current config
     */
    function startTextCycler() {
        saveCurrentTextConfig();
        
        if (currentTextConfigIndex < 0) return;
        const config = textCyclerConfigs[currentTextConfigIndex];
        
        if (!config.textLines || config.textLines.length === 0) {
            dependencies.log('Enter at least one text line', 'error');
            return;
        }
        
        if (config.mode === 'legacy' && !config.textSource) {
            dependencies.log('Select a text source first', 'error');
            return;
        }
        
        if (config.mode === 'legacy' && !dependencies.connected) {
            dependencies.log('Connect to OBS first for legacy mode', 'error');
            if (typeof showPage === 'function') showPage('setup');
            return;
        }
        
        startConfigCycling(currentTextConfigIndex);
    }

    /**
     * Start cycling for a specific config
     * @param {number} index - Config index
     */
    function startConfigCycling(index) {
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
            sendToDisplay(config.configId, {
                type: 'style',
                styles: config.styles
            });
        }
        
        // Send initial text
        showConfigText(index, config.textLines[0]);
        
        // Start interval
        config.intervalId = setInterval(() => {
            config.cycleIndex = (config.cycleIndex + 1) % config.textLines.length;
            showConfigText(index, config.textLines[config.cycleIndex]);
        }, config.cycleDuration);
        
        saveTextCyclerConfigs();
        renderTextCyclerConfigs();
        
        // Update UI if this is current config
        if (index === currentTextConfigIndex) {
            const startBtn = document.getElementById('startCycleBtn');
            if (startBtn) startBtn.disabled = true;
            const stopBtn = document.getElementById('stopCycleBtn');
            if (stopBtn) stopBtn.disabled = false;
        }
        
        dependencies.log(`Started: ${config.name} (${config.textLines.length} lines)`, 'success');
    }

    /**
     * Show text for a config
     * @param {number} index - Config index
     * @param {string} text - Text to show
     */
    function showConfigText(index, text) {
        const config = textCyclerConfigs[index];
        if (!config) return;
        
        if (config.mode === 'browser') {
            // Send to browser source
            sendToDisplay(config.configId, {
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
     * @param {string} targetText - Target text
     * @param {Object} config - Config object
     * @param {number} configIndex - Config index
     */
    function showTextWithTransitionLegacy(targetText, config, configIndex) {
        const transition = config.transition;
        const transDuration = config.transDuration || 500;
        
        if (transitionInterval) {
            clearInterval(transitionInterval);
            transitionInterval = null;
        }
        
        if (transition === 'none') {
            setTextFast(targetText, config.textSource, configIndex);
            return;
        }
        
        const STEP_MS = 100;
        const totalSteps = Math.max(Math.floor(transDuration / STEP_MS), 1);
        let currentStep = 0;
        
        function doStep() {
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
            
            setTextFast(displayText, config.textSource, configIndex);
            
            if (currentStep >= totalSteps) {
                clearInterval(transitionInterval);
                transitionInterval = null;
                setTextFast(targetText, config.textSource, configIndex);
            }
        }
        
        doStep();
        if (totalSteps > 1) {
            transitionInterval = setInterval(doStep, STEP_MS);
        }
    }

    /**
     * Set text on OBS source (legacy mode)
     * @param {string} text - Text to set
     * @param {string} sourceName - Source name
     * @param {number} configIndex - Config index
     */
    function setTextFast(text, sourceName, configIndex) {
        if (!sourceName || !dependencies.connected || !dependencies.ws || dependencies.ws.readyState !== WebSocket.OPEN) return;
        
        const now = Date.now();
        if (now - lastTextSend < MIN_TEXT_INTERVAL) {
            if (configIndex === currentTextConfigIndex) {
                const preview = document.getElementById('textPreview');
                if (preview) preview.textContent = text;
            }
            return;
        }
        lastTextSend = now;
        
        dependencies.ws.send(JSON.stringify({
            op: 6,
            d: {
                requestType: 'SetInputSettings',
                requestId: 'txt_' + (dependencies.msgId++),
                requestData: {
                    inputName: sourceName,
                    inputSettings: { text: text }
                }
            }
        }));
        
        if (configIndex === currentTextConfigIndex) {
            const preview = document.getElementById('textPreview');
            if (preview) preview.textContent = text;
        }
    }

    /**
     * Scramble text (legacy)
     * @param {string} text - Text to scramble
     * @returns {string}
     */
    function scrambleTextLegacy(text) {
        const chars = '#$%&*@!?+=~<>[]{}';
        return text.split('').map(c => c === ' ' ? ' ' : chars[Math.floor(Math.random() * chars.length)]).join('');
    }

    /**
     * Reveal text progressively (legacy)
     * @param {string} target - Target text
     * @param {number} progress - Progress 0-1
     * @returns {string}
     */
    function revealTextLegacy(target, progress) {
        const chars = '#$%&*@!?+=~<>[]{}';
        const revealed = Math.ceil(progress * target.length);
        return target.split('').map((c, i) => i < revealed ? c : (c === ' ' ? ' ' : chars[Math.floor(Math.random() * chars.length)])).join('');
    }

    /**
     * Wave text effect (legacy)
     * @param {string} target - Target text
     * @param {number} progress - Progress 0-1
     * @returns {string}
     */
    function waveTextLegacy(target, progress) {
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
    function stopTextCycler() {
        if (currentTextConfigIndex >= 0) {
            stopConfigCycling(currentTextConfigIndex);
        }
    }

    /**
     * Stop cycling for a specific config
     * @param {number} index - Config index
     */
    function stopConfigCycling(index) {
        const config = textCyclerConfigs[index];
        if (!config) return;
        
        if (config.intervalId) {
            clearInterval(config.intervalId);
            config.intervalId = null;
        }
        
        config.isRunning = false;
        saveTextCyclerConfigs();
        renderTextCyclerConfigs();
        
        if (index === currentTextConfigIndex) {
            const startBtn = document.getElementById('startCycleBtn');
            if (startBtn) startBtn.disabled = false;
            const stopBtn = document.getElementById('stopCycleBtn');
            if (stopBtn) stopBtn.disabled = true;
        }
        
        dependencies.log(`Stopped: ${config.name}`, 'info');
    }

    /**
     * Quick start/stop for a config
     * @param {number} index - Config index
     */
    function quickStart(index) {
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
     */
    function restoreRunningTextCyclers() {
        textCyclerConfigs.forEach((config, index) => {
            if (config.isRunning) {
                config.isRunning = false;
                startConfigCycling(index);
            }
        });
    }

    /**
     * Set configs (for import/restore operations)
     * @param {Array} configs - New configs array
     */
    function setConfigs(configs) {
        textCyclerConfigs = configs || [];
        saveTextCyclerConfigs();
        renderTextCyclerConfigs();
    }

    /**
     * Add configs (for merge operations)
     * @param {Array} newConfigs - Configs to add
     */
    function addConfigs(newConfigs) {
        textCyclerConfigs = [...textCyclerConfigs, ...newConfigs];
        saveTextCyclerConfigs();
        renderTextCyclerConfigs();
    }

    // ============ Public API ============
    window.TextCycler = {
        init,
        loadConfigs,
        saveTextCyclerConfigs,
        renderTextCyclerConfigs,
        newTextConfig,
        loadConfig,
        saveCurrentTextConfig,
        deleteCurrentTextConfig,
        exportTextConfigs,
        importTextConfigs,
        startTextCycler,
        stopTextCycler,
        quickStart,
        restoreRunningTextCyclers,
        getConfigs: () => textCyclerConfigs,
        setConfigs,
        addConfigs,
        getCurrentIndex: () => currentTextConfigIndex,
        setCurrentIndex: (index) => { currentTextConfigIndex = index; },
        // Compatibility getters
        get textCyclerConfigs() { return textCyclerConfigs; },
        get currentTextConfigIndex() { return currentTextConfigIndex; }
    };

})();

