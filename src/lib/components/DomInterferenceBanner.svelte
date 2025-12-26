<script lang="ts">
  /**
   * DOM Interference Banner Component
   * 
   * Displays a warning banner when client-side DOM interference is detected.
   * Shows a clear message that application access has been restricted.
   */
  
  import { domInterferenceDetected } from '../../stores/dom-interference';
</script>

{#if $domInterferenceDetected}
  <div class="interference-banner" role="alert" aria-live="polite">
    <div class="interference-banner__content">
      <div class="interference-banner__icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </div>
      <div class="interference-banner__message">
        <strong>Client-side DOM interference detected</strong>
        <span class="interference-banner__subtext">Application access has been restricted for security reasons.</span>
      </div>
    </div>
  </div>
{/if}

<style lang="scss">
  @use '@styles/animations' as *;
  
  .interference-banner {
    background: linear-gradient(135deg, var(--warning) 0%, var(--danger) 100%);
    border-bottom: 2px solid var(--danger);
    padding: 12px 16px;
    color: var(--text);
    @include gpu-accelerated;
    animation: slideDown 0.3s ease-out;
    box-shadow: 0 2px 8px rgba(234, 43, 31, 0.3);
  }
  
  @keyframes slideDown {
    from {
      transform: translateY(-100%);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
  
  .interference-banner__content {
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: 1400px;
    margin: 0 auto;
  }
  
  .interference-banner__icon {
    flex-shrink: 0;
    color: var(--text);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .interference-banner__message {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
  }
  
  .interference-banner__message strong {
    font-weight: 600;
    font-size: 0.95em;
  }
  
  .interference-banner__subtext {
    font-size: 0.85em;
    opacity: 0.9;
  }
</style>

