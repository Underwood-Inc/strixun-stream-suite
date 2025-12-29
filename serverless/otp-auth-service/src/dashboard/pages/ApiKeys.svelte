<script lang="ts">
  import { onMount } from 'svelte';
  import { apiClient } from '$lib/api-client';
  import type { Customer, ApiKey, ApiKeyResponse } from '$lib/types';
  import Card from '$components/Card.svelte';

  export let customer: Customer | null = null;

  let apiKeys: ApiKey[] = [];
  let loading = true;
  let error: string | null = null;
  let newKeyName = '';
  let showNewKeyModal = false;
  let newApiKey: string | null = null;

  onMount(async () => {
    await loadApiKeys();
  });

  async function loadApiKeys() {
    if (!customer?.customerId) {
      try {
        customer = await apiClient.getCustomer();
      } catch (err) {
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
      console.error('Failed to load API keys:', err);
      error = err instanceof Error ? err.message : 'Failed to load API keys';
    } finally {
      loading = false;
    }
  }

  async function handleCreateKey() {
    if (!customer?.customerId) return;

    const name = newKeyName.trim() || 'Default API Key';

    try {
      const response: ApiKeyResponse = await apiClient.createApiKey(customer.customerId, name);
      newApiKey = response.apiKey;
      showNewKeyModal = true;
      newKeyName = '';
      await loadApiKeys();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to create API key';
      alert(error);
    }
  }

  async function handleRevokeKey(keyId: string) {
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      return;
    }

    if (!customer?.customerId) return;

    try {
      await apiClient.revokeApiKey(customer.customerId, keyId);
      await loadApiKeys();
    } catch (err) {
      alert('Failed to revoke API key: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }

  async function handleRotateKey(keyId: string) {
    if (!confirm('Are you sure you want to rotate this API key? The old key will be revoked and a new one will be created.')) {
      return;
    }

    if (!customer?.customerId) return;

    try {
      const response: ApiKeyResponse = await apiClient.rotateApiKey(customer.customerId, keyId);
      newApiKey = response.apiKey;
      showNewKeyModal = true;
      await loadApiKeys();
    } catch (err) {
      alert('Failed to rotate API key: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    alert('API key copied to clipboard!');
    showNewKeyModal = false;
    newApiKey = null;
  }
</script>

<div class="api-keys">
  <h1 class="api-keys__title">API Keys</h1>

  {#if loading}
    <div class="api-keys__loading">Loading API keys...</div>
  {:else if error}
    <div class="api-keys__error">{error}</div>
  {:else}
    <Card>
      <h2 class="api-keys__section-title">Create New API Key</h2>
      <div class="api-keys__create">
        <input
          type="text"
          class="api-keys__input"
          placeholder="Key name (optional)"
          bind:value={newKeyName}
          onkeypress={(e) => e.key === 'Enter' && handleCreateKey()}
        />
        <button class="api-keys__button api-keys__button--primary" onclick={handleCreateKey}>
          Create API Key
        </button>
      </div>
    </Card>

    <Card>
      <h2 class="api-keys__section-title">Your API Keys</h2>
      {#if apiKeys.length === 0}
        <div class="api-keys__empty">
          <div class="api-keys__empty-icon">🔑</div>
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
                  <td class="api-keys__key-value">
                    {#if key.apiKey}
                      <code class="api-keys__key-code">{key.apiKey}</code>
                      <button 
                        class="api-keys__copy-btn" 
                        onclick={() => {
                          navigator.clipboard.writeText(key.apiKey);
                          alert('API key copied to clipboard!');
                        }}
                        title="Copy API key"
                      >
                        📋
                      </button>
                    {:else}
                      <span class="api-keys__key-missing">N/A</span>
                    {/if}
                  </td>
                  <td>
                    <span class="api-keys__status" class:status-active={key.status === 'active'} class:status-revoked={key.status === 'revoked'}>
                      {key.status || 'unknown'}
                    </span>
                  </td>
                  <td class="api-keys__date">
                    {key.createdAt ? new Date(key.createdAt).toLocaleDateString() : 'N/A'}
                  </td>
                  <td class="api-keys__date">
                    {key.lastUsed ? new Date(key.lastUsed).toLocaleDateString() : 'Never'}
                  </td>
                  <td>
                    {#if key.status === 'active'}
                      <div class="api-keys__actions">
                        <button class="api-keys__button api-keys__button--warning" onclick={() => handleRotateKey(key.keyId)}>
                          Rotate
                        </button>
                        <button class="api-keys__button api-keys__button--danger" onclick={() => handleRevokeKey(key.keyId)}>
                          Revoke
                        </button>
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

{#if showNewKeyModal && newApiKey}
  <div 
    class="api-keys__modal" 
    role="dialog"
    tabindex="-1"
    aria-modal="true"
    aria-labelledby="modal-title"
    onclick={(e) => e.target === e.currentTarget && (showNewKeyModal = false)}
    onkeydown={(e) => e.key === 'Escape' && (showNewKeyModal = false)}
  >
    <div class="api-keys__modal-content">
      <h2 id="modal-title" class="api-keys__modal-title">⚠️ API Key Created</h2>
      <p class="api-keys__modal-text">Copy this API key now. You won't be able to see it again!</p>
      <div class="api-keys__modal-key">{newApiKey}</div>
      <button class="api-keys__button api-keys__button--primary" onclick={() => copyToClipboard(newApiKey!)}>
        Copy to Clipboard
      </button>
    </div>
  </div>
{/if}

<style>
  .api-keys {
    width: 100%;
  }

  .api-keys__title {
    font-size: 2rem;
    margin-bottom: var(--spacing-xl);
    color: var(--accent);
  }

  .api-keys__loading,
  .api-keys__error {
    padding: var(--spacing-xl);
    text-align: center;
  }

  .api-keys__error {
    color: var(--danger);
    background: var(--card);
    border: 1px solid var(--danger);
    border-left: 4px solid var(--danger);
    border-radius: var(--radius-md);
    padding: var(--spacing-lg);
  }

  .api-keys__section-title {
    font-size: 1.25rem;
    margin-bottom: var(--spacing-md);
    color: var(--accent);
  }

  .api-keys__info {
    background: var(--bg-dark);
    border: 1px solid var(--border);
    border-left: 4px solid var(--info);
    border-radius: var(--radius-md);
    padding: var(--spacing-md);
    margin-bottom: var(--spacing-lg);
  }

  .api-keys__info-text {
    margin: 0;
    color: var(--text-secondary);
    font-size: 0.875rem;
    line-height: 1.5;
  }

  .api-keys__info-text strong {
    color: var(--text);
  }

  .api-keys__create {
    display: flex;
    gap: var(--spacing-md);
  }

  .api-keys__input {
    flex: 1;
    padding: var(--spacing-md);
    background: var(--bg-dark);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    color: var(--text);
    font-size: 1rem;
  }

  .api-keys__button {
    padding: var(--spacing-md) var(--spacing-lg);
    border: 3px solid;
    border-radius: 0;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.1s;
    white-space: nowrap;
  }

  .api-keys__button--primary {
    background: var(--accent);
    border-color: var(--accent-dark);
    color: #000;
    box-shadow: 0 4px 0 var(--accent-dark);
  }

  .api-keys__button--primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 0 var(--accent-dark);
  }

  .api-keys__button--warning {
    padding: var(--spacing-xs) var(--spacing-md);
    background: var(--warning);
    border: 2px solid var(--warning);
    border-radius: var(--radius-sm);
    color: #000;
    font-weight: 600;
    font-size: 0.875rem;
  }

  .api-keys__button--danger {
    padding: var(--spacing-xs) var(--spacing-md);
    background: transparent;
    border: 2px solid var(--danger);
    border-radius: var(--radius-sm);
    color: var(--danger);
    font-weight: 600;
    font-size: 0.875rem;
  }

  .api-keys__empty {
    text-align: center;
    padding: var(--spacing-3xl);
    color: var(--text-secondary);
  }

  .api-keys__empty-icon {
    font-size: 3rem;
    margin-bottom: var(--spacing-md);
    opacity: 0.5;
  }

  .api-keys__empty-hint {
    margin-top: var(--spacing-sm);
    font-size: 0.875rem;
    color: var(--muted);
  }

  .api-keys__table-container {
    overflow-x: auto;
  }

  .api-keys__table {
    width: 100%;
    border-collapse: collapse;
  }

  .api-keys__table th {
    text-align: left;
    padding: var(--spacing-md);
    color: var(--text-secondary);
    font-weight: 600;
    border-bottom: 1px solid var(--border);
  }

  .api-keys__table td {
    padding: var(--spacing-md);
    border-bottom: 1px solid var(--border);
  }

  .api-keys__key-value {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .api-keys__key-code {
    font-family: monospace;
    font-size: 0.875rem;
    color: var(--accent);
    background: var(--bg-dark);
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--radius-sm);
    word-break: break-all;
    flex: 1;
  }

  .api-keys__copy-btn {
    background: transparent;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: var(--spacing-xs);
    cursor: pointer;
    font-size: 1rem;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .api-keys__copy-btn:hover {
    background: var(--bg-dark);
    border-color: var(--accent);
  }

  .api-keys__key-missing {
    color: var(--text-secondary);
    font-style: italic;
  }

  .api-keys__status {
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--radius-sm);
    font-size: 0.875rem;
    font-weight: 600;
  }

  .api-keys__status.status-active {
    background: var(--success);
    color: #000;
  }

  .api-keys__status.status-revoked {
    background: var(--danger);
    color: #000;
  }

  .api-keys__date {
    color: var(--text-secondary);
    font-size: 0.875rem;
  }

  .api-keys__actions {
    display: flex;
    gap: var(--spacing-sm);
    justify-content: flex-end;
  }

  .api-keys__modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  }

  .api-keys__modal-content {
    background: var(--card);
    border: 2px solid var(--accent);
    border-radius: var(--radius-md);
    padding: var(--spacing-xl);
    max-width: 600px;
    width: 90%;
  }

  .api-keys__modal-title {
    margin-bottom: var(--spacing-lg);
    color: var(--accent);
  }

  .api-keys__modal-text {
    margin-bottom: var(--spacing-md);
    color: var(--text-secondary);
  }

  .api-keys__modal-key {
    background: var(--bg-dark);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: var(--spacing-md);
    margin-bottom: var(--spacing-lg);
    font-family: monospace;
    word-break: break-all;
    color: var(--accent);
    font-weight: 600;
  }
</style>

