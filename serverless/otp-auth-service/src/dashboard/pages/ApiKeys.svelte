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

  // Origins modal
  let showOriginsModal = false;
  let editingKey: ApiKey | null = null;
  let editingOrigins: string[] = [];
  let originsSaving = false;
  let originsError: string | null = null;
  let originsSuccess: string | null = null;

  onMount(async () => {
    await loadApiKeys();
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

  async function handleCreate(e: CustomEvent<{ name: string }>) {
    if (!customer?.customerId) return;
    try {
      const response: ApiKeyResponse = await apiClient.createApiKey(customer.customerId, e.detail.name);
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
    originsError = null;
    originsSuccess = null;
    showOriginsModal = true;
  }

  async function handleSaveOrigins(e: CustomEvent<{ origins: string[] }>) {
    if (!customer?.customerId || !editingKey) return;
    originsSaving = true;
    originsError = null;
    originsSuccess = null;
    try {
      await apiClient.updateKeyOrigins(customer.customerId, editingKey.keyId, e.detail.origins);
      originsSuccess = 'Allowed origins saved!';
      const idx = apiKeys.findIndex(k => k.keyId === editingKey!.keyId);
      if (idx >= 0) {
        apiKeys[idx] = { ...apiKeys[idx], allowedOrigins: e.detail.origins };
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

    <ApiKeyCreateForm on:create={handleCreate} />

    <Card>
      <h2 class="api-keys__section-title">Your API Keys</h2>
      {#if apiKeys.length === 0}
        <div class="api-keys__empty">
          <div class="icon">★</div>
          <p>No API keys yet</p>
          <p class="api-keys__empty-hint">Create your first API key above to get started</p>
        </div>
      {:else}
        <div class="api-keys__table-container">
          <table class="api-keys__table">
            <thead>
              <tr>
                <th>Name</th>
                <th>API Key</th>
                <th>Status</th>
                <th>Created</th>
                <th>Last Used</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each apiKeys as key}
                <tr>
                  <td>{key.name || 'Unnamed'}</td>
                  <td class="api-keys__key-cell">
                    <code class="api-keys__key-code">sk_<ObfuscatedText text="****" length={12} charset="hex" color="warning" revealOnHover ariaLabel={`API Key ending in ${key.keyId.substring(key.keyId.length - 8)}`} />{key.keyId.substring(key.keyId.length - 8)}</code>
                  </td>
                  <td>
                    <span class="api-keys__status" class:status-active={key.status === 'active'} class:status-revoked={key.status === 'revoked'}>
                      {key.status || 'unknown'}
                    </span>
                  </td>
                  <td class="api-keys__date">{key.createdAt ? new Date(key.createdAt).toLocaleDateString() : 'N/A'}</td>
                  <td class="api-keys__date">{key.lastUsed ? new Date(key.lastUsed).toLocaleDateString() : 'Never'}</td>
                  <td>
                    {#if key.status === 'active'}
                      <div class="api-keys__actions">
                        <button class="api-keys__btn api-keys__btn--test" onclick={() => handleTest(key.keyId)} disabled={testingKeyId === key.keyId}>
                          {testingKeyId === key.keyId ? '...' : 'Test'}
                        </button>
                        <button class="api-keys__btn api-keys__btn--code" onclick={() => handleShowSnippet(key.keyId)} title="Get HTML+JS code for end-to-end testing">{'</>'}</button>
                        <button class="api-keys__btn api-keys__btn--origins" onclick={() => openOrigins(key)} title="Configure allowed origins">🌐 {key.allowedOrigins?.length || 0}</button>
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
  bind:saving={originsSaving}
  bind:error={originsError}
  bind:success={originsSuccess}
  on:save={handleSaveOrigins}
  on:close={() => (showOriginsModal = false)}
/>

<style>
  .api-keys { width: 100%; }
  .api-keys :global(.card + .card) { margin-top: var(--spacing-xl); }

  .api-keys__title {
    font-size: 2rem;
    margin-bottom: var(--spacing-xl);
    color: var(--accent);
  }

  .api-keys__loading, .api-keys__error {
    padding: var(--spacing-xl);
    text-align: center;
  }
  .api-keys__error {
    color: var(--danger); background: var(--card);
    border: 1px solid var(--danger); border-left: 4px solid var(--danger);
    border-radius: var(--radius-md); padding: var(--spacing-lg);
  }

  .api-keys__section-title {
    font-size: 1.25rem;
    margin-bottom: var(--spacing-md);
    color: var(--accent);
  }

  .api-keys__empty {
    text-align: center; padding: var(--spacing-3xl); color: var(--text-secondary);
  }
  .api-keys__empty-hint {
    margin-top: var(--spacing-sm); font-size: 0.875rem; color: var(--muted);
  }

  .api-keys__table-container { overflow-x: auto; }
  .api-keys__table { width: 100%; border-collapse: collapse; }
  .api-keys__table th {
    text-align: left; padding: var(--spacing-md);
    color: var(--text-secondary); font-weight: 600;
    border-bottom: 1px solid var(--border);
  }
  .api-keys__table td {
    padding: var(--spacing-md); border-bottom: 1px solid var(--border);
  }

  .api-keys__key-cell {
    display: flex; align-items: center; gap: var(--spacing-sm); font-family: monospace;
  }
  .api-keys__key-code {
    font-family: monospace; font-size: 0.875rem; color: var(--accent);
    background: var(--bg-dark); padding: var(--spacing-xs) var(--spacing-sm);
    display: inline-flex; align-items: center; border-radius: var(--radius-sm);
    word-break: break-all; flex: 1;
  }

  .api-keys__status {
    padding: var(--spacing-xs) var(--spacing-sm); border-radius: var(--radius-sm);
    font-size: 0.875rem; font-weight: 600;
  }
  .api-keys__status.status-active { background: var(--success); color: #000; }
  .api-keys__status.status-revoked { background: var(--danger); color: #000; }

  .api-keys__date { color: var(--text-secondary); font-size: 0.875rem; }

  .api-keys__actions { display: flex; gap: var(--spacing-sm); justify-content: flex-end; }

  .api-keys__btn {
    padding: var(--spacing-xs) var(--spacing-md); border-radius: var(--radius-sm);
    font-weight: 600; font-size: 0.875rem; cursor: pointer; white-space: nowrap;
  }
  .api-keys__btn--test { background: var(--info); border: 2px solid var(--info); color: #000; }
  .api-keys__btn--test:disabled { opacity: 0.6; cursor: wait; }
  .api-keys__btn--code {
    background: var(--bg-dark); border: 2px solid var(--accent); color: var(--accent);
    font-size: 0.75rem; font-family: monospace; font-weight: 700;
    padding: var(--spacing-xs) var(--spacing-sm);
  }
  .api-keys__btn--code:hover { background: var(--accent); color: #000; }
  .api-keys__btn--origins {
    background: var(--bg-dark); border: 2px solid var(--info); color: var(--info);
    font-size: 0.75rem; padding: var(--spacing-xs) var(--spacing-sm);
  }
  .api-keys__btn--origins:hover { background: var(--info); color: #000; }
  .api-keys__btn--warning { background: var(--warning); border: 2px solid var(--warning); color: #000; }
  .api-keys__btn--danger { background: transparent; border: 2px solid var(--danger); color: var(--danger); }
</style>
