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
    
    // URL Shortener API URL (auto-injected during deployment)
    // Format: https://strixun-url-shortener.YOUR_SUBDOMAIN.workers.dev
    URL_SHORTENER_API_URL: '%%URL_SHORTENER_API_URL%%',
    
    // OTP Auth Service API URL (auto-injected during deployment)
    // Format: https://otp-auth-service.YOUR_SUBDOMAIN.workers.dev
    OTP_AUTH_API_URL: '%%OTP_AUTH_API_URL%%',
    
    // GitHub Pages base URL (auto-injected during deployment)
    GITHUB_PAGES_URL: '%%GITHUB_PAGES_URL%%',
    
    // Storybook URL (auto-injected during deployment)
    STORYBOOK_URL: '%%STORYBOOK_URL%%',
    
    // Twitch API Configuration (auto-injected during deployment)
    TWITCH_CLIENT_ID: '%%TWITCH_CLIENT_ID%%',
    
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
 * 3. Hardcoded fallback (for development/testing)
 * 4. Null (user must configure)
 */
// Cache the API URL to prevent repeated logging
let cachedApiUrl = null;
let apiUrlLogged = false;

/**
 * Validate and normalize a URL
 * Returns null if URL is invalid or malformed
 */
function validateAndNormalizeUrl(url) {
    if (!url || typeof url !== 'string') {
        return null;
    }
    
    const trimmed = url.trim();
    if (!trimmed || trimmed === '') {
        return null;
    }
    
    // Check for placeholder values
    if (trimmed.startsWith('%%') || trimmed.includes('%%')) {
        return null;
    }
    
    // Check for malformed URLs (starts with dot, missing protocol, etc.)
    if (trimmed.startsWith('.') || trimmed.startsWith('/')) {
        console.warn('[Config] Invalid URL format (starts with . or /):', trimmed);
        return null;
    }
    
    // If URL doesn't start with http:// or https://, try to fix it
    let normalized = trimmed;
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
        // If it looks like a domain, add https://
        if (normalized.includes('.') && !normalized.includes(' ')) {
            normalized = 'https://' + normalized;
        } else {
            console.warn('[Config] Invalid URL format (missing protocol):', trimmed);
            return null;
        }
    }
    
    // Validate URL format
    try {
        const urlObj = new URL(normalized);
        // Ensure it's a valid URL
        if (!urlObj.hostname || urlObj.hostname === '') {
            console.warn('[Config] Invalid URL (no hostname):', trimmed);
            return null;
        }
        // Check for double dots in hostname (malformed)
        if (urlObj.hostname.startsWith('.') || urlObj.hostname.includes('..')) {
            console.warn('[Config] Invalid URL (malformed hostname):', trimmed);
            return null;
        }
        return normalized;
    } catch (e) {
        console.warn('[Config] Invalid URL format:', trimmed, e);
        return null;
    }
}

window.getWorkerApiUrl = function() {
    // Return cached value if available
    if (cachedApiUrl !== null) {
        return cachedApiUrl;
    }
    
    // Priority 1: Manual override from storage
    if (typeof storage !== 'undefined') {
        const manualOverride = storage.get('twitch_api_server');
        if (manualOverride && typeof manualOverride === 'string' && manualOverride.trim() !== '') {
            const validated = validateAndNormalizeUrl(manualOverride);
            if (validated) {
                if (!apiUrlLogged) {
                    console.log('[Config] Using manual API server override:', validated);
                    apiUrlLogged = true;
                }
                cachedApiUrl = validated;
                return cachedApiUrl;
            } else {
                console.warn('[Config] Manual override URL is invalid, ignoring:', manualOverride);
            }
        }
    }
    
    // Priority 2: Auto-injected during deployment
    const injected = window.STRIXUN_CONFIG.WORKER_API_URL;
    if (injected && typeof injected === 'string') {
        const validated = validateAndNormalizeUrl(injected);
        if (validated) {
            if (!apiUrlLogged) {
                console.log('[Config] Using auto-injected API server:', validated);
                apiUrlLogged = true;
            }
            cachedApiUrl = validated;
            return cachedApiUrl;
        } else {
            console.warn('[Config] Injected URL is invalid, ignoring:', injected);
        }
    }
    
    // Priority 3: Hardcoded fallback for local development
    // Using custom domain: api.idling.app
    const HARDCODED_WORKER_URL = 'https://api.idling.app';
    if (HARDCODED_WORKER_URL && !HARDCODED_WORKER_URL.includes('UPDATE-ME')) {
        if (!apiUrlLogged) {
            console.log('[Config] Using hardcoded Worker URL:', HARDCODED_WORKER_URL);
            console.warn('[Config] [WARNING] Using hardcoded fallback. For production, add WORKER_URL to GitHub Actions.');
            apiUrlLogged = true;
        }
        cachedApiUrl = HARDCODED_WORKER_URL;
        return cachedApiUrl;
    }
    
    // Priority 4: No configuration available
    if (!apiUrlLogged) {
        console.error('[Config] [ERROR] No API server configured!');
        console.log('[Config] Solutions:');
        console.log('  1. Update HARDCODED_WORKER_URL in config.js with your actual Worker URL');
        console.log('  2. OR manually configure in Setup  Twitch API Settings');
        console.log('  3. OR add WORKER_URL to GitHub Secrets for auto-injection');
        apiUrlLogged = true;
    }
    cachedApiUrl = null;
    return null;
};

