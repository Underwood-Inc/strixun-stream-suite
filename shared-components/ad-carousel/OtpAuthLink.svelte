<script lang="ts">
  /**
   * OTP Authentication Link Component
   * 
   * A friendly, attention-grabbing link to the OTP Authentication service.
   * Designed to be short, friendly, and eye-catching.
   * 
   * @example
   * ```svelte
   * <OtpAuthLink />
   * ```
   */
</script>

<a 
  href="https://auth.idling.app" 
  target="_blank" 
  rel="noopener noreferrer"
  class="otp-auth-link"
>
  🔐 Secured by OTP Auth
</a>

<style lang="scss">
  .otp-auth-link {
    font-size: 0.75rem;
    color: var(--text-secondary);
    text-decoration: none;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-weight: 500;

    &:hover {
      color: var(--accent);
      text-decoration: underline;
      transform: translateY(-1px);
    }

    &:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
      border-radius: 2px;
    }

    &:active {
      transform: translateY(0);
    }
  }
</style>

