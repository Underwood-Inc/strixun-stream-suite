<script lang="ts">
  import { onMount } from 'svelte';
  import { getNavRoutes, type AppRoute } from '../../router/routes';
  import { navigate } from '../../router';
  import { uiFlags, isNavRouteVisible } from '../../stores/ui-feature-flags';

  export let enabled = true;

  let open = false;
  let query = '';

  $: routes = getNavRoutes().filter(
    (r) => r.showInNav && isNavRouteVisible(r, $uiFlags) && r.path !== '/login',
  );
  $: filtered = routes.filter((r) => r.label.toLowerCase().includes(query.trim().toLowerCase()));

  function close() {
    open = false;
    query = '';
  }

  function go(route: AppRoute) {
    navigate(route.path);
    close();
  }

  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!enabled) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        open = !open;
      }
      if (e.key === 'Escape' && open) {
        close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
</script>

{#if enabled && open}
  <button type="button" class="cmdk-backdrop" aria-label="Close command palette" onclick={close}></button>
  <div class="cmdk" role="dialog" aria-label="Command palette">
    <input
      class="cmdk__input"
      type="search"
      placeholder="Jump to page…"
      bind:value={query}
      autofocus
    />
    <ul class="cmdk__list">
      {#each filtered as route (route.path)}
        <li>
          <button type="button" class="cmdk__item" onclick={() => go(route)}>
            {route.label}
            <span class="cmdk__path">{route.path}</span>
          </button>
        </li>
      {/each}
      {#if filtered.length === 0}
        <li class="cmdk__empty">No matches</li>
      {/if}
    </ul>
  </div>
{/if}

<style lang="scss">
  .cmdk-backdrop {
    position: fixed;
    inset: 0;
    z-index: 2000;
    background: rgba(0, 0, 0, 0.5);
    border: none;
    cursor: pointer;
  }
  .cmdk {
    position: fixed;
    z-index: 2001;
    top: 15vh;
    left: 50%;
    transform: translateX(-50%);
    width: min(480px, 92vw);
    background: var(--bg-secondary, #1e1e1e);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.45);
    padding: 0.75rem;
  }
  .cmdk__input {
    width: 100%;
    box-sizing: border-box;
    padding: 0.5rem 0.75rem;
    margin-bottom: 0.5rem;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: rgba(0, 0, 0, 0.25);
    color: inherit;
  }
  .cmdk__list {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 50vh;
    overflow: auto;
  }
  .cmdk__item {
    width: 100%;
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.5rem 0.35rem;
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    text-align: left;
    border-radius: 4px;
  }
  .cmdk__item:hover {
    background: rgba(255, 255, 255, 0.08);
  }
  .cmdk__path {
    opacity: 0.6;
    font-size: 0.85rem;
  }
  .cmdk__empty {
    padding: 0.75rem;
    opacity: 0.7;
  }
</style>