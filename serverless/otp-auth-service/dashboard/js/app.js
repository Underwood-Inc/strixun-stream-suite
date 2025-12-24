/**
 * Main Application Router
 * Handles routing and page navigation
 */

import { apiClient } from './api-client.js';
import { LoginComponent } from './auth.js';
import { DashboardPage } from './pages/dashboard.js';
import { ApiKeysPage } from './pages/api-keys.js';
import { AuditLogsPage } from './pages/audit-logs.js';
import { AnalyticsPage } from './pages/analytics.js';

/**
 * Main App Class
 */
export class App {
    constructor() {
        this.currentPage = null;
        this.currentPageComponent = null;
        this.user = null;
        this.customer = null;
        this.isAuthenticated = false;
        
        this.init();
    }

    /**
     * Initialize app
     */
    async init() {
        // Check authentication
        if (apiClient.token) {
            try {
                this.user = await apiClient.getMe();
                this.isAuthenticated = true;
                await this.loadCustomer();
                this.showDashboard();
            } catch (error) {
                console.error('Auth check failed:', error);
                apiClient.setToken(null);
                this.showLogin();
            }
        } else {
            this.showLogin();
        }

        // Setup event listeners
        this.setupEventListeners();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Auth events
        window.addEventListener('auth:login', () => {
            this.isAuthenticated = true;
            this.loadCustomer().then(() => this.showDashboard());
        });

        window.addEventListener('auth:logout', () => {
            this.isAuthenticated = false;
            this.user = null;
            this.customer = null;
            this.showLogin();
        });

        // Navigation
        document.querySelectorAll('.app-nav__link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = link.getAttribute('data-page');
                if (page) {
                    this.navigateToPage(page);
                }
            });
        });

        // Logout button
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }
    }

    /**
     * Load customer data
     */
    async loadCustomer() {
        try {
            this.customer = await apiClient.getCustomer();
        } catch (error) {
            console.error('Failed to load customer:', error);
            // If customer endpoint fails, we might not have API key setup yet
            // That's okay, we'll handle it in the pages
        }
    }

    /**
     * Show login page
     */
    showLogin() {
        const loginPage = document.getElementById('login-page');
        const dashboardPage = document.getElementById('dashboard-page');
        const userInfo = document.getElementById('user-info');
        
        if (loginPage) loginPage.classList.add('active');
        if (dashboardPage) dashboardPage.classList.remove('active');
        if (userInfo) userInfo.style.display = 'none';

        // Render login component
        if (loginPage) {
            const loginContainer = loginPage;
            const loginComponent = new LoginComponent(loginContainer);
            loginComponent.render();
        }
    }

    /**
     * Show dashboard
     */
    showDashboard() {
        const loginPage = document.getElementById('login-page');
        const dashboardPage = document.getElementById('dashboard-page');
        const userInfo = document.getElementById('user-info');
        const userEmail = document.getElementById('user-email');
        
        if (loginPage) loginPage.classList.remove('active');
        if (dashboardPage) dashboardPage.classList.add('active');
        if (userInfo) userInfo.style.display = 'flex';
        if (userEmail && this.user) {
            userEmail.textContent = this.user.email || 'User';
        }

        // Navigate to default page
        this.navigateToPage('dashboard');
    }

    /**
     * Navigate to page
     * @param {string} pageName - Page name
     */
    navigateToPage(pageName) {
        // Update navigation
        document.querySelectorAll('.app-nav__link').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('data-page') === pageName) {
                link.classList.add('active');
            }
        });

        // Clean up current page
        if (this.currentPageComponent && typeof this.currentPageComponent.destroy === 'function') {
            this.currentPageComponent.destroy();
        }

        // Render new page
        const contentContainer = document.getElementById('dashboard-content');
        if (!contentContainer) return;

        this.currentPage = pageName;

        switch (pageName) {
            case 'dashboard':
                this.currentPageComponent = new DashboardPage(contentContainer, this.customer);
                break;
            case 'api-keys':
                this.currentPageComponent = new ApiKeysPage(contentContainer, this.customer);
                break;
            case 'audit-logs':
                this.currentPageComponent = new AuditLogsPage(contentContainer, this.customer);
                break;
            case 'analytics':
                this.currentPageComponent = new AnalyticsPage(contentContainer, this.customer);
                break;
            default:
                contentContainer.innerHTML = '<div class="error">Page not found</div>';
        }
    }

    /**
     * Handle logout
     */
    async handleLogout() {
        try {
            await apiClient.logout();
        } catch (error) {
            console.error('Logout error:', error);
        }
        window.dispatchEvent(new CustomEvent('auth:logout'));
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new App();
    });
} else {
    new App();
}

