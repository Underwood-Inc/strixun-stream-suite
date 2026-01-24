<script lang="ts">
  /**
   * Text Cycler Display Component
   * 
   * Standalone display for OBS browser source overlays.
   * Receives text updates via BroadcastChannel/localStorage.
   * 
   * URL Parameters:
   * - id: Config ID for the text cycler (default: 'default')
   * - debug: Show debug status indicator ('true' to enable)
   * - color: Text color override
   * - size: Font size override
   * - font: Font family override
   * - weight: Font weight override
   * - shadow: Text shadow override
   * - align: Text alignment override
   * 
   * @example /#/text-cycler-display?id=text1&debug=true
   */
  
  import { onMount, onDestroy } from 'svelte';
  import { getQueryParam } from '../router';
  import { connected } from '../stores/connection';
  import { storage } from '../modules/storage';
  import { connectProgrammatic } from '../modules/websocket';
  
  // ============ Props ============
  /** Config ID - if provided, uses this instead of URL param */
  export let propConfigId: string | null = null;
  /** Preview mode - embedded in parent, not full viewport */
  export let previewMode = false;
  
  // ============ Configuration ============
  let configId = 'default';
  let debug = false;
  
  // State
  let displayText = 'Ready';
  let statusText = 'Waiting for connection...';
  let animationClass = '';
  let animationFrame: number | null = null;
  
  // Custom styles
  let customColor = '';
  let customSize = '';
  let customFont = '';
  let customWeight = '';
  let customShadow = '';
  let customAlign = 'center';
  let customLetterSpacing = '';
  let customLineHeight = '';
  let customTextTransform = '';
  let customStroke = '';
  let customFontStyle = '';
  
  // Character sets for animations
  const CHARS_ENCHANT = 'ᔑᒷᓵᒷ⊣╎⋮ꖌꖎᒲリ𝙹ᑑ∷ᓭℸ∴⨅';
  const CHARS_GLITCH = '█▓▒░╔╗╚╝║═┌┐└┘│─┼▀▄▌▐■□▪▫●○';
  
  // Communication
  let channel: BroadcastChannel | null = null;
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let lastPolledTimestamp = 0;
  
  onMount(() => {
    // Use prop configId if provided, otherwise parse from URL
    if (propConfigId) {
      configId = propConfigId;
    } else {
      configId = getQueryParam('id') || 'default';
    }
    debug = getQueryParam('debug') === 'true';
    
    // Apply custom styles from URL (only in non-preview mode)
    if (!previewMode) {
      customColor = getQueryParam('color') || '';
      customSize = getQueryParam('size') || '';
      customFont = getQueryParam('font') || '';
      customWeight = getQueryParam('weight') || '';
      customShadow = getQueryParam('shadow') || '';
      customAlign = getQueryParam('align') || 'center';
    }
    
    console.log('[TextCyclerDisplay] onMount - configId:', configId, 'previewMode:', previewMode);
    
    // Set up BroadcastChannel for same-origin communication (preview mode)
    try {
      channel = new BroadcastChannel('text_cycler_' + configId);
      channel.onmessage = (e) => handleMessage(e.data);
      updateStatus('BroadcastChannel connected');
    } catch (err) {
      updateStatus('BroadcastChannel not supported');
    }
    
    // Listen for WebSocket-relayed messages (works when connected to OBS)
    // This is the primary receive path for OBS browser sources
    window.addEventListener('strixun_text_cycler_msg', handleWebSocketEvent as EventListener);
    
    // LocalStorage fallback
    window.addEventListener('storage', handleStorageEvent);
    pollInterval = setInterval(pollLocalStorage, 100);
    
    // If not in preview mode and not already connected, try to connect to OBS
    // This allows the browser source to receive WebSocket events directly
    if (!previewMode && !$connected) {
      const host = (storage.getRaw('obs_host') as string) || 'localhost';
      const port = (storage.getRaw('obs_port') as string) || '4455';
      console.log('[TextCyclerDisplay] Attempting OBS WebSocket connection:', { host, port });
      updateStatus('Connecting to OBS...');
      // Note: Password is stored in cloud, not accessible here. Try without password first.
      connectProgrammatic(host, port, '');
    }
    
    // Load initial state
    loadInitialState();
    
    // Announce presence
    sendResponse({ type: 'ready', configId });
    updateStatus('Display ready');
  });
  
  // Reactive: reinitialize when propConfigId changes
  $: if (propConfigId && propConfigId !== configId) {
    reinitializeChannel(propConfigId);
  }
  
  function reinitializeChannel(newConfigId: string): void {
    // Close existing channel
    if (channel) {
      channel.close();
    }
    
    // Update configId
    configId = newConfigId;
    
    // Reset polling timestamp to receive new messages
    lastPolledTimestamp = 0;
    
    // Set up new BroadcastChannel
    try {
      channel = new BroadcastChannel('text_cycler_' + configId);
      channel.onmessage = (e) => handleMessage(e.data);
    } catch (err) {
      // BroadcastChannel not supported
    }
    
    // Load initial state for new config
    loadInitialState();
    
    // Poll immediately for any pending messages
    pollLocalStorage();
  }
  
  onDestroy(() => {
    if (channel) {
      channel.close();
    }
    if (pollInterval) {
      clearInterval(pollInterval);
    }
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }
    window.removeEventListener('strixun_text_cycler_msg', handleWebSocketEvent as EventListener);
    window.removeEventListener('storage', handleStorageEvent);
  });
  
  /**
   * Handle messages received via WebSocket (relayed as window events)
   */
  function handleWebSocketEvent(e: CustomEvent): void {
    const data = e.detail;
    console.log('[TextCyclerDisplay] handleWebSocketEvent fired:', {
      eventConfigId: data?.configId,
      ourConfigId: configId,
      matches: data?.configId === configId,
      messageType: data?.message?.type
    });
    if (data && data.configId === configId && data.message) {
      updateStatus('Received via WebSocket');
      handleMessage(data.message);
    }
  }
  
  function handleStorageEvent(e: StorageEvent): void {
    if (e.key === 'text_cycler_msg_' + configId && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        // Extract message from wrapper (same structure as pollLocalStorage)
        handleMessage(parsed.message || parsed);
      } catch (err) {
        // Ignore parse errors
      }
    }
  }
  
  function pollLocalStorage(): void {
    try {
      const msgKey = 'text_cycler_msg_' + configId;
      const msgData = localStorage.getItem(msgKey);
      if (msgData) {
        const parsed = JSON.parse(msgData);
        // Check if this is a new message (has timestamp and it's newer)
        if (parsed.timestamp && parsed.timestamp > lastPolledTimestamp) {
          lastPolledTimestamp = parsed.timestamp;
          handleMessage(parsed.message || parsed);
        } else if (!parsed.timestamp) {
          // Legacy format without timestamp - only process if we haven't seen it
          const legacyKey = 'text_cycler_processed_' + configId + '_' + JSON.stringify(parsed);
          if (!sessionStorage.getItem(legacyKey)) {
            sessionStorage.setItem(legacyKey, '1');
            handleMessage(parsed);
          }
        }
      }
    } catch (err) {
      // Silently ignore parse errors
    }
  }
  
  function loadInitialState(): void {
    try {
      const savedState = localStorage.getItem('text_cycler_state_' + configId);
      if (savedState) {
        const state = JSON.parse(savedState);
        if (state.text) {
          displayText = state.text;
        }
        if (state.styles) {
          applyStyles(state.styles);
        }
      }
    } catch (err) {
      // Ignore
    }
  }
  
  function handleMessage(msg: any): void {
    updateStatus(`Received: ${msg.type}`);
    
    switch (msg.type) {
      case 'show':
        // Apply styles if included in show message
        if (msg.styles) {
          applyStyles(msg.styles);
        }
        showText(msg.text, msg.transition, msg.duration);
        break;
      case 'clear':
        displayText = '';
        break;
      case 'style':
        applyStyles(msg.styles);
        break;
      case 'ping':
        sendResponse({ type: 'pong', configId });
        break;
    }
  }
  
  function sendResponse(data: any): void {
    if (channel) {
      channel.postMessage(data);
    }
    localStorage.setItem('text_cycler_response_' + configId, JSON.stringify(data));
  }
  
  function updateStatus(msg: string): void {
    statusText = `[${configId}] ${msg}`;
    if (debug) console.log(`[TextCyclerDisplay:${configId}]`, msg);
  }
  
  function getRandomChar(charset: string): string {
    const chars = [...charset];
    return chars[Math.floor(Math.random() * chars.length)] || '?';
  }
  
  // ============ Animation Functions ============
  
  function showText(text: string, transition = 'none', duration = 500): void {
    // Cancel any running animation
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
    
    // Clear animation classes
    animationClass = '';
    
    switch (transition) {
      case 'obfuscate':
        animateObfuscate(text, duration);
        break;
      case 'typewriter':
        animateTypewriter(text, duration);
        break;
      case 'glitch':
        animateGlitch(text, duration);
        break;
      case 'scramble':
        animateScramble(text, duration);
        break;
      case 'wave':
        animateWave(text, duration);
        break;
      case 'fade':
        animateFade(text, duration);
        break;
      case 'slide_left':
        animateSlide(text, duration, 'left');
        break;
      case 'slide_right':
        animateSlide(text, duration, 'right');
        break;
      case 'slide_up':
        animateSlide(text, duration, 'up');
        break;
      case 'slide_down':
        animateSlide(text, duration, 'down');
        break;
      case 'pop':
        animatePop(text, duration);
        break;
      case 'none':
      default:
        displayText = text;
        break;
    }
  }
  
  function animateObfuscate(targetText: string, duration: number): void {
    const startTime = performance.now();
    const chars = [...targetText];
    
    function animate() {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const revealed = Math.floor(progress * chars.length);
      
      displayText = chars.map((char, i) => {
        if (i < revealed) return char;
        if (char === ' ') return ' ';
        return getRandomChar(CHARS_ENCHANT);
      }).join('');
      
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        displayText = targetText;
      }
    }
    
    animationFrame = requestAnimationFrame(animate);
  }
  
  function animateTypewriter(targetText: string, duration: number): void {
    const startTime = performance.now();
    const chars = [...targetText];
    animationClass = 'typewriter';
    
    function animate() {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const show = Math.floor(progress * chars.length);
      
      displayText = chars.slice(0, show).join('');
      
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        displayText = targetText;
        animationClass = '';
      }
    }
    
    animationFrame = requestAnimationFrame(animate);
  }
  
  function animateGlitch(targetText: string, duration: number): void {
    const startTime = performance.now();
    const chars = [...targetText];
    animationClass = 'glitch';
    
    function animate() {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const glitchChance = 1.0 - progress;
      
      displayText = chars.map((char) => {
        if (char === ' ') return ' ';
        if (Math.random() < glitchChance * 0.7) {
          return getRandomChar(CHARS_GLITCH);
        }
        return char;
      }).join('');
      
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        displayText = targetText;
        animationClass = '';
      }
    }
    
    animationFrame = requestAnimationFrame(animate);
  }
  
  function animateScramble(targetText: string, duration: number): void {
    const startTime = performance.now();
    const chars = [...targetText];
    
    function animate() {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      if (progress >= 0.95) {
        displayText = targetText;
        return;
      }
      
      displayText = chars.map((char) => {
        if (char === ' ') return ' ';
        return getRandomChar(CHARS_ENCHANT);
      }).join('');
      
      animationFrame = requestAnimationFrame(animate);
    }
    
    animationFrame = requestAnimationFrame(animate);
  }
  
  function animateWave(targetText: string, duration: number): void {
    const startTime = performance.now();
    const chars = [...targetText];
    const waveWidth = 3;
    
    function animate() {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const center = progress * (chars.length + waveWidth);
      
      displayText = chars.map((char, i) => {
        const dist = Math.abs(i - center);
        if (dist < waveWidth && char !== ' ') {
          return getRandomChar(CHARS_ENCHANT);
        }
        if (i < center - waveWidth) {
          return char;
        }
        return ' ';
      }).join('');
      
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        displayText = targetText;
      }
    }
    
    animationFrame = requestAnimationFrame(animate);
  }
  
  function animateFade(targetText: string, duration: number): void {
    animationClass = 'fade-out';
    
    setTimeout(() => {
      displayText = targetText;
      animationClass = 'fade-in';
      
      setTimeout(() => {
        animationClass = '';
      }, duration / 2);
    }, duration / 2);
  }
  
  function animateSlide(targetText: string, duration: number, direction: string): void {
    animationClass = `slide-out-${direction}`;
    
    setTimeout(() => {
      displayText = targetText;
      animationClass = '';
    }, duration / 2);
  }
  
  function animatePop(targetText: string, duration: number): void {
    animationClass = 'scale-out';
    
    setTimeout(() => {
      displayText = targetText;
      animationClass = 'pop-in';
      
      setTimeout(() => {
        animationClass = '';
      }, duration);
    }, 100);
  }
  
  function applyStyles(styles: any): void {
    if (!styles) return;
    
    // Color
    customColor = styles.color || '';
    
    // Font properties
    customFont = styles.fontFamily || '';
    customSize = styles.fontSize || '';
    customWeight = styles.fontWeight || '';
    customFontStyle = styles.fontStyle || '';
    
    // Text alignment
    customAlign = styles.textAlign || 'center';
    
    // Spacing
    customLetterSpacing = (styles.letterSpacing && styles.letterSpacing !== 'normal') 
      ? styles.letterSpacing : '';
    customLineHeight = styles.lineHeight || '';
    
    // Transform
    customTextTransform = (styles.textTransform && styles.textTransform !== 'none') 
      ? styles.textTransform : '';
    
    // Shadow
    customShadow = styles.shadow || '';
    
    // Stroke - combine width and color into webkit-text-stroke format
    if (styles.strokeWidth && styles.strokeWidth !== '0' && styles.strokeWidth !== '0px') {
      const strokeColor = styles.strokeColor || '#000000';
      customStroke = `${styles.strokeWidth} ${strokeColor}`;
    } else {
      customStroke = '';
    }
  }