/**
 * Get URL Shortener API URL
 * Priority:
 * 1. Manual override from localStorage (url_shortener_api_server)
 * 2. Auto-injected config from deployment
 * 3. Hardcoded fallback (for development/testing)
 * 4. Null (user must configure)
 */
// Cache the URL shortener API URL to prevent repeated logging
let cachedUrlShortenerApiUrl = null;
let urlShortenerApiUrlLogged = false;

window.getUrlShortenerApiUrl = function() {
    // Return cached value if available
    if (cachedUrlShortenerApiUrl !== null) {
        return cachedUrlShortenerApiUrl;
    }
    
    // Priority 1: Manual override from storage
    if (typeof storage !== 'undefined') {
        const manualOverride = storage.get('url_shortener_api_server');
        if (manualOverride && manualOverride.trim() !== '') {
            if (!urlShortenerApiUrlLogged) {
                console.log('[Config] Using manual URL shortener API server override:', manualOverride);
                urlShortenerApiUrlLogged = true;
            }
            cachedUrlShortenerApiUrl = manualOverride;
            return cachedUrlShortenerApiUrl;
        }
    }
    
    // Priority 2: Auto-injected during deployment
    const injected = window.STRIXUN_CONFIG.URL_SHORTENER_API_URL;
    if (injected && !injected.startsWith('%%')) {
        if (!urlShortenerApiUrlLogged) {
            console.log('[Config] Using auto-injected URL shortener API server:', injected);
            urlShortenerApiUrlLogged = true;
        }
        cachedUrlShortenerApiUrl = injected;
        return cachedUrlShortenerApiUrl;
    }
    
    // Priority 3: Hardcoded fallback - use custom domain (s.idling.app)
    const CUSTOM_DOMAIN_URL = 'https://s.idling.app';
    const WORKERS_DEV_URL = 'https://strixun-url-shortener.strixuns-script-suite.workers.dev';
    
    // Use custom domain as primary (s.idling.app)
    const HARDCODED_URL_SHORTENER_URL = CUSTOM_DOMAIN_URL;
    
    if (HARDCODED_URL_SHORTENER_URL && !HARDCODED_URL_SHORTENER_URL.includes('UPDATE-ME')) {
        if (!urlShortenerApiUrlLogged) {
            console.log('[Config] Using hardcoded URL Shortener Worker URL:', HARDCODED_URL_SHORTENER_URL);
            console.log('[Config] [OK] Using custom domain: s.idling.app');
            urlShortenerApiUrlLogged = true;
        }
        cachedUrlShortenerApiUrl = HARDCODED_URL_SHORTENER_URL;
        return cachedUrlShortenerApiUrl;
    }
    
    // Priority 4: No configuration available
    if (!urlShortenerApiUrlLogged) {
        console.error('[Config] [ERROR] No URL shortener API server configured!');
        console.log('[Config] Solutions:');
        console.log('  1. Update HARDCODED_URL_SHORTENER_URL in config.js with your actual Worker URL');
        console.log('  2. OR manually configure in localStorage (url_shortener_api_server)');
        console.log('  3. OR add URL_SHORTENER_API_URL to GitHub Secrets for auto-injection');
        urlShortenerApiUrlLogged = true;
    }
    cachedUrlShortenerApiUrl = null;
    return null;
};

/**
 * Get OTP Auth Service API URL
 * Priority:
 * 1. Manual override from localStorage (otp_auth_api_server)
 * 2. Auto-injected config from deployment
 * 3. Hardcoded fallback (for development/testing)
 * 4. Null (user must configure)
 */
// Cache the OTP auth API URL to prevent repeated logging
let cachedOtpAuthApiUrl = null;
let otpAuthApiUrlLogged = false;

