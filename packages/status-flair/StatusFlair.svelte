<script lang="ts">
  /**
   * StatusFlair Component
   * 
   * A reusable component for displaying feature status indicators (WIP, In Testing, etc.)
   * Applies fancy visual flairs with striped backgrounds and appropriate styling.
   * 
   * The component acts as a transparent wrapper that applies status styling to its direct child.
   * 
   * @example
   * ```svelte
   * <StatusFlair status="wip">
   *   <button>Feature Button</button>
   * </StatusFlair>
   * 
   * <StatusFlair status="in-testing">
   *   <div class="card">Feature Card</div>
   * </StatusFlair>
   * ```
   */

  export let status: 'wip' | 'in-testing' | 'beta' | 'alpha' | 'experimental' | 'deprecated' | 'coming-soon' | 'super-admin' | null = null;
  export let className: string = '';
</script>

<div
  class="status-flair {className}"
  class:status-flair--wip={status === 'wip'}
  class:status-flair--in-testing={status === 'in-testing'}
  class:status-flair--beta={status === 'beta'}
  class:status-flair--alpha={status === 'alpha'}
  class:status-flair--experimental={status === 'experimental'}
  class:status-flair--deprecated={status === 'deprecated'}
  class:status-flair--coming-soon={status === 'coming-soon'}
  class:status-flair--super-admin={status === 'super-admin'}
>
  <slot />
</div>

<style lang="scss">
  @use '../shared-styles/mixins' as *;
  
  .status-flair {
    display: contents;
  }

  // Apply WIP state to direct child only
  .status-flair--wip :global(> *) {
    @include wip-state;
  }

  // Apply IN TESTING state to direct child only
  .status-flair--in-testing :global(> *) {
    @include in-testing-state;
  }

  // Apply BETA state to direct child only
  .status-flair--beta :global(> *) {
    @include beta-state;
  }

  // Apply ALPHA state to direct child only
  .status-flair--alpha :global(> *) {
    @include alpha-state;
  }

  // Apply EXPERIMENTAL state to direct child only
  .status-flair--experimental :global(> *) {
    @include experimental-state;
  }

  // Apply DEPRECATED state to direct child only
  .status-flair--deprecated :global(> *) {
    @include deprecated-state;
  }

  // Apply COMING SOON state to direct child only
  .status-flair--coming-soon :global(> *) {
    @include coming-soon-state;
  }

  // Apply SUPER ADMIN state to direct child only
  .status-flair--super-admin :global(> *) {
    @include super-admin-state;
    
    // Ensure disabled state preserves styling
    &:disabled {
      border-color: var(--warning) !important;
      background-image: repeating-linear-gradient(
        135deg,
        rgba(255, 193, 7, 0.08),
        rgba(255, 193, 7, 0.08) 6px,
        rgba(255, 193, 7, 0.12) 6px,
        rgba(255, 193, 7, 0.12) 12px
      ) !important;
      box-shadow: 0 2px 0 var(--warning) !important;
    }
  }
</style>

