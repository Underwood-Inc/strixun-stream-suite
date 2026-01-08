<script lang="ts">
  export let featureName: string = 'Feature';
  export let icon: string = '⚠';
  export let description: string = 'This feature is currently in development and not yet available.';
  export let additionalInfo: string = '';
</script>

<div class="in-development-tooltip">
  <div class="tooltip-header">
    <span class="tooltip-icon">{icon}</span>
    <strong>{featureName}</strong>
    <span class="status-badge">In Development</span>
  </div>
  <p class="tooltip-description">{description}</p>
  {#if additionalInfo}
    <p class="tooltip-additional">{additionalInfo}</p>
  {/if}
</div>

<style>
  .in-development-tooltip {
    padding: var(--spacing-sm);
    max-width: 300px;
  }

  .tooltip-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    margin-bottom: var(--spacing-sm);
    flex-wrap: wrap;
  }

  .tooltip-icon {
    font-size: 1.25rem;
  }

  .status-badge {
    background: var(--warning);
    color: #000;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-left: auto;
  }

  .tooltip-description {
    font-size: 0.875rem;
    line-height: 1.5;
    margin-bottom: var(--spacing-xs);
    color: var(--text-secondary);
  }

  .tooltip-additional {
    font-size: 0.8rem;
    font-style: italic;
    color: var(--muted);
    margin-top: var(--spacing-xs);
  }
</style>
