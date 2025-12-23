<script lang="ts">
  /**
   * Strixun Stream Suite - Root Component
   * 
   * Main application component that orchestrates all pages
   */
  
  import { onMount } from 'svelte';
  import Header from './components/Header.svelte';
  import InfoBar from './components/InfoBar.svelte';
  import Navigation from './components/Navigation.svelte';
  import Dashboard from './pages/Dashboard.svelte';
  import Sources from './pages/Sources.svelte';
  import TextCycler from './pages/TextCycler.svelte';
  import Swaps from './pages/Swaps.svelte';
  import Layouts from './pages/Layouts.svelte';
  import Notes from './pages/Notes.svelte';
  import Scripts from './pages/Scripts.svelte';
  import Install from './pages/Install.svelte';
  import Setup from './pages/Setup.svelte';
  import ActivityLog from './components/ActivityLog.svelte';
  import ToastContainer from './components/ui/ToastContainer.svelte';
  
  import { currentPage } from './stores/navigation';
  import { initializeApp } from './modules/bootstrap';
  
  let pageKey = 0;
  
  $: {
    // Force re-render on page change for transitions
    pageKey = $currentPage;
  }
  
  // Initialize app on mount
  onMount(async () => {
    try {
      await initializeApp();
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
      <div class="page-wrapper" key={pageKey}>
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

