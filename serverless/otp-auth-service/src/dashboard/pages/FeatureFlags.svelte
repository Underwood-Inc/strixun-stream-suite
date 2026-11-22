<script lang="ts">
  import { FEATURE_FLAG_CANON_ROWS } from '@strixun/feature-flags';
  import { fetchFlagSnapshot, setFlagState } from '$dashboard/lib/flags-api-client';
  import { onMount } from 'svelte';

  export let userRoles: string[] = [];
  export let userPermissions: string[] = [];

  $: canWrite =
    userPermissions.includes('flags:write') ||
    userPermissions.includes('*') ||
    userRoles.includes('super-admin');

  let loading = true;
  let error: string | null = null;
  let product = 'stream-suite';
  let flags: Record<string, boolean | number | null> = {};
  let savingId: string | null = null;

  const products = ['stream-suite', 'auth', 'access'] as const;

  async function load() {
    loading = true;
    error = null;
    try {
      const snap = await fetchFlagSnapshot(product);
      flags = { ...snap.flags };
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  async function toggleBoolean(flagId: string) {
    if (!canWrite) return;
    const current = flags[flagId];
    if (typeof current !== 'boolean') return;
    savingId = flagId;
    try {
      const next = !current;
      await setFlagState(flagId, next);
      flags = { ...flags, [flagId]: next };
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      savingId = null;
    }
  }

  onMount(() => {
    load();
  });

  $: rows = FEATURE_FLAG_CANON_ROWS.filter((r) => r.product === product);
</script>

<section class="feature-flags">
  <header class="feature-flags__header">
    <h1>Feature flags</h1>
    <p class="feature-flags__hint">Scoped controls for {product}. Full audit and rules on flags.idling.app (when deployed).</p>
    <div class="feature-flags__filters">
      <label>
        Product
        <select bind:value={product} onchange={() => load()}>
          {#each products as p}
            <option value={p}>{p}</option>
          {/each}
        </select>
      </label>
      <button type="button" class="btn" onclick={() => load()} disabled={loading}>Refresh</button>
    </div>
  </header>

  {#if loading}
    <p>Loading flags…</p>
  {:else if error}
    <p class="error">{error}</p>
    <button type="button" onclick={() => load()}>Retry</button>
  {:else}
    <table class="feature-flags__table">
      <thead>
        <tr>
          <th>Flag</th>
          <th>Kind</th>
          <th>Default</th>
          <th>Effective</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each rows as row}
          <tr>
            <td>
              <code>{row.id}</code>
              <div class="desc">{row.description}</div>
            </td>
            <td>{row.kind}</td>
            <td>{String(row.defaultValue)}</td>
            <td>{String(flags[row.id] ?? row.defaultValue)}</td>
            <td>
              {#if row.kind === 'boolean' && canWrite}
                <button
                  type="button"
                  class="toggle"
                  disabled={savingId === row.id}
                  onclick={() => toggleBoolean(row.id)}
                >
                  {flags[row.id] === true ? 'On' : 'Off'}
                </button>
              {:else if row.sensitivity === 'security' && row.id.includes('bypass') && !row.id.includes('bypass-enabled')}
                <span class="muted">Per customer → Customer Access</span>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</section>

<style>
  .feature-flags__header h1 {
    margin: 0 0 var(--spacing-sm);
  }
  .feature-flags__hint {
    color: var(--muted-foreground);
    margin-bottom: var(--spacing-md);
  }
  .feature-flags__filters {
    display: flex;
    gap: var(--spacing-md);
    align-items: flex-end;
    margin-bottom: var(--spacing-lg);
  }
  .feature-flags__table {
    width: 100%;
    border-collapse: collapse;
  }
  .feature-flags__table th,
  .feature-flags__table td {
    text-align: left;
    padding: var(--spacing-sm);
    border-bottom: 1px solid var(--border);
    vertical-align: top;
  }
  .desc {
    font-size: 0.85rem;
    color: var(--muted-foreground);
    margin-top: 4px;
  }
  .error {
    color: var(--destructive, #e55);
  }
  .muted {
    font-size: 0.85rem;
    color: var(--muted-foreground);
  }
  .toggle {
    min-width: 4rem;
  }
</style>