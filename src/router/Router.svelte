<script lang="ts">
  /**
   * Router Component
   * 
   * Main router component that handles route matching and renders
   * the appropriate page component based on the current hash route.
   * 
   * This component:
   * - Listens to route changes via the currentRoute store
   * - Dynamically renders the matched page component
   * - Shows loading state during navigation/guard checks
   * - Provides page transition animations
   */
  
  import { onMount, onDestroy } from 'svelte';
  import { 
    currentPath,
    isNavigating, 
    routerReady,
    initRouter,
    destroyRouter,
    registerRoutes,
    recheckCurrentRoute
  } from './index';
  import { getRouteDefinitions } from './routes';
  import { authCheckComplete, isAuthenticated } from '../stores/auth';
  import { animate } from '../core/animations';
  
  // Import all page components
  import Login from '../pages/Login.svelte';
  import Dashboard from '../pages/Dashboard.svelte';
  import Sources from '../pages/Sources.svelte';
  import TextCycler from '../pages/TextCycler.svelte';
  import TextCyclerDisplay from '../pages/TextCyclerDisplay.svelte';
  import Swaps from '../pages/Swaps.svelte';
  import Layouts from '../pages/Layouts.svelte';
  import Notes from '../pages/Notes.svelte';
  import Chat from '../pages/Chat.svelte';
  import Scripts from '../pages/Scripts.svelte';
  import Setup from '../pages/Setup.svelte';
  import type { Component } from 'svelte';

  /** Lazy-loaded so URL shortener workspace deps cannot brick the whole SPA on boot. */
  let UrlShortenerPage: Component | null = null;
  let urlShortenerLoadError: string | null = null;

  async function ensureUrlShortenerPage(): Promise<void> {
    if (UrlShortenerPage || urlShortenerLoadError) return;
    try {
      const mod = await import('../pages/UrlShortener.svelte');
      UrlShortenerPage = mod.default;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      urlShortenerLoadError = msg;
      console.error('[Router] Failed to load URL Shortener page:', err);
    }
  }

  $: if ($currentPath === '/url-shortener' && $routerReady) {
    void ensureUrlShortenerPage();
  }
  
  // Component map for dynamic rendering
  const componentMap: Record<string, typeof Login> = {
    '/login': Login,
    '/dashboard': Dashboard,
    '/sources': Sources,
    '/text-cycler': TextCycler,
    '/text-cycler-display': TextCyclerDisplay,
    '/swaps': Swaps,
    '/layouts': Layouts,
    '/notes': Notes,
    '/chat': Chat,
    '/scripts': Scripts,
    '/setup': Setup
  };
  
  // Track previous path for animations
  let previousPath = '';
  
  // Flag to prevent reactive blocks from running during initialization
  let hasInitialized = false;
  
  // Track previous auth state to detect actual changes
  let prevAuthComplete = false;
  let prevIsAuthenticated: boolean | undefined = undefined;
  
  // Initialize router on mount
  onMount(() => {
    // Register routes first
    registerRoutes(getRouteDefinitions());
    
    // Then initialize
    initRouter();
    
    // Mark as initialized AFTER initRouter completes
    hasInitialized = true;
  });
  
  // Cleanup on destroy
  onDestroy(() => {
    destroyRouter();
  });
  
  // Re-check route when auth state ACTUALLY CHANGES (not just on mount)
  // Only runs after initialization to prevent race conditions
  $: {
    if (hasInitialized && $routerReady) {
      // Check if auth state actually changed
      const authChanged = $authCheckComplete !== prevAuthComplete;
      const authStateChanged = $isAuthenticated !== prevIsAuthenticated;
      
      if (authChanged || authStateChanged) {
        console.log('[Router] Auth state changed, rechecking route:', { 
          authChanged, 
          authStateChanged,
          authComplete: $authCheckComplete,
          isAuthenticated: $isAuthenticated
        });
        prevAuthComplete = $authCheckComplete;
        prevIsAuthenticated = $isAuthenticated;
        recheckCurrentRoute();
      }
    }
  }
  
  // Get current component based on path - NEVER default to Dashboard for unknown paths
  // If path isn't in componentMap, show nothing (let guards redirect properly)
  $: currentComponent =
    $currentPath === '/url-shortener' ? UrlShortenerPage : componentMap[$currentPath] || null;
  
  // Track path changes for animation key
  $: {
    if ($currentPath !== previousPath) {
      previousPath = $currentPath;
    }
  }
</script>

{#if !$routerReady}
  <!-- Router initializing -->
  <div class="router-loading">
    <div class="router-loading__spinner"></div>
    <p>Loading...</p>
  </div>
{:else if $isNavigating}
  <!-- Navigation in progress (guards running) -->
  <div class="router-loading router-loading--navigating">
    <div class="router-loading__spinner"></div>
  </div>
{:else if $currentPath === '/url-shortener' && urlShortenerLoadError}
  <div class="router-loading" role="alert">
    <p>URL Shortener failed to load.</p>
    <p style="font-size: 0.85rem; opacity: 0.85;">{urlShortenerLoadError}</p>
  </div>
{:else if $currentPath === '/url-shortener' && !UrlShortenerPage}
  <div class="router-loading">
    <div class="router-loading__spinner"></div>
    <p>Loading URL Shortener…</p>
  </div>
{:else if currentComponent}
  <!-- Render matched route with transition -->
  {#key $currentPath}
    <div 
      class="router-view"
      use:animate={{
        preset: 'fadeIn',
        duration: 250,
        easing: 'easeOutCubic',
        id: 'route-transition',
        trigger: 'mount'
      }}
    >
      <svelte:component this={currentComponent} />
    </div>
  {/key}
{:else}
  <!-- Unknown route - show loading while redirect happens -->
  <div class="router-loading">
    <div class="router-loading__spinner"></div>
  </div>
{/if}

<style lang="scss">
  @use '@styles/animations' as *;
  @use '@styles/mixins' as *;
  
  .router-view {
    width: 100%;
    height: 100%;
    @include page-transition;
    @include gpu-accelerated;
  }
  
  .router-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 200px;
    gap: 16px;
    color: var(--text-secondary);
    
    &--navigating {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      min-height: auto;
      z-index: 100;
    }
  }
  
  .router-loading__spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
