<script lang="ts">
  import Card from '$dashboard/components/Card.svelte';

  /** From GET /admin/oidc-metadata */
  export let scopesSupported: string[] = [];
  export let claimsSupported: string[] = [];
  export let claimsByScope: Record<string, string[]> = {};
  export let presetScopes: { value: string; label: string }[] = [];

  let expanded = false;
</script>

<Card>
  <div class="claims-ref">
    <button
      type="button"
      class="claims-ref__toggle"
      onclick={() => (expanded = !expanded)}
      aria-expanded={expanded}
      aria-controls="claims-ref-panel"
    >
      {expanded ? '▼' : '▶'} Scopes &amp; claims reference
    </button>
    {#if expanded}
      <div id="claims-ref-panel" class="claims-ref__panel" role="region">
        <p class="claims-ref__intro">
          Configure which scopes (and thus claims) each API key can request. In <code>POST /auth/verify-otp</code>, send <code>scope</code> in the body (e.g. <code>"openid profile"</code>). Per-key allowed scopes are set in the key create form or in the key’s configuration (origins modal).
        </p>
        {#if scopesSupported.length > 0}
          <p class="claims-ref__row"><strong>Supported scopes:</strong> {#each scopesSupported as s}<code class="claims-ref__code">{s}</code>{/each}</p>
        {/if}
        {#if presetScopes.length > 0}
          <p class="claims-ref__row"><strong>Presets:</strong></p>
          <ul class="claims-ref__list">
            {#each presetScopes as p}
              <li><code class="claims-ref__code">{p.value}</code> — {p.label}</li>
            {/each}
          </ul>
        {/if}
        {#if Object.keys(claimsByScope).length > 0}
          <p class="claims-ref__row"><strong>Claims by scope:</strong></p>
          <dl class="claims-ref__dl">
            {#each Object.entries(claimsByScope) as [scope, claims]}
              <dt class="claims-ref__dt"><code class="claims-ref__code">{scope}</code></dt>
              <dd class="claims-ref__dd">{claims.join(', ')}</dd>
            {/each}
          </dl>
        {/if}
        {#if claimsSupported.length > 0}
          <p class="claims-ref__row"><strong>All supported claims:</strong> <span class="claims-ref__claims">{claimsSupported.slice(0, 24).join(', ')}{claimsSupported.length > 24 ? '…' : ''}</span></p>
        {/if}
      </div>
    {/if}
  </div>
</Card>

<style>
  .claims-ref {
    padding: 0 var(--spacing-lg) var(--spacing-lg) 0;
    padding-top: var(--spacing-lg);
    padding-left: var(--spacing-lg);
  }
  .claims-ref__toggle {
    background: transparent;
    border: none;
    color: var(--accent);
    font-size: 0.9375rem;
    font-weight: 600;
    cursor: pointer;
    padding: var(--spacing-xs) 0;
    text-align: left;
    width: 100%;
  }
  .claims-ref__toggle:hover {
    color: var(--accent-light);
  }
  .claims-ref__panel {
    margin-top: var(--spacing-md);
  }
  .claims-ref__intro {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-bottom: var(--spacing-md);
  }
  .claims-ref__intro code {
    background: var(--bg-dark);
    padding: 2px var(--spacing-xs);
    border-radius: var(--radius-sm);
    color: var(--accent);
  }
  .claims-ref__row {
    font-size: 0.875rem;
    margin-bottom: var(--spacing-sm);
  }
  .claims-ref__code {
    background: var(--bg-dark);
    padding: 2px var(--spacing-xs);
    border-radius: var(--radius-sm);
    color: var(--accent);
    margin-right: var(--spacing-xs);
  }
  .claims-ref__list {
    margin: 0 0 var(--spacing-md) 0;
    padding-left: var(--spacing-lg);
    font-size: 0.875rem;
    color: var(--text-secondary);
  }
  .claims-ref__dl {
    margin: 0 0 var(--spacing-md) 0;
    font-size: 0.875rem;
  }
  .claims-ref__dt {
    margin-top: var(--spacing-xs);
    color: var(--accent);
  }
  .claims-ref__dd {
    margin-left: 0;
    color: var(--text-secondary);
  }
  .claims-ref__claims {
    word-break: break-word;
  }
</style>
