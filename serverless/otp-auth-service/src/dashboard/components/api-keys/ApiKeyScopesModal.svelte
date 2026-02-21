<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let show = false;
  export let keyName = '';
  /** Allowed OIDC scopes for this key (e.g. openid, profile, email). Empty = all supported. */
  export let allowedScopes: string[] = [];
  /** Preset scope options (from GET /admin/oidc-metadata). */
  export let presetScopes: { value: string; label: string }[] = [];
  /** Scope → claim names (from GET /admin/oidc-metadata). Shown so users see what data each config returns. */
  export let claimsByScope: Record<string, string[]> = {};
  export let saving = false;
  export let error: string | null = null;
  export let success: string | null = null;

  const dispatch = createEventDispatcher<{
    save: { allowedScopes: string[] };
    close: void;
  }>();

  function toggleScope(scopeValue: string) {
    const scopes = scopeValue.trim().split(/\s+/);
    const next = [...allowedScopes];
    for (const s of scopes) {
      if (next.includes(s)) next.splice(next.indexOf(s), 1);
      else next.push(s);
    }
    allowedScopes = next.sort();
  }

  function isPresetSelected(preset: { value: string }) {
    const set = new Set(allowedScopes);
    return preset.value.trim().split(/\s+/).every(s => set.has(s));
  }

  function close() {
    dispatch('close');
  }
</script>

{#if show}
  <div class="modal" role="dialog" tabindex="-1" aria-modal="true" aria-labelledby="scopes-modal-title"
    onclick={(e) => e.target === e.currentTarget && close()}
    onkeydown={(e) => e.key === 'Escape' && close()}>
    <div class="modal__content">
      <div class="modal__header">
        <h2 id="scopes-modal-title" class="modal__title">Allowed OIDC scopes</h2>
        <button class="modal__close" onclick={close} aria-label="Close modal">x</button>
      </div>

      <div class="modal__body">
        <p class="modal__text">
          Limit which scopes (and thus claims) can be requested when using the API key <strong>"{keyName}"</strong>.
        </p>
        <p class="modal__text modal__text--info">
          Leave all unchecked to allow all supported scopes. Check one or more presets to restrict what this key can request.
        </p>

        {#if error}
          <div class="modal__alert modal__alert--error">{error}</div>
        {/if}
        {#if success}
          <div class="modal__alert modal__alert--success">{success}</div>
        {/if}

        {#if presetScopes.length > 0}
          <div class="modal__scopes-presets">
            {#each presetScopes as preset}
              <label class="modal__scopes-label">
                <input type="checkbox" checked={isPresetSelected(preset)} onchange={() => toggleScope(preset.value)} />
                <span><code class="modal__scope-code">{preset.value}</code> — {preset.label}</span>
              </label>
            {/each}
          </div>
        {:else}
          <p class="modal__text modal__text--info">Loading presets…</p>
        {/if}

        {#if Object.keys(claimsByScope).length > 0}
          <div class="modal__claims-ref" role="region" aria-labelledby="scopes-modal-claims-heading">
            <h3 id="scopes-modal-claims-heading" class="modal__claims-title">Claims returned by scope</h3>
            <p class="modal__text modal__text--info modal__claims-intro">
              The token and <code>GET /auth/me</code> include only the claims for the scopes that are requested. Below is what each scope returns.
            </p>
            <dl class="modal__claims-dl">
              {#each Object.entries(claimsByScope) as [scope, claims]}
                <dt class="modal__claims-dt"><code class="modal__scope-code">{scope}</code></dt>
                <dd class="modal__claims-dd">{claims.join(', ')}</dd>
              {/each}
            </dl>
          </div>
        {/if}
      </div>

      <div class="modal__footer">
        <button class="modal__btn modal__btn--secondary" onclick={close}>Cancel</button>
        <button class="modal__btn modal__btn--primary" onclick={() => dispatch('save', { allowedScopes })} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal {
    position: fixed; inset: 0; background: rgba(0,0,0,0.8);
    display: flex; align-items: center; justify-content: center;
    z-index: 10000; padding: 1rem;
  }
  .modal__content {
    background: var(--card); border: 2px solid var(--accent);
    border-radius: var(--radius-md); padding: var(--spacing-xl);
    max-width: 500px; width: 90%; max-height: 80vh;
    overflow-y: auto; display: flex; flex-direction: column;
  }
  .modal__header {
    display: flex; justify-content: space-between; align-items: center;
    padding-bottom: var(--spacing-md); border-bottom: 1px solid var(--border);
    margin-bottom: var(--spacing-md);
  }
  .modal__title { margin: 0; color: var(--accent); }
  .modal__close {
    background: transparent; border: none; color: var(--text-secondary);
    font-size: 1.5rem; cursor: pointer; padding: var(--spacing-xs); line-height: 1;
  }
  .modal__close:hover { color: var(--text); }
  .modal__body { flex: 1; overflow-y: auto; }
  .modal__text { margin-bottom: var(--spacing-md); color: var(--text-secondary); }
  .modal__text--info { font-size: 0.875rem; }
  .modal__footer {
    display: flex; justify-content: flex-end; gap: var(--spacing-md);
    padding-top: var(--spacing-md); border-top: 1px solid var(--border);
    margin-top: var(--spacing-md);
  }
  .modal__alert {
    border-radius: var(--radius-sm); padding: var(--spacing-sm) var(--spacing-md);
    margin-bottom: var(--spacing-md); font-size: 0.875rem;
  }
  .modal__alert--error {
    color: var(--danger); background: rgba(255,71,87,0.1); border: 1px solid var(--danger);
  }
  .modal__alert--success {
    color: var(--success); background: rgba(0,210,106,0.1); border: 1px solid var(--success);
  }
  .modal__scopes-presets {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }
  .modal__scopes-label {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    cursor: pointer;
    font-size: 0.9375rem;
    color: var(--text-secondary);
  }
  .modal__scopes-label input { flex-shrink: 0; }
  .modal__scope-code {
    background: var(--bg-dark);
    padding: 2px var(--spacing-xs);
    border-radius: var(--radius-sm);
    color: var(--accent);
    font-size: 0.875rem;
  }
  .modal__claims-ref {
    margin-top: var(--spacing-lg);
    padding-top: var(--spacing-md);
    border-top: 1px solid var(--border);
  }
  .modal__claims-title {
    margin: 0 0 var(--spacing-xs) 0;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text);
  }
  .modal__claims-intro { margin-bottom: var(--spacing-sm); }
  .modal__claims-dl {
    margin: 0;
    font-size: 0.8125rem;
  }
  .modal__claims-dt {
    margin-top: var(--spacing-xs);
    color: var(--accent);
  }
  .modal__claims-dt:first-child { margin-top: 0; }
  .modal__claims-dd {
    margin-left: 0;
    color: var(--text-secondary);
    word-break: break-word;
  }
</style>
