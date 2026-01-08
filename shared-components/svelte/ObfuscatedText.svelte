<script lang="ts">
  /**
   * ObfuscatedText Component
   * 
   * A reusable component for displaying obfuscated/scrambled text using various character sets.
   * Perfect for hiding undecided values, redacting sensitive information, or creating mysterious text effects.
   * 
   * @example
   * ```svelte
   * <ObfuscatedText text="$99.99" />
   * <ObfuscatedText text="1,000 users" length={5} />
   * <ObfuscatedText text="Secret data" animate={false} />
   * <ObfuscatedText text="API Key" charset="glitch" color="warning" />
   * <ObfuscatedText text="Hidden" revealOnHover pauseOnHover />
   * ```
   */

  import { onMount, onDestroy } from 'svelte';

  // Character sets
  const CHARS_ENCHANT = 'ᔑᒷᓵᒷ⊣╎⋮ꖌꖎᒲリ𝙹ᑑ∷ᓭℸ∴⨅';
  const CHARS_GLITCH = '█▓▒░╔╗╚╝║═┌┐└┘│─┼▀▄▌▐■□▪▫●○';
  const CHARS_BLOCK = '█▓▒░';
  const CHARS_BINARY = '01';
  const CHARS_HEX = '0123456789ABCDEF';

  type CharsetType = 'enchant' | 'glitch' | 'block' | 'binary' | 'hex';
  type ColorVariant = 'default' | 'info' | 'warning' | 'danger' | 'success';

  export let text: string = ''; // Original text (used to determine length if length prop not provided)
  export let length: number | null = null; // Custom length override
  export let animate: boolean = true; // Whether to animate the scrambling
  export let className: string = ''; // Additional CSS classes
  export let charset: CharsetType = 'enchant'; // Character set to use
  export let color: ColorVariant = 'default'; // Color variant
  export let updateInterval: number = 100; // Update interval in ms
  export let blur: boolean = false; // Apply blur effect
  export let revealOnHover: boolean = false; // Show actual text on hover
  export let pauseOnHover: boolean = false; // Pause animation on hover
  export let ariaLabel: string = ''; // Custom aria-label (defaults to text)

  let displayText: string = '';
  let animationFrame: number | null = null;
  let isAnimating: boolean = false;
  let measureElement: HTMLSpanElement;
  let containerElement: HTMLSpanElement;
  let measuredWidth: number = 0;
  let lastUpdateTime: number = 0;
  let isHovered: boolean = false;
  let isPaused: boolean = false;

  // Get character set based on charset prop
  function getCharset(): string {
    switch (charset) {
      case 'glitch': return CHARS_GLITCH;
      case 'block': return CHARS_BLOCK;
      case 'binary': return CHARS_BINARY;
      case 'hex': return CHARS_HEX;
      case 'enchant':
      default: return CHARS_ENCHANT;
    }
  }

  // Get a random character from the selected charset
  function getRandomChar(): string {
    const charSet = getCharset();
    const chars = [...charSet];
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
    if (!animate || !isAnimating || isPaused) return;
    
    // Only update if enough time has passed since last update
    if (timestamp - lastUpdateTime >= updateInterval) {
      displayText = generateScrambledText();
      lastUpdateTime = timestamp;
    }
    
    animationFrame = requestAnimationFrame(animateScramble);
  }

  // Handle mouse enter
  function handleMouseEnter(): void {
    isHovered = true;
    if (pauseOnHover) {
      isPaused = true;
    }
  }

  // Handle mouse leave
  function handleMouseLeave(): void {
    isHovered = false;
    if (pauseOnHover) {
      isPaused = false;
    }
  }

  // Handle copy event - copy actual text instead of scrambled
  function handleCopy(event: ClipboardEvent): void {
    if (text) {
      event.preventDefault();
      event.clipboardData?.setData('text/plain', text);
    }
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
  $: if (text || length !== null || charset) {
    measureOriginalTextWidth();
    stopAnimation();
    startAnimation();
  }

  // Determine what text to show
  $: actualDisplayText = (revealOnHover && isHovered) ? text : displayText;
  
  // Computed aria-label
  $: computedAriaLabel = ariaLabel || text || 'Obfuscated text';

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
  class:blur={blur}
  class:color-info={color === 'info'}
  class:color-warning={color === 'warning'}
  class:color-danger={color === 'danger'}
  class:color-success={color === 'success'}
  class:reveal-hover={revealOnHover}
  style="width: {measuredWidth}px;"
  aria-label={computedAriaLabel}
  role="text"
  on:mouseenter={handleMouseEnter}
  on:mouseleave={handleMouseLeave}
  on:copy={handleCopy}
>
  {actualDisplayText}
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

  // Blur effect
  .obfuscated-text.blur {
    filter: blur(1px);
  }

  // Color variants
  .obfuscated-text.color-info {
    color: var(--info);
  }

  .obfuscated-text.color-warning {
    color: var(--warning);
  }

  .obfuscated-text.color-danger {
    color: var(--danger);
  }

  .obfuscated-text.color-success {
    color: var(--success);
  }

  // Reveal on hover
  .obfuscated-text.reveal-hover {
    cursor: help;
    transition: opacity 0.3s ease;
  }

  .obfuscated-text.reveal-hover:hover {
    opacity: 1;
  }
</style>
