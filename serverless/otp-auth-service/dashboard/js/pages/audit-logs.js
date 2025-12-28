/**
 * Audit Logs Page Component
 * View and filter audit logs
 */

import { apiClient } from '../api-client.js';

export class AuditLogsPage {
    constructor(container, customer) {
        this.container = container;
        this.customer = customer;
        this.loading = true;
        this.logs = [];
        this.error = null;
        this.filters = {
            startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            endDate: new Date().toISOString().split('T')[0],
            eventType: ''
        };
        this.render();
        this.loadLogs();
    }

    async loadLogs() {
        this.loading = true;
        this.render();

        try {
            const response = await apiClient.getAuditLogs(null, this.filters);
            this.logs = response.events || [];
        } catch (error) {
            console.error('Failed to load audit logs:', error);
            this.error = error.message || 'Failed to load audit logs';
        } finally {
            this.loading = false;
            this.render();
        }
    }

    handleFilterChange() {
        const startDateInput = document.getElementById('filter-start-date');
        const endDateInput = document.getElementById('filter-end-date');
        const eventTypeInput = document.getElementById('filter-event-type');

        this.filters.startDate = startDateInput?.value || this.filters.startDate;
        this.filters.endDate = endDateInput?.value || this.filters.endDate;
        this.filters.eventType = eventTypeInput?.value || '';

        this.loadLogs();
    }

    render() {
        if (this.loading) {
            this.container.innerHTML = `
                <div class="loading">
                    <div class="loading__spinner"></div>
                    <p>Loading audit logs...</p>
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
                <h1 style="font-size: 2rem; margin-bottom: var(--spacing-xl); color: var(--accent);">
                    Audit Logs
                </h1>

                <div style="
                    background: var(--card);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    padding: var(--spacing-lg);
                    margin-bottom: var(--spacing-xl);
                ">
                    <h2 style="font-size: 1.25rem; margin-bottom: var(--spacing-md); color: var(--accent);">
                        Filters
                    </h2>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--spacing-md);">
                        <div>
                            <label style="display: block; margin-bottom: var(--spacing-xs); color: var(--text-secondary); font-size: 0.875rem;">
                                Start Date
                            </label>
                            <input
                                type="date"
                                id="filter-start-date"
                                value="${this.filters.startDate}"
                                style="
                                    width: 100%;
                                    padding: var(--spacing-sm);
                                    background: var(--bg-dark);
                                    border: 1px solid var(--border);
                                    border-radius: var(--radius-md);
                                    color: var(--text);
                                "
                            />
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: var(--spacing-xs); color: var(--text-secondary); font-size: 0.875rem;">
                                End Date
                            </label>
                            <input
                                type="date"
                                id="filter-end-date"
                                value="${this.filters.endDate}"
                                style="
                                    width: 100%;
                                    padding: var(--spacing-sm);
                                    background: var(--bg-dark);
                                    border: 1px solid var(--border);
                                    border-radius: var(--radius-md);
                                    color: var(--text);
                                "
                            />
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: var(--spacing-xs); color: var(--text-secondary); font-size: 0.875rem;">
                                Event Type
                            </label>
                            <select
                                id="filter-event-type"
                                style="
                                    width: 100%;
                                    padding: var(--spacing-sm);
                                    background: var(--bg-dark);
                                    border: 1px solid var(--border);
                                    border-radius: var(--radius-md);
                                    color: var(--text);
                                "
                            >
                                <option value="">All Events</option>
                                <option value="otp_requested">OTP Requested</option>
                                <option value="otp_verified">OTP Verified</option>
                                <option value="otp_failed">OTP Failed</option>
                                <option value="login_success">Login Success</option>
                                <option value="login_failed">Login Failed</option>
                                <option value="api_key_created">API Key Created</option>
                                <option value="api_key_revoked">API Key Revoked</option>
                                <option value="user_data_deleted">User Data Deleted</option>
                            </select>
                        </div>
                        <div style="display: flex; align-items: flex-end;">
                            <button
                                onclick="window.auditLogsPage.handleFilterChange()"
                                style="
                                    width: 100%;
                                    padding: var(--spacing-sm) var(--spacing-md);
                                    background: var(--accent);
                                    border: 3px solid var(--accent-dark);
                                    border-radius: 0;
                                    color: #000;
                                    font-weight: 700;
                                    cursor: pointer;
                                "
                            >
                                Apply Filters
                            </button>
                        </div>
                    </div>
                </div>

                <div style="
                    background: var(--card);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    padding: var(--spacing-lg);
                ">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-md);">
                        <h2 style="font-size: 1.25rem; color: var(--accent);">
                            Logs (${this.logs.length})
                        </h2>
                    </div>
                    ${this.logs.length === 0 ? `
                        <div class="empty-state">
                            <div class="empty-state__icon">[NOTE]</div>
                            <p>No audit logs found</p>
                            <p style="margin-top: var(--spacing-sm); font-size: 0.875rem; color: var(--muted);">
                                Try adjusting your filters or check back later
                            </p>
                        </div>
                    ` : `
                        <div style="overflow-x: auto;">
                            <table style="width: 100%; border-collapse: collapse;">
                                <thead>
                                    <tr style="border-bottom: 1px solid var(--border);">
                                        <th style="text-align: left; padding: var(--spacing-md); color: var(--text-secondary); font-weight: 600;">Timestamp</th>
                                        <th style="text-align: left; padding: var(--spacing-md); color: var(--text-secondary); font-weight: 600;">Event Type</th>
                                        <th style="text-align: left; padding: var(--spacing-md); color: var(--text-secondary); font-weight: 600;">Details</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${this.logs.map(log => `
                                        <tr style="border-bottom: 1px solid var(--border);">
                                            <td style="padding: var(--spacing-md); color: var(--text-secondary); font-size: 0.875rem; font-family: monospace;">
                                                ${new Date(log.timestamp).toLocaleString()}
                                            </td>
                                            <td style="padding: var(--spacing-md);">
                                                <span style="
                                                    padding: var(--spacing-xs) var(--spacing-sm);
                                                    border-radius: var(--radius-sm);
                                                    font-size: 0.875rem;
                                                    font-weight: 600;
                                                    background: var(--bg-dark);
                                                    color: var(--accent);
                                                ">
                                                    ${log.eventType || 'unknown'}
                                                </span>
                                            </td>
                                            <td style="padding: var(--spacing-md); color: var(--text-secondary); font-size: 0.875rem;">
                                                <pre style="margin: 0; font-family: monospace; white-space: pre-wrap; word-break: break-word;">${JSON.stringify(log, null, 2).replace(/{|}|"/g, '').slice(0, 200)}${JSON.stringify(log).length > 200 ? '...' : ''}</pre>
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

        // Store reference for handlers
        window.auditLogsPage = this;

        // Set event type filter if it was set
        const eventTypeInput = document.getElementById('filter-event-type');
        if (eventTypeInput && this.filters.eventType) {
            eventTypeInput.value = this.filters.eventType;
        }
    }

    destroy() {
        delete window.auditLogsPage;
    }
}

