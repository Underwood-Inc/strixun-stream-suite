<script lang="ts">
  import { onMount } from 'svelte';
  import { apiClient } from '$dashboard/lib/api-client';
  import type { Customer, ApiKey, ApiKeyResponse, ApiKeyVerifyResponse } from '$dashboard/lib/types';
  import Card from '$dashboard/components/Card.svelte';
  import ObfuscatedText from '@shared-components/svelte/ObfuscatedText.svelte';
  import ApiKeyCreateForm from '$dashboard/components/api-keys/ApiKeyCreateForm.svelte';
  import ApiKeyNewKeyModal from '$dashboard/components/api-keys/ApiKeyNewKeyModal.svelte';
  import ApiKeyTestModal from '$dashboard/components/api-keys/ApiKeyTestModal.svelte';
  import ApiKeySnippetModal from '$dashboard/components/api-keys/ApiKeySnippetModal.svelte';
  import ApiKeyOriginsModal from '$dashboard/components/api-keys/ApiKeyOriginsModal.svelte';
  import ApiKeyUsageCard from '$dashboard/components/api-keys/ApiKeyUsageCard.svelte';

  export let customer: Customer | null = null;

  let apiKeys: ApiKey[] = [];
  let loading = true;
  let error: string | null = null;

  // New key modal
  let showNewKeyModal = false;
  let newApiKey: string | null = null;

  // Test modal
  let showTestModal = false;
  let testResult: ApiKeyVerifyResponse | null = null;
  let testingKeyId: string | null = null;
  let testError: string | null = null;

  // Snippet modal
  let showSnippetModal = false;
  let codeSnippet = '';

  // Origins + scopes modal
  let showOriginsModal = false;
  let editingKey: ApiKey | null = null;
  let editingOrigins: string[] = [];
  let editingScopes: string[] = [];
  let originsSaving = false;
  let originsError: string | null = null;
  let originsSuccess: string | null = null;

  // OIDC metadata for scopes/claims UI (presets and reference)
  let oidcMetadata: {
    presetScopes: { value: string; label: string }[];
    scopesSupported: string[];
    claimsSupported: string[];
    claimsByScope: Record<string, string[]>;
  } | null = null;
  let oidcPresetScopes: { value: string; label: string }[] = [];

  onMount(async () => {
    await loadApiKeys();
    try {
      const meta = await apiClient.getOidcMetadata();
      oidcMetadata = {
        presetScopes: meta.presetScopes,
        scopesSupported: meta.scopesSupported,
        claimsSupported: meta.claimsSupported ?? [],
        claimsByScope: meta.claimsByScope ?? {},
      };
      oidcPresetScopes = meta.presetScopes;
    } catch {
      oidcPresetScopes = [
        { value: 'openid', label: 'Minimal (openid only)' },
        { value: 'openid profile', label: 'Default (openid profile)' },
        { value: 'openid profile email', label: 'With email (openid profile email)' },
      ];
    }
  });

  async function loadApiKeys() {
    if (!customer?.customerId) {
      try {
        customer = await apiClient.getCustomer();
      } catch {
        error = 'Failed to load customer data. Please ensure you have API access.';
        loading = false;
        return;
      }
    }
    if (!customer?.customerId) {
      error = 'Customer ID not found. Please contact support.';
      loading = false;
      return;
    }
    loading = true;
    error = null;
    try {
      const response = await apiClient.getApiKeys(customer.customerId);
      apiKeys = response.apiKeys || [];
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load API keys';
    } finally {
      loading = false;
    }
  }

  async function handleCreate(e: CustomEvent<{ name: string; allowedOrigins?: string[]; allowedScopes?: string[] }>) {
    if (!customer?.customerId) return;
    try {
      const response: ApiKeyResponse = await apiClient.createApiKey(customer.customerId, e.detail.name, {
        allowedOrigins: e.detail.allowedOrigins,
        allowedScopes: e.detail.allowedScopes,
      });
      newApiKey = response.apiKey;
      showNewKeyModal = true;
      await loadApiKeys();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to create API key';
    }
  }

  async function handleRevoke(keyId: string) {
    if (!confirm('Revoke this API key? This cannot be undone.')) return;
    if (!customer?.customerId) return;
    try {
      await apiClient.revokeApiKey(customer.customerId, keyId);
      await loadApiKeys();
    } catch (err) {
      alert('Failed to revoke: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }

  async function handleRotate(keyId: string) {
    if (!confirm('Rotate this API key? The old key will be revoked.')) return;
    if (!customer?.customerId) return;
    try {
      const response: ApiKeyResponse = await apiClient.rotateApiKey(customer.customerId, keyId);
      newApiKey = response.apiKey;
      showNewKeyModal = true;
      await loadApiKeys();
    } catch (err) {
      alert('Failed to rotate: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }

  async function handleTest(keyId: string) {
    if (!customer?.customerId) return;
    testingKeyId = keyId;
    testError = null;
    testResult = null;
    showTestModal = true;
    try {
      const resp = await fetch(`/admin/customers/${customer.customerId}/api-keys/${keyId}/reveal`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      });
      if (!resp.ok) throw new Error('Failed to reveal API key');
      const { apiKey: val } = (await resp.json()) as { apiKey?: string };
      if (!val) throw new Error('Could not retrieve API key value');
      testResult = await apiClient.testApiKey(val);
    } catch (err) {
      testError = err instanceof Error ? err.message : 'Failed to test API key';
    } finally {
      testingKeyId = null;
    }
  }

  async function handleShowSnippet(keyId: string) {
    if (!customer?.customerId) return;
    codeSnippet = '';
    showSnippetModal = true;
    try {
      const resp = await fetch(`/admin/customers/${customer.customerId}/api-keys/${keyId}/reveal`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      });
      if (!resp.ok) throw new Error('Failed to reveal API key');
      const { apiKey: val } = (await resp.json()) as { apiKey?: string };
      if (!val) throw new Error('Could not retrieve API key value');
      codeSnippet = (await apiClient.getTestSnippet(val)).snippet;
    } catch (err) {
      codeSnippet = `<!-- Error: ${err instanceof Error ? err.message : 'Failed to generate snippet'} -->`;
    }
  }

  function openOrigins(key: ApiKey) {
    editingKey = key;
    editingOrigins = [...(key.allowedOrigins || [])];
    editingScopes = [...(key.allowedScopes || [])];
    originsError = null;
    originsSuccess = null;
    showOriginsModal = true;
  }

  async function handleSaveOrigins(e: CustomEvent<{ origins: string[]; allowedScopes?: string[] }>) {
    if (!customer?.customerId || !editingKey) return;
    originsSaving = true;
    originsError = null;
    originsSuccess = null;
    try {
      await apiClient.updateKeyOrigins(customer.customerId, editingKey.keyId, {
        allowedOrigins: e.detail.origins,
        allowedScopes: e.detail.allowedScopes,
      });
      originsSuccess = 'Configuration saved!';
      const idx = apiKeys.findIndex(k => k.keyId === editingKey!.keyId);
      if (idx >= 0) {
        apiKeys[idx] = { ...apiKeys[idx], allowedOrigins: e.detail.origins, allowedScopes: e.detail.allowedScopes };
        apiKeys = [...apiKeys];
      }
      setTimeout(() => { showOriginsModal = false; }, 1200);
    } catch (err) {
      originsError = err instanceof Error ? err.message : 'Failed to save';
    } finally {
      originsSaving = false;
    }
  }

</script>

<div class="api-keys">
  <h1 class="api-keys__title">API Keys</h1>

  {#if loading}
    <p class="api-keys__loading">Loading API keys...</p>
  {:else if error}
    <div class="api-keys__error">{error}</div>
  {:else}
    <ApiKeyUsageCard />

    {#if oidcMetadata}
      <ClaimsReference
        scopesSupported={oidcMetadata.scopesSupported}
        claimsSupported={oidcMetadata.claimsSupported ?? []}
        claimsByScope={oidcMetadata.claimsByScope ?? {}}
        presetScopes={oidcPresetScopes}
      />
    {/if}

    <ApiKeyCreateForm
      scopesSupported={oidcMetadata?.scopesSupported ?? []}
      presetScopes={oidcPresetScopes}
      on:create={handleCreate}
    />

    <Card>
      <div class="api-keys__card-inner">
      <h2 class="api-keys__section-title">Your API Keys</h2>
      {#if apiKeys.length === 0}
        <div class="api-keys__empty">
          <div class="icon">★</div>
          <p>No API keys yet</p>
          <p class="api-keys__empty-hint">Create your first API key above to get started</p>
        </div>
      {:else}
        <div class="api-keys__list">
          <table class="api-keys__table">
            <thead>
              <tr>
                <th class="api-keys__th-name">Name</th>
                <th class="api-keys__th-key">API Key</th>
                <th class="api-keys__th-status">Status</th>
                <th class="api-keys__th-created">Created</th>
                <th class="api-keys__th-used">Last Used</th>
                <th class="api-keys__th-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each apiKeys as key}
                <tr class="api-keys__row">
                  <td class="api-keys__td-name" data-label="Name">{key.name || 'Unnamed'}</td>
                  <td class="api-keys__key-cell api-keys__td-key" data-label="API Key">
                    <code class="api-keys__key-code" title="Reveal on hover">sk_<ObfuscatedText text="****" length={12} charset="hex" color="warning" revealOnHover ariaLabel={`API Key ending in ${key.keyId.substring(key.keyId.length - 8)}`} />{key.keyId.substring(key.keyId.length - 8)}</code>
                  </td>
                  <td class="api-keys__td-status" data-label="Status">
                    <span class="api-keys__status" class:status-active={key.status === 'active'} class:status-revoked={key.status === 'revoked'}>
                      {key.status || 'unknown'}
                    </span>
                  </td>
                  <td class="api-keys__date api-keys__td-created" data-label="Created">{key.createdAt ? new Date(key.createdAt).toLocaleDateString() : 'N/A'}</td>
                  <td class="api-keys__date api-keys__td-used" data-label="Last Used">{key.lastUsed ? new Date(key.lastUsed).toLocaleDateString() : 'Never'}</td>
                  <td class="api-keys__td-actions" data-label="Actions">
                    {#if key.status === 'active'}
                      <div class="api-keys__actions">
                        <button class="api-keys__btn api-keys__btn--test" onclick={() => handleTest(key.keyId)} disabled={testingKeyId === key.keyId}>
                          {testingKeyId === key.keyId ? '...' : 'Test'}
                        </button>
                        <button class="api-keys__btn api-keys__btn--code" onclick={() => handleShowSnippet(key.keyId)} title="Get HTML+JS test page for end-to-end testing">Test Page</button>
                        <button class="api-keys__btn api-keys__btn--origins" onclick={() => openOrigins(key)} title="Configure allowed origins (CORS)">Origins ({key.allowedOrigins?.length || 0})</button>
                        <button class="api-keys__btn api-keys__btn--warning" onclick={() => handleRotate(key.keyId)}>Rotate</button>
                        <button class="api-keys__btn api-keys__btn--danger" onclick={() => handleRevoke(key.keyId)}>Revoke</button>
                      </div>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
      </div>
    </Card>
  {/if}
</div>

<ApiKeyNewKeyModal bind:show={showNewKeyModal} bind:apiKey={newApiKey} />

<ApiKeyTestModal
  bind:show={showTestModal}
  loading={!!testingKeyId}
  error={testError}
  result={testResult}
/>

<ApiKeySnippetModal bind:show={showSnippetModal} bind:snippet={codeSnippet} />

<ApiKeyOriginsModal
  bind:show={showOriginsModal}
  keyName={editingKey?.name || ''}
  bind:origins={editingOrigins}
  bind:allowedScopes={editingScopes}
  presetScopes={oidcPresetScopes}
  bind:saving={originsSaving}
  bind:error={originsError}
  bind:success={originsSuccess}
  on:save={handleSaveOrigins}
  on:close={() => (showOriginsModal = false)}
/>

<style>
  .api-keys { width: 100%; }
  /* Spacing: bottom and right only to avoid wrap issues; parent controls gap between sections */
  .api-keys > * { margin-bottom: var(--spacing-xl); margin-right: 0; }
  .api-keys > *:last-child { margin-bottom: 0; }

  .api-keys__card-inner {
    padding: 0 var(--spacing-lg) var(--spacing-lg) 0;
    padding-top: var(--spacing-lg);
    padding-left: var(--spacing-lg);
  }

  .api-keys__title {
    font-size: 2rem;
    margin-bottom: var(--spacing-xl);
    margin-right: 0;
    color: var(--accent);
  }

  .api-keys__loading, .api-keys__error {
    padding: 0 var(--spacing-xl) var(--spacing-xl) 0;
    padding-top: var(--spacing-xl);
    padding-left: var(--spacing-xl);
    text-align: center;
  }
  .api-keys__error {
    color: var(--danger); background: var(--card);
    border: 1px solid var(--danger); border-left: 4px solid var(--danger);
    border-radius: var(--radius-md);
    padding: 0 var(--spacing-lg) var(--spacing-lg) 0;
    padding-top: var(--spacing-lg);
    padding-left: var(--spacing-lg);
  }

  .api-keys__section-title {
    font-size: 1.25rem;
    margin-bottom: var(--spacing-md);
    margin-right: 0;
    color: var(--accent);
  }

  .api-keys__empty {
    text-align: center;
    padding: 0 var(--spacing-3xl) var(--spacing-3xl) 0;
    padding-top: var(--spacing-3xl);
    padding-left: var(--spacing-3xl);
    color: var(--text-secondary);
  }
  .api-keys__empty-hint {
    margin-bottom: var(--spacing-sm);
    margin-top: 0;
    margin-right: 0;
    font-size: 0.875rem;
    color: var(--muted);
  }

  .api-keys__list { overflow-x: auto; }
  .api-keys__table { width: 100%; border-collapse: collapse; min-width: 640px; }
  .api-keys__table th {
    text-align: left;
    padding: 0 var(--spacing-md) var(--spacing-md) 0;
    padding-top: var(--spacing-md);
    padding-left: var(--spacing-md);
    color: var(--text-secondary); font-weight: 600;
    border-bottom: 1px solid var(--border);
  }
  .api-keys__table td {
    padding: 0 var(--spacing-md) var(--spacing-md) 0;
    padding-top: var(--spacing-md);
    padding-left: var(--spacing-md);
    border-bottom: 1px solid var(--border);
    vertical-align: middle;
  }

  /* Table view: row hover on cells */
  .api-keys__row:hover td {
    background: rgba(234, 43, 31, 0.1);
  }

  .api-keys__th-name { min-width: 6rem; }
  .api-keys__th-key { min-width: 11rem; }
  .api-keys__th-actions { min-width: 18rem; white-space: nowrap; }

  .api-keys__key-cell {
    display: flex; align-items: center; gap: var(--spacing-sm); font-family: monospace;
  }
  .api-keys__key-code {
    font-family: monospace; font-size: 0.875rem; color: var(--accent);
    background: var(--bg-dark); padding: var(--spacing-xs) var(--spacing-sm);
    display: inline-flex; align-items: center; border-radius: var(--radius-sm);
    word-break: break-all; min-width: 0;
  }

  .api-keys__status {
    padding: var(--spacing-xs) var(--spacing-sm); border-radius: var(--radius-sm);
    font-size: 0.875rem; font-weight: 600;
  }
  .api-keys__status.status-active { background: var(--success); color: #000; }
  .api-keys__status.status-revoked { background: var(--danger); color: #000; }

  .api-keys__date { color: var(--text-secondary); font-size: 0.875rem; }

  .api-keys__actions {
    display: flex; flex-wrap: wrap; gap: var(--spacing-sm);
    justify-content: flex-end; align-items: center;
  }

  .api-keys__btn {
    padding: var(--spacing-sm) var(--spacing-md); border-radius: var(--radius-sm);
    font-weight: 600; font-size: 0.8125rem; cursor: pointer; white-space: nowrap;
  }
  .api-keys__btn--test { background: var(--info); border: 2px solid var(--info); color: #000; }
  .api-keys__btn--test:disabled { opacity: 0.6; cursor: wait; }
  .api-keys__btn--code {
    background: var(--bg-dark); border: 2px solid var(--accent); color: var(--accent);
  }
  .api-keys__btn--code:hover { background: var(--accent); color: #000; }
  .api-keys__btn--origins {
    background: var(--bg-dark); border: 2px solid var(--info); color: var(--info);
  }
  .api-keys__btn--origins:hover { background: var(--info); color: #000; }
  .api-keys__btn--warning { background: var(--warning); border: 2px solid var(--warning); color: #000; }
  .api-keys__btn--danger { background: transparent; border: 2px solid var(--danger); color: var(--danger); }

  /* Condensed view: one card per row (proper list of rows with per-row hover) */
  @media (max-width: 1024px) {
    .api-keys__table { min-width: 0; display: block; }
    .api-keys__table thead { display: none; }
    .api-keys__table tbody {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-lg);
    }
    .api-keys__row {
      display: block;
      padding: 0 var(--spacing-lg) var(--spacing-lg) var(--spacing-lg);
      padding-top: var(--spacing-lg);
      margin: 0;
      background: var(--bg-dark);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      isolation: isolate;
    }
    .api-keys__row:hover {
      background: rgba(234, 43, 31, 0.1);
    }
    .api-keys__row:hover td {
      background: transparent;
    }
    .api-keys__row td {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--spacing-md);
      padding: var(--spacing-sm) 0;
      padding-right: 0;
      border-bottom: 1px solid var(--border);
    }
    .api-keys__row td:last-child { border-bottom: none; padding-bottom: 0; }
    .api-keys__row td::before {
      content: attr(data-label);
      font-weight: 600;
      color: var(--text-secondary);
      font-size: 0.8125rem;
      flex-shrink: 0;
    }
    .api-keys__key-cell::before { content: attr(data-label); }
    .api-keys__td-actions { flex-wrap: wrap; align-items: flex-start; }
    .api-keys__td-actions::before { width: 100%; margin-bottom: var(--spacing-xs); }
    .api-keys__td-actions .api-keys__actions { width: 100%; justify-content: flex-start; }
  }

  @media (max-width: 480px) {
    .api-keys__row td { flex-direction: column; align-items: flex-start; gap: var(--spacing-xs); }
    .api-keys__row td::before { margin-bottom: 0; }
    .api-keys__actions { width: 100%; }
  }
</style>
