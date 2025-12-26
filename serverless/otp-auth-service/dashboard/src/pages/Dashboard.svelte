<script lang="ts">
  import { onMount } from 'svelte';
  import { apiClient } from '$lib/api-client';
  import type { Customer, Analytics, ApiKey, EncryptedApiKeyData } from '$lib/types';
  import Card from '$components/Card.svelte';

  export let customer: Customer | null = null;

  let analytics: Analytics | null = null;
  let apiKeys: ApiKey[] = [];
  let loading = true;
  let error: string | null = null;
  let revealedKeys: Record<string, string> = {};
  let revealingKeyId: string | null = null;

  onMount(async () => {
    // Set timeout to prevent infinite loading (increased to 10 seconds)
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn('Dashboard data load timed out');
        loading = false;
        error = 'Failed to load dashboard data: Request timed out';
      }
    }, 10000);

    try {
      await loadData();
    } finally {
      clearTimeout(timeout);
    }
  });

  async function loadData() {
    loading = true;
    error = null;

    try {
      // Load customer, analytics, and API keys in parallel for better performance
      const [customerData, analyticsData, apiKeysData] = await Promise.all([
        customer ? Promise.resolve(customer) : apiClient.getCustomer().catch(() => null),
        apiClient.getAnalytics().catch(() => null),
        customer?.customerId ? apiClient.getApiKeys(customer.customerId).catch(() => ({ apiKeys: [] })) : Promise.resolve({ apiKeys: [] })
      ]);
      
      customer = customerData;
      analytics = analyticsData;
      
      // API keys are double-encrypted - keep them encrypted until user clicks reveal
      if (apiKeysData && apiKeysData.apiKeys) {
        apiKeys = apiKeysData.apiKeys;
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      error = err instanceof Error ? err.message : 'Failed to load dashboard data';
    } finally {
      loading = false;
    }
  }

  async function handleRevealKey(keyId: string) {
    if (!customer?.customerId) return;
    
    // Check if we can decrypt a double-encrypted key locally first
    const key = apiKeys.find(k => k.keyId === keyId);
    if (key && key.apiKey && typeof key.apiKey === 'object' && 'doubleEncrypted' in key.apiKey) {
      const token = apiClient.getToken();
      if (token) {
        try {
          revealingKeyId = keyId;
          // Uses shared encryption suite from serverless/shared/encryption
          const { decryptWithJWT } = await import('@strixun/api-framework');
          const encryptedData = key.apiKey as EncryptedApiKeyData;
          const decrypted = await decryptWithJWT(encryptedData, token);
          if (typeof decrypted === 'string') {
            revealedKeys[keyId] = decrypted;
            revealingKeyId = null;
            return;
          }
        } catch (err) {
          console.error('Failed to decrypt API key locally:', err);
          // Fall through to server-side reveal
        }
      }
    }
    
    // If local decryption fails or key is not double-encrypted, use server reveal endpoint
    revealingKeyId = keyId;
    error = null;
    
    try {
      const response = await apiClient.revealApiKey(customer.customerId, keyId);
      if (response.apiKey) {
        revealedKeys[keyId] = response.apiKey;
      }
    } catch (err) {
      console.error('Failed to reveal API key:', err);
      error = err instanceof Error ? err.message : 'Failed to reveal API key';
    } finally {
      revealingKeyId = null;
    }
  }

  function maskApiKey(key: string): string {
    if (!key || key.length < 8) return '••••••••';
    const prefix = key.substring(0, 8);
    const suffix = key.substring(key.length - 4);
    return `${prefix}${'•'.repeat(Math.max(0, key.length - 12))}${suffix}`;
  }

  function getDisplayKey(key: ApiKey): string {
    if (revealedKeys[key.keyId]) {
      return revealedKeys[key.keyId];
    }
    if (key.apiKey && typeof key.apiKey === 'string') {
      return maskApiKey(key.apiKey);
    }
    return '••••••••••••••••••••••••';
  }

  function isKeyRevealed(keyId: string): boolean {
    return !!revealedKeys[keyId];
  }
</script>

<div class="dashboard">
  <h1 class="dashboard__title">Dashboard</h1>

  {#if loading}
    <div class="dashboard__loading">Loading...</div>
  {:else if error}
    <div class="dashboard__error">{error}</div>
  {:else}
    {#if customer}
      <Card>
        <h2 class="dashboard__section-title">Account Information</h2>
        <div class="dashboard__info-grid">
          <div class="dashboard__info-item">
            <div class="dashboard__info-label">Customer ID</div>
            <div class="dashboard__info-value">{customer.customerId || 'N/A'}</div>
          </div>
          <div class="dashboard__info-item">
            <div class="dashboard__info-label">Status</div>
            <div class="dashboard__info-value" class:status-active={customer.status === 'active'} class:status-warning={customer.status !== 'active'}>
              {customer.status || 'unknown'}
            </div>
          </div>
          <div class="dashboard__info-item">
            <div class="dashboard__info-label">Plan</div>
            <div class="dashboard__info-value">{customer.plan || 'free'}</div>
          </div>
        </div>
      </Card>
    {/if}

    {#if apiKeys.length > 0}
      <Card>
        <h2 class="dashboard__section-title">Developer API Keys</h2>
        <div class="dashboard__api-keys">
          {#each apiKeys.slice(0, 3) as key}
            <div class="dashboard__api-key-item">
              <div class="dashboard__api-key-info">
                <div class="dashboard__api-key-name">{key.name || 'Unnamed'}</div>
                <div class="dashboard__api-key-id">ID: {key.keyId}</div>
              </div>
              <div class="dashboard__api-key-display">
                <code class="dashboard__api-key-value">{getDisplayKey(key)}</code>
                {#if !isKeyRevealed(key.keyId) && key.status === 'active'}
                  <button 
                    class="dashboard__api-key-reveal" 
                    onclick={() => handleRevealKey(key.keyId)}
                    disabled={revealingKeyId === key.keyId}
                  >
                    {revealingKeyId === key.keyId ? 'Revealing...' : 'Reveal'}
                  </button>
                {/if}
              </div>
            </div>
          {/each}
          {#if apiKeys.length > 3}
            <p class="dashboard__api-keys-more">+ {apiKeys.length - 3} more API key{apiKeys.length - 3 === 1 ? '' : 's'}. View all in <a href="#api-keys">API Keys</a> tab.</p>
          {/if}
        </div>
      </Card>
    {/if}

    {#if analytics?.today}
      <div class="dashboard__metrics">
        <Card>
          <div class="dashboard__metric">
            <div class="dashboard__metric-label">OTP Requests (Today)</div>
            <div class="dashboard__metric-value dashboard__metric-value--accent">
              {analytics.today.otpRequests || 0}
            </div>
          </div>
        </Card>
        <Card>
          <div class="dashboard__metric">
            <div class="dashboard__metric-label">Successful Logins (Today)</div>
            <div class="dashboard__metric-value dashboard__metric-value--success">
              {analytics.today.successfulLogins || 0}
            </div>
          </div>
        </Card>
        <Card>
          <div class="dashboard__metric">
            <div class="dashboard__metric-label">Failed Attempts (Today)</div>
            <div class="dashboard__metric-value dashboard__metric-value--danger">
              {analytics.today.failedAttempts || 0}
            </div>
          </div>
        </Card>
        <Card>
          <div class="dashboard__metric">
            <div class="dashboard__metric-label">Success Rate</div>
            <div class="dashboard__metric-value dashboard__metric-value--info">
              {analytics.today.successRate || 0}%
            </div>
          </div>
        </Card>
      </div>
    {:else}
      <Card>
        <div class="dashboard__empty">
          <div class="dashboard__empty-icon">📊</div>
          <p>No analytics data available yet</p>
          <p class="dashboard__empty-hint">Analytics will appear here once you start using the API</p>
        </div>
      </Card>
    {/if}
  {/if}
</div>

<style>
  .dashboard {
    width: 100%;
    position: relative;
    z-index: 1;
    pointer-events: auto;
  }

  .dashboard__title {
    font-size: 2rem;
    margin-bottom: var(--spacing-xl);
    color: var(--accent);
  }

  .dashboard__loading,
  .dashboard__error {
    padding: var(--spacing-xl);
    text-align: center;
    color: var(--text-secondary);
    position: relative;
    z-index: 1;
    pointer-events: auto;
  }

  .dashboard__error {
    color: var(--danger);
    background: var(--card);
    border: 1px solid var(--danger);
    border-left: 4px solid var(--danger);
    border-radius: var(--radius-md);
    padding: var(--spacing-lg);
  }

  .dashboard__section-title {
    font-size: 1.25rem;
    margin-bottom: var(--spacing-md);
    color: var(--accent);
  }

  .dashboard__info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--spacing-md);
  }

  .dashboard__info-item {
    display: flex;
    flex-direction: column;
  }

  .dashboard__info-label {
    color: var(--text-secondary);
    font-size: 0.875rem;
    margin-bottom: var(--spacing-xs);
  }

  .dashboard__info-value {
    font-weight: 600;
    font-family: monospace;
  }

  .dashboard__info-value.status-active {
    color: var(--success);
  }

  .dashboard__info-value.status-warning {
    color: var(--warning);
  }

  .dashboard__metrics {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: var(--spacing-lg);
    margin-top: var(--spacing-xl);
  }

  .dashboard__metric {
    display: flex;
    flex-direction: column;
  }

  .dashboard__metric-label {
    color: var(--text-secondary);
    font-size: 0.875rem;
    margin-bottom: var(--spacing-xs);
  }

  .dashboard__metric-value {
    font-size: 2rem;
    font-weight: 700;
  }

  .dashboard__metric-value--accent {
    color: var(--accent);
  }

  .dashboard__metric-value--success {
    color: var(--success);
  }

  .dashboard__metric-value--danger {
    color: var(--danger);
  }

  .dashboard__metric-value--info {
    color: var(--info);
  }

  .dashboard__empty {
    text-align: center;
    padding: var(--spacing-3xl);
    color: var(--text-secondary);
  }

  .dashboard__empty-icon {
    font-size: 3rem;
    margin-bottom: var(--spacing-md);
    opacity: 0.5;
  }

  .dashboard__empty-hint {
    margin-top: var(--spacing-sm);
    font-size: 0.875rem;
    color: var(--muted);
  }

  .dashboard__api-keys {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .dashboard__api-key-item {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    padding: var(--spacing-md);
    background: var(--bg-dark);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
  }

  .dashboard__api-key-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .dashboard__api-key-name {
    font-weight: 600;
    color: var(--text);
  }

  .dashboard__api-key-id {
    font-family: monospace;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .dashboard__api-key-display {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    flex-wrap: wrap;
  }

  .dashboard__api-key-value {
    font-family: monospace;
    font-size: 0.875rem;
    background: var(--bg);
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--radius-sm);
    color: var(--text);
    word-break: break-all;
    flex: 1;
    min-width: 200px;
  }

  .dashboard__api-key-reveal {
    padding: var(--spacing-xs) var(--spacing-md);
    background: var(--accent);
    border: 2px solid var(--accent-dark);
    border-radius: var(--radius-sm);
    color: #000;
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    white-space: nowrap;
  }

  .dashboard__api-key-reveal:hover:not(:disabled) {
    background: var(--accent-dark);
  }

  .dashboard__api-key-reveal:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .dashboard__api-keys-more {
    margin-top: var(--spacing-sm);
    font-size: 0.875rem;
    color: var(--text-secondary);
    text-align: center;
  }

  .dashboard__api-keys-more a {
    color: var(--accent);
    text-decoration: underline;
  }
</style>

