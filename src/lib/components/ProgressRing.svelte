<script lang="ts">
  /**
   * Progress Ring Component
   * 
   * Circular progress indicator with animated stroke.
   * Displays progress as a percentage in a circular ring format.
   * 
   * @example
   * <ProgressRing progress={75} size={60} />
   * 
   * @example
   * <ProgressRing 
   *   progress={50} 
   *   size={80} 
   *   color="var(--success)" 
   *   label="50%"
   * />
   */
  
  /** Progress value from 0 to 100 */
  export let progress: number = 0;
  
  /** Size of the ring in pixels */
  export let size: number = 60;
  
  /** Stroke width in pixels */
  export let strokeWidth: number = 6;
  
  /** Color of the progress ring (CSS variable or color value) */
  export let color: string = 'var(--accent)';
  
  /** Whether to show the progress label */
  export let showLabel: boolean = true;
  
  /** Custom label text (overrides default percentage) */
  export let label: string | null = null;
  
  $: circumference = 2 * Math.PI * ((size - strokeWidth) / 2);
  $: offset = circumference - (progress / 100) * circumference;
  
  // import ComponentDocsButton from './ComponentDocsButton.svelte';
</script>

<div class="progress-ring-wrapper" style="position: relative; display: inline-block;">
  <!-- <ComponentDocsButton componentName="ProgressRing" position="top-right" size="small" /> -->
  <div class="progress-ring" style="width: {size}px; height: {size}px;">
  <svg class="progress-ring__svg" width={size} height={size}>
    <circle
      class="progress-ring__circle-bg"
      cx={size / 2}
      cy={size / 2}
      r={(size - strokeWidth) / 2}
      fill="none"
      stroke="var(--border)"
      stroke-width={strokeWidth}
    />
    <circle
      class="progress-ring__circle"
      cx={size / 2}
      cy={size / 2}
      r={(size - strokeWidth) / 2}
      fill="none"
      stroke={color}
      stroke-width={strokeWidth}
      stroke-dasharray={circumference}
      stroke-dashoffset={offset}
      stroke-linecap="round"
      transform={`rotate(-90 ${size / 2} ${size / 2})`}
    />
  </svg>
  {#if showLabel}
    <div class="progress-ring__label">
      {label ?? `${Math.round(progress)}%`}
    </div>
  {/if}
  </div>
</div>

<style lang="scss">
  @use '@styles/animations' as *;
  
  .progress-ring {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    @include gpu-accelerated;
  }
  
  .progress-ring__svg {
    transform: rotate(-90deg);
  }
  
  .progress-ring__circle {
    transition: stroke-dashoffset 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .progress-ring__label {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 0.75em;
    font-weight: 700;
    color: var(--text);
    text-align: center;
  }
</style>

