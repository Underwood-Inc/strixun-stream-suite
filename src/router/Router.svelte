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
    currentRoute, 
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
  import UrlShortener from '../pages/UrlShortener.svelte';
  import Setup from '../pages/Setup.svelte';
  
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
    '/url-shortener': UrlShortener,
    '/setup': Setup
  };
  
  // Track previous path for animations
  let previousPath = '';
  
  // Initialize router on mount
  onMount(() => {
    // Register routes first
    registerRoutes(getRouteDefinitions());
    
    // Then initialize
    initRouter();
  });
  
  // Cleanup on destroy
  onDestroy(() => {
    destroyRouter();
  });
  
  // Re-check route when auth state changes
  $: if ($authCheckComplete) {
    // Auth check completed, re-run guards
    recheckCurrentRoute();
  }
  
  // Track auth changes to re-run guards
  $: if ($routerReady && $authCheckComplete) {
    // When auth state changes after router is ready, recheck
    const _ = $isAuthenticated;
    recheckCurrentRoute();
  }
  
  // Get current component based on path
  $: currentComponent = componentMap[$currentPath] || Dashboard;
  
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
{:else}
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
