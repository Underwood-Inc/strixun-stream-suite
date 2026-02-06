<script lang="ts">
  import { onMount } from 'svelte';
  import { apiClient } from '$dashboard/lib/api-client';
  import type { Customer, ApiKey, ApiKeyResponse, ApiKeyVerifyResponse } from '$dashboard/lib/types';
  import Card from '$dashboard/components/Card.svelte';
  import ObfuscatedText from '@shared-components/svelte/ObfuscatedText.svelte';
  import CodeBlock from '@shared-components/svelte/CodeBlock.svelte';

  export let customer: Customer | null = null;

  let apiKeys: ApiKey[] = [];
  let loading = true;
  let error: string | null = null;
  let newKeyName = '';
  let showNewKeyModal = false;
  let newApiKey: string | null = null;
  
  // Test API key state
  let showTestModal = false;
  let testResult: ApiKeyVerifyResponse | null = null;
  let testingKeyId: string | null = null;
  let testError: string | null = null;
  
  // Code snippet modal state
  let showCodeSnippetModal = false;
  let codeSnippet: string = '';
  
  // Per-key origins modal state
  let showOriginsModal = false;
  let editingKeyId: string | null = null;
  let editingKeyName: string = '';
  let editingOrigins: string[] = [];
  let newOrigin = '';
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

  /**
   * Test an API key to verify it works
   * First reveals the key, then tests it
   */
  async function handleTestKey(keyId: string) {
    if (!customer?.customerId) return;
    
    testingKeyId = keyId;
    testError = null;
    testResult = null;
    showTestModal = true;
    
    try {
      // First, reveal the API key
      const response = await fetch(`/admin/customers/${customer.customerId}/api-keys/${keyId}/reveal`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error('Failed to reveal API key for testing');
      }
      
      const revealData = await response.json() as { apiKey?: string };
      const apiKeyValue = revealData.apiKey;
      
      if (!apiKeyValue) {
        throw new Error('Could not retrieve API key value');
      }
      
      // Now test the key
      const result = await apiClient.testApiKey(apiKeyValue);
      testResult = result;
    } catch (err) {
      testError = err instanceof Error ? err.message : 'Failed to test API key';
    } finally {
      testingKeyId = null;
    }
  }

  /**
   * Show the code snippet modal for end-to-end testing
   */
  async function handleShowCodeSnippet(keyId: string) {
    if (!customer?.customerId) return;
    
    codeSnippet = '';
    showCodeSnippetModal = true;
    
    try {
      // First, reveal the API key
      const response = await fetch(`/admin/customers/${customer.customerId}/api-keys/${keyId}/reveal`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error('Failed to reveal API key');
      }
      
      const revealData = await response.json() as { apiKey?: string };
      const apiKeyValue = revealData.apiKey;
      
      if (!apiKeyValue) {
        throw new Error('Could not retrieve API key value');
      }
      
      // Get the code snippet
      const snippetResponse = await apiClient.getTestSnippet(apiKeyValue);
      codeSnippet = snippetResponse.snippet;
    } catch (err) {
      codeSnippet = `<!-- Error: ${err instanceof Error ? err.message : 'Failed to generate snippet'} -->`;
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    alert('API key copied to clipboard!');
    showNewKeyModal = false;
    newApiKey = null;
  }

  function closeTestModal() {
    showTestModal = false;
    testResult = null;
    testError = null;
  }

  function closeSnippetModal() {
    showCodeSnippetModal = false;
    codeSnippet = '';
  }

  function downloadSnippet() {
    if (!codeSnippet) return;
    const blob = new Blob([codeSnippet], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'otp-auth-test.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ===== Per-Key Allowed Origins Functions =====
  
  function openOriginsModal(key: ApiKey) {
    editingKeyId = key.keyId;
    editingKeyName = key.name;
    editingOrigins = [...(key.allowedOrigins || [])];
    newOrigin = '';
    originsError = null;
    originsSuccess = null;
    showOriginsModal = true;
  }
  
  function closeOriginsModal() {
    showOriginsModal = false;
    editingKeyId = null;
    editingKeyName = '';
    editingOrigins = [];
    newOrigin = '';
    originsError = null;
    originsSuccess = null;
  }
  
  function addOrigin() {
    const origin = newOrigin.trim();
    if (!origin) return;
    
    // Validate URL format
    if (!origin.startsWith('http://') && !origin.startsWith('https://')) {
      originsError = 'Origin must start with http:// or https://';
      return;
    }
    
    // Remove trailing slash
    const normalizedOrigin = origin.replace(/\/$/, '');
    
    // Check for duplicates
    if (editingOrigins.includes(normalizedOrigin)) {
      originsError = 'This origin is already added';
      return;
    }
    
    editingOrigins = [...editingOrigins, normalizedOrigin];
    newOrigin = '';
    originsError = null;
    originsSuccess = null;
  }
  
  function removeOrigin(origin: string) {
    editingOrigins = editingOrigins.filter(o => o !== origin);
    originsSuccess = null;
  }
  
  async function saveKeyOrigins() {
    if (!customer?.customerId || !editingKeyId) return;
    
    originsSaving = true;
    originsError = null;
    originsSuccess = null;
    
    try {
      await apiClient.updateKeyOrigins(customer.customerId, editingKeyId, editingOrigins);
      originsSuccess = 'Allowed origins saved successfully!';
      // Update local state
      const keyIndex = apiKeys.findIndex(k => k.keyId === editingKeyId);
      if (keyIndex >= 0) {
        apiKeys[keyIndex] = { ...apiKeys[keyIndex], allowedOrigins: editingOrigins };
        apiKeys = [...apiKeys]; // Trigger reactivity
      }
      setTimeout(() => {
        closeOriginsModal();
      }, 1500);
    } catch (err) {
      console.error('Failed to save allowed origins:', err);
      originsError = err instanceof Error ? err.message : 'Failed to save configuration';
    } finally {
      originsSaving = false;
    }
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
                  <td class="api-keys__key-value">
                    <code class="api-keys__key-code">sk_<ObfuscatedText text="****" length={12} charset="hex" color="warning" revealOnHover ariaLabel={`API Key ending in ${key.keyId.substring(key.keyId.length - 8)}`} />{key.keyId.substring(key.keyId.length - 8)}</code>
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
                        <button 
                          class="api-keys__button api-keys__button--test" 
                          onclick={() => handleTestKey(key.keyId)}
                          disabled={testingKeyId === key.keyId}
                        >
                          {testingKeyId === key.keyId ? '...' : 'Test'}
                        </button>
                        <button 
                          class="api-keys__button api-keys__button--code" 
                          onclick={() => handleShowCodeSnippet(key.keyId)}
                          title="Get HTML+JS code for end-to-end testing"
                        >
                          {'</>'}
                        </button>
                        <button 
                          class="api-keys__button api-keys__button--origins" 
                          onclick={() => openOriginsModal(key)}
                          title="Configure allowed origins for CORS"
                        >
                          🌐 {key.allowedOrigins?.length || 0}
                        </button>
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
      <h2 id="modal-title" class="api-keys__modal-title">⚠ API Key Created</h2>
      <p class="api-keys__modal-text">Copy this API key now. You won't be able to see it again!</p>
      <div class="api-keys__modal-key">{newApiKey}</div>
      <button class="api-keys__button api-keys__button--primary" onclick={() => copyToClipboard(newApiKey!)}>
        Copy to Clipboard
      </button>
    </div>
  </div>
{/if}

<!-- Test Result Modal -->
{#if showTestModal}
  <div 
    class="api-keys__modal" 
    role="dialog"
    tabindex="-1"
    aria-modal="true"
    aria-labelledby="test-modal-title"
    onclick={(e) => e.target === e.currentTarget && closeTestModal()}
    onkeydown={(e) => e.key === 'Escape' && closeTestModal()}
  >
    <div class="api-keys__modal-content api-keys__modal-content--test">
      <button class="api-keys__modal-close" onclick={closeTestModal} aria-label="Close modal">×</button>
      
      {#if testingKeyId}
        <div class="api-keys__test-loading">
          <div class="api-keys__spinner"></div>
          <p>Testing API key...</p>
        </div>
      {:else if testError}
        <h2 id="test-modal-title" class="api-keys__modal-title api-keys__modal-title--error">✗ Test Failed</h2>
        <p class="api-keys__modal-text">{testError}</p>
      {:else if testResult}
        <h2 id="test-modal-title" class="api-keys__modal-title" class:api-keys__modal-title--success={testResult.valid} class:api-keys__modal-title--error={!testResult.valid}>
          {testResult.valid ? '✓ Multi-Tenant Integration Test Passed' : '✗ Integration Test Failed'}
        </h2>
        
        <!-- Test Summary -->
        {#if testResult.testSummary}
          <p class="api-keys__test-summary" class:api-keys__test-summary--success={testResult.valid} class:api-keys__test-summary--error={!testResult.valid}>
            {testResult.testSummary}
          </p>
        {/if}
        
        <!-- Test Steps -->
        {#if testResult.testSteps && testResult.testSteps.length > 0}
          <div class="api-keys__test-section">
            <h3>Test Steps</h3>
            <ul class="api-keys__test-steps">
              {#each testResult.testSteps as step}
                <li class="api-keys__test-step" class:api-keys__test-step--passed={step.status === 'passed'} class:api-keys__test-step--failed={step.status === 'failed'} class:api-keys__test-step--skipped={step.status === 'skipped'}>
                  <span class="api-keys__step-number">{step.step}</span>
                  <span class="api-keys__step-icon">
                    {#if step.status === 'passed'}✓{:else if step.status === 'failed'}✗{:else if step.status === 'skipped'}○{:else}•{/if}
                  </span>
                  <div class="api-keys__step-content">
                    <span class="api-keys__step-name">{step.name}</span>
                    <span class="api-keys__step-message">{step.message}</span>
                    {#if step.duration !== undefined}
                      <span class="api-keys__step-duration">{step.duration}ms</span>
                    {/if}
                  </div>
                </li>
              {/each}
            </ul>
          </div>
        {/if}
        
        {#if testResult.valid}
          <div class="api-keys__test-result">
            <div class="api-keys__test-section">
              <h3>Key Information</h3>
              <dl class="api-keys__test-details">
                <dt>Key ID</dt>
                <dd>{testResult.keyId}</dd>
                <dt>Name</dt>
                <dd>{testResult.name}</dd>
                <dt>Customer ID</dt>
                <dd><code>{testResult.customerId}</code></dd>
                <dt>Status</dt>
                <dd><span class="api-keys__status status-active">{testResult.status}</span></dd>
                <dt>Plan</dt>
                <dd><span class="api-keys__plan">{testResult.customerPlan}</span></dd>
              </dl>
            </div>
            
            <div class="api-keys__test-section">
              <h3>Rate Limits</h3>
              {#if testResult.rateLimits}
                <dl class="api-keys__test-details">
                  <dt>Per Hour</dt>
                  <dd>{testResult.rateLimits.requestsPerHour.toLocaleString()} requests</dd>
                  <dt>Per Day</dt>
                  <dd>{testResult.rateLimits.requestsPerDay.toLocaleString()} requests</dd>
                </dl>
              {/if}
            </div>
            
            <div class="api-keys__test-section">
              <h3>Available Services ({testResult.services.filter((s: { available: boolean }) => s.available).length}/{testResult.services.length})</h3>
              <ul class="api-keys__services-list">
                {#each testResult.services as service}
                  <li class:api-keys__service--available={service.available} class:api-keys__service--unavailable={!service.available}>
                    <span class="api-keys__service-icon">{service.available ? '✓' : '✗'}</span>
                    <span class="api-keys__service-name">{service.name}</span>
                    <code class="api-keys__service-endpoint">{service.endpoint}</code>
                  </li>
                {/each}
              </ul>
            </div>
          </div>
        {:else}
          <p class="api-keys__modal-text api-keys__modal-text--error">{testResult.error || 'The API key is not valid. Please check the key or contact support.'}</p>
        {/if}
      {/if}
    </div>
  </div>
{/if}

<!-- Code Snippet Modal -->
{#if showCodeSnippetModal}
  <div 
    class="api-keys__modal" 
    role="dialog"
    tabindex="-1"
    aria-modal="true"
    aria-labelledby="snippet-modal-title"
    onclick={(e) => e.target === e.currentTarget && closeSnippetModal()}
    onkeydown={(e) => e.key === 'Escape' && closeSnippetModal()}
  >
    <div class="api-keys__modal-content api-keys__modal-content--snippet">
      <!-- Modal Header -->
      <div class="api-keys__modal-header">
        <h2 id="snippet-modal-title" class="api-keys__modal-title">{'</>'} End-to-End Test Page</h2>
        <button class="api-keys__modal-close" onclick={closeSnippetModal} aria-label="Close modal">×</button>
      </div>
      
      <!-- Modal Body -->
      <div class="api-keys__modal-body">
        <p class="api-keys__modal-text">
          Download or copy this HTML code. Open it in your browser to test the complete OTP flow.
        </p>
        
        <div class="api-keys__snippet-instructions">
          <h4>Instructions:</h4>
          <ol>
            <li>Click "Download HTML" below to save the file</li>
            <li>Open the downloaded file in your browser</li>
            <li>Enter your email and test the full OTP flow</li>
          </ol>
        </div>
        
        <div class="api-keys__snippet-container">
          {#if codeSnippet}
            <CodeBlock code={codeSnippet} language="html" />
          {:else}
            <div class="api-keys__test-loading">
              <div class="api-keys__spinner"></div>
              <p>Generating code snippet...</p>
            </div>
          {/if}
        </div>
      </div>
      
      <!-- Modal Footer -->
      <div class="api-keys__modal-footer">
        <button 
          class="api-keys__button--secondary" 
          onclick={closeSnippetModal}
        >
          Close
        </button>
        <button 
          class="api-keys__button--download" 
          onclick={downloadSnippet}
          disabled={!codeSnippet}
        >
          ⬇️ Download HTML
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Per-Key Origins Modal -->
{#if showOriginsModal}
  <div 
    class="api-keys__modal" 
    role="dialog"
    tabindex="-1"
    aria-modal="true"
    aria-labelledby="origins-modal-title"
    onclick={(e) => e.target === e.currentTarget && closeOriginsModal()}
    onkeydown={(e) => e.key === 'Escape' && closeOriginsModal()}
  >
    <div class="api-keys__modal-content api-keys__modal-content--origins">
      <!-- Modal Header -->
      <div class="api-keys__modal-header">
        <h2 id="origins-modal-title" class="api-keys__modal-title">🌐 Allowed Origins</h2>
        <button class="api-keys__modal-close" onclick={closeOriginsModal} aria-label="Close modal">×</button>
      </div>
      
      <!-- Modal Body -->
      <div class="api-keys__modal-body">
        <p class="api-keys__modal-text">
          Configure which domains can use the API key <strong>"{editingKeyName}"</strong>.
        </p>
        <p class="api-keys__modal-text api-keys__modal-text--info">
          <strong>No origins configured</strong> = Key works from <em>any</em> origin.<br/>
          <strong>Origins configured</strong> = Key <em>only</em> works from those specific origins.
        </p>
        
        {#if originsError}
          <div class="api-keys__origins-error">{originsError}</div>
        {/if}
        
        {#if originsSuccess}
          <div class="api-keys__origins-success">{originsSuccess}</div>
        {/if}
        
        <div class="api-keys__origins-add">
          <input
            type="text"
            class="api-keys__input"
            placeholder="https://your-app.com"
            bind:value={newOrigin}
            onkeypress={(e: KeyboardEvent) => e.key === 'Enter' && addOrigin()}
          />
          <button class="api-keys__button api-keys__button--add-origin" onclick={addOrigin}>
            Add
          </button>
        </div>
        
        <div class="api-keys__origins-help">
          <strong>Examples:</strong>
          <code>https://myapp.com</code>,
          <code>http://localhost:3000</code>
        </div>
        
        {#if editingOrigins.length === 0}
          <div class="api-keys__origins-empty">
            <p>No allowed origins configured for this key.</p>
            <p class="api-keys__origins-empty-hint">
              Add origins to use this API key from a browser.
            </p>
          </div>
        {:else}
          <ul class="api-keys__origins-list">
            {#each editingOrigins as origin}
              <li class="api-keys__origin-item">
                <code class="api-keys__origin-value">{origin}</code>
                <button 
                  class="api-keys__origin-remove" 
                  onclick={() => removeOrigin(origin)}
                  aria-label={`Remove ${origin}`}
                >
                  ×
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
      
      <!-- Modal Footer -->
      <div class="api-keys__modal-footer">
        <button 
          class="api-keys__button--secondary" 
          onclick={closeOriginsModal}
        >
          Cancel
        </button>
        <button 
          class="api-keys__button--download" 
          onclick={saveKeyOrigins}
          disabled={originsSaving}
        >
          {originsSaving ? 'Saving...' : 'Save Origins'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .api-keys {
    width: 100%;
  }

  .api-keys :global(.card + .card) {
    margin-top: var(--spacing-xl);
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
    font-family: monospace;
  }

  .api-keys__key-code {
    font-family: monospace;
    font-size: 0.875rem;
    color: var(--accent);
    background: var(--bg-dark);
    padding: var(--spacing-xs) var(--spacing-sm);
    display: inline-flex;
    align-items: center;
    vertical-align: middle;
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
    padding: 1rem;
  }

  .api-keys__modal-content {
    background: var(--card);
    border: 2px solid var(--accent);
    border-radius: var(--radius-md);
    padding: var(--spacing-xl);
    max-width: 600px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
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

  /* Test button styles */
  .api-keys__button--test {
    padding: var(--spacing-xs) var(--spacing-md);
    background: var(--info);
    border: 2px solid var(--info);
    border-radius: var(--radius-sm);
    color: #000;
    font-weight: 600;
    font-size: 0.875rem;
  }

  .api-keys__button--test:hover {
    opacity: 0.9;
  }

  .api-keys__button--test:disabled {
    opacity: 0.6;
    cursor: wait;
  }

  /* Code snippet button */
  .api-keys__button--code {
    padding: var(--spacing-xs) var(--spacing-sm);
    background: var(--bg-dark);
    border: 2px solid var(--accent);
    border-radius: var(--radius-sm);
    color: var(--accent);
    font-weight: 700;
    font-size: 0.75rem;
    font-family: monospace;
  }

  .api-keys__button--code:hover {
    background: var(--accent);
    color: #000;
  }

  /* Origins button */
  .api-keys__button--origins {
    padding: var(--spacing-xs) var(--spacing-sm);
    background: var(--bg-dark);
    border: 2px solid var(--info);
    border-radius: var(--radius-sm);
    color: var(--info);
    font-weight: 600;
    font-size: 0.75rem;
  }

  .api-keys__button--origins:hover {
    background: var(--info);
    color: #000;
  }

  /* Add origin button */
  .api-keys__button--add-origin {
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--accent);
    border: none;
    border-radius: var(--radius-sm);
    color: #000;
    font-weight: 600;
    width: auto;
    flex-shrink: 0;
  }

  .api-keys__button--add-origin:hover {
    background: var(--accent-light);
  }

  /* Origins modal */
  .api-keys__modal-content--origins {
    max-width: 600px;
  }

  /* Modal structure */
  .api-keys__modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: var(--spacing-md);
    border-bottom: 1px solid var(--border);
    margin-bottom: var(--spacing-md);
  }

  .api-keys__modal-header .api-keys__modal-title {
    margin-bottom: 0;
  }

  .api-keys__modal-body {
    flex: 1;
    overflow-y: auto;
  }

  .api-keys__modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--spacing-md);
    padding-top: var(--spacing-md);
    border-top: 1px solid var(--border);
    margin-top: var(--spacing-md);
  }

  .api-keys__button--secondary {
    padding: var(--spacing-sm) var(--spacing-lg);
    background: transparent;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    width: auto;
  }

  .api-keys__button--secondary:hover {
    background: var(--bg-dark);
    border-color: var(--text-secondary);
  }

  /* Modal close button */
  .api-keys__modal-close {
    background: transparent;
    border: none;
    flex-shrink: 0;
    color: var(--text-secondary);
    font-size: 1.5rem;
    cursor: pointer;
    padding: var(--spacing-xs);
    line-height: 1;
  }

  .api-keys__modal-close:hover {
    color: var(--text);
  }

  /* Test modal content */
  .api-keys__modal-content--test {
    position: relative;
    max-width: 700px;
    overflow-y: auto;
  }
  
  .api-keys__modal-content--snippet {
    position: relative;
    max-width: 700px;
  }

  .api-keys__modal-title--success {
    color: var(--success);
  }

  .api-keys__modal-title--error {
    color: var(--danger);
  }

  /* Test loading state */
  .api-keys__test-loading {
    text-align: center;
    padding: var(--spacing-xl);
  }

  .api-keys__spinner {
    width: 40px;
    height: 40px;
    border: 4px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto var(--spacing-md);
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Test result sections */
  .api-keys__test-result {
    margin-top: var(--spacing-lg);
  }

  .api-keys__test-section {
    margin-bottom: var(--spacing-lg);
    padding: var(--spacing-md);
    background: var(--bg-dark);
    border-radius: var(--radius-md);
  }

  .api-keys__test-section h3 {
    margin-bottom: var(--spacing-sm);
    font-size: 1rem;
    color: var(--accent);
  }

  .api-keys__test-details {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--spacing-xs) var(--spacing-md);
  }

  .api-keys__test-details dt {
    color: var(--text-secondary);
    font-size: 0.875rem;
  }

  .api-keys__test-details dd {
    margin: 0;
    font-size: 0.875rem;
  }

  .api-keys__plan {
    padding: var(--spacing-xs) var(--spacing-sm);
    background: var(--accent);
    color: #000;
    border-radius: var(--radius-sm);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  /* Services list */
  .api-keys__services-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .api-keys__services-list li {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-xs) 0;
    font-size: 0.875rem;
  }

  .api-keys__service--available .api-keys__service-icon {
    color: var(--success);
  }

  .api-keys__service--unavailable {
    opacity: 0.5;
  }

  .api-keys__service--unavailable .api-keys__service-icon {
    color: var(--danger);
  }

  .api-keys__service-name {
    flex: 1;
  }

  .api-keys__service-endpoint {
    font-family: monospace;
    font-size: 0.75rem;
    color: var(--text-secondary);
    background: var(--bg);
    padding: 2px var(--spacing-xs);
    border-radius: var(--radius-sm);
  }

  /* Code snippet modal */
  .api-keys__modal-content--snippet {
    max-width: 900px;
    width: 95%;
  }
  
  /* Responsive modal adjustments */
  @media (max-width: 768px) {
    .api-keys__modal {
      padding: var(--spacing-md) var(--spacing-sm);
    }
    
    .api-keys__modal-content {
      padding: var(--spacing-md);
    }
    
    .api-keys__modal-content--snippet {
      width: 100%;
    }
  }

  .api-keys__button--download {
    padding: var(--spacing-sm) var(--spacing-lg);
    background: var(--success);
    border: none;
    border-radius: var(--radius-sm);
    color: #fff;
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xs);
    white-space: nowrap;
    width: auto;
  }

  .api-keys__button--download:hover {
    background: #2fb350;
  }

  .api-keys__button--download:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .api-keys__snippet-instructions {
    background: var(--bg-dark);
    border-radius: var(--radius-md);
    padding: var(--spacing-md);
    margin-bottom: var(--spacing-lg);
  }

  .api-keys__snippet-instructions h4 {
    margin-bottom: var(--spacing-sm);
    color: var(--accent);
  }

  .api-keys__snippet-instructions ol {
    margin: 0;
    padding-left: var(--spacing-lg);
    color: var(--text-secondary);
    font-size: 0.875rem;
  }

  .api-keys__snippet-instructions li {
    margin-bottom: var(--spacing-xs);
  }

  .api-keys__snippet-instructions code {
    background: var(--bg);
    padding: 2px var(--spacing-xs);
    border-radius: var(--radius-sm);
    color: var(--accent);
  }

  .api-keys__snippet-container {
    background: var(--bg-dark);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    max-height: 400px;
    overflow: auto;
    margin-bottom: var(--spacing-lg);
  }

  .api-keys__snippet-code {
    margin: 0;
    padding: var(--spacing-md);
    font-family: monospace;
    font-size: 0.75rem;
    line-height: 1.5;
    white-space: pre;
    color: var(--text);
  }

  .api-keys__button--copy {
    width: 100%;
    margin-top: var(--spacing-md);
  }

  /* Test summary styles */
  .api-keys__test-summary {
    padding: var(--spacing-md);
    border-radius: var(--radius-md);
    margin-bottom: var(--spacing-lg);
    font-weight: 600;
  }

  .api-keys__test-summary--success {
    background: rgba(0, 210, 106, 0.15);
    border: 1px solid var(--success);
    color: var(--success);
  }

  .api-keys__test-summary--error {
    background: rgba(255, 71, 87, 0.15);
    border: 1px solid var(--danger);
    color: var(--danger);
  }

  /* Test steps styles */
  .api-keys__test-steps {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .api-keys__test-step {
    display: flex;
    align-items: flex-start;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    margin-bottom: var(--spacing-xs);
    border-radius: var(--radius-sm);
    background: var(--bg-dark);
    border-left: 3px solid var(--border);
  }

  .api-keys__test-step--passed {
    border-left-color: var(--success);
  }

  .api-keys__test-step--failed {
    border-left-color: var(--danger);
    background: rgba(255, 71, 87, 0.1);
  }

  .api-keys__test-step--skipped {
    border-left-color: var(--warning);
    opacity: 0.7;
  }

  .api-keys__step-number {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--border);
    color: var(--text);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 700;
    flex-shrink: 0;
  }

  .api-keys__test-step--passed .api-keys__step-number {
    background: var(--success);
    color: #000;
  }

  .api-keys__test-step--failed .api-keys__step-number {
    background: var(--danger);
    color: #000;
  }

  .api-keys__step-icon {
    font-size: 1rem;
    width: 20px;
    text-align: center;
    flex-shrink: 0;
  }

  .api-keys__test-step--passed .api-keys__step-icon {
    color: var(--success);
  }

  .api-keys__test-step--failed .api-keys__step-icon {
    color: var(--danger);
  }

  .api-keys__test-step--skipped .api-keys__step-icon {
    color: var(--warning);
  }

  .api-keys__step-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .api-keys__step-name {
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--text);
  }

  .api-keys__step-message {
    font-size: 0.75rem;
    color: var(--text-secondary);
    word-break: break-word;
  }

  .api-keys__step-duration {
    font-size: 0.625rem;
    color: var(--muted);
    font-family: monospace;
  }

  .api-keys__modal-text--error {
    color: var(--danger);
  }

  /* ===== Allowed Origins Styles ===== */
  
  .api-keys__section-description {
    color: var(--text-secondary);
    font-size: 0.875rem;
    margin-bottom: var(--spacing-lg);
    line-height: 1.5;
  }
  
  .api-keys__origins-add {
    display: flex;
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-md);
  }
  
  .api-keys__button--secondary {
    background: var(--bg-dark);
    border-color: var(--accent);
    color: var(--accent);
    box-shadow: 0 4px 0 var(--border);
  }

  .api-keys__button--secondary:hover {
    background: var(--accent);
    color: #000;
    transform: translateY(-2px);
    box-shadow: 0 6px 0 var(--border);
  }
  
  .api-keys__origins-help {
    font-size: 0.75rem;
    color: var(--text-secondary);
    margin-bottom: var(--spacing-lg);
  }
  
  .api-keys__origins-help code {
    background: var(--bg-dark);
    padding: 2px var(--spacing-xs);
    border-radius: var(--radius-sm);
    color: var(--accent);
    margin: 0 var(--spacing-xs);
  }
  
  .api-keys__origins-empty {
    text-align: center;
    padding: var(--spacing-xl);
    color: var(--text-secondary);
    background: var(--bg-dark);
    border-radius: var(--radius-md);
    border: 1px dashed var(--border);
  }
  
  .api-keys__origins-empty-hint {
    margin-top: var(--spacing-sm);
    font-size: 0.875rem;
    color: var(--muted);
  }
  
  .api-keys__origins-list {
    list-style: none;
    padding: 0;
    margin: 0 0 var(--spacing-lg) 0;
  }
  
  .api-keys__origin-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--bg-dark);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    margin-bottom: var(--spacing-sm);
  }
  
  .api-keys__origin-value {
    font-family: monospace;
    font-size: 0.875rem;
    color: var(--accent);
    word-break: break-all;
  }
  
  .api-keys__origin-remove {
    background: transparent;
    border: none;
    color: var(--danger);
    font-size: 1.25rem;
    cursor: pointer;
    padding: var(--spacing-xs);
    line-height: 1;
    opacity: 0.7;
    transition: opacity 0.2s;
  }
  
  .api-keys__origin-remove:hover {
    opacity: 1;
  }
  
  .api-keys__origins-save {
    width: 100%;
  }
  
  .api-keys__origins-error {
    color: var(--danger);
    background: rgba(255, 71, 87, 0.1);
    border: 1px solid var(--danger);
    border-radius: var(--radius-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    margin-bottom: var(--spacing-md);
    font-size: 0.875rem;
  }
  
  .api-keys__origins-success {
    color: var(--success);
    background: rgba(0, 210, 106, 0.1);
    border: 1px solid var(--success);
    border-radius: var(--radius-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    margin-bottom: var(--spacing-md);
    font-size: 0.875rem;
  }
</style>

