<script lang="ts">
  /**
   * Strixun Stream Suite - Root Component
   * 
   * Main application component that orchestrates all pages
   */
  
  import { ActivityLog, FloatingPanel, Header, InfoBar, Navigation, Sidebar, ToastContainer } from '@components';
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
  
  import { animate } from './core/animations';
  import { initAnimationPreferences } from './core/animations/store';
  import { initializeApp } from './modules/bootstrap';
  import { currentPage } from './stores/navigation';
  
  let pageWrapper: HTMLDivElement;
  
  // Initialize app on mount
  onMount(async () => {
    try {
      await initializeApp();
      // Initialize animation preferences
      initAnimationPreferences();
    } catch (error) {
      console.error('[App] Failed to initialize:', error);
      // Still show the app even if initialization fails
    }
  });
</script>

<div class="app">
  <Header />
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
          {:else if $currentPage === 'setup'}
            <Setup />
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
    defaultExpanded={true}
    storageKey="ui_sidebar_panel"
  >
    <Sidebar />
  </FloatingPanel>
  
  <ToastContainer />
</div>

<style lang="scss">
  @use '@styles/main';
  @use '@styles/animations' as *;
  @use '@styles/mixins' as *;
  
  .page-wrapper {
    @include page-transition;
    @include gpu-accelerated;
  }
</style>

