<script lang="ts">
  /**
   * ObfuscatedText Component
   * 
   * A reusable component for displaying obfuscated/scrambled text using Minecraft enchantment table style characters.
   * Perfect for hiding undecided values, redacting sensitive information, or creating mysterious text effects.
   * 
   * @example
   * ```svelte
   * <ObfuscatedText text="$99.99" />
   * <ObfuscatedText text="1,000 users" length={5} />
   * <ObfuscatedText text="Secret data" animate={false} />
   * ```
   */

  import { onMount, onDestroy } from 'svelte';

  // Character set from Minecraft enchantment table
  const CHARS_ENCHANT = 'ᔑᒷᓵᒷ⊣╎⋮ꖌꖎᒲリ𝙹ᑑ∷ᓭℸ∴⨅';

  export let text: string = ''; // Original text (used to determine length if length prop not provided)
  export let length: number | null = null; // Custom length override
  export let animate: boolean = true; // Whether to animate the scrambling
  export let className: string = ''; // Additional CSS classes

  let displayText: string = '';
  let animationFrame: number | null = null;
  let isAnimating: boolean = false;
  let measureElement: HTMLSpanElement;
  let containerElement: HTMLSpanElement;
  let measuredWidth: number = 0;
  let lastUpdateTime: number = 0;
  const UPDATE_INTERVAL: number = 100; // Update every 100ms (10 times per second)

  // Get a random enchantment table character
  function getRandomChar(): string {
    const chars = [...CHARS_ENCHANT];
    return chars[Math.floor(Math.random() * chars.length)] || '?';
  }

  // Generate scrambled text
  function generateScrambledText(): string {
    const textLength = length !== null ? length : [...text].length;
    return Array.from({ length: textLength }, () => getRandomChar()).join('');
  }

  // Measure the actual width of the original text
  function measureOriginalTextWidth(): void {
    if (measureElement) {
      // Force a layout to get accurate measurement
      measuredWidth = measureElement.offsetWidth;
    }
  }

  // Animation loop - updates scrambled text based on time interval
  function animateScramble(timestamp: number): void {
    if (!animate || !isAnimating) return;
    
    // Only update if enough time has passed since last update
    if (timestamp - lastUpdateTime >= UPDATE_INTERVAL) {
      displayText = generateScrambledText();
      lastUpdateTime = timestamp;
    }
    
    animationFrame = requestAnimationFrame(animateScramble);
  }

  // Start animation
  function startAnimation(): void {
    if (!animate) {
      displayText = generateScrambledText();
      return;
    }

    lastUpdateTime = 0;
    isAnimating = true;
    requestAnimationFrame(animateScramble);
  }

  // Stop animation
  function stopAnimation(): void {
    isAnimating = false;
    if (animationFrame !== null) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
  }

  onMount(() => {
    measureOriginalTextWidth();
    startAnimation();
  });

  onDestroy(() => {
    stopAnimation();
  });

  // Restart animation if props change
  $: if (text || length !== null) {
    measureOriginalTextWidth();
    stopAnimation();
    startAnimation();
  }

  // Generate placeholder text for width measurement (same length as obfuscated text)
  $: placeholderText = length !== null 
    ? '0'.repeat(length) 
    : text || '0'.repeat(5);
</script>

<!-- Hidden element to measure original text width -->
<span bind:this={measureElement} class="measure-text" aria-hidden="true">
  {placeholderText}
</span>

<!-- Visible obfuscated text with fixed width -->
<span 
  bind:this={containerElement}
  class="obfuscated-text {className}" 
  class:animated={animate}
  style="width: {measuredWidth}px;"
>
  {displayText}
</span>

<style lang="scss">
  @use '../../shared-styles/mixins' as *;

  .measure-text {
    position: absolute;
    visibility: hidden;
    pointer-events: none;
    white-space: nowrap;
    font-family: inherit;
    font-size: inherit;
    font-weight: inherit;
    letter-spacing: inherit;
    line-height: inherit;
  }

  .obfuscated-text {
    @include text-obfuscate-static;
    display: inline-block;
    font-variant: normal;
    font-feature-settings: normal;
    user-select: none;
    pointer-events: none;
    text-align: center;
    vertical-align: baseline;
    overflow: hidden;
    white-space: nowrap;
    box-sizing: border-box;
    font-family: inherit;
    font-size: inherit;
    font-weight: inherit;
    line-height: 1;
    position: relative;
    top: 0;
  }

  .obfuscated-text.animated {
    @include text-obfuscate(1.6s);
  }
</style>
