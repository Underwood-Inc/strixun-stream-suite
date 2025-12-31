/**
 * API Keys Page Component
 * Manage API keys: list, create, revoke, rotate
 */

import { apiClient } from '../api-client.js';

export class ApiKeysPage {
    constructor(container, customer) {
        this.container = container;
        this.customer = customer;
        this.loading = true;
        this.apiKeys = [];
        this.error = null;
        this.render();
        this.loadApiKeys();
    }

    async loadApiKeys() {
        if (!this.customer?.customerId) {
            try {
                this.customer = await apiClient.getCustomer();
            } catch (error) {
                this.error = 'Failed to load customer data. Please ensure you have API access.';
                this.loading = false;
                this.render();
                return;
            }
        }

        if (!this.customer?.customerId) {
            this.error = 'Customer ID not found. Please contact support.';
            this.loading = false;
            this.render();
            return;
        }

        this.loading = true;
        this.render();

        try {
            const response = await apiClient.getApiKeys(this.customer.customerId);
            this.apiKeys = response.apiKeys || [];
        } catch (error) {
            console.error('Failed to load API keys:', error);
            this.error = error.message || 'Failed to load API keys';
        } finally {
            this.loading = false;
            this.render();
        }
    }

    async handleCreateKey() {
        const nameInput = document.getElementById('new-key-name');
        const name = nameInput?.value.trim() || 'Default API Key';

        if (!this.customer?.customerId) {
            alert('Customer ID not found');
            return;
        }

        try {
            const response = await apiClient.createApiKey(this.customer.customerId, name);
            
            // Show the new key in a modal/alert (user must copy it now)
            const keyDisplay = `
                <div style="
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
                ">
                    <div style="
                        background: var(--card);
                        border: 2px solid var(--accent);
                        border-radius: var(--radius-md);
                        padding: var(--spacing-xl);
                        max-width: 600px;
                        width: 90%;
                    ">
                        <h2 style="margin-bottom: var(--spacing-lg); color: var(--accent);">
                            [WARNING] API Key Created
                        </h2>
                        <p style="margin-bottom: var(--spacing-md); color: var(--text-secondary);">
                            Copy this API key now. You won't be able to see it again!
                        </p>
                        <div style="
                            background: var(--bg-dark);
                            border: 1px solid var(--border);
                            border-radius: var(--radius-sm);
                            padding: var(--spacing-md);
                            margin-bottom: var(--spacing-lg);
                            font-family: monospace;
                            word-break: break-all;
                            color: var(--accent);
                            font-weight: 600;
                        ">
                            ${response.apiKey}
                        </div>
                        <button
                            onclick="
                                navigator.clipboard.writeText('${response.apiKey}');
                                alert('API key copied to clipboard!');
                                this.parentElement.parentElement.remove();
                            "
                            style="
                                width: 100%;
                                padding: var(--spacing-md);
                                background: var(--accent);
                                border: 3px solid var(--accent-dark);
                                border-radius: 0;
                                color: #000;
                                font-weight: 700;
                                cursor: pointer;
                            "
                        >
                            Copy to Clipboard
                        </button>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', keyDisplay);
            
            // Reload keys
            await this.loadApiKeys();
            
            // Clear input
            if (nameInput) nameInput.value = '';
        } catch (error) {
            alert('Failed to create API key: ' + (error.message || 'Unknown error'));
        }
    }

    async handleRevokeKey(keyId) {
        if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
            return;
        }

        if (!this.customer?.customerId) {
            alert('Customer ID not found');
            return;
        }

        try {
            await apiClient.revokeApiKey(this.customer.customerId, keyId);
            await this.loadApiKeys();
        } catch (error) {
            alert('Failed to revoke API key: ' + (error.message || 'Unknown error'));
        }
    }

    async handleRotateKey(keyId) {
        if (!confirm('Are you sure you want to rotate this API key? The old key will be revoked and a new one will be created.')) {
            return;
        }

        if (!this.customer?.customerId) {
            alert('Customer ID not found');
            return;
        }

        try {
            const response = await apiClient.rotateApiKey(this.customer.customerId, keyId);
            
            // Show new key
            const keyDisplay = `
                <div style="
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
                ">
                    <div style="
                        background: var(--card);
                        border: 2px solid var(--accent);
                        border-radius: var(--radius-md);
                        padding: var(--spacing-xl);
                        max-width: 600px;
                        width: 90%;
                    ">
                        <h2 style="margin-bottom: var(--spacing-lg); color: var(--accent);">
                            [WARNING] New API Key
                        </h2>
                        <p style="margin-bottom: var(--spacing-md); color: var(--text-secondary);">
                            Your API key has been rotated. Copy the new key now!
                        </p>
                        <div style="
                            background: var(--bg-dark);
                            border: 1px solid var(--border);
                            border-radius: var(--radius-sm);
                            padding: var(--spacing-md);
                            margin-bottom: var(--spacing-lg);
                            font-family: monospace;
                            word-break: break-all;
                            color: var(--accent);
                            font-weight: 600;
                        ">
                            ${response.apiKey}
                        </div>
                        <button
                            onclick="
                                navigator.clipboard.writeText('${response.apiKey}');
                                alert('API key copied to clipboard!');
                                this.parentElement.parentElement.remove();
                            "
                            style="
                                width: 100%;
                                padding: var(--spacing-md);
                                background: var(--accent);
                                border: 3px solid var(--accent-dark);
                                border-radius: 0;
                                color: #000;
                                font-weight: 700;
                                cursor: pointer;
                            "
                        >
                            Copy to Clipboard
                        </button>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', keyDisplay);
            
            // Reload keys
            await this.loadApiKeys();
        } catch (error) {
            alert('Failed to rotate API key: ' + (error.message || 'Unknown error'));
        }
    }

