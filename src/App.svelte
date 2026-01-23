<script lang="ts">
  /**
   * Strixun Stream Suite - Root Component
   * 
   * Main application component that orchestrates all pages via the Router.
   * The router handles auth guards, route protection, and page rendering.
   */
  
  import { ActivityLog, DomInterferenceBanner, FloatingPanel, Header, InfoBar, Navigation, Sidebar, ThemeSettings, ToastContainer, TwitchAdCarousel } from '@components';
  import { onMount } from 'svelte';
  
  import { initAnimationPreferences } from './core/animations/store';
  import { initializeApp, completeInitializationAfterAuth } from './modules/bootstrap';
  import { isAuthenticated, authCheckComplete } from './stores/auth';
  import { domInterferenceDetected } from './stores/dom-interference';
  import { themeSettingsVisible } from './stores/theme-settings';
  
  // Router
  import Router from './router/Router.svelte';
  import { currentPath } from './router';
  import { isDisplayRoute } from './router/routes';
  
  let hasCompletedPostAuthInit = false;
  
  // Check if current route should render without app chrome
  // This includes login page and display routes (OBS browser sources)
  $: isLoginPage = $currentPath === '/login';
  $: isDisplayPage = isDisplayRoute($currentPath);
  $: shouldHideChrome = isLoginPage || isDisplayPage;
  
  // Initialize app on mount
  onMount(async () => {
    try {
      await initializeApp();
      // Initialize animation preferences
      initAnimationPreferences();
    } catch (error) {
      // Log error - use store if available
      if (typeof window !== 'undefined' && (window as any).addLogEntry) {
        (window as any).addLogEntry(`Failed to initialize: ${error instanceof Error ? error.message : String(error)}`, 'error', 'ERROR');
      }
      // Still show the app even if initialization fails
    }
  });
  
  // Watch for auth state changes - complete initialization when user authenticates
  $: {
    // Only trigger if authenticated, not already completed, and auth check is done
    if ($isAuthenticated && !hasCompletedPostAuthInit && $authCheckComplete) {
      // Set flag immediately to prevent duplicate calls
      hasCompletedPostAuthInit = true;
      // Call asynchronously to avoid blocking reactive updates
      Promise.resolve().then(() => {
        completeInitializationAfterAuth().catch(error => {
          // Reset flag on error so it can retry
          hasCompletedPostAuthInit = false;
          if (typeof window !== 'undefined' && (window as any).addLogEntry) {
            (window as any).addLogEntry(`Failed to complete post-auth initialization: ${error instanceof Error ? error.message : String(error)}`, 'error', 'ERROR');
          }
        });
      });
    }
  }
</script>

{#if shouldHideChrome}
  <!-- Login page or display routes: full-screen, no app chrome -->
  <Router />
{:else}
  <!-- Main app layout with full chrome -->
  <div class="app" class:app--restricted={$domInterferenceDetected}>
    <Header />
    <DomInterferenceBanner />
    <InfoBar />
    <Navigation />
    
    <div class="split-container">
      <main class="split-main content">
        <Router />
      </main>
      
      <div class="split-divider" id="logDivider"></div>
      <ActivityLog />
    </div>
    
    <FloatingPanel
      position="left"
      collapsedWidth={40}
      expandedWidth={320}
      minWidth={200}
      maxWidth={500}
      defaultExpanded={false}
      storageKey="ui_sidebar_panel"
    >
      <Sidebar />
    </FloatingPanel>
    
    <ToastContainer />
    
    <TwitchAdCarousel
      position="bottom-right"
      supportUrl="https://www.twitch.tv/strixun"
      storageKey="ui_main_ad_carousel_state"
    />
    
    <ThemeSettings
      visible={$themeSettingsVisible}
      onClose={() => themeSettingsVisible.set(false)}
    />
  </div>
{/if}

<style lang="scss">
  @use '@styles/main';
  @use '@styles/animations' as *;
  @use '@styles/mixins' as *;
  
  .app--restricted {
    .split-main {
      opacity: 0.6;
      pointer-events: none;
      user-select: none;
    }
    
    .split-main :global(.router-view) {
      filter: blur(2px);
    }
  }
</style>
