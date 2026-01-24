<script lang="ts">
  /**
   * Initialization Screen Component
   * 
   * Shows loading state with status messages during app initialization.
   * Provides clear feedback about what's happening so users aren't confused.
   */
  
  import { fade, fly } from 'svelte/transition';
  
  export let status: string = 'Initializing...';
  export let substatus: string = '';
  export let progress: number = 0; // 0-100
  export let isDisplay: boolean = false; // Minimal version for display routes
</script>

{#if isDisplay}
  <!-- Minimal loading for display routes (OBS browser sources) -->
  <div class="init-screen init-screen--display" transition:fade={{ duration: 200 }}>
    <div class="init-screen__spinner"></div>
    <p class="init-screen__status">{status}</p>
  </div>
{:else}
  <!-- Full loading screen for main app -->
  <div class="init-screen" transition:fade={{ duration: 300 }}>
    <div class="init-screen__container" in:fly={{ y: 20, duration: 400, delay: 100 }}>
      <div class="init-screen__logo">
        <span class="init-screen__logo-icon">⚡</span>
        <span class="init-screen__logo-text">Strixun Stream Suite</span>
      </div>
      
      <div class="init-screen__spinner-container">
        <div class="init-screen__spinner init-screen__spinner--large"></div>
      </div>
      
      <div class="init-screen__status-container">
        <p class="init-screen__status">{status}</p>
        {#if substatus}
          <p class="init-screen__substatus" transition:fade={{ duration: 150 }}>{substatus}</p>
        {/if}
      </div>
      
      {#if progress > 0}
        <div class="init-screen__progress" transition:fade={{ duration: 150 }}>
          <div class="init-screen__progress-bar" style="width: {progress}%"></div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style lang="scss">
  .init-screen {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg, #1a1611);
    z-index: 9999;
    
    &--display {
      background: transparent;
      flex-direction: column;
      gap: 16px;
    }
  }
  
  .init-screen__container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
    padding: 48px;
    background: var(--card, #252017);
    border-radius: 16px;
    border: 1px solid var(--border, #3d3627);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    min-width: 300px;
    max-width: 400px;
  }
  
  .init-screen__logo {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
  }
  
  .init-screen__logo-icon {
    font-size: 32px;
    color: var(--accent, #edae49);
    animation: pulse 2s ease-in-out infinite;
  }
  
  .init-screen__logo-text {
    font-size: 20px;
    font-weight: 600;
    color: var(--accent, #edae49);
    letter-spacing: 0.5px;
  }
  
  .init-screen__spinner-container {
    padding: 16px;
  }
  
  .init-screen__spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border, #3d3627);
    border-top-color: var(--accent, #edae49);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    
    &--large {
      width: 48px;
      height: 48px;
      border-width: 4px;
    }
  }
  
  .init-screen__status-container {
    text-align: center;
    min-height: 48px;
  }
  
  .init-screen__status {
    font-size: 16px;
    color: var(--text, #f9f9f9);
    margin: 0;
  }
  
  .init-screen__substatus {
    font-size: 13px;
    color: var(--muted, #888);
    margin: 8px 0 0;
  }
  
  .init-screen__progress {
    width: 100%;
    height: 4px;
    background: var(--border, #3d3627);
    border-radius: 2px;
    overflow: hidden;
  }
  
  .init-screen__progress-bar {
    height: 100%;
    background: linear-gradient(90deg, var(--accent-dark, #c68214), var(--accent, #edae49));
    border-radius: 2px;
    transition: width 0.3s ease-out;
  }
  
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.7;
      transform: scale(1.05);
    }
  }
</style>
