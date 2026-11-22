<script lang="ts">
  import ActivityLog from './ActivityLog.svelte';
  import { uiFlags } from '../../stores/ui-feature-flags';

  export let open = false;
  export let onClose: () => void = () => {};

  $: show = open && $uiFlags.logDrawer && !$uiFlags.activityLog;
</script>

{#if show}
  <button type="button" class="log-drawer-backdrop" aria-label="Close log drawer" onclick={onClose}></button>
  <aside class="log-drawer" aria-label="Activity log">
    <header class="log-drawer__header">
      <span>Activity log</span>
      <button type="button" class="log-drawer__close" onclick={onClose}>Close</button>
    </header>
    <div class="log-drawer__body">
      <ActivityLog />
    </div>
  </aside>
{/if}

<style lang="scss">
  .log-drawer-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1200;
    background: rgba(0, 0, 0, 0.45);
    border: none;
    cursor: pointer;
  }
  .log-drawer {
    position: fixed;
    top: 0;
    right: 0;
    z-index: 1201;
    width: min(420px, 100vw);
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--bg-secondary, #1a1a1a);
    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.35);
  }
  .log-drawer__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    font-weight: 600;
  }
  .log-drawer__close {
    cursor: pointer;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: inherit;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
  }
  .log-drawer__body {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
</style>