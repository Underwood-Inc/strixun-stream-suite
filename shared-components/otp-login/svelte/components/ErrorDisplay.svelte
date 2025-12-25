<script lang="ts">
  /**
   * ErrorDisplay Component
   * 
   * Displays error messages, rate limit countdown, and summary
   */
  
  import Tooltip from '../../../tooltip/Tooltip.svelte';
  import { getErrorInfo, generateRateLimitTooltip } from '../../../error-mapping/error-legend';
  import { RateLimitInfoCard } from '../../../rate-limit-info';
  import { OtpLoginCore } from '../../core';
  import type { OtpLoginState } from '../../core';

  export let state: OtpLoginState;

  function formatRateLimitCountdown(seconds: number): string {
    return OtpLoginCore.formatRateLimitCountdown(seconds);
  }

  // Get minimal summary for inline display
  function getRateLimitSummary(emailLimit: any, failedAttempts: number | null): { scenario: string; limit: number; recommendation: string | null } | null {
    if (!emailLimit) return null;
    
    const adjustment = emailLimit.max - 3;
    let scenario: string;
    if (adjustment >= 2) scenario = 'New User';
    else if (adjustment === 1) scenario = 'Trusted User';
    else if (adjustment === 0) scenario = 'Normal User';
    else if (adjustment === -1) scenario = 'Frequent Requester';
    else scenario = 'Suspicious Activity';
    
    let recommendation: string | null = null;
    if (emailLimit.max === 1 && failedAttempts && failedAttempts > 0) {
      recommendation = 'Tip: Successfully log in to increase your limit';
    } else if (emailLimit.max === 2) {
      recommendation = 'Tip: Wait 24 hours to reset your request count';
    } else if (adjustment < 1) {
      recommendation = 'Tip: Successfully log in for a +1 bonus';
    }
    
    return { scenario, limit: emailLimit.max, recommendation };
  }
</script>

{#if state.error}
  {@const errorInfo = getErrorInfo(state.errorCode || 'rate_limit_exceeded')}
  {@const resetTime = state.rateLimitResetAt ? new Date(state.rateLimitResetAt).toLocaleString(navigator.language || 'en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : null}
  {@const tooltipContent = generateRateLimitTooltip(errorInfo, state.errorDetails as any)}
  {@const isRateLimitError = state.errorCode?.includes('rate_limit') || false}
  {@const summary = isRateLimitError ? getRateLimitSummary(state.errorDetails?.emailLimit, (state.errorDetails?.failedAttempts ?? null) as number | null) : null}
  <div class="otp-login-error">
    <div class="otp-login-error-message">
      {state.error}
      {#if isRateLimitError}
        <Tooltip 
          component={RateLimitInfoCard as any}
          componentProps={{
            compact: true,
            embedded: true,
            emailLimit: state.errorDetails?.emailLimit || null,
            failedAttempts: (state.errorDetails?.failedAttempts ?? null) as number | null,
            baseLimit: 3
          }}
          position="top" 
          interactive={true}
          maxWidth="450px"
          maxHeight="600px"
        >
          <span class="otp-login-error-info-icon" aria-label="Rate limit details">ℹ️</span>
        </Tooltip>
      {:else}
        <Tooltip 
          content={tooltipContent} 
          position="top" 
          interactive={true}
          maxWidth="420px"
          maxHeight="500px"
        >
          <span class="otp-login-error-info-icon" aria-label="Error details">ℹ️</span>
        </Tooltip>
      {/if}
    </div>
    {#if state.rateLimitCountdown > 0}
      <div class="otp-login-rate-limit-countdown">
        <span class="otp-login-countdown-icon">⏱️</span>
        <span class="otp-login-countdown-text">
          Try again in: <strong>{formatRateLimitCountdown(state.rateLimitCountdown)}</strong>
          {#if resetTime}
            <span class="otp-login-reset-time">(at {resetTime})</span>
          {/if}
        </span>
      </div>
    {/if}
    {#if summary}
      <div class="otp-login-rate-limit-summary">
        <div class="otp-login-rate-limit-summary-status">
          <span class="otp-login-rate-limit-summary-label">Status:</span>
          <span class="otp-login-rate-limit-summary-scenario">{summary.scenario}</span>
          <span class="otp-login-rate-limit-summary-limit">({summary.limit}/hour)</span>
        </div>
        {#if summary.recommendation}
          <div class="otp-login-rate-limit-summary-tip">
            {summary.recommendation}
          </div>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style lang="scss">
  @use '../../../../shared-styles/animations' as *;

  .otp-login-error {
    background: var(--card);
    border: 1px solid var(--danger);
    border-left: 4px solid var(--danger);
    border-radius: var(--radius-md);
    padding: var(--spacing-lg);
    color: var(--danger);
    margin-bottom: var(--spacing-lg);
    animation: slide-down 0.3s ease-out;
  }

  .otp-login-error-message {
    margin-bottom: var(--spacing-sm);
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    position: relative;
    
    :global(.tooltip-wrapper) {
      pointer-events: auto;
      z-index: 10;
      position: relative;
    }
  }
  
  .otp-login-error-info-icon {
    cursor: help;
    font-size: 1rem;
    opacity: 0.7;
    transition: opacity 0.2s;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    position: relative;
    z-index: 10;
    pointer-events: auto;
    user-select: none;
    
    &:hover {
      opacity: 1;
    }
  }
  
  .otp-login-reset-time {
    font-size: 0.875rem;
    opacity: 0.8;
    margin-left: var(--spacing-xs);
  }

  .otp-login-rate-limit-countdown {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    margin-top: var(--spacing-md);
    padding-top: var(--spacing-md);
    border-top: 1px solid rgba(234, 43, 31, 0.2);
    color: var(--text);
    font-size: 0.875rem;
  }

  .otp-login-rate-limit-summary {
    margin-top: var(--spacing-sm);
    padding-top: var(--spacing-sm);
    border-top: 1px solid rgba(234, 43, 31, 0.2);
    font-size: 0.85rem;
  }

  .otp-login-rate-limit-summary-status {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
    color: var(--text);
  }

  .otp-login-rate-limit-summary-label {
    color: var(--text-secondary);
    font-weight: 500;
  }

  .otp-login-rate-limit-summary-scenario {
    color: var(--accent);
    font-weight: 600;
  }

  .otp-login-rate-limit-summary-limit {
    color: var(--text-secondary);
    font-family: monospace;
    font-size: 0.9em;
  }

  .otp-login-rate-limit-summary-tip {
    color: var(--success);
    font-size: 0.8rem;
    font-style: italic;
    padding-left: 4px;
  }

  .otp-login-countdown-icon {
    font-size: 1.25rem;
    animation: pulse 2s ease-in-out infinite;
  }

  .otp-login-countdown-text {
    flex: 1;
  }

  .otp-login-countdown-text strong {
    color: var(--accent);
    font-weight: 600;
    font-family: monospace;
    font-size: 1rem;
  }

  .otp-login-countdown-text strong::selection {
    background: var(--accent);
    color: var(--bg-dark);
  }

  .otp-login-rate-limit-summary-scenario::selection {
    background: var(--accent);
    color: var(--bg-dark);
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.7;
      transform: scale(1.1);
    }
  }
</style>

