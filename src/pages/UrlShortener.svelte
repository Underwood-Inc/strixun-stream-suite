<script lang="ts">
  /**
   * URL Shortener Page
   * 
   * Create and manage short URLs with OTP authentication.
   * IN TESTING - This feature is currently in testing.
   * 
   * Note: Auth is handled by the router guards. This page will only
   * render when the user is authenticated.
   */
  
  import { onMount } from 'svelte';
  import { Tooltip } from '@components';
  import { stagger } from '../core/animations';
  import { logout, customer } from '../stores/auth';
  import { showToast } from '../stores/toast-queue';
  import { navigate } from '../router';

  interface ShortUrl {
    shortCode: string;
    url: string;
    shortUrl: string;
    createdAt: string;
    clickCount: number;
  }

  let urls: ShortUrl[] = [];
  let isLoading = false;
  let isCreating = false;
  let urlInput = '';
  let customCodeInput = '';
  let urlShortenerApiUrl = '';

  // Get URL shortener API URL
  function getUrlShortenerApiUrl(): string {
    // Try to get from window config (injected during build)
    if (typeof window !== 'undefined' && (window as any).getUrlShortenerApiUrl) {
      return (window as any).getUrlShortenerApiUrl() || '';
    }
    // Fallback: try to construct from main API URL
    if (typeof window !== 'undefined' && (window as any).getWorkerApiUrl) {
      const mainApiUrl = (window as any).getWorkerApiUrl();
      if (mainApiUrl) {
        // Assume URL shortener is on a subdomain or different path
        return mainApiUrl.replace(/\/api.*$/, '').replace(/^https?:\/\/([^.]+)\./, 'https://s.') || '';
      }
    }
    return '';
  }

  onMount(() => {
    urlShortenerApiUrl = getUrlShortenerApiUrl();
    // Auth is handled by router guards - just load URLs
    loadUrls();
  });

  /**
   * Handle logout - navigates to login page
   */
  async function handleLogout(): Promise<void> {
    await logout();
    urls = [];
    navigate('/login');
  }

  /**
   * Handle 401 response - session expired, redirect to login
   */
  function handleUnauthorized(): void {
    showToast({ message: 'Session expired. Please log in again.', type: 'warning' });
    navigate('/login', { query: { redirect: '/url-shortener' } });
  }

  /**
   * Load user's URLs
   */
  async function loadUrls(): Promise<void> {
    if (!urlShortenerApiUrl) {
      return;
    }

    try {
      isLoading = true;
      // CRITICAL: Use credentials: 'include' to send HttpOnly cookie automatically
      const response = await fetch(`${urlShortenerApiUrl}/api/list`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Send HttpOnly cookie
      });

      if (!response.ok) {
        if (response.status === 401) {
          handleUnauthorized();
          return;
        }
        throw new Error(`Failed to load URLs: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success) {
        urls = data.urls || [];
      }
    } catch (error) {
      console.error('[URL Shortener] Failed to load URLs:', error);
      showToast({ 
        message: error instanceof Error ? error.message : 'Failed to load URLs', 
        type: 'error' 
      });
    } finally {
      isLoading = false;
    }
  }

  /**
   * Create short URL
   */
  async function createShortUrl(): Promise<void> {
    if (!urlShortenerApiUrl) {
      showToast({ message: 'URL Shortener API not configured', type: 'error' });
      return;
    }

    if (!urlInput.trim()) {
      showToast({ message: 'Please enter a URL', type: 'error' });
      return;
    }

    // Validate URL format
    try {
      new URL(urlInput.trim());
    } catch {
      showToast({ message: 'Please enter a valid URL (must start with http:// or https://)', type: 'error' });
      return;
    }

    // Validate custom code if provided
    if (customCodeInput.trim() && !/^[a-zA-Z0-9_-]{3,20}$/.test(customCodeInput.trim())) {
      showToast({ 
        message: 'Custom code must be 3-20 characters and contain only letters, numbers, hyphens, and underscores', 
        type: 'error' 
      });
      return;
    }

    try {
      isCreating = true;
      // CRITICAL: Use credentials: 'include' to send HttpOnly cookie automatically
      const response = await fetch(`${urlShortenerApiUrl}/api/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Send HttpOnly cookie
        body: JSON.stringify({
          url: urlInput.trim(),
          customCode: customCodeInput.trim() || undefined,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          handleUnauthorized();
          return;
        }
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || `Failed to create short URL: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success) {
        showToast({ 
          message: `Short URL created: ${data.shortUrl}`, 
          type: 'success',
          title: 'Success'
        });
        urlInput = '';
        customCodeInput = '';
        await loadUrls();
      }
    } catch (error) {
      console.error('[URL Shortener] Failed to create short URL:', error);
      showToast({ 
        message: error instanceof Error ? error.message : 'Failed to create short URL', 
        type: 'error' 
      });
    } finally {
      isCreating = false;
    }
  }

  /**
   * Delete short URL
   */
  async function deleteUrl(shortCode: string): Promise<void> {
    if (!urlShortenerApiUrl) {
      return;
    }

    if (!confirm('Are you sure you want to delete this short URL?')) {
      return;
    }

    try {
      // CRITICAL: Use credentials: 'include' to send HttpOnly cookie automatically
      const response = await fetch(`${urlShortenerApiUrl}/api/delete/${shortCode}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Send HttpOnly cookie
      });

      if (!response.ok) {
        if (response.status === 401) {
          handleUnauthorized();
          return;
        }
        throw new Error(`Failed to delete URL: ${response.statusText}`);
      }

      showToast({ message: 'Short URL deleted', type: 'success' });
      await loadUrls();
    } catch (error) {
      console.error('[URL Shortener] Failed to delete URL:', error);
      showToast({ 
        message: error instanceof Error ? error.message : 'Failed to delete URL', 
        type: 'error' 
      });
    }
  }

  /**
   * Copy URL to clipboard
   */
  async function copyToClipboard(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      showToast({ message: 'Copied to clipboard', type: 'success' });
    } catch (error) {
      console.error('[URL Shortener] Failed to copy:', error);
      showToast({ message: 'Failed to copy to clipboard', type: 'error' });
    }
  }
