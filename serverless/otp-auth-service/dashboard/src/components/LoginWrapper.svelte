<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  let container: HTMLDivElement;
  let root: any = null;

  onMount(async () => {
    if (container && typeof window !== 'undefined') {
      const React = await import('react');
      const { createRoot } = await import('react-dom/client');
      const Login = (await import('./Login.tsx')).default;
      root = createRoot(container);
      root.render(React.createElement(Login));
    }
  });

  onDestroy(() => {
    if (root) {
      root.unmount();
      root = null;
    }
  });
</script>

<div bind:this={container}></div>

<style>
  :global(.login-wrapper) {
    position: relative;
  }

  :global(.login-footer) {
    text-align: center;
    color: var(--text-secondary);
    font-size: 0.875rem;
    margin-top: var(--spacing-xl);
    padding: 0 var(--spacing-xl);
  }

  :global(.login-link) {
    background: none;
    border: none;
    color: var(--accent);
    cursor: pointer;
    text-decoration: underline;
    font-size: inherit;
    padding: 0;
    margin-left: var(--spacing-xs);
  }

  :global(.login-link:hover) {
    color: var(--accent-dark);
  }
</style>

