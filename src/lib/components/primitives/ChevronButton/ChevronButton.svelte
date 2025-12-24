<script lang="ts">
  /**
   * ChevronButton Component
   * 
   * A shared chevron button component with SVG chevron that matches header icon buttons.
   * Chevron becomes blocky/chunky on hover to match the aesthetic.
   * 
   * @example
   * ```svelte
   * <ChevronButton
   *   direction="left"
   *   onClick={handleClick}
   *   ariaLabel="Collapse panel"
   * />
   * ```
   */

  interface Props {
    /** Direction of the chevron: 'left', 'right', 'up', 'down' */
    direction?: 'left' | 'right' | 'up' | 'down';
    /** Click handler function */
    onClick?: () => void;
    /** ARIA label for accessibility */
    ariaLabel?: string;
    /** Additional CSS classes */
    className?: string;
    /** Size variant: 'small' for floating panel, 'default' for activity log */
    size?: 'small' | 'default';
  }

  let {
    direction = 'left',
    onClick,
    ariaLabel,
    className = '',
    size = 'default'
  }: Props = $props();

  function getRotation(): number {
    switch (direction) {
      case 'left':
        return 0;
      case 'right':
        return 180;
      case 'up':
        return 90;
      case 'down':
        return 270;
      default:
        return 0;
    }
  }

  function handleClick(): void {
    if (onClick) {
      onClick();
    }
  }
</script>

<button
  class="chevron-button chevron-button--{size} {className}"
  on:click={handleClick}
  aria-label={ariaLabel}
  type="button"
>
  <svg
    width={size === 'small' ? '14' : '16'}
    height={size === 'small' ? '14' : '16'}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="square"
    stroke-linejoin="miter"
    class="chevron-svg"
    style="transform: rotate({getRotation()}deg);"
  >
    <path d="M10 4 L6 8 L10 12" />
  </svg>
</button>

<style lang="scss">
  @use '@styles/animations' as *;
  
  :global(.chevron-button) {
    background: transparent;
    border: 2px solid var(--border);
    color: var(--text);
    border-radius: 0;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all 0.1s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 2px 0 var(--border);
    position: relative;
    overflow: hidden;
    
    @include ripple-effect(rgba(255, 255, 255, 0.2));
    
    .chevron-svg {
      display: block;
      transition: all 0.1s cubic-bezier(0.4, 0, 0.2, 1);
      transform-origin: center;
    }
    
    &:hover {
      background: var(--border);
      color: var(--text);
      transform: translateY(-1px);
      box-shadow: 0 3px 0 var(--border);
      
      .chevron-svg {
        stroke-width: 3;
        stroke-linecap: butt;
        stroke-linejoin: miter;
        filter: drop-shadow(0 0 1px currentColor);
      }
    }
    
    &:active {
      transform: translateY(1px);
      box-shadow: 0 1px 0 var(--border);
    }
  }
  
  :global(.chevron-button--default) {
    padding: 0 10px;
    min-width: 32px;
    min-height: 32px;
  }
  
  :global(.chevron-button--small) {
    padding: 0 8px;
    min-width: 30px;
    min-height: 30px;
  }
</style>

