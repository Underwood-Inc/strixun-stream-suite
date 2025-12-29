<script lang="ts">
  /**
   * Strixun Stream Suite - Root Component
   * 
   * Main application component that orchestrates all pages
   */
  
  import { ActivityLog, AuthScreen, DomInterferenceBanner, FloatingPanel, Header, InfoBar, Navigation, Sidebar, ThemeSettings, ToastContainer, TwitchAdCarousel } from '@components';
  import { onMount } from 'svelte';
  import Chat from './pages/Chat.svelte';
  import Dashboard from './pages/Dashboard.svelte';
  import Install from './pages/Install.svelte';
  import Layouts from './pages/Layouts.svelte';
  import Notes from './pages/Notes.svelte';
  import Scripts from './pages/Scripts.svelte';
  import Setup from './pages/Setup.svelte';
  import Sources from './pages/Sources.svelte';
  import Swaps from './pages/Swaps.svelte';
  import TextCycler from './pages/TextCycler.svelte';
  import UrlShortener from './pages/UrlShortener.svelte';
  
  import { animate } from './core/animations';
  import { initAnimationPreferences } from './core/animations/store';
  import { initializeApp, completeInitializationAfterAuth } from './modules/bootstrap';
  import { authRequired, isAuthenticated } from './stores/auth';
  import { currentPage } from './stores/navigation';
  import { domInterferenceDetected } from './stores/dom-interference';
  import { themeSettingsVisible } from './stores/theme-settings';
  
  let hasCompletedPostAuthInit = false;
  
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
    // Only trigger if authenticated, not already completed, and auth is no longer required
    if ($isAuthenticated && !hasCompletedPostAuthInit && !$authRequired) {
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

{#if $authRequired}
  <AuthScreen />
  <!-- ActivityLog must be rendered even during auth so logs can be displayed -->
  <div class="split-container auth-only">
    <div class="split-divider" id="logDivider"></div>
    <ActivityLog />
  </div>
{:else}
<div class="app" class:app--restricted={$domInterferenceDetected}>
  <Header />
  <DomInterferenceBanner />
  <InfoBar />
  <Navigation />
  
  <div class="split-container">
    <main class="split-main content">
      {#key $currentPage}
        <div 
          class="page-wrapper" 
          bind:this={pageWrapper}
          use:animate={{
            preset: 'fadeIn',
            duration: 250,
            easing: 'easeOutCubic',
            id: 'page-transition',
            trigger: 'mount'
          }}
        >
          {#if $domInterferenceDetected}
            {#if $currentPage === 'dashboard'}
              <Dashboard />
            {:else if $currentPage === 'notes'}
              <Notes />
            {:else if $currentPage === 'scripts'}
              <Scripts />
            {:else if $currentPage === 'install'}
              <Install />
            {:else if $currentPage === 'setup'}
              <Setup />
            {:else}
              <!-- Redirect to dashboard when interference detected and trying to access restricted pages -->
              <Dashboard />
            {/if}
          {:else}
            {#if $currentPage === 'dashboard'}
              <Dashboard />
            {:else if $currentPage === 'sources'}
              <Sources />
            {:else if $currentPage === 'text'}
              <TextCycler />
            {:else if $currentPage === 'swaps'}
              <Swaps />
            {:else if $currentPage === 'layouts'}
              <Layouts />
            {:else if $currentPage === 'notes'}
              <Notes />
            {:else if $currentPage === 'chat'}
              <Chat />
            {:else if $currentPage === 'scripts'}
              <Scripts />
            {:else if $currentPage === 'install'}
              <Install />
            {:else if $currentPage === 'url-shortener'}
              <UrlShortener />
            {:else if $currentPage === 'setup'}
              <Setup />
            {/if}
          {/if}
        </div>
      {/key}
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
  
  .page-wrapper {
    @include page-transition;
    @include gpu-accelerated;
  }
  
  .split-container.auth-only {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 300px;
    z-index: 1000;
  }
  
  .app--restricted {
    .split-main {
      opacity: 0.6;
      pointer-events: none;
      user-select: none;
    }
    
    .split-main .page-wrapper {
      filter: blur(2px);
    }
  }
</style>