</script>

<main class="text-cycler-display" class:debug class:preview-mode={previewMode}>
  <p 
    class="text-display {animationClass}" 
    style="
      font-size: {customSize};
      font-weight: {customWeight};
      color: {customColor};
      font-family: {customFont};
      text-shadow: {customShadow};
      text-align: {customAlign};
      letter-spacing: {customLetterSpacing};
      line-height: {customLineHeight};
      text-transform: {customTextTransform};
      font-style: {customFontStyle};
      -webkit-text-stroke: {customStroke};
    "
  >
    {displayText}
  </p>
  {#if !previewMode}
    <small class="status">{statusText}</small>
  {/if}
</main>

<style>
  .text-cycler-display {
    /* Full viewport layout without position: fixed */
    width: 100vw;
    height: 100vh;
    min-height: 100vh;
    /* Dark background for visibility - OBS can use color key or custom CSS to make transparent */
    background: #000000;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    margin: 0;
    padding: 20px;
    box-sizing: border-box;
  }
  
  /* Preview mode - embedded in parent container */
  .text-cycler-display.preview-mode {
    width: 100%;
    height: 200px;
    min-height: 200px;
    max-height: 200px;
    border-radius: 6px;
  }
  
  .text-display {
    /* Reset paragraph margins */
    margin: 0;
    /* Styles applied inline for dynamic customization */
    white-space: pre-wrap;
    word-wrap: break-word;
    width: 100%;
    
    /* Animation base */
    opacity: 1;
    transform: translateY(0) scale(1);
    transition: opacity 500ms ease, transform 500ms ease;
  }
  
  /* Fade animation */
  .text-display.fade-out {
    opacity: 0;
  }
  
  .text-display.fade-in {
    opacity: 1;
  }
  
  /* Slide animations */
  .text-display.slide-out-left {
    opacity: 0;
    transform: translateX(-100px);
  }
  
  .text-display.slide-out-right {
    opacity: 0;
    transform: translateX(100px);
  }
  
  .text-display.slide-out-up {
    opacity: 0;
    transform: translateY(-50px);
  }
  
  .text-display.slide-out-down {
    opacity: 0;
    transform: translateY(50px);
  }
  
  /* Scale animations */
  .text-display.scale-out {
    opacity: 0;
    transform: scale(0.5);
  }
  
  .text-display.scale-in {
    opacity: 1;
    transform: scale(1);
  }
  
  /* Pop animation */
  .text-display.pop-in {
    animation: popIn 500ms cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }
  
  @keyframes popIn {
    0% { opacity: 0; transform: scale(0.3); }
    50% { transform: scale(1.1); }
    100% { opacity: 1; transform: scale(1); }
  }
  
  /* Typewriter cursor */
  .text-display.typewriter::after {
    content: '|';
    animation: blink 0.7s infinite;
  }
  
  @keyframes blink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0; }
  }
  
  /* Glitch effect */
  .text-display.glitch {
    animation: glitch 0.1s infinite;
  }
  
  @keyframes glitch {
    0% { transform: translate(0); }
    20% { transform: translate(-2px, 2px); }
    40% { transform: translate(-2px, -2px); }
    60% { transform: translate(2px, 2px); }
    80% { transform: translate(2px, -2px); }
    100% { transform: translate(0); }
  }
  
  /* Status indicator */
  .status {
    position: fixed;
    bottom: 10px;
    right: 10px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.3);
    display: none;
  }
  
  .debug .status {
    display: block;
  }
</style>
