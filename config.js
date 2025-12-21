/**
 * Strixun Stream Suite - Configuration
 * Auto-configuration with smart defaults and manual overrides
 * 
 * This file is auto-generated during deployment but can be manually edited.
 */

window.STRIXUN_CONFIG = window.STRIXUN_CONFIG || {
    // Cloudflare Worker API URL (auto-injected during deployment)
    // Format: https://strixun-twitch-api.YOUR_SUBDOMAIN.workers.dev
    WORKER_API_URL: '%%WORKER_API_URL%%',
    
    // GitHub Pages base URL (auto-injected during deployment)
    GITHUB_PAGES_URL: '%%GITHUB_PAGES_URL%%',
    
    // Deployment info (for debugging)
    DEPLOYED_AT: '%%DEPLOYED_AT%%',
    DEPLOYMENT_ENV: '%%DEPLOYMENT_ENV%%',
    
    // Feature flags
    FEATURES: {
        AUTO_CONFIG: true,
        WORKER_HEALTH_CHECK: true,
        CONFIG_VALIDATION: true
    }
};

/**
 * Get the Cloudflare Worker API URL
 * Priority:
 * 1. Manual override from localStorage (twitch_api_server)
 * 2. Auto-injected config from deployment
 * 3. Auto-detection based on wrangler.toml
 * 4. Null (user must configure)
 */
window.getWorkerApiUrl = function() {
    // Priority 1: Manual override from storage
    if (typeof storage !== 'undefined') {
        const manualOverride = storage.get('twitch_api_server');
        if (manualOverride && manualOverride.trim() !== '') {
            console.log('[Config] Using manual API server override:', manualOverride);
            return manualOverride;
        }
    }
    
    // Priority 2: Auto-injected during deployment
    const injected = window.STRIXUN_CONFIG.WORKER_API_URL;
    if (injected && !injected.startsWith('%%')) {
        console.log('[Config] Using auto-injected API server:', injected);
        return injected;
    }
    
    // Priority 3: Auto-detect from known patterns
    // If running on GitHub Pages, attempt to construct the Worker URL
    const hostname = window.location.hostname;
    if (hostname.includes('github.io')) {
        // Extract GitHub username from URL: https://username.github.io/repo/
        const username = hostname.split('.')[0];
        // Construct Worker URL based on naming convention
        const autoDetectedUrl = `https://strixun-twitch-api.${username}.workers.dev`;
        console.log('[Config] Auto-detected API server:', autoDetectedUrl);
        console.warn('[Config] ⚠️ This is an auto-detected URL. Verify it works or configure manually in Setup.');
        return autoDetectedUrl;
    }
    
    // Priority 4: No configuration available
    console.warn('[Config] ⚠️ No API server configured. Please configure in Setup → Twitch API Settings');
    return null;
};

/**
 * Get GitHub Pages base URL
 */
window.getGitHubPagesUrl = function() {
    const injected = window.STRIXUN_CONFIG.GITHUB_PAGES_URL;
    if (injected && !injected.startsWith('%%')) {
        return injected;
    }
    
    // Fallback to current location
    const { protocol, hostname, pathname } = window.location;
    const basePath = pathname.substring(0, pathname.lastIndexOf('/') + 1);
    return `${protocol}//${hostname}${basePath}`;
};

/**
 * Test Worker API connection
 */
window.testWorkerApi = async function() {
    const apiUrl = window.getWorkerApiUrl();
    if (!apiUrl) {
        return {
            success: false,
            error: 'No API server configured',
            message: 'Configure API server URL in Setup → Twitch API Settings'
        };
    }
    
    try {
        const response = await fetch(`${apiUrl}/health`, {
            method: 'GET',
            cache: 'no-store'
        });
        
        if (!response.ok) {
            return {
                success: false,
                error: `HTTP ${response.status}`,
                message: 'Worker is deployed but returned an error'
            };
        }
        
        const data = await response.json();
        return {
            success: true,
            data,
            message: 'Worker API is healthy and responsive'
        };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            message: 'Failed to connect to Worker. Check URL and CORS settings.'
        };
    }
};

/**
 * Initialize configuration
 * Runs health checks and logs config state
 */
window.initStrixunConfig = async function() {
    console.group('🎬 Strixun Stream Suite - Configuration');
    console.log('Worker API URL:', window.getWorkerApiUrl() || '❌ Not configured');
    console.log('GitHub Pages URL:', window.getGitHubPagesUrl());
    console.log('Deployed At:', window.STRIXUN_CONFIG.DEPLOYED_AT);
    console.log('Environment:', window.STRIXUN_CONFIG.DEPLOYMENT_ENV);
    
    if (window.STRIXUN_CONFIG.FEATURES.WORKER_HEALTH_CHECK) {
        const healthCheck = await window.testWorkerApi();
        if (healthCheck.success) {
            console.log('✅ Worker API Health Check: PASSED');
            console.log('Worker Info:', healthCheck.data);
        } else {
            console.warn('⚠️ Worker API Health Check: FAILED');
            console.warn('Error:', healthCheck.error);
            console.warn('Message:', healthCheck.message);
        }
    }
    
    console.groupEnd();
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (window.STRIXUN_CONFIG.FEATURES.AUTO_CONFIG) {
            window.initStrixunConfig();
        }
    });
} else {
    if (window.STRIXUN_CONFIG.FEATURES.AUTO_CONFIG) {
        window.initStrixunConfig();
    }
}