window.getOtpAuthApiUrl = function() {
    // Return cached value if available
    if (cachedOtpAuthApiUrl !== null) {
        return cachedOtpAuthApiUrl;
    }
    
    // Priority 1: Manual override from storage
    if (typeof storage !== 'undefined') {
        const manualOverride = storage.get('otp_auth_api_server');
        if (manualOverride && manualOverride.trim() !== '') {
            if (!otpAuthApiUrlLogged) {
                console.log('[Config] Using manual OTP auth API server override:', manualOverride);
                otpAuthApiUrlLogged = true;
            }
            cachedOtpAuthApiUrl = manualOverride;
            return cachedOtpAuthApiUrl;
        }
    }
    
    // Priority 2: Auto-injected during deployment
    const injected = window.STRIXUN_CONFIG.OTP_AUTH_API_URL;
    if (injected && !injected.startsWith('%%')) {
        if (!otpAuthApiUrlLogged) {
            console.log('[Config] Using auto-injected OTP auth API server:', injected);
            otpAuthApiUrlLogged = true;
        }
        cachedOtpAuthApiUrl = injected;
        return cachedOtpAuthApiUrl;
    }
    
    // Priority 3: Hardcoded fallback - use custom domain as primary
    const CUSTOM_DOMAIN_URL = 'https://auth.idling.app';
    const WORKERS_DEV_URL = 'https://otp-auth-service.strixuns-script-suite.workers.dev';
    
    // Use custom domain as primary (auth.idling.app)
    const HARDCODED_OTP_AUTH_URL = CUSTOM_DOMAIN_URL;
    
    if (HARDCODED_OTP_AUTH_URL && !HARDCODED_OTP_AUTH_URL.includes('UPDATE-ME')) {
        if (!otpAuthApiUrlLogged) {
            console.log('[Config] Using hardcoded OTP Auth Worker URL:', HARDCODED_OTP_AUTH_URL);
            console.log('[Config] [OK] Using custom domain: auth.idling.app');
            otpAuthApiUrlLogged = true;
        }
        cachedOtpAuthApiUrl = HARDCODED_OTP_AUTH_URL;
        return cachedOtpAuthApiUrl;
    }
    
    // Priority 4: No configuration available
    if (!otpAuthApiUrlLogged) {
        console.error('[Config] [ERROR] No OTP auth API server configured!');
        console.log('[Config] Solutions:');
        console.log('  1. Update HARDCODED_OTP_AUTH_URL in config.js with your actual Worker URL');
        console.log('  2. OR manually configure in localStorage (otp_auth_api_server)');
        console.log('  3. OR add OTP_AUTH_API_URL to GitHub Secrets for auto-injection');
        otpAuthApiUrlLogged = true;
    }
    cachedOtpAuthApiUrl = null;
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
            message: 'Configure API server URL in Setup  Twitch API Settings'
        };
    }
    
    // Validate URL before making request
    try {
        const urlObj = new URL(apiUrl);
        // Check for malformed URLs
        if (urlObj.hostname.startsWith('.') || urlObj.hostname.includes('..') || !urlObj.hostname) {
            return {
                success: false,
                error: 'Invalid URL format',
                message: `API URL is malformed: ${apiUrl}. Please check your configuration.`
            };
        }
    } catch (e) {
        return {
            success: false,
            error: 'Invalid URL format',
            message: `API URL is invalid: ${apiUrl}. Please check your configuration.`
        };
    }
    
    try {
        // Skip health check if API URL is a placeholder or non-existent domain
        if (apiUrl.includes('%%') || apiUrl.includes('idling.app')) {
            return {
                success: false,
                error: 'API not configured',
                message: 'API server URL not configured for local development'
            };
        }
        
        // Add timeout to prevent browser lockup (5 seconds max)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
        }, 5000);
        
        let response;
        try {
            response = await fetch(`${apiUrl}/health`, {
                method: 'GET',
                cache: 'no-store',
                signal: controller.signal
            });
            clearTimeout(timeoutId);
        } catch (fetchError) {
            clearTimeout(timeoutId);
            // If aborted, it's a timeout
            if (fetchError instanceof Error && fetchError.name === 'AbortError') {
                return {
                    success: false,
                    error: 'Request timeout',
                    message: 'Health check timed out after 5 seconds'
                };
            }
            throw fetchError; // Re-throw other errors
        }
        
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
    console.group(' Strixun Stream Suite - Configuration');
    console.log('Worker API URL:', window.getWorkerApiUrl() || '[ERROR] Not configured');
    console.log('URL Shortener API URL:', window.getUrlShortenerApiUrl() || '[ERROR] Not configured');
    console.log('OTP Auth API URL:', window.getOtpAuthApiUrl() || '[ERROR] Not configured');
    console.log('GitHub Pages URL:', window.getGitHubPagesUrl());
    console.log('Deployed At:', window.STRIXUN_CONFIG.DEPLOYED_AT);
    console.log('Environment:', window.STRIXUN_CONFIG.DEPLOYMENT_ENV);
    
    if (window.STRIXUN_CONFIG.FEATURES.WORKER_HEALTH_CHECK) {
        const healthCheck = await window.testWorkerApi();
        if (healthCheck.success) {
            console.log('[OK] Worker API Health Check: PASSED');
            console.log('Worker Info:', healthCheck.data);
        } else {
            console.warn('[WARNING] Worker API Health Check: FAILED');
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