    render() {
        if (this.loading) {
            this.container.innerHTML = `
                <div class="loading">
                    <div class="loading__spinner"></div>
                    <p>Loading API keys...</p>
                </div>
            `;
            return;
        }

        if (this.error) {
            this.container.innerHTML = `
                <div class="error">${this.error}</div>
            `;
            return;
        }

        this.container.innerHTML = `
            <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-xl);">
                    <h1 style="font-size: 2rem; color: var(--accent);">
                        API Keys
                    </h1>
                </div>

                <div style="
                    background: var(--card);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    padding: var(--spacing-lg);
                    margin-bottom: var(--spacing-xl);
                ">
                    <h2 style="font-size: 1.25rem; margin-bottom: var(--spacing-md); color: var(--accent);">
                        Create New API Key
                    </h2>
                    <div style="display: flex; gap: var(--spacing-md);">
                        <input
                            type="text"
                            id="new-key-name"
                            placeholder="Key name (optional)"
                            style="
                                flex: 1;
                                padding: var(--spacing-md);
                                background: var(--bg-dark);
                                border: 1px solid var(--border);
                                border-radius: var(--radius-md);
                                color: var(--text);
                                font-size: 1rem;
                            "
                        />
                        <button
                            onclick="window.apiKeysPage.handleCreateKey()"
                            style="
                                padding: var(--spacing-md) var(--spacing-lg);
                                background: var(--accent);
                                border: 3px solid var(--accent-dark);
                                border-radius: 0;
                                color: #000;
                                font-weight: 700;
                                cursor: pointer;
                                white-space: nowrap;
                            "
                        >
                            Create API Key
                        </button>
                    </div>
                </div>

                <div style="
                    background: var(--card);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    padding: var(--spacing-lg);
                ">
                    <h2 style="font-size: 1.25rem; margin-bottom: var(--spacing-md); color: var(--accent);">
                        Your API Keys
                    </h2>
                    ${this.apiKeys.length === 0 ? `
                        <div class="empty-state">
                            <div class="empty-state__icon">[EMOJI]</div>
                            <p>No API keys yet</p>
                            <p style="margin-top: var(--spacing-sm); font-size: 0.875rem; color: var(--muted);">
                                Create your first API key above to get started
                            </p>
                        </div>
                    ` : `
                        <div style="overflow-x: auto;">
                            <table style="width: 100%; border-collapse: collapse;">
                                <thead>
                                    <tr style="border-bottom: 1px solid var(--border);">
                                        <th style="text-align: left; padding: var(--spacing-md); color: var(--text-secondary); font-weight: 600;">Name</th>
                                        <th style="text-align: left; padding: var(--spacing-md); color: var(--text-secondary); font-weight: 600;">Key ID</th>
                                        <th style="text-align: left; padding: var(--spacing-md); color: var(--text-secondary); font-weight: 600;">Status</th>
                                        <th style="text-align: left; padding: var(--spacing-md); color: var(--text-secondary); font-weight: 600;">Created</th>
                                        <th style="text-align: left; padding: var(--spacing-md); color: var(--text-secondary); font-weight: 600;">Last Used</th>
                                        <th style="text-align: right; padding: var(--spacing-md); color: var(--text-secondary); font-weight: 600;">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${this.apiKeys.map(key => `
                                        <tr style="border-bottom: 1px solid var(--border);">
                                            <td style="padding: var(--spacing-md);">${key.name || 'Unnamed'}</td>
                                            <td style="padding: var(--spacing-md); font-family: monospace; font-size: 0.875rem; color: var(--text-secondary);">
                                                ${key.keyId || 'N/A'}
                                            </td>
                                            <td style="padding: var(--spacing-md);">
                                                <span style="
                                                    padding: var(--spacing-xs) var(--spacing-sm);
                                                    border-radius: var(--radius-sm);
                                                    font-size: 0.875rem;
                                                    font-weight: 600;
                                                    background: ${key.status === 'active' ? 'var(--success)' : 'var(--danger)'};
                                                    color: #000;
                                                ">
                                                    ${key.status || 'unknown'}
                                                </span>
                                            </td>
                                            <td style="padding: var(--spacing-md); color: var(--text-secondary); font-size: 0.875rem;">
                                                ${key.createdAt ? new Date(key.createdAt).toLocaleDateString() : 'N/A'}
                                            </td>
                                            <td style="padding: var(--spacing-md); color: var(--text-secondary); font-size: 0.875rem;">
                                                ${key.lastUsed ? new Date(key.lastUsed).toLocaleDateString() : 'Never'}
                                            </td>
                                            <td style="padding: var(--spacing-md); text-align: right;">
                                                <div style="display: flex; gap: var(--spacing-sm); justify-content: flex-end;">
                                                    ${key.status === 'active' ? `
                                                        <button
                                                            onclick="window.apiKeysPage.handleRotateKey('${key.keyId}')"
                                                            style="
                                                                padding: var(--spacing-xs) var(--spacing-md);
                                                                background: var(--warning);
                                                                border: 2px solid var(--warning);
                                                                border-radius: var(--radius-sm);
                                                                color: #000;
                                                                font-weight: 600;
                                                                font-size: 0.875rem;
                                                                cursor: pointer;
                                                            "
                                                        >
                                                            Rotate
                                                        </button>
                                                        <button
                                                            onclick="window.apiKeysPage.handleRevokeKey('${key.keyId}')"
                                                            style="
                                                                padding: var(--spacing-xs) var(--spacing-md);
                                                                background: transparent;
                                                                border: 2px solid var(--danger);
                                                                border-radius: var(--radius-sm);
                                                                color: var(--danger);
                                                                font-weight: 600;
                                                                font-size: 0.875rem;
                                                                cursor: pointer;
                                                            "
                                                        >
                                                            Revoke
                                                        </button>
                                                    ` : ''}
                                                </div>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    `}
                </div>
            </div>
        `;

        // Store reference for button handlers
        window.apiKeysPage = this;
    }

    destroy() {
        delete window.apiKeysPage;
    }
}

