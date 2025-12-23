<script lang="ts">
  /**
   * Strixun Stream Suite - Root Component
   * 
   * Main application component that orchestrates all pages
   */
  
  import { onMount } from 'svelte';
  import { Header, InfoBar, Navigation } from '@components';
  import Dashboard from './pages/Dashboard.svelte';
  import Sources from './pages/Sources.svelte';
  import TextCycler from './pages/TextCycler.svelte';
  import Swaps from './pages/Swaps.svelte';
  import Layouts from './pages/Layouts.svelte';
  import Notes from './pages/Notes.svelte';
  import Chat from './pages/Chat.svelte';
  import Scripts from './pages/Scripts.svelte';
  import Install from './pages/Install.svelte';
  import Setup from './pages/Setup.svelte';
  import { ActivityLog, ToastContainer, FloatingPanel, ModrinthProducts } from '@components';
  
  import { currentPage } from './stores/navigation';
  import { initializeApp } from './modules/bootstrap';
  import { animate } from './core/animations';
  import { initAnimationPreferences } from './core/animations/store';
  
  let pageKey = 0;
  let pageWrapper: HTMLDivElement;
  
  $: {
    // Force re-render on page change for transitions
    pageKey = $currentPage;
  }
  
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
      <div 
        class="page-wrapper" 
        key={pageKey}
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
    storageKey="ui_modrinth_panel"
  >
    <ModrinthProducts />
  </FloatingPanel>
  
  <ToastContainer />
</div>

<style lang="scss">
  @use '@styles/main';
  @use '@styles/animations' as *;
  
  .page-wrapper {
    @include page-transition;
    @include gpu-accelerated;
  }
</style>

