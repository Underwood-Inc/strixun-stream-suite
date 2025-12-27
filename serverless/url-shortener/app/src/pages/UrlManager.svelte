<script lang="ts">
  import { onMount } from 'svelte';
  import { apiClient, type ShortUrl } from '$lib/api-client';
  import { createEventDispatcher } from 'svelte';

  export let userEmail: string | null = null;

  const dispatch = createEventDispatcher();

  let urls: ShortUrl[] = [];
  let loading = false;
  let urlInput = '';
  let customCodeInput = '';
  let creating = false;

  onMount(() => {
    loadUrls();
  });

  async function loadUrls(): Promise<void> {
    loading = true;
    try {
      const response = await apiClient.listUrls();
      if (response.success && response.urls) {
        urls = response.urls;
      } else {
        console.error('Failed to load URLs:', response.error);
      }
    } catch (error) {
      console.error('Error loading URLs:', error);
    } finally {
      loading = false;
    }
  }

  async function createShortUrl(): Promise<void> {
    if (!urlInput.trim()) {
      showToast('Please enter a URL to shorten', 'error');
      return;
    }

    if (!isValidUrl(urlInput.trim())) {
      showToast('Please enter a valid URL (must start with http:// or https://)', 'error');
      return;
    }

    if (customCodeInput && !/^[a-zA-Z0-9_-]{3,20}$/.test(customCodeInput)) {
      showToast('Custom code must be 3-20 characters and contain only letters, numbers, hyphens, and underscores', 'error');
      return;
    }

    creating = true;
    try {
      const response = await apiClient.createUrl({
        url: urlInput.trim(),
        customCode: customCodeInput.trim() || undefined,
      });

      if (response.success && response.shortUrl) {
        showToast(`Short URL created: ${response.shortUrl}`, 'success');
        urlInput = '';
        customCodeInput = '';
        await loadUrls();
      } else {
        showToast(response.error || 'Failed to create short URL', 'error');
      }
    } catch (error: any) {
      if (error.message?.includes('Unauthorized')) {
        showToast('Session expired. Please sign in again.', 'error');
        dispatch('logout');
      } else {
        showToast('Network error. Please try again.', 'error');
      }
    } finally {
      creating = false;
    }
  }

  async function deleteUrl(shortCode: string): Promise<void> {
    if (!confirm('Are you sure you want to delete this short URL?')) {
      return;
    }

    try {
      const response = await apiClient.deleteUrl(shortCode);
      if (response.success) {
        showToast('Short URL deleted successfully', 'success');
        await loadUrls();
      } else {
        if (response.error?.includes('Unauthorized')) {
          showToast('Session expired. Please sign in again.', 'error');
          dispatch('logout');
        } else {
          showToast(response.error || 'Failed to delete URL', 'error');
        }
      }
    } catch (error: any) {
      if (error.message?.includes('Unauthorized')) {
        showToast('Session expired. Please sign in again.', 'error');
        dispatch('logout');
      } else {
        showToast('Network error. Please try again.', 'error');
      }
    }
  }

  async function copyToClipboard(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      showToast('Copied to clipboard!', 'success');
    } catch (error) {
      showToast('Failed to copy to clipboard', 'error');
    }
  }

  function isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }

  function showToast(message: string, type: 'success' | 'error' | 'warning' = 'success'): void {
    // Simple toast implementation - could be extracted to a component
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px 24px;
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.4);
      z-index: 10000;
      max-width: 400px;
      animation: slideIn 0.3s ease-out;
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideIn 0.3s ease-out reverse';
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300);
    }, 3000);
  }

  function handleLogout(): void {
    apiClient.logout();
    dispatch('logout');
  }
</script>

