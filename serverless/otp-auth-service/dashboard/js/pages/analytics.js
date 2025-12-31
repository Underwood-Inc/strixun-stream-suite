/**
 * Analytics Page Component
 * View analytics and metrics
 */

import { apiClient } from '../api-client.js';

export class AnalyticsPage {
    constructor(container, customer) {
        this.container = container;
        this.customer = customer;
        this.loading = true;
        this.analytics = null;
        this.realtime = null;
        this.errors = null;
        this.error = null;
        this.render();
        this.loadData();
    }

    async loadData() {
        this.loading = true;
        this.render();

        try {
            const [analytics, realtime, errors] = await Promise.all([
                apiClient.getAnalytics().catch(() => null),
                apiClient.getRealtimeAnalytics().catch(() => null),
                apiClient.getErrorAnalytics().catch(() => null)
            ]);

            this.analytics = analytics;
            this.realtime = realtime;
            this.errors = errors;
        } catch (error) {
            console.error('Failed to load analytics:', error);
            this.error = error.message || 'Failed to load analytics';
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
                    <p>Loading analytics...</p>
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

        const analytics = this.analytics || {};
        const realtime = this.realtime || {};
        const errors = this.errors || {};

        this.container.innerHTML = `
            <div>
                <h1 style="font-size: 2rem; margin-bottom: var(--spacing-xl); color: var(--accent);">
                    Analytics
                </h1>

                ${analytics.today || analytics.period ? `
                    <div style="
                        background: var(--card);
                        border: 1px solid var(--border);
                        border-radius: var(--radius-md);
                        padding: var(--spacing-lg);
                        margin-bottom: var(--spacing-xl);
                    ">
                        <h2 style="font-size: 1.25rem; margin-bottom: var(--spacing-md); color: var(--accent);">
                            Today's Metrics
                        </h2>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--spacing-lg);">
                            <div>
                                <div style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: var(--spacing-xs);">
                                    OTP Requests
                                </div>
                                <div style="font-size: 2rem; font-weight: 700; color: var(--accent);">
                                    ${analytics.today?.otpRequests || 0}
                                </div>
                            </div>
                            <div>
                                <div style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: var(--spacing-xs);">
                                    OTP Verifications
                                </div>
                                <div style="font-size: 2rem; font-weight: 700; color: var(--success);">
                                    ${analytics.today?.otpVerifications || 0}
                                </div>
                            </div>
                            <div>
                                <div style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: var(--spacing-xs);">
                                    Successful Logins
                                </div>
                                <div style="font-size: 2rem; font-weight: 700; color: var(--success);">
                                    ${analytics.today?.successfulLogins || 0}
                                </div>
                            </div>
                            <div>
                                <div style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: var(--spacing-xs);">
                                    Failed Attempts
                                </div>
                                <div style="font-size: 2rem; font-weight: 700; color: var(--danger);">
                                    ${analytics.today?.failedAttempts || 0}
                                </div>
                            </div>
                            <div>
                                <div style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: var(--spacing-xs);">
                                    Success Rate
                                </div>
                                <div style="font-size: 2rem; font-weight: 700; color: var(--info);">
                                    ${analytics.today?.successRate || 0}%
                                </div>
                            </div>
                            <div>
                                <div style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: var(--spacing-xs);">
                                    Emails Sent
                                </div>
                                <div style="font-size: 2rem; font-weight: 700; color: var(--accent2);">
                                    ${analytics.today?.emailsSent || 0}
                                </div>
                            </div>
                        </div>
                    </div>
                ` : ''}

                ${analytics.period ? `
                    <div style="
                        background: var(--card);
                        border: 1px solid var(--border);
                        border-radius: var(--radius-md);
                        padding: var(--spacing-lg);
                        margin-bottom: var(--spacing-xl);
                    ">
                        <h2 style="font-size: 1.25rem; margin-bottom: var(--spacing-md); color: var(--accent);">
                            Period Summary (${analytics.period.start} to ${analytics.period.end})
                        </h2>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--spacing-lg);">
                            <div>
                                <div style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: var(--spacing-xs);">
                                    Total OTP Requests
                                </div>
                                <div style="font-size: 1.5rem; font-weight: 700; color: var(--accent);">
                                    ${analytics.period.otpRequests || 0}
                                </div>
                            </div>
                            <div>
                                <div style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: var(--spacing-xs);">
                                    Total Verifications
                                </div>
                                <div style="font-size: 1.5rem; font-weight: 700; color: var(--success);">
                                    ${analytics.period.otpVerifications || 0}
                                </div>
                            </div>
                            <div>
                                <div style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: var(--spacing-xs);">
                                    Overall Success Rate
                                </div>
                                <div style="font-size: 1.5rem; font-weight: 700; color: var(--info);">
                                    ${analytics.period.successRate || 0}%
                                </div>
                            </div>
                        </div>
                    </div>
                ` : ''}

                ${realtime.activeUsers !== undefined || realtime.requestsPerMinute !== undefined ? `
                    <div style="
                        background: var(--card);
                        border: 1px solid var(--border);
                        border-radius: var(--radius-md);
                        padding: var(--spacing-lg);
                        margin-bottom: var(--spacing-xl);
                    ">
                        <h2 style="font-size: 1.25rem; margin-bottom: var(--spacing-md); color: var(--accent);">
                            Real-time Metrics
                        </h2>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--spacing-lg);">
                            ${realtime.activeUsers !== undefined ? `
                                <div>
                                    <div style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: var(--spacing-xs);">
                                        Active Users
                                    </div>
                                    <div style="font-size: 2rem; font-weight: 700; color: var(--accent);">
                                        ${realtime.activeUsers || 0}
                                    </div>
                                </div>
                            ` : ''}
                            ${realtime.requestsPerMinute !== undefined ? `
                                <div>
                                    <div style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: var(--spacing-xs);">
                                        Requests/Minute
                                    </div>
                                    <div style="font-size: 2rem; font-weight: 700; color: var(--info);">
                                        ${realtime.requestsPerMinute || 0}
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                ` : ''}

                ${errors.total !== undefined && errors.total > 0 ? `
                    <div style="
                        background: var(--card);
                        border: 1px solid var(--border);
                        border-radius: var(--radius-md);
                        padding: var(--spacing-lg);
                        margin-bottom: var(--spacing-xl);
                    ">
                        <h2 style="font-size: 1.25rem; margin-bottom: var(--spacing-md); color: var(--accent);">
                            Error Analytics
                        </h2>
                        <div style="margin-bottom: var(--spacing-md);">
                            <div style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: var(--spacing-xs);">
                                Total Errors
                            </div>
                            <div style="font-size: 2rem; font-weight: 700; color: var(--danger);">
                                ${errors.total || 0}
                            </div>
                        </div>
                        ${errors.byCategory ? `
                            <div>
                                <h3 style="font-size: 1rem; margin-bottom: var(--spacing-sm); color: var(--text-secondary);">
                                    By Category
                                </h3>
                                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: var(--spacing-md);">
                                    ${Object.entries(errors.byCategory).map(([category, count]) => `
                                        <div style="
                                            background: var(--bg-dark);
                                            border: 1px solid var(--border);
                                            border-radius: var(--radius-sm);
                                            padding: var(--spacing-sm);
                                        ">
                                            <div style="color: var(--text-secondary); font-size: 0.875rem;">
                                                ${category}
                                            </div>
                                            <div style="font-size: 1.25rem; font-weight: 700; color: var(--danger);">
                                                ${count}
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                ` : ''}

                ${!analytics.today && !analytics.period && !realtime.activeUsers && (!errors.total || errors.total === 0) ? `
                    <div class="empty-state">
                        <div class="empty-state__icon">[EMOJI]</div>
                        <p>No analytics data available yet</p>
                        <p style="margin-top: var(--spacing-sm); font-size: 0.875rem; color: var(--muted);">
                            Analytics will appear here once you start using the API
                        </p>
                    </div>
                ` : ''}
            </div>
        `;
    }

    destroy() {
        // Cleanup if needed
    }
}

