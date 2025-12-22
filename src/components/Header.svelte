<script lang="ts">
  /**
   * Header Component
   * 
   * Application header with status indicator and controls
   */
  
  import { onMount } from 'svelte';
  import { connected } from '../stores/connection';
  import { navigateTo } from '../stores/navigation';
  import { celebrateClick, celebrateConnection } from '../utils/particles';
  
  let statusClass = 'disconnected';
  let reloadButton: HTMLButtonElement;
  let connectButton: HTMLButtonElement;
  
  $: {
    if ($connected) {
      statusClass = 'connected';
    } else {
      statusClass = 'disconnected';
    }
  }
  
  // Celebrate connection when it changes to connected
  let wasConnected = false;
  $: {
    if ($connected && !wasConnected) {
      celebrateConnection();
    }
    wasConnected = $connected;
  }
  
  function handleReload(e: MouseEvent): void {
    celebrateClick(e.currentTarget as HTMLElement);
    setTimeout(() => location.reload(), 200);
  }
  
  function handleConnect(e: MouseEvent): void {
    celebrateClick(e.currentTarget as HTMLElement);
    navigateTo('setup');
  }
</script>

<header class="header">
  <h1>
    <span class="status-dot {statusClass}" id="statusDot"></span>
    <span class="title-text">Strixun's Stream Suite [SSS]</span>
  </h1>
  <div class="header-actions">
    <button class="btn-icon" bind:this={reloadButton} on:click={handleReload} title="Reload Panel">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
      </svg>
    </button>
    <button class="btn-primary" bind:this={connectButton} on:click={handleConnect} id="connectHeaderBtn">Connect</button>
  </div>
</header>

<style lang="scss">
  @use '../styles/animations' as *;
  
  .header {
    padding: 12px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--card);
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
    z-index: 100;
    
    h1 {
      font-size: 1.1em;
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 0;
    }
    
  .title-text {
    white-space: nowrap;
  }
  
  .header-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  
  .btn-icon {
    background: transparent;
    border: 2px solid var(--border);
    color: var(--text);
    padding: 8px 10px;
    border-radius: 0;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.1s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 2px 0 var(--border);
    position: relative;
    overflow: hidden;
    
    @include ripple-effect(rgba(255, 255, 255, 0.2));
    
    &:hover {
      background: var(--border);
      color: var(--text);
      transform: translateY(-1px);
      box-shadow: 0 3px 0 var(--border);
    }
    
    &:active {
      transform: translateY(1px);
      box-shadow: 0 1px 0 var(--border);
    }
    
    svg {
      display: block;
      transition: transform 0.2s;
    }
    
    &:hover svg {
      transform: rotate(90deg);
    }
  }
  
  .btn-primary {
    @include arcade-button(var(--accent), var(--accent-dark));
    padding: 8px 20px;
    font-size: 0.9em;
  }
}
  
  .status-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--danger);
    transition: all 0.3s ease;
    position: relative;
    
    &.connected {
      background: var(--success);
      @include glow(var(--success), 1);
      animation: float 3s ease-in-out infinite;
    }
    
    &.connecting {
      background: var(--warning);
      @include status-pulse(var(--warning));
    }
  }
</style>

