<script lang="ts">
  export let featureName: string;
  export let icon: string;
  export let description: string;
  export let additionalInfo: string;
</script>

<div class="in-testing-tooltip">
  <strong class="tooltip-title">
    {icon} {featureName}
  </strong>
  <div class="badge-wrapper">
    <span class="status-badge">IN TESTING</span>
  </div>
  <p class="description">
    {description}
  </p>
  <p class="additional-info">
    {additionalInfo}
  </p>
</div>

<style>
  .in-testing-tooltip {
    text-align: left;
  }

  .tooltip-title {
    color: var(--accent, #ffa500);
    font-size: 1.1em;
    display: block;
    margin-bottom: 8px;
  }

  .badge-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }

  .status-badge {
    display: inline-block;
    padding: 4px 8px;
    background: rgba(100, 149, 237, 0.2);
    border: 1px solid var(--info, #6495ed);
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--info, #6495ed);
  }

  .description {
    margin: 0;
    line-height: 1.6;
    color: var(--text-secondary, #ccc);
  }

  .additional-info {
    margin-top: 8px;
    margin-bottom: 0;
    font-size: 0.85em;
    color: var(--text-muted, #999);
  }
</style>