</script>

<div class="url-shortener-page" use:stagger={{ preset: 'fadeIn', stagger: 80, config: { duration: 300 } }}>
  <Tooltip text="URL Shortener | This feature is currently in testing" level="info" position="bottom">
    <div class="testing-banner in-testing">★ IN TESTING - This feature is currently in testing</div>
  </Tooltip>

  <div class="url-shortener-content">
    <div class="header">
      <div>
        <h1>★ URL Shortener</h1>
        <p class="user-info">Signed in as {$customer?.displayName || 'Customer'}</p>
      </div>
      <div class="header-actions">
        <button 
          class="btn btn-secondary" 
          on:click={loadUrls}
          disabled={isLoading}
        >
          {isLoading ? 'Loading...' : '→ Refresh'}
        </button>
        <button class="btn btn-secondary" on:click={handleLogout}>
          Logout
        </button>
      </div>
    </div>

    <div class="create-section">
      <h2>Create Short URL</h2>
      <div class="create-form">
        <div class="form-group">
          <label for="url-input">URL to shorten</label>
          <input 
            id="url-input"
            type="url" 
            bind:value={urlInput}
            placeholder="https://example.com/very/long/url"
            class="url-input"
            on:keydown={(e) => e.key === 'Enter' && createShortUrl()}
          />
        </div>
        <div class="form-group">
          <label for="custom-code-input">Custom code (optional)</label>
          <input 
            id="custom-code-input"
            type="text" 
            bind:value={customCodeInput}
            placeholder="mycode"
            class="custom-code-input"
            on:keydown={(e) => e.key === 'Enter' && createShortUrl()}
          />
          <small>3-20 characters, letters, numbers, hyphens, and underscores only</small>
        </div>
        <button 
          class="btn btn-primary" 
          on:click={createShortUrl}
          disabled={isCreating || !urlInput.trim()}
        >
          {isCreating ? 'Creating...' : 'Create Short URL'}
        </button>
      </div>
    </div>

    <div class="urls-section">
      <h2>Your Short URLs</h2>
      {#if isLoading}
        <div class="loading">Loading URLs...</div>
      {:else if urls.length === 0}
        <div class="empty-state">
          <p>No short URLs yet. Create your first one above!</p>
        </div>
      {:else}
        <div class="urls-list">
          {#each urls as urlItem}
            <div class="url-card">
              <div class="url-card-content">
                <div class="url-info">
                  <div class="url-short">
                    <strong>{urlItem.shortUrl}</strong>
                    <button 
                      class="btn-copy"
                      on:click={() => copyToClipboard(urlItem.shortUrl)}
                      title="Copy to clipboard"
                    >★</button>
                  </div>
                  <div class="url-original">
                    <a href={urlItem.url} target="_blank" rel="noopener noreferrer">
                      {urlItem.url}
                    </a>
                  </div>
                  <div class="url-meta">
                    <span>Created: {new Date(urlItem.createdAt).toLocaleDateString()}</span>
                    <span>•</span>
                    <span>Clicks: {urlItem.clickCount}</span>
                  </div>
                </div>
                <button 
                  class="btn-delete"
                  on:click={() => deleteUrl(urlItem.shortCode)}
                  title="Delete"
                >★</button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

<style lang="scss">
  @use '@styles/animations' as *;
  @use '@styles/mixins' as *;

  .url-shortener-page {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    position: relative;
  }

  .testing-banner {
    padding: 12px 16px;
    margin: 16px;
    text-align: center;
    font-size: 0.9rem;
    font-weight: 600;
    border-radius: 0;
    @include in-testing-state;
    pointer-events: auto;
    cursor: help;
  }

  .url-shortener-content {
    padding: 24px;
    max-width: 1200px;
    margin: 0 auto;
    width: 100%;
    overflow-y: auto;
    @include scrollbar(6px);
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 32px;

    h1 {
      margin: 0 0 4px 0;
      font-size: 28px;
      color: var(--text);
    }

    .user-info {
      margin: 0;
      font-size: 12px;
      color: var(--text-secondary);
    }

    .header-actions {
      display: flex;
      gap: 8px;
      align-items: center;
    }
  }

  .create-section {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 24px;
    margin-bottom: 32px;

    h2 {
      margin: 0 0 16px 0;
      font-size: 20px;
      color: var(--text);
    }

    .create-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 8px;

      label {
        font-size: 14px;
        font-weight: 500;
        color: var(--text);
      }

      input {
        padding: 12px;
        background: var(--bg);
        border: 1px solid var(--border);
        border-radius: 4px;
        color: var(--text);
        font-size: 16px;
        transition: border-color 0.2s;

        &:focus {
          outline: none;
          border-color: var(--accent);
        }
      }

      small {
        font-size: 12px;
        color: var(--text-secondary);
      }
    }
  }

  .urls-section {
    h2 {
      margin: 0 0 16px 0;
      font-size: 20px;
      color: var(--text);
    }
  }

  .urls-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .url-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px;
    transition: all 0.2s ease;

    &:hover {
      border-color: var(--accent);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .url-card-content {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
    }

    .url-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .url-short {
      display: flex;
      align-items: center;
      gap: 8px;

      strong {
        font-size: 16px;
        color: var(--accent);
        word-break: break-all;
      }
    }

    .url-original {
      a {
        color: var(--text-secondary);
        text-decoration: none;
        font-size: 14px;
        word-break: break-all;

        &:hover {
          color: var(--text);
          text-decoration: underline;
        }
      }
    }

    .url-meta {
      display: flex;
      gap: 8px;
      font-size: 12px;
      color: var(--text-secondary);
    }

    .btn-copy {
      padding: 4px 8px;
      background: transparent;
      border: 1px solid var(--border);
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s;

      &:hover {
        background: var(--bg-secondary);
        border-color: var(--accent);
      }
    }

    .btn-delete {
      padding: 8px 12px;
      background: var(--error);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s;

      &:hover {
        background: var(--error-hover, #d32f2f);
      }
    }
  }

  .empty-state {
    text-align: center;
    padding: 48px;
    color: var(--text-secondary);
  }

  .loading {
    text-align: center;
    padding: 48px;
    color: var(--text-secondary);
  }

  .btn {
    padding: 10px 20px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s;

    &.btn-primary {
      background: var(--accent);
      color: white;

      &:hover:not(:disabled) {
        background: var(--accent-hover);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    &.btn-secondary {
      background: var(--bg-secondary);
      color: var(--text);
      border: 1px solid var(--border);

      &:hover {
        background: var(--card);
      }
    }
  }
</style>
