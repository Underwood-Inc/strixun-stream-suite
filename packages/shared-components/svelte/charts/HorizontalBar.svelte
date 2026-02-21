<script lang="ts">
  /**
   * HorizontalBar – agnostic chart primitive for a single horizontal bar (value vs max).
   * Reusable for any metric: no business logic, no domain-specific naming.
   * Uses design tokens (--success, --warning, etc.) via variant; consumer chooses variant.
   */

  interface Props {
    value?: number;
    max?: number;
    label?: string;
    valueLabel?: string;
    variant?: 'default' | 'success' | 'warning' | 'danger';
  }

  let {
    value = 0,
    max = 1,
    label = '',
    valueLabel = '',
    variant = 'default'
  }: Props = $props();

  const fillPercent = $derived(max > 0 ? Math.min((value / max) * 100, 100) : 0);
</script>

<figure
  class="horizontal-bar"
  role="img"
  aria-label={label ? `${label}: ${valueLabel || `${value} of ${max}`}` : (valueLabel || `${value} of ${max}`)}
>
  {#if label}
    <figcaption class="horizontal-bar__caption">
      <span class="horizontal-bar__label">{label}</span>
      <span class="horizontal-bar__pct">{fillPercent.toFixed(0)}%</span>
    </figcaption>
  {/if}
  <div class="horizontal-bar__track" aria-hidden="true">
    <svg
      class="horizontal-bar__svg"
      viewBox="0 0 100 10"
      preserveAspectRatio="none"
      focusable="false"
      aria-hidden="true"
    >
      <rect class="horizontal-bar__bg" width="100" height="10" rx="2" ry="2" />
      <rect
        class="horizontal-bar__fill"
        class:horizontal-bar__fill--default={variant === 'default'}
        class:horizontal-bar__fill--success={variant === 'success'}
        class:horizontal-bar__fill--warning={variant === 'warning'}
        class:horizontal-bar__fill--danger={variant === 'danger'}
        width={fillPercent}
        height="10"
        rx="2"
        ry="2"
      />
    </svg>
  </div>
  {#if valueLabel}
    <div class="horizontal-bar__footer">
      <span class="horizontal-bar__count">{valueLabel}</span>
    </div>
  {/if}
</figure>

<style>
  .horizontal-bar {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin: 0;
  }

  .horizontal-bar__caption {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.875rem;
    color: var(--text-secondary, #b8b8b8);
  }

  .horizontal-bar__label {
    font-weight: 500;
  }

  .horizontal-bar__track {
    width: 100%;
    height: 10px;
    overflow: hidden;
    border-radius: 4px;
    border: 1px solid var(--border, #3d3627);
    background: var(--bg-dark, #0f0e0b);
  }

  .horizontal-bar__svg {
    width: 100%;
    height: 100%;
    display: block;
  }

  .horizontal-bar__bg {
    fill: transparent;
  }

  .horizontal-bar__fill {
    transition: width 0.35s ease;
  }

  .horizontal-bar__fill--default {
    fill: var(--accent, #edae49);
  }

  .horizontal-bar__fill--success {
    fill: var(--success, #28a745);
  }

  .horizontal-bar__fill--warning {
    fill: var(--warning, #ffc107);
  }

  .horizontal-bar__fill--danger {
    fill: var(--danger, #ea2b1f);
  }

  .horizontal-bar__footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.75rem;
    color: var(--muted, #888);
  }

  .horizontal-bar__pct {
    font-weight: 600;
    color: var(--text, #f9f9f9);
  }

  .horizontal-bar__count {
    color: var(--muted, #888);
  }
</style>
