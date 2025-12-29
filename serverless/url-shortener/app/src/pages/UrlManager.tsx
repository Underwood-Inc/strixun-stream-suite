/**
 * URL Manager Component
 * Manages short URLs - create, list, and delete
 */

import { useState, useEffect } from 'react';
import { apiClient, type ShortUrl } from '../lib/api-client';

interface UrlManagerProps {
  userDisplayName: string | null;
  onLogout: () => void;
}

export default function UrlManager({ userDisplayName, onLogout }: UrlManagerProps) {
  const [urls, setUrls] = useState<ShortUrl[]>([]);
  const [loading, setLoading] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [customCodeInput, setCustomCodeInput] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadUrls();
  }, []);

  async function loadUrls(): Promise<void> {
    setLoading(true);
    try {
      const response = await apiClient.listUrls();
      if (response.success && response.urls) {
        setUrls(response.urls);
      } else {
        console.error('Failed to load URLs:', response.error);
      }
    } catch (error) {
      console.error('Error loading URLs:', error);
    } finally {
      setLoading(false);
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

    setCreating(true);
    try {
      const response = await apiClient.createUrl({
        url: urlInput.trim(),
        customCode: customCodeInput.trim() || undefined,
      });

      if (response.success && response.shortUrl) {
        showToast(`Short URL created: ${response.shortUrl}`, 'success');
        setUrlInput('');
        setCustomCodeInput('');
        await loadUrls();
      } else {
        showToast(response.error || 'Failed to create short URL', 'error');
      }
    } catch (error: any) {
      if (error.message?.includes('Unauthorized')) {
        showToast('Session expired. Please sign in again.', 'error');
        onLogout();
      } else {
        showToast('Network error. Please try again.', 'error');
      }
    } finally {
      setCreating(false);
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
          onLogout();
        } else {
          showToast(response.error || 'Failed to delete URL', 'error');
        }
      }
    } catch (error: any) {
      if (error.message?.includes('Unauthorized')) {
        showToast('Session expired. Please sign in again.', 'error');
        onLogout();
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
        if (document.body.contains(toast)) {
          document.body.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }

  function handleLogout(): void {
    apiClient.logout();
    onLogout();
  }

  return (
    <div className="url-manager">
      <header className="header">
        <div className="header-content">
          <div>
            <h1>URL Shortener</h1>
            <p className="user-info">Signed in as: <strong>{userDisplayName || 'User'}</strong></p>
          </div>
          <button className="btn btn-secondary" onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </header>

      <main className="main-content">
        <div className="card create-section">
          <h2>Create Short URL</h2>
          <div className="form-group">
            <label htmlFor="urlInput">URL to shorten</label>
            <input 
              type="url" 
              id="urlInput"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com/very/long/url"
              autoComplete="off"
              disabled={creating}
            />
          </div>
          <div className="form-group">
            <label htmlFor="customCodeInput">Custom code (optional)</label>
            <input 
              type="text" 
              id="customCodeInput"
              value={customCodeInput}
              onChange={(e) => setCustomCodeInput(e.target.value)}
              placeholder="mycode"
              pattern="[a-zA-Z0-9_-]{3,20}"
              autoComplete="off"
              disabled={creating}
            />
            <small>3-20 characters, letters, numbers, hyphens, and underscores only</small>
          </div>
          <button 
            className="btn btn-primary" 
            onClick={createShortUrl}
            disabled={creating}
          >
            {creating ? 'Creating...' : 'Create Short URL'}
          </button>
        </div>

        <div className="card urls-section">
          <div className="urls-header">
            <h2>Your Short URLs</h2>
            <button className="btn btn-secondary" onClick={loadUrls} disabled={loading}>
              [REFRESH] Refresh
            </button>
          </div>
          
          {loading ? (
            <div className="loading">Loading URLs...</div>
          ) : urls.length === 0 ? (
            <div className="empty-state">No short URLs yet. Create your first one above!</div>
          ) : (
            <div className="urls-list">
              {urls.map((url) => (
                <div key={url.shortCode} className="url-card">
                  <div className="url-card-header">
                    <div className="url-short">
                      <strong>{url.shortUrl}</strong>
                      <button 
                        className="btn-copy" 
                        onClick={() => copyToClipboard(url.shortUrl)}
                        title="Copy to clipboard"
                      >
                        [COPY] Copy
                      </button>
                    </div>
                    <button 
                      className="btn btn-danger" 
                      onClick={() => deleteUrl(url.shortCode)}
                      title="Delete"
                    >
                      [DELETE] Delete
                    </button>
                  </div>
                  <div className="url-original">
                    <a href={url.url} target="_blank" rel="noopener noreferrer">
                      {url.url}
                    </a>
                  </div>
                  <div className="url-meta">
                    <span>Created: {new Date(url.createdAt).toLocaleDateString()}</span>
                    <span>•</span>
                    <span>Clicks: {url.clickCount || 0}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

