<script lang="ts">
  /**
   * EmailForm Component
   * 
   * Email input form for requesting OTP
   */
  
  import { onMount, onDestroy } from 'svelte';
  import type { OtpLoginState } from '../../core';

  export let state: OtpLoginState;
  export let onEmailChange: (e: Event) => void;
  export let onRequestOtp: () => void;
  export let onKeyPress: (e: KeyboardEvent, handler: () => void) => void;

  let emailInput: HTMLInputElement;
  let observer: MutationObserver | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let isLightBackground = false;

  /**
   * Calculate relative luminance of a color (for contrast calculation)
   * Based on WCAG 2.1 formula
   */
  function getLuminance(rgb: [number, number, number]): number {
    const [r, g, b] = rgb.map(val => {
      val = val / 255;
      return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  /**
   * Parse RGB color string to array
   */
  function parseRGB(color: string): [number, number, number] | null {
    // Handle rgb/rgba format
    const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbMatch) {
      return [
        parseInt(rgbMatch[1], 10),
        parseInt(rgbMatch[2], 10),
        parseInt(rgbMatch[3], 10)
      ];
    }
    return null;
  }

  /**
   * Determine if background is light or dark and set appropriate text color
   * Does not update color when input is focused to prevent unreadable text
   */
  function updateTextColor() {
    if (!emailInput) return;
    
    // Don't update color when input is focused - keep the current readable color
    if (document.activeElement === emailInput) {
      return;
    }

    const computedStyle = window.getComputedStyle(emailInput);
    let bgColor = computedStyle.backgroundColor;
    
    // If background is transparent or rgba with alpha, get the actual rendered color
    // by checking parent elements
    if (bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent') {
      let element: HTMLElement | null = emailInput.parentElement;
      while (element && (bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent')) {
        const parentStyle = window.getComputedStyle(element);
        bgColor = parentStyle.backgroundColor;
        element = element.parentElement;
      }
    }
    
    // Parse background color
    const rgb = parseRGB(bgColor);
    if (!rgb) {
      // Fallback: use CSS variable (assumes dark theme by default)
      emailInput.style.color = 'var(--text)';
      return;
    }

    // Calculate luminance
    const luminance = getLuminance(rgb);
    
    // If background is light (luminance > 0.5), use dark text; otherwise use light text
    // Using 0.5 as threshold for light/dark determination
    isLightBackground = luminance > 0.5;
    
    if (isLightBackground) {
      // Light background - use dark text
      emailInput.style.color = '#1a1a1a';
      emailInput.classList.add('otp-login-input--light-bg');
      emailInput.classList.remove('otp-login-input--dark-bg');
    } else {
      // Dark background - use light text
      emailInput.style.color = 'var(--text)';
      emailInput.classList.add('otp-login-input--dark-bg');
      emailInput.classList.remove('otp-login-input--light-bg');
    }
  }

  onMount(() => {
    if (!emailInput) return;

    // Initial color update
    updateTextColor();

    // Ensure text color remains readable when input is focused
    // Always use the default text color when focused to prevent unreadable colors
    const handleFocus = () => {
      // The input background is var(--bg-dark) from the mixin, so use var(--text) for readability
      emailInput.style.color = 'var(--text)';
    };

    // Ensure text color remains readable when input loses focus
    const handleBlur = () => {
      // Update color when not focused
      updateTextColor();
    };

    emailInput.addEventListener('focus', handleFocus);
    emailInput.addEventListener('blur', handleBlur);

    // Watch for parent/ancestor style changes (e.g., theme changes) but not self
    // CRITICAL: Don't watch the input element itself to avoid infinite loops
    // when we set its style.color property
    const parentElement = emailInput.parentElement;
    if (parentElement) {
      observer = new MutationObserver(() => {
        // Only update if not focused
        if (document.activeElement !== emailInput) {
          updateTextColor();
        }
      });

      observer.observe(parentElement, {
        attributes: true,
        attributeFilter: ['style', 'class'],
        subtree: false
      });
    }

    // Watch for size changes that might affect computed styles
    resizeObserver = new ResizeObserver(() => {
      // Only update if not focused
      if (document.activeElement !== emailInput) {
        updateTextColor();
      }
    });

    resizeObserver.observe(emailInput);

    // Also update on window resize (in case of media query changes)
    const handleResize = () => {
      if (document.activeElement !== emailInput) {
        updateTextColor();
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      emailInput.removeEventListener('focus', handleFocus);
      emailInput.removeEventListener('blur', handleBlur);
      window.removeEventListener('resize', handleResize);
    };
  });

  onDestroy(() => {
    if (observer) {
      observer.disconnect();
    }
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
  });
</script>

<form class="otp-login-form" onsubmit={(e) => { e.preventDefault(); onRequestOtp(); }}>
  <div class="otp-login-field">
    <label for="otp-login-email" class="otp-login-label">Email Address</label>
    <input
      type="email"
      id="otp-login-email"
      class="otp-login-input"
      bind:this={emailInput}
      required
      autocomplete="email"
      placeholder="your@email.com"
      value={state.email}
      disabled={state.loading}
      autofocus
      oninput={onEmailChange}
      onkeydown={(e) => onKeyPress(e, onRequestOtp)}
    />
  </div>
  <button
    type="submit"
    class="otp-login-button otp-login-button--primary"
    disabled={state.loading || !state.email}
  >
    {state.loading ? 'Sending...' : 'Send OTP Code'}
  </button>
</form>

<style lang="scss">
  @use '../../../../shared-styles/mixins' as *;
  @use '../../../../shared-styles/animations' as *;

  .otp-login-form {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
    position: relative;
    z-index: 1;
    pointer-events: auto;
  }

  .otp-login-field {
    display: flex;
    flex-direction: column;
    position: relative;
    z-index: 1;
    pointer-events: auto;
  }

  .otp-login-label {
    display: block;
    margin-bottom: var(--spacing-sm);
    color: var(--text-secondary);
    font-size: 0.875rem;
    pointer-events: none;
  }

  .otp-login-input {
    @include input;
    width: 100%;
    padding: var(--spacing-md);
    font-size: 1rem;
    box-sizing: border-box;
    position: relative;
    z-index: 10000;
    pointer-events: auto;
    cursor: text;
    user-select: text;
    -webkit-user-select: text;
    -moz-user-select: text;
    touch-action: manipulation;
  }

  .otp-login-input#otp-login-email {
    /* Color is set dynamically via JavaScript based on background contrast */
    font-weight: 500;
    
    /* Ensure text color remains readable when focused/active */
    &:focus,
    &:active {
      color: var(--text);
    }
  }

  .otp-login-input#otp-login-email::selection {
    /* Selection uses accent color - bright enough for good contrast with any text color */
    background-color: var(--accent);
    color: #000000;
    -webkit-text-stroke: 0px transparent;
    text-stroke: 0px transparent;
  }

  .otp-login-input#otp-login-email::-moz-selection {
    background-color: var(--accent);
    color: #000000;
    text-stroke: 0px transparent;
  }

  .otp-login-button {
    flex: 1;
    padding: var(--spacing-md);
    font-size: 0.875rem;
  }

  .otp-login-button--primary {
    @include arcade-button(var(--accent), var(--accent-dark));
  }
</style>

