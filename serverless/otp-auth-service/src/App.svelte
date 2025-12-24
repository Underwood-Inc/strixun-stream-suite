<script lang="ts">
  import { onMount } from 'svelte';
  import LandingPage from './pages/LandingPage.svelte';
  import DashboardApp from './pages/DashboardApp.svelte';

  // Simple routing based on pathname
  let currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';
  
  onMount(() => {
    // Update path on navigation
    const updatePath = () => {
      currentPath = window.location.pathname;
    };
    
    window.addEventListener('popstate', updatePath);
    
    // Smooth scroll for anchor links (only on landing page)
    if (currentPath === '/' || currentPath === '') {
      document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
          e.preventDefault();
          const target = document.querySelector(this.getAttribute('href') || '');
          if (target) {
            target.scrollIntoView({
              behavior: 'smooth',
              block: 'start'
            });
          }
        });
      });
    }
    
    return () => {
      window.removeEventListener('popstate', updatePath);
    };
  });
</script>

{#if currentPath.startsWith('/dashboard')}
  <DashboardApp />
{:else}
  <LandingPage />
{/if}

<style>
  main {
    min-height: 100vh;
  }
</style>
