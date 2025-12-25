<script lang="ts">
  /**
   * Card Component
   * 
   * A simple, composable card component for displaying content.
   * Highly reusable and unopinionated - accepts any content via slots.
   * 
   * @example
   * ```svelte
   * <Card>
   *   <h3>Card Title</h3>
   *   <p>Card content goes here</p>
   * </Card>
   * ```
   */

  export let className: string = '';
  export let clickable: boolean = false;
  export let onCardClick: (() => void) | undefined = undefined;

  function handleClick(): void {
    if (clickable && onCardClick) {
      onCardClick();
    }
  }
</script>

<div
  class="card {className}"
  class:card--clickable={clickable}
  role={clickable ? 'button' : undefined}
  tabindex={clickable ? 0 : undefined}
  on:click={handleClick}
  on:keydown={(e) => {
    if (clickable && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      handleClick();
    }
  }}
>
  <slot />
</div>

<style lang="scss">
  @use '@styles/mixins' as *;
  @use '@styles/animations' as *;

  .card {
    @include card;
    transition: border-color 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1), background-image 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    height: 100%;
    max-height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .card--clickable {
    cursor: pointer;
    
    &:hover {
      border-color: var(--accent);
      box-shadow: 0 2px 12px rgba(237, 174, 73, 0.25);
      // Subtle pulsing glow animation
      @include card-hover-pattern;
      // No transform to prevent content shift
    }

    &:active {
      box-shadow: 0 1px 6px rgba(237, 174, 73, 0.2);
      // No animation on active, just static shadow
      // No transform to prevent content shift
    }

    &:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
  }
</style>

