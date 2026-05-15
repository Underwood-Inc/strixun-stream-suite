<script lang="ts">
  export let headline: string = 'Free tier';
  export let icon: string = '✓';
</script>

<div class="free-tier-tooltip">
  <div class="tooltip-header">
    <span class="tooltip-icon" aria-hidden="true">{icon}</span>
    <strong>{headline}</strong>
    <span class="status-badge">Live</span>
  </div>
  <p class="tooltip-lead">Available on the hosted free tier today:</p>
  <ul class="tooltip-list">
    <li>Dashboard signup</li>
    <li>API keys</li>
    <li>Audit logs</li>
    <li>Analytics</li>
    <li>Downloadable integration examples</li>
  </ul>
  <div class="tooltip-footer">
    <p class="tooltip-footer-title">Paid Stripe tiers</p>
    <p class="tooltip-footer-text">Not available yet. Self-host from GitHub if you need higher limits.</p>
  </div>
</div>

<style>
  .free-tier-tooltip {
    padding: var(--spacing-xs);
    max-width: 22rem;
    text-align: left;
  }

  .tooltip-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    margin-bottom: var(--spacing-sm);
    flex-wrap: wrap;
  }

  .tooltip-icon {
    font-size: 1.125rem;
    line-height: 1;
  }

  .status-badge {
    margin-left: auto;
    background: var(--success, #5cb85c);
    color: #0d0d0d;
    padding: 2px 8px;
    border-radius: 3px;
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .tooltip-lead {
    font-size: 0.8125rem;
    line-height: 1.45;
    margin: 0 0 var(--spacing-xs);
    color: var(--text-secondary, rgba(255, 255, 255, 0.85));
  }

  .tooltip-list {
    margin: 0 0 var(--spacing-sm);
    padding-left: 1.125rem;
    font-size: 0.8125rem;
    line-height: 1.5;
    color: var(--text, #fff);
  }

  .tooltip-list li {
    margin-bottom: 0.25rem;
  }

  .tooltip-list li:last-child {
    margin-bottom: 0;
  }

  .tooltip-footer {
    padding-top: var(--spacing-sm);
    margin-top: var(--spacing-xs);
    border-top: 1px solid var(--border, rgba(255, 255, 255, 0.12));
  }

  .tooltip-footer-title {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin: 0 0 0.25rem;
    color: var(--text-secondary, rgba(255, 255, 255, 0.75));
  }

  .tooltip-footer-text {
    font-size: 0.8125rem;
    line-height: 1.45;
    margin: 0;
    color: var(--muted, rgba(255, 255, 255, 0.65));
  }
</style>
