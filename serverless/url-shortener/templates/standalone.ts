/**
 * Standalone HTML Template
 * 
 * This file contains the embedded HTML for the URL Shortener standalone page.
 * The HTML is embedded as a string constant for use in Cloudflare Workers.
 * 
 * Source: standalone.html
 * Note: This file should be kept in sync with standalone.html
 */

export const STANDALONE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>URL Shortener - Strixun Stream Suite</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        :root {
            /* Strixun Stream Suite Design System Colors */
            --bg: #1a1611;
            --bg-dark: #0f0e0b;
            --card: #252017;
            --border: #3d3627;
            --border-light: #4a4336;
            
            /* Brand Colors */
            --accent: #edae49;
            --accent-light: #f9df74;
            --accent-dark: #c68214;
            --accent2: #6495ed;
            
            /* Status Colors */
            --success: #28a745;
            --warning: #ffc107;
            --danger: #ea2b1f;
            --info: #6495ed;
            
            /* Text Colors */
            --text: #f9f9f9;
            --text-secondary: #b8b8b8;
            --muted: #888;
            
            /* Spacing (8px grid) */
            --spacing-xs: 8px;
            --spacing-sm: 12px;
            --spacing-md: 16px;
            --spacing-lg: 24px;
            --spacing-xl: 32px;
            --spacing-2xl: 48px;
            
            /* Border Radius */
            --radius-sm: 4px;
            --radius-md: 8px;
            --radius-lg: 12px;
            
            /* Shadows */
            --shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.2);
            --shadow-md: 0 4px 8px rgba(0, 0, 0, 0.3);
            --shadow-lg: 0 8px 16px rgba(0, 0, 0, 0.4);
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--bg);
            color: var(--text);
            line-height: 1.6;
            min-height: 100vh;
            padding: var(--spacing-lg);
        }

        .container {
            max-width: 900px;
            margin: 0 auto;
        }

        .header {
            text-align: center;
            margin-bottom: var(--spacing-2xl);
            padding: var(--spacing-xl) 0;
        }

        .header h1 {
            font-size: 2.5rem;
            font-weight: 600;
            margin-bottom: var(--spacing-md);
            color: var(--accent);
            text-shadow: 0 2px 4px rgba(237, 174, 73, 0.3);
        }

        .header p {
            color: var(--text-secondary);
            font-size: 1.1rem;
        }

        .card {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: var(--radius-md);
            padding: var(--spacing-xl);
            margin-bottom: var(--spacing-lg);
            box-shadow: var(--shadow-md);
            transition: border-color 0.2s, box-shadow 0.2s;
        }

        .card:hover {
            border-color: var(--border-light);
            box-shadow: var(--shadow-lg);
        }

        .auth-section {
            text-align: center;
        }

        .auth-section h2 {
            margin-bottom: 20px;
            font-size: 1.5rem;
        }

        .form-group {
            margin-bottom: 20px;
            text-align: left;
        }

        .form-group label {
            display: block;
            margin-bottom: 8px;
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
            text-decoration: none;
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

        .btn-group {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }

        .user-info {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: var(--spacing-lg);
            padding-bottom: var(--spacing-lg);
            border-bottom: 1px solid var(--border);
        }

        .user-info strong {
            color: var(--accent);
        }

        .user-info span {
            color: var(--text-secondary);
        }

        .create-section h2,
        .urls-section h2 {
            margin-bottom: var(--spacing-lg);
            font-size: 1.5rem;
            font-weight: 600;
            color: var(--accent);
        }

        .url-card {
            background: var(--bg-dark);
            border: 1px solid var(--border);
            border-radius: var(--radius-md);
            padding: var(--spacing-lg);
            margin-bottom: var(--spacing-md);
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
            margin-bottom: 12px;
        }

        .url-short {
            display: flex;
            align-items: center;
            gap: 10px;
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
            margin-bottom: 12px;
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

        .empty-state {
            text-align: center;
            padding: var(--spacing-2xl) var(--spacing-lg);
            color: var(--text-secondary);
        }

        .loading {
            text-align: center;
            padding: var(--spacing-lg);
            color: var(--text-secondary);
        }

        .toast {
            position: fixed;
            bottom: var(--spacing-lg);
            right: var(--spacing-lg);
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: var(--radius-md);
            padding: var(--spacing-md) var(--spacing-lg);
            box-shadow: var(--shadow-lg);
            z-index: 10000;
            max-width: 400px;
            animation: slideIn 0.3s ease-out;
        }

        .toast.success {
            border-left: 4px solid var(--success);
        }

        .toast.error {
            border-left: 4px solid var(--danger);
        }

        .toast.warning {
            border-left: 4px solid var(--warning);
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
            body {
                padding: var(--spacing-md);
            }

            .header h1 {
                font-size: 2rem;
            }

            .card {
                padding: var(--spacing-lg);
            }

            .user-info {
                flex-direction: column;
                align-items: flex-start;
                gap: 10px;
            }

            .url-card-header {
                flex-direction: column;
                gap: 10px;
            }

            .btn-group {
                width: 100%;
            }

            .btn-group .btn {
                flex: 1;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔗 URL Shortener</h1>
            <p>Strixun Stream Suite - Create and manage short URLs with secure OTP authentication</p>
        </div>

        <!-- Authentication Section - Uses Shared OTP Component -->
        <div id="authSection" class="card auth-section">
            <div id="otpLoginContainer"></div>
        </div>

        <!-- Main App Section -->
        <div id="appSection" style="display: none;">
            <div class="card">
                <div class="user-info">
                    <div>
                        <strong>Signed in as:</strong> <span id="userEmail"></span>
                    </div>
                    <button class="btn btn-secondary" onclick="logout()">
                        Sign Out
                    </button>
                </div>
            </div>

            <!-- Create URL Section -->
            <div class="card create-section">
                <h2>Create Short URL</h2>
                <div class="form-group">
                    <label for="urlInput">URL to shorten</label>
                    <input 
                        type="url" 
                        id="urlInput" 
                        placeholder="https://example.com/very/long/url"
                        autocomplete="off"
                    >
                </div>
                <div class="form-group">
                    <label for="customCodeInput">Custom code (optional)</label>
                    <input 
                        type="text" 
                        id="customCodeInput" 
                        placeholder="mycode"
                        pattern="[a-zA-Z0-9_-]{3,20}"
                        autocomplete="off"
                    >
                    <small>3-20 characters, letters, numbers, hyphens, and underscores only</small>
                </div>
                <button class="btn btn-primary" onclick="createShortUrl()" id="createBtn">
                    Create Short URL
                </button>
            </div>

            <!-- URLs List Section -->
            <div class="card urls-section">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="margin: 0;">Your Short URLs</h2>
                    <button class="btn btn-secondary" onclick="loadUrls()" id="refreshBtn">
                        🔄 Refresh
                    </button>
                </div>
                <div id="urlsList">
                    <div class="loading">Loading URLs...</div>
                </div>
            </div>
        </div>
    </div>

    <!-- Load decryption library and shared OTP Svelte component -->
    <script src="/decrypt.js"></script>
    <script src="/otp-login-svelte.js"></script>

    <script>
        // Configuration - Using custom domain (s.idling.app)
        const OTP_AUTH_API_URL = 'https://auth.idling.app';
        const URL_SHORTENER_API_URL = 'https://s.idling.app';
        
        // CRITICAL: OTP encryption key - must match server-side OTP_ENCRYPTION_KEY or JWT_SECRET
        // In production, this should be set via environment variable or window function
        const OTP_ENCRYPTION_KEY = (typeof window !== 'undefined' && window.getOtpEncryptionKey) 
            ? window.getOtpEncryptionKey() 
            : undefined; // Will use JWT_SECRET on server if not provided

        // State
        let authToken = null;
        let userEmail = null;
        let otpLoginComponent = null;

        // Helper to decrypt API responses using bundled library
        async function decryptResponse(response, token) {
            const isEncrypted = response.headers.get('X-Encrypted') === 'true';
            let data = await response.json();
            
            if (isEncrypted && data.encrypted && token) {
                try {
                    // Use the bundled decryptWithJWT function from /decrypt.js
                    if (typeof window.decryptWithJWT !== 'function') {
                        throw new Error('Decryption library not loaded. Please refresh the page.');
                    }
                    data = await window.decryptWithJWT(data, token);
                } catch (error) {
                    console.error('Failed to decrypt response:', error);
                    throw new Error('Failed to decrypt response. Please try again.');
                }
            }
            
            return data;
        }

        // Initialize
        window.addEventListener('DOMContentLoaded', () => {
            // Check for stored token
            const storedToken = localStorage.getItem('urlShortenerToken');
            const storedEmail = localStorage.getItem('urlShortenerEmail');
            
            if (storedToken && storedEmail) {
                authToken = storedToken;
                userEmail = storedEmail;
                showApp();
            } else {
                showAuth();
            }
        });

        // Authentication Functions - Using Shared OTP Component
        function handleLoginSuccess(data) {
            // Support both OAuth 2.0 format (access_token) and legacy format (token)
            authToken = data.access_token || data.token;
            userEmail = data.email;
            
            // Store token
            localStorage.setItem('urlShortenerToken', authToken);
            localStorage.setItem('urlShortenerEmail', userEmail);
            
            showToast('Successfully signed in!', 'success');
            showApp();
        }

        function handleLoginError(error) {
            showToast(error, 'error');
        }

        function logout() {
            authToken = null;
            userEmail = null;
            localStorage.removeItem('urlShortenerToken');
            localStorage.removeItem('urlShortenerEmail');
            if (otpLoginComponent) {
                otpLoginComponent.$destroy();
                otpLoginComponent = null;
            }
            showAuth();
            showToast('Signed out successfully', 'success');
        }

        function showAuth() {
            document.getElementById('authSection').style.display = 'block';
            document.getElementById('appSection').style.display = 'none';
            
            // Initialize shared OTP Svelte component if not already initialized
            if (!otpLoginComponent && typeof window.OtpLoginSvelte !== 'undefined') {
                const container = document.getElementById('otpLoginContainer');
                container.innerHTML = ''; // Clear container
                
                // Use the bundled Svelte component - same as all other apps
                otpLoginComponent = new window.OtpLoginSvelte({
                    target: container,
                    props: {
                        apiUrl: OTP_AUTH_API_URL,
                        onSuccess: handleLoginSuccess,
                        onError: handleLoginError,
                        otpEncryptionKey: OTP_ENCRYPTION_KEY,
                        title: 'Sign In',
                        subtitle: 'Enter your email to receive a verification code',
                    },
                });
            } else if (otpLoginComponent) {
                // Reset component if it exists
                otpLoginComponent.$destroy();
                otpLoginComponent = null;
                showAuth(); // Re-initialize
            }
        }

        function showApp() {
            document.getElementById('authSection').style.display = 'none';
            document.getElementById('appSection').style.display = 'block';
            document.getElementById('userEmail').textContent = userEmail;
            loadUrls();
        }

        // URL Shortener Functions
        async function createShortUrl() {
            const url = document.getElementById('urlInput').value.trim();
            const customCode = document.getElementById('customCodeInput').value.trim();

            if (!url) {
                showToast('Please enter a URL to shorten', 'error');
                return;
            }

            if (!isValidUrl(url)) {
                showToast('Please enter a valid URL (must start with http:// or https://)', 'error');
                return;
            }

            if (customCode && !/^[a-zA-Z0-9_-]{3,20}$/.test(customCode)) {
                showToast('Custom code must be 3-20 characters and contain only letters, numbers, hyphens, and underscores', 'error');
                return;
            }

            const createBtn = document.getElementById('createBtn');
            createBtn.disabled = true;
            createBtn.textContent = 'Creating...';

            try {
                const response = await fetch(\`\${URL_SHORTENER_API_URL}/api/create\`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': \`Bearer \${authToken}\`,
                    },
                    body: JSON.stringify({
                        url,
                        customCode: customCode || undefined,
                    }),
                });

                const data = await decryptResponse(response, authToken);

                if (response.ok && data.success) {
                    showToast(\`Short URL created: \${data.shortUrl}\`, 'success');
                    document.getElementById('urlInput').value = '';
                    document.getElementById('customCodeInput').value = '';
                    loadUrls();
                } else {
                    showToast(data.error || 'Failed to create short URL', 'error');
                }
            } catch (error) {
                showToast('Network error. Please try again.', 'error');
            } finally {
                createBtn.disabled = false;
                createBtn.textContent = 'Create Short URL';
            }
        }

        async function loadUrls() {
            const urlsList = document.getElementById('urlsList');
            const refreshBtn = document.getElementById('refreshBtn');
            
            urlsList.innerHTML = '<div class="loading">Loading URLs...</div>';
            refreshBtn.disabled = true;

            try {
                const response = await fetch(\`\${URL_SHORTENER_API_URL}/api/list\`, {
                    headers: {
                        'Authorization': \`Bearer \${authToken}\`,
                    },
                });

                const data = await decryptResponse(response, authToken);

                if (response.ok && data.success) {
                    if (data.urls && data.urls.length > 0) {
                        urlsList.innerHTML = data.urls.map(url => \`
                            <div class="url-card">
                                <div class="url-card-header">
                                    <div class="url-short">
                                        <strong>\${escapeHtml(url.shortUrl)}</strong>
                                        <button class="btn-copy" onclick="copyToClipboard('\${escapeHtml(url.shortUrl)}')" title="Copy to clipboard">
                                            📋 Copy
                                        </button>
                                    </div>
                                    <button class="btn btn-danger" onclick="deleteUrl('\${escapeHtml(url.shortCode)}')" title="Delete">
                                        🗑️ Delete
                                    </button>
                                </div>
                                <div class="url-original">
                                    <a href="\${escapeHtml(url.url)}" target="_blank" rel="noopener noreferrer">
                                        \${escapeHtml(url.url)}
                                    </a>
                                </div>
                                <div class="url-meta">
                                    <span>Created: \${new Date(url.createdAt).toLocaleDateString()}</span>
                                    <span>•</span>
                                    <span>Clicks: \${url.clickCount || 0}</span>
                                </div>
                            </div>
                        \`).join('');
                    } else {
                        urlsList.innerHTML = '<div class="empty-state">No short URLs yet. Create your first one above!</div>';
                    }
                } else {
                    if (response.status === 401) {
                        showToast('Session expired. Please sign in again.', 'error');
                        logout();
                    } else {
                        showToast(data.error || 'Failed to load URLs', 'error');
                        urlsList.innerHTML = '<div class="empty-state">Failed to load URLs</div>';
                    }
                }
            } catch (error) {
                showToast('Network error. Please try again.', 'error');
                urlsList.innerHTML = '<div class="empty-state">Network error</div>';
            } finally {
                refreshBtn.disabled = false;
            }
        }

        async function deleteUrl(shortCode) {
            if (!confirm('Are you sure you want to delete this short URL?')) {
                return;
            }

            try {
                const response = await fetch(\`\${URL_SHORTENER_API_URL}/api/delete/\${shortCode}\`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': \`Bearer \${authToken}\`,
                    },
                });

                const data = await decryptResponse(response, authToken);

                if (response.ok && data.success) {
                    showToast('Short URL deleted successfully', 'success');
                    loadUrls();
                } else {
                    if (response.status === 401) {
                        showToast('Session expired. Please sign in again.', 'error');
                        logout();
                    } else {
                        showToast(data.error || 'Failed to delete URL', 'error');
                    }
                }
            } catch (error) {
                showToast('Network error. Please try again.', 'error');
            }
        }

        // Utility Functions
        function isValidUrl(url) {
            try {
                const urlObj = new URL(url);
                return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
            } catch {
                return false;
            }
        }

        async function copyToClipboard(text) {
            try {
                await navigator.clipboard.writeText(text);
                showToast('Copied to clipboard!', 'success');
            } catch (error) {
                // Fallback for older browsers
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                try {
                    document.execCommand('copy');
                    showToast('Copied to clipboard!', 'success');
                } catch (err) {
                    showToast('Failed to copy to clipboard', 'error');
                }
                document.body.removeChild(textarea);
            }
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function showToast(message, type = 'success') {
            const toast = document.createElement('div');
            toast.className = \`toast \${type}\`;
            toast.textContent = message;
            document.body.appendChild(toast);

            setTimeout(() => {
                toast.style.animation = 'slideIn 0.3s ease-out reverse';
                setTimeout(() => {
                    document.body.removeChild(toast);
                }, 300);
            }, 3000);
        }

        // Allow Enter key to submit forms
        document.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                if (document.getElementById('emailInput') === document.activeElement) {
                    requestOTP();
                } else if (document.getElementById('otpInput') === document.activeElement) {
                    verifyOTP();
                } else if (document.getElementById('urlInput') === document.activeElement) {
                    createShortUrl();
                }
            }
        });
    </script>
</body>
</html>`;

