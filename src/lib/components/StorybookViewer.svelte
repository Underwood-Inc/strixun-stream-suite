<script lang="ts">
  /**
   * Storybook Viewer Component
   * 
   * Displays Storybook pages in an iframe overlay within the OBS dock.
   * Default behavior: Shows Storybook in iframe overlay (stays in dock)
   * Option: Open in new tab (via button)
   * 
   * @example
   * <StorybookViewer 
   *   componentName="SearchBox"
   *   open={showStorybook}
   *   onClose={() => showStorybook = false}
   * />
   */
  
  import { onMount, onDestroy } from 'svelte';
  import { animate } from '../../core/animations';
  
  // Portal action to render overlay at body level
  function portal(node: HTMLElement, target: HTMLElement) {
    target.appendChild(node);
    return {
      update(newTarget: HTMLElement) {
        if (newTarget !== target) {
          newTarget.appendChild(node);
          target = newTarget;
        }
      },
      destroy() {
        if (node.parentNode) {
          node.parentNode.removeChild(node);
        }
      }
    };
  }
  
  export let componentName: string;
  export let open: boolean = false;
  export let onClose: () => void;
  
  // Get Storybook base URL from config or environment
  function getStorybookUrl(): string {
    if (typeof window !== 'undefined') {
      // Try to get from STRIXUN_CONFIG
      const config = (window as any).STRIXUN_CONFIG;
      if (config?.STORYBOOK_URL) {
        return config.STORYBOOK_URL;
      }
      
      // Try to get from GITHUB_PAGES_URL and construct Storybook URL
      if (config?.GITHUB_PAGES_URL) {
        const pagesUrl = config.GITHUB_PAGES_URL;
        // Ensure trailing slash
        const baseUrl = pagesUrl.endsWith('/') ? pagesUrl : `${pagesUrl}/`;
        return `${baseUrl}storybook/`;
      }
      
      // Fallback: construct from current location
      const currentUrl = window.location.href;
      const baseUrl = currentUrl.split('/').slice(0, -1).join('/');
      return `${baseUrl}/storybook/`;
    }
    return '/storybook/';
  }
  
  // Construct Storybook URL for the component
  $: storybookUrl = (() => {
    const base = getStorybookUrl();
    // Storybook URL format: base + ?path=/story/Components-ComponentName--Default
    // Story title format: "Components/SearchBox" -> path: "components-searchbox--default"
    // Convert component name to lowercase: SearchBox -> searchbox
    const storyName = componentName.toLowerCase();
    const storyPath = `/story/components-${storyName}--default`;
    return `${base}?path=${encodeURIComponent(storyPath)}`;
  })();
  
  let overlayElement: HTMLDivElement;
  let iframeElement: HTMLIFrameElement;
  let portalContainer: HTMLDivElement | null = null;
  
  function handleClose(): void {
    if (onClose) {
      onClose();
    }
  }
  
  function handleOpenInNewTab(): void {
    window.open(storybookUrl, '_blank', 'noopener,noreferrer');
  }
  
  function handleEscape(e: KeyboardEvent): void {
    if (e.key === 'Escape' && open) {
      handleClose();
    }
  }
  
  onMount(() => {
    // Create portal container at body level
    portalContainer = document.createElement('div');
    portalContainer.id = 'storybook-viewer-portal';
    document.body.appendChild(portalContainer);
    
    // Add escape key listener
    window.addEventListener('keydown', handleEscape);
  });
  
  onDestroy(() => {
    // Remove portal container
    if (portalContainer && portalContainer.parentNode) {
      portalContainer.parentNode.removeChild(portalContainer);
      portalContainer = null;
    }
    
    // Remove escape key listener
    window.removeEventListener('keydown', handleEscape);
  });
</script>

{#if open && portalContainer}
  <div 
    class="storybook-viewer-overlay"
    bind:this={overlayElement}
    use:portal={portalContainer}
    use:animate={{
      preset: 'fadeIn',
      duration: 200,
      easing: 'easeOutCubic',
      id: 'storybook-viewer-overlay',
      trigger: 'mount'
    }}
    on:click={(e) => {
      // Close on overlay click (but not on iframe click)
      if (e.target === overlayElement) {
        handleClose();
      }
    }}
  >
    <div 
      class="storybook-viewer-container"
      use:animate={{
        preset: 'slideUp',
        duration: 300,
        easing: 'easeOutCubic',
        id: 'storybook-viewer-container',
        trigger: 'mount'
      }}
    >
      <div class="storybook-viewer-header">
        <div class="storybook-viewer-title">
          <span class="storybook-viewer-icon">📚</span>
          <span>Storybook: {componentName}</span>
        </div>
        <div class="storybook-viewer-actions">
          <button
            class="storybook-viewer-btn storybook-viewer-btn--secondary"
            on:click={handleOpenInNewTab}
            title="Open in new tab"
          >
            <span>🔗</span>
            <span>Open in Tab</span>
          </button>
          <button
            class="storybook-viewer-btn storybook-viewer-btn--close"
            on:click={handleClose}
            title="Close (Esc)"
          >
            ❓
          </button>
        </div>
      </div>
      
      <div class="storybook-viewer-content">
        <iframe
          bind:this={iframeElement}
          src={storybookUrl}
          class="storybook-viewer-iframe"
          title={`Storybook: ${componentName}`}
          allow="fullscreen"
        />
      </div>
    </div>
  </div>
{/if}

<style lang="scss">
  @use '@styles/animations' as *;
  
  .storybook-viewer-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.85);
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    @include gpu-accelerated;
  }
  
  .storybook-viewer-container {
    width: 100%;
    height: 100%;
    max-width: 1400px;
    max-height: 90vh;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    @include gpu-accelerated;
  }
  
  .storybook-viewer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-dark);
    flex-shrink: 0;
  }
  
  .storybook-viewer-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 600;
    color: var(--text);
  }
  
  .storybook-viewer-icon {
    font-size: 20px;
  }
  
  .storybook-viewer-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .storybook-viewer-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text);
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
    @include gpu-accelerated;
    
    &:hover {
      background: var(--bg);
      border-color: var(--accent);
      color: var(--accent);
    }
    
    &:active {
      transform: scale(0.98);
    }
  }
  
  .storybook-viewer-btn--secondary {
    background: transparent;
    
    &:hover {
      background: var(--bg-secondary);
    }
  }
  
  .storybook-viewer-btn--close {
    padding: 8px;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    line-height: 1;
  }
  
  .storybook-viewer-content {
    flex: 1;
    position: relative;
    overflow: hidden;
    background: var(--bg);
  }
  
  .storybook-viewer-iframe {
    width: 100%;
    height: 100%;
    border: none;
    display: block;
  }
</style>

