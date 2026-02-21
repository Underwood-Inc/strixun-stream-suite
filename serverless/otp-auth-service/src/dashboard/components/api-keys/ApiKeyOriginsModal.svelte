<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let show = false;
  export let keyName = '';
  export let origins: string[] = [];
  /** Allowed OIDC scopes for this key (e.g. openid, profile, email). Empty = all supported. */
  export let allowedScopes: string[] = [];
  /** Preset scope options for display (from GET /admin/oidc-metadata). */
  export let presetScopes: { value: string; label: string }[] = [];
  export let saving = false;
  export let error: string | null = null;
  export let success: string | null = null;

  let newOrigin = '';

  const dispatch = createEventDispatcher<{
    save: { origins: string[]; allowedScopes?: string[] };
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

  function addOrigin() {
    const text = newOrigin.trim();
    if (!text) return;

    const tokens = text.split(/[\n,]+/).map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    const invalid: string[] = [];
    const added: string[] = [];
    for (const token of tokens) {
      const normalized = token === 'null' ? 'null' : (token.startsWith('http://') || token.startsWith('https://') ? token.replace(/\/$/, '') : null);
      if (normalized === null) {
        invalid.push(token);
        continue;
      }
      if (!origins.includes(normalized) && !added.includes(normalized)) added.push(normalized);
    }
    if (invalid.length > 0) {
      error = `Invalid: ${invalid.join(', ')}. Use http:// or https:// URL, or null (no quotes needed).`;
      return;
    }
    if (added.length === 0) {
      error = 'Already added';
      return;
    }
    origins = [...origins, ...added];
    newOrigin = '';
    error = null;
    success = null;
  }

  function removeOrigin(origin: string) {
    origins = origins.filter(o => o !== origin);
    success = null;
  }

  function close() {
    dispatch('close');
  }
</script>

{#if show}
  <div class="modal" role="dialog" tabindex="-1" aria-modal="true" aria-labelledby="origins-modal-title"
    onclick={(e) => e.target === e.currentTarget && close()}
    onkeydown={(e) => e.key === 'Escape' && close()}>
    <div class="modal__content">
      <div class="modal__header">
        <h2 id="origins-modal-title" class="modal__title">Allowed Origins</h2>
        <button class="modal__close" onclick={close} aria-label="Close modal">x</button>
      </div>

      <div class="modal__body">
        <p class="modal__text">
          Configure which domains can use the API key <strong>"{keyName}"</strong>.
        </p>
        <p class="modal__text modal__text--info">
          <strong>No origins configured</strong> = Key works from <em>any</em> origin.<br/>
          <strong>Origins configured</strong> = Key <em>only</em> works from those specific origins.
        </p>
        <p class="modal__text modal__text--info">
          Add <code>null</code> (no quotes) to allow the downloadable test page when opened as file://. One origin per line or comma-separated.
        </p>

        {#if error}
          <div class="modal__alert modal__alert--error">{error}</div>
        {/if}
        {#if success}
          <div class="modal__alert modal__alert--success">{success}</div>
        {/if}

        <div class="modal__add-block">
          <textarea
            class="modal__textarea"
            placeholder="https://myapp.com&#10;http://localhost:3000&#10;null"
            bind:value={newOrigin}
            rows="4"
            aria-label="Allowed origins (one per line or comma-separated)"
          ></textarea>
          <button class="modal__btn modal__btn--add" onclick={addOrigin}>Add</button>
        </div>

        {#if origins.length === 0}
          <div class="modal__empty">
            <p>No allowed origins configured for this key.</p>
            <p class="modal__empty-hint">Add origins to use this API key from a browser.</p>
          </div>
        {:else}
          <ul class="modal__list">
            {#each origins as origin}
              <li class="modal__list-item">
                <code class="modal__origin-value">{origin}</code>
                <button class="modal__origin-remove" onclick={() => removeOrigin(origin)} aria-label={`Remove ${origin}`}>x</button>
              </li>
            {/each}
          </ul>
        {/if}

        <div class="modal__scopes">
          <h3 class="modal__scopes-title">Allowed OIDC scopes</h3>
          <p class="modal__text modal__text--info">
            Limit which scopes (and thus claims) can be requested when using this key. Leave all unchecked to allow all supported scopes.
          </p>
          {#if presetScopes.length > 0}
            <div class="modal__scopes-presets">
              {#each presetScopes as preset}
                <label class="modal__scopes-label">
                  <input type="checkbox" checked={isPresetSelected(preset)} onchange={() => toggleScope(preset.value)} />
                  <span><code class="modal__scope-code">{preset.value}</code> — {preset.label}</span>
                </label>
              {/each}
            </div>
          {/if}
        </div>
      </div>

      <div class="modal__footer">
        <button class="modal__btn modal__btn--secondary" onclick={close}>Cancel</button>
        <button class="modal__btn modal__btn--primary" onclick={() => dispatch('save', { origins, allowedScopes })} disabled={saving}>
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
    max-width: 600px; width: 90%; max-height: 80vh;
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
  .modal__add-block {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-md);
  }
  .modal__textarea {
    width: 100%;
    box-sizing: border-box;
    padding: var(--spacing-md);
    background: var(--card);
    border: 2px solid var(--border);
    border-radius: var(--radius-md);
    color: var(--text);
    font-size: 0.9375rem;
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
    line-height: 1.5;
    min-height: 6rem;
    resize: vertical;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .modal__textarea::placeholder {
    color: var(--text-secondary);
    opacity: 0.8;
  }
  .modal__textarea:hover {
    border-color: var(--text-secondary);
  }
  .modal__textarea:focus {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(234, 43, 31, 0.15);
  }

  .modal__btn {
    padding: var(--spacing-sm) var(--spacing-lg); font-weight: 600;
    font-size: 0.875rem; cursor: pointer; border-radius: var(--radius-sm);
  }
  .modal__btn--add {
    background: var(--accent); border: none; color: #000; align-self: flex-start;
  }
  .modal__btn--secondary {
    background: transparent; border: 1px solid var(--border); color: var(--text-secondary);
  }
  .modal__btn--secondary:hover { background: var(--bg-dark); border-color: var(--text-secondary); }
  .modal__btn--primary {
    background: var(--success); border: none; color: #fff;
  }
  .modal__btn--primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .modal__empty {
    text-align: center; padding: var(--spacing-xl); color: var(--text-secondary);
    background: var(--bg-dark); border-radius: var(--radius-md); border: 1px dashed var(--border);
  }
  .modal__empty-hint { margin-top: var(--spacing-sm); font-size: 0.875rem; color: var(--muted); }
  .modal__list { list-style: none; padding: 0; margin: 0 0 var(--spacing-lg) 0; }
  .modal__list-item {
    display: flex; align-items: center; justify-content: space-between;
    padding: var(--spacing-sm) var(--spacing-md); background: var(--bg-dark);
    border: 1px solid var(--border); border-radius: var(--radius-sm); margin-bottom: var(--spacing-sm);
  }
  .modal__origin-value {
    font-family: monospace; font-size: 0.875rem; color: var(--accent); word-break: break-all;
  }
  .modal__origin-remove {
    background: transparent; border: none; color: var(--danger);
    font-size: 1.25rem; cursor: pointer; padding: var(--spacing-xs); line-height: 1; opacity: 0.7;
  }
  .modal__origin-remove:hover { opacity: 1; }
  .modal__scopes {
    margin-top: var(--spacing-xl);
    padding-top: var(--spacing-md);
    border-top: 1px solid var(--border);
  }
  .modal__scopes-title {
    margin: 0 0 var(--spacing-sm) 0;
    font-size: 1rem;
    color: var(--accent);
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
</style>