<div class="url-manager">
  <header class="header">
    <div class="header-content">
      <div>
        <h1>🔗 URL Shortener</h1>
        <p class="user-info">Signed in as: <strong>{userEmail}</strong></p>
      </div>
      <button class="btn btn-secondary" on:click={handleLogout}>
        Sign Out
      </button>
    </div>
  </header>

  <main class="main-content">
    <div class="card create-section">
      <h2>Create Short URL</h2>
      <div class="form-group">
        <label for="urlInput">URL to shorten</label>
        <input 
          type="url" 
          id="urlInput"
          bind:value={urlInput}
          placeholder="https://example.com/very/long/url"
          autocomplete="off"
          disabled={creating}
        >
      </div>
      <div class="form-group">
        <label for="customCodeInput">Custom code (optional)</label>
        <input 
          type="text" 
          id="customCodeInput"
          bind:value={customCodeInput}
          placeholder="mycode"
          pattern="[a-zA-Z0-9_-]{3,20}"
          autocomplete="off"
          disabled={creating}
        >
        <small>3-20 characters, letters, numbers, hyphens, and underscores only</small>
      </div>
      <button 
        class="btn btn-primary" 
        on:click={createShortUrl}
        disabled={creating}
      >
        {creating ? 'Creating...' : 'Create Short URL'}
      </button>
    </div>

    <div class="card urls-section">
      <div class="urls-header">
        <h2>Your Short URLs</h2>
        <button class="btn btn-secondary" on:click={loadUrls} disabled={loading}>
          🔄 Refresh
        </button>
      </div>
      
      {#if loading}
        <div class="loading">Loading URLs...</div>
      {:else if urls.length === 0}
        <div class="empty-state">No short URLs yet. Create your first one above!</div>
      {:else}
        <div class="urls-list">
          {#each urls as url (url.shortCode)}
            <div class="url-card">
              <div class="url-card-header">
                <div class="url-short">
                  <strong>{url.shortUrl}</strong>
                  <button 
                    class="btn-copy" 
                    on:click={() => copyToClipboard(url.shortUrl)}
                    title="Copy to clipboard"
                  >
                    📋 Copy
                  </button>
                </div>
                <button 
                  class="btn btn-danger" 
                  on:click={() => deleteUrl(url.shortCode)}
                  title="Delete"
                >
                  🗑️ Delete
                </button>
              </div>
              <div class="url-original">
                <a href={url.url} target="_blank" rel="noopener noreferrer">
                  {url.url}
                </a>
              </div>
              <div class="url-meta">
                <span>Created: {new Date(url.createdAt).toLocaleDateString()}</span>
                <span>•</span>
                <span>Clicks: {url.clickCount || 0}</span>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </main>
</div>

<style>
  .url-manager {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .header {
    background: var(--card);
    border-bottom: 1px solid var(--border);
    padding: var(--spacing-lg) var(--spacing-xl);
  }

  .header-content {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header h1 {
    font-size: 1.5rem;
    font-weight: 600;
    margin-bottom: var(--spacing-xs);
    color: var(--accent);
  }

  .user-info {
    color: var(--text-secondary);
    font-size: 0.875rem;
  }

  .user-info strong {
    color: var(--accent);
  }

  .main-content {
    flex: 1;
    max-width: 1200px;
    width: 100%;
    margin: 0 auto;
    padding: var(--spacing-xl);
  }

  .card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--spacing-xl);
    margin-bottom: var(--spacing-lg);
    box-shadow: var(--shadow-md);
  }

  .card h2 {
    margin-bottom: var(--spacing-lg);
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--accent);
  }

  .form-group {
    margin-bottom: var(--spacing-lg);
  }

  .form-group label {
    display: block;
    margin-bottom: var(--spacing-xs);
    color: var(--text);
    font-weight: 500;
  }

  .form-group input {
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--bg-dark);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    color: var(--text);
    font-size: 1rem;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .form-group input:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(237, 174, 73, 0.1);
  }

  .form-group small {
    display: block;
    margin-top: var(--spacing-xs);
    color: var(--text-secondary);
    font-size: 0.875rem;
  }

  .btn {
    padding: var(--spacing-sm) var(--spacing-lg);
    border: none;
    border-radius: var(--radius-md);
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    display: inline-block;
  }

  .btn-primary {
    background: var(--accent);
    color: var(--bg-dark);
    font-weight: 600;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--accent-light);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(237, 174, 73, 0.4);
  }

  .btn-secondary {
    background: var(--card);
    border: 1px solid var(--border);
    color: var(--text);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--border);
    border-color: var(--border-light);
  }

  .btn-danger {
    background: var(--danger);
    color: white;
  }

  .btn-danger:hover:not(:disabled) {
    background: #c8231a;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(234, 43, 31, 0.4);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .urls-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-lg);
  }

  .urls-header h2 {
    margin: 0;
  }

  .urls-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .url-card {
    background: var(--bg-dark);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--spacing-lg);
    transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
  }

  .url-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
    border-color: var(--border-light);
  }

  .url-card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: var(--spacing-sm);
  }

  .url-short {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    flex: 1;
  }

  .url-short strong {
    color: var(--accent);
    font-size: 1.1rem;
    font-weight: 600;
    word-break: break-all;
  }

  .btn-copy {
    padding: var(--spacing-xs) var(--spacing-sm);
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text);
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  .btn-copy:hover {
    background: var(--border);
    border-color: var(--accent);
    color: var(--accent);
  }

  .url-original {
    margin-bottom: var(--spacing-sm);
  }

  .url-original a {
    color: var(--text-secondary);
    text-decoration: none;
    font-size: 0.9rem;
    word-break: break-all;
    transition: color 0.2s;
  }

  .url-original a:hover {
    color: var(--accent);
    text-decoration: underline;
  }

  .url-meta {
    display: flex;
    gap: var(--spacing-md);
    color: var(--text-secondary);
    font-size: 0.875rem;
    flex-wrap: wrap;
  }

  .empty-state,
  .loading {
    text-align: center;
    padding: var(--spacing-2xl) var(--spacing-lg);
    color: var(--text-secondary);
  }

  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @media (max-width: 600px) {
    .main-content {
      padding: var(--spacing-md);
    }

    .header-content {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--spacing-md);
    }

    .url-card-header {
      flex-direction: column;
      gap: var(--spacing-sm);
    }

    .urls-header {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--spacing-sm);
    }
  }
</style>

