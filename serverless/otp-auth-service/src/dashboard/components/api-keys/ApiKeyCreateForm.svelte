<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Card from '$dashboard/components/Card.svelte';

  const dispatch = createEventDispatcher<{ create: { name: string; allowedOrigins?: string[] } }>();

  let newKeyName = '';
  let origins: string[] = [];
  let newOrigin = '';
  let originsError: string | null = null;
  let showOrigins = false;

  function addOrigin() {
    const text = newOrigin.trim();
    if (!text) return;
    originsError = null;
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
      originsError = `Invalid: ${invalid.join(', ')}. Use http:// or https:// URL, or null (no quotes needed).`;
      return;
    }
    if (added.length === 0) {
      originsError = 'Already added';
      return;
    }
    origins = [...origins, ...added];
    newOrigin = '';
  }

  function removeOrigin(origin: string) {
    origins = origins.filter((o) => o !== origin);
    originsError = null;
  }

  function handleCreate() {
    const name = newKeyName.trim() || 'Default API Key';
    dispatch('create', {
      name,
      allowedOrigins: origins.length > 0 ? origins : undefined,
    });
    newKeyName = '';
    origins = [];
    newOrigin = '';
    originsError = null;
  }
</script>

<Card>
  <div class="create-form__inner">
  <h2 class="create-form__title">Create New API Key</h2>
  <div class="create-form__row">
    <input
      type="text"
      class="create-form__input"
      placeholder="Key name (optional)"
      bind:value={newKeyName}
      onkeypress={(e) => e.key === 'Enter' && !e.shiftKey && handleCreate()}
    />
    <button class="create-form__button" onclick={handleCreate}>
      Create API Key
    </button>
  </div>

  <div class="create-form__cors">
    <button
      type="button"
      class="create-form__cors-toggle"
      onclick={() => (showOrigins = !showOrigins)}
      aria-expanded={showOrigins}
      aria-controls="create-form-cors-panel"
    >
      {showOrigins ? '▼' : '▶'} Allowed origins (optional)
    </button>
    {#if showOrigins}
      <div id="create-form-cors-panel" class="create-form__cors-panel" role="region" aria-label="CORS allowed origins">
        <p class="create-form__cors-hint">
          <strong>One per line or comma-separated.</strong> Use <code>null</code> (no quotes) to allow the downloadable test page when opened as file://. Examples: <code>https://myapp.com</code>, <code>http://localhost:3000</code>. Leave empty to allow any origin.
        </p>
        {#if originsError}
          <div class="create-form__cors-error">{originsError}</div>
        {/if}
        <div class="create-form__cors-add">
          <textarea
            class="create-form__input create-form__cors-textarea"
            placeholder="https://myapp.com&#10;http://localhost:3000&#10;null"
            bind:value={newOrigin}
            rows="3"
            aria-label="Allowed origins (one per line or comma-separated)"
          />
          <button type="button" class="create-form__cors-add-btn" onclick={addOrigin}>Add</button>
        </div>
        {#if origins.length > 0}
          <ul class="create-form__cors-list">
            {#each origins as origin}
              <li class="create-form__cors-item">
                <code class="create-form__cors-value">{origin}</code>
                <button
                  type="button"
                  class="create-form__cors-remove"
                  onclick={() => removeOrigin(origin)}
                  aria-label="Remove {origin}"
                >
                  ×
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    {/if}
  </div>
  </div>
</Card>

<style>
  .create-form__inner {
    padding: 0 var(--spacing-lg) var(--spacing-lg) 0;
    padding-top: var(--spacing-lg);
    padding-left: var(--spacing-lg);
  }

  .create-form__title {
    font-size: 1.25rem;
    margin-bottom: var(--spacing-md);
    margin-right: 0;
    color: var(--accent);
  }

  .create-form__row {
    display: flex;
    gap: var(--spacing-md);
  }

  .create-form__input {
    flex: 1;
    padding: var(--spacing-md);
    background: var(--bg-dark);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    color: var(--text);
    font-size: 1rem;
  }

  .create-form__input:focus {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    border-color: var(--accent);
  }

  .create-form__button {
    padding: var(--spacing-md) var(--spacing-lg);
    background: var(--accent);
    border: 3px solid var(--accent-dark);
    border-radius: 0;
    color: #000;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    box-shadow: 0 4px 0 var(--accent-dark);
  }

  .create-form__button:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 0 var(--accent-dark);
  }

  .create-form__cors {
    margin-bottom: 0;
    margin-top: 0;
    padding-bottom: var(--spacing-lg);
    padding-top: var(--spacing-lg);
    border-top: 1px solid var(--border);
  }

  .create-form__cors-toggle {
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

  .create-form__cors-toggle:hover {
    color: var(--accent-light);
  }

  .create-form__cors-panel {
    margin-bottom: var(--spacing-md);
    margin-top: 0;
  }

  .create-form__cors-hint {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-bottom: var(--spacing-md);
    margin-right: 0;
  }

  .create-form__cors-hint code {
    background: var(--bg-dark);
    padding: 2px var(--spacing-xs);
    border-radius: var(--radius-sm);
    color: var(--accent);
  }

  .create-form__cors-error {
    font-size: 0.875rem;
    color: var(--danger);
    margin-bottom: var(--spacing-sm);
  }

  .create-form__cors-add {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-md);
    margin-right: 0;
  }

  .create-form__cors-textarea {
    min-width: 0;
    resize: vertical;
    min-height: 4.5rem;
    font-family: inherit;
  }

  .create-form__cors-add-btn {
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--info);
    border: none;
    border-radius: var(--radius-sm);
    color: #000;
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    flex-shrink: 0;
  }

  .create-form__cors-add-btn:hover {
    filter: brightness(1.1);
  }

  .create-form__cors-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .create-form__cors-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md) var(--spacing-sm) 0;
    padding-left: var(--spacing-md);
    background: var(--bg-dark);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    margin-bottom: var(--spacing-sm);
    margin-right: 0;
  }

  .create-form__cors-value {
    font-size: 0.875rem;
    color: var(--accent);
    word-break: break-all;
  }

  .create-form__cors-remove {
    background: transparent;
    border: none;
    color: var(--danger);
    font-size: 1.25rem;
    line-height: 1;
    cursor: pointer;
    padding: var(--spacing-xs);
    flex-shrink: 0;
    opacity: 0.8;
  }

  .create-form__cors-remove:hover {
    opacity: 1;
  }
</style>
