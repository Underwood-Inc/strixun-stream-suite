/**
 * Dashboard Page Component
 * Overview page with key metrics and quick actions
 */

import { apiClient } from '../api-client.js';

export class DashboardPage {
    constructor(container, customer) {
        this.container = container;
        this.customer = customer;
        this.loading = true;
        this.data = null;
        this.render();
        this.loadData();
    }

    async loadData() {
        this.loading = true;
        this.render();

        try {
            // Load analytics data
            const [analytics, customerData] = await Promise.all([
                apiClient.getAnalytics().catch(() => null),
                customer ? Promise.resolve(customer) : apiClient.getCustomer().catch(() => null)
            ]);

            this.data = {
                analytics,
                customer: customerData || customer
            };
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
            this.error = error.message;
        } finally {
            this.loading = false;
            this.render();
        }
    }

    render() {
        if (this.loading) {
            this.container.innerHTML = `
                <div class="loading">
                    <div class="loading__spinner"></div>
                    <p>Loading dashboard...</p>
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

        const customer = this.data?.customer;
        const analytics = this.data?.analytics;

        this.container.innerHTML = `
            <div>
                <h1 style="font-size: 2rem; margin-bottom: var(--spacing-xl); color: var(--accent);">
                    Dashboard
                </h1>

                ${customer ? `
                    <div style="
                        background: var(--card);
                        border: 1px solid var(--border);
                        border-radius: var(--radius-md);
                        padding: var(--spacing-lg);
                        margin-bottom: var(--spacing-xl);
                    ">
                        <h2 style="font-size: 1.25rem; margin-bottom: var(--spacing-md); color: var(--accent);">
                            Account Information
                        </h2>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--spacing-md);">
                            <div>
                                <div style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: var(--spacing-xs);">
                                    Customer ID
                                </div>
                                <div style="font-weight: 600; font-family: monospace;">
                                    ${customer.customerId || 'N/A'}
                                </div>
                            </div>
                            <div>
                                <div style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: var(--spacing-xs);">
                                    Status
                                </div>
                                <div style="font-weight: 600; color: ${customer.status === 'active' ? 'var(--success)' : 'var(--warning)'};">
                                    ${customer.status || 'unknown'}
                                </div>
                            </div>
                            <div>
                                <div style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: var(--spacing-xs);">
                                    Plan
                                </div>
                                <div style="font-weight: 600;">
                                    ${customer.plan || 'free'}
                                </div>
                            </div>
                        </div>
                    </div>
                ` : ''}

                ${analytics ? `
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: var(--spacing-lg); margin-bottom: var(--spacing-xl);">
                        <div style="
                            background: var(--card);
                            border: 1px solid var(--border);
                            border-radius: var(--radius-md);
                            padding: var(--spacing-lg);
                        ">
                            <div style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: var(--spacing-xs);">
                                OTP Requests (Today)
                            </div>
                            <div style="font-size: 2rem; font-weight: 700; color: var(--accent);">
                                ${analytics.today?.otpRequests || 0}
                            </div>
                        </div>
                        <div style="
                            background: var(--card);
                            border: 1px solid var(--border);
                            border-radius: var(--radius-md);
                            padding: var(--spacing-lg);
                        ">
                            <div style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: var(--spacing-xs);">
                                Successful Logins (Today)
                            </div>
                            <div style="font-size: 2rem; font-weight: 700; color: var(--success);">
                                ${analytics.today?.successfulLogins || 0}
                            </div>
                        </div>
                        <div style="
                            background: var(--card);
                            border: 1px solid var(--border);
                            border-radius: var(--radius-md);
                            padding: var(--spacing-lg);
                        ">
                            <div style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: var(--spacing-xs);">
                                Failed Attempts (Today)
                            </div>
                            <div style="font-size: 2rem; font-weight: 700; color: var(--danger);">
                                ${analytics.today?.failedAttempts || 0}
                            </div>
                        </div>
                        <div style="
                            background: var(--card);
                            border: 1px solid var(--border);
                            border-radius: var(--radius-md);
                            padding: var(--spacing-lg);
                        ">
                            <div style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: var(--spacing-xs);">
                                Success Rate
                            </div>
                            <div style="font-size: 2rem; font-weight: 700; color: var(--info);">
                                ${analytics.today?.successRate || 0}%
                            </div>
                        </div>
                    </div>
                ` : `
                    <div class="empty-state">
                        <div class="empty-state__icon">[EMOJI]</div>
                        <p>No analytics data available yet</p>
                        <p style="margin-top: var(--spacing-sm); font-size: 0.875rem; color: var(--muted);">
                            Analytics will appear here once you start using the API
                        </p>
                    </div>
                `}

                <div style="
                    background: var(--card);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    padding: var(--spacing-lg);
                ">
                    <h2 style="font-size: 1.25rem; margin-bottom: var(--spacing-md); color: var(--accent);">
                        Quick Actions
                    </h2>
                    <div style="display: flex; gap: var(--spacing-md); flex-wrap: wrap;">
                        <a href="#api-keys" class="app-nav__link" style="text-decoration: none;">
                            Manage API Keys
                        </a>
                        <a href="#audit-logs" class="app-nav__link" style="text-decoration: none;">
                            View Audit Logs
                        </a>
                        <a href="#analytics" class="app-nav__link" style="text-decoration: none;">
                            View Analytics
                        </a>
                    </div>
                </div>
            </div>
        `;
    }

    destroy() {
        // Cleanup if needed
    }
}

