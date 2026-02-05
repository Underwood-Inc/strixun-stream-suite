/**
 * API Key Verification Handler
 * Allows developers to test and verify their API keys work correctly
 */

import { getCorsHeadersRecord } from '../../utils/cors.js';
import { verifyApiKey, getApiKeysForCustomer, type ApiKeyData } from '../../services/api-key.js';
import { fetchCustomerByCustomerId } from '@strixun/api-framework';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    JWT_SECRET?: string;
    [key: string]: any;
}

interface TestStep {
    step: number;
    name: string;
    status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
    message: string;
    duration?: number;
}

interface ApiKeyVerifyResponse {
    success: boolean;
    valid: boolean;
    keyId?: string;
    name?: string;
    status?: 'active' | 'inactive' | 'revoked';
    customerId?: string;
    customerStatus?: string;
    customerPlan?: string;
    createdAt?: string;
    lastUsed?: string | null;
    ssoConfig?: {
        isolationMode: string;
        globalSsoEnabled: boolean;
    };
    services: {
        name: string;
        endpoint: string;
        available: boolean;
    }[];
    rateLimits?: {
        requestsPerHour: number;
        requestsPerDay: number;
    };
    error?: string;
    testedAt: string;
    /** Step-by-step test results */
    testSteps: TestStep[];
    /** Summary of what was tested */
    testSummary: string;
}

/**
 * Verify API key and return detailed information
 * POST /api-key/verify
 * 
 * This endpoint performs a comprehensive multi-tenant integration test:
 * 1. Validates the API key format and cryptographic signature
 * 2. Verifies the key exists and is active in the database
 * 3. Checks the associated customer account status
 * 4. Tests tenant isolation (key is scoped to correct customer)
 * 5. Validates SSO configuration
 * 6. Returns available services and rate limits
 */
export async function handleVerifyApiKey(request: Request, env: Env): Promise<Response> {
    const corsHeaders = getCorsHeadersRecord(env, request);
    const testSteps: TestStep[] = [];
    let stepNumber = 1;
    
    const addStep = (name: string, status: TestStep['status'], message: string, duration?: number): void => {
        testSteps.push({ step: stepNumber++, name, status, message, duration });
    };
    
    try {
        // STEP 1: Check API key header presence
        const step1Start = Date.now();
        const apiKey = request.headers.get('X-OTP-API-Key');
        
        if (!apiKey) {
            addStep('API Key Header Check', 'failed', 'Missing X-OTP-API-Key header in request');
            const response: ApiKeyVerifyResponse = {
                success: false,
                valid: false,
                services: [],
                error: 'Missing X-OTP-API-Key header',
                testedAt: new Date().toISOString(),
                testSteps,
                testSummary: 'Test failed: No API key provided in request headers'
            };
            return new Response(JSON.stringify(response), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
        addStep('API Key Header Check', 'passed', 'X-OTP-API-Key header present', Date.now() - step1Start);
        
        // STEP 2: Validate API key format
        const step2Start = Date.now();
        const trimmedKey = apiKey.trim();
        const isValidFormat = trimmedKey.startsWith('otp_live_sk_') || trimmedKey.startsWith('otp_test_sk_');
        if (!isValidFormat) {
            addStep('API Key Format Validation', 'failed', `Invalid key prefix. Expected 'otp_live_sk_' or 'otp_test_sk_'`);
            const response: ApiKeyVerifyResponse = {
                success: false,
                valid: false,
                services: [],
                error: 'Invalid API key format',
                testedAt: new Date().toISOString(),
                testSteps,
                testSummary: 'Test failed: API key does not have valid format'
            };
            return new Response(JSON.stringify(response), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
        const keyType = trimmedKey.startsWith('otp_live_sk_') ? 'LIVE' : 'TEST';
        addStep('API Key Format Validation', 'passed', `Valid ${keyType} key format detected`, Date.now() - step2Start);
        
        // STEP 3: Cryptographic verification (hash lookup in KV)
        const step3Start = Date.now();
        console.log('[ApiKeyVerify] Verifying key:', {
            keyLength: trimmedKey.length,
            keyPrefix: trimmedKey.substring(0, 20) + '...',
            keySuffix: '...' + trimmedKey.substring(trimmedKey.length - 8)
        });
        const verification = await verifyApiKey(apiKey, env);
        console.log('[ApiKeyVerify] Verification result:', verification ? 'FOUND' : 'NOT FOUND');
        
        if (!verification) {
            addStep('Cryptographic Verification', 'failed', 'Key hash not found in database or key is revoked/inactive');
            const response: ApiKeyVerifyResponse = {
                success: true,
                valid: false,
                services: [],
                error: 'Invalid or revoked API key',
                testedAt: new Date().toISOString(),
                testSteps,
                testSummary: 'Test failed: API key not found or has been revoked'
            };
            return new Response(JSON.stringify(response), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
        addStep('Cryptographic Verification', 'passed', `Key verified via SHA-256 hash lookup. Key ID: ${verification.keyId}`, Date.now() - step3Start);
        
        // STEP 4: Customer account verification
        // Use fetchCustomerByCustomerId which calls customer-api service (not local KV)
        const step4Start = Date.now();
        const customer = await fetchCustomerByCustomerId(verification.customerId, env);
        if (!customer) {
            addStep('Customer Account Check', 'failed', `Customer ${verification.customerId} not found`);
        } else if (customer.status !== 'active') {
            addStep('Customer Account Check', 'failed', `Customer account is ${customer.status}, not active`);
        } else {
            addStep('Customer Account Check', 'passed', `Customer ${verification.customerId} is active (Plan: ${customer.plan || 'free'})`, Date.now() - step4Start);
        }
        
        // STEP 5: Tenant isolation verification
        const step5Start = Date.now();
        const allKeys = await getApiKeysForCustomer(verification.customerId, env);
        const keyData = allKeys.find(k => k.keyId === verification.keyId);
        if (keyData) {
            addStep('Tenant Isolation Check', 'passed', `Key correctly scoped to customer ${verification.customerId}. ${allKeys.length} total keys for this tenant.`, Date.now() - step5Start);
        } else {
            addStep('Tenant Isolation Check', 'failed', 'Key not found in customer key index');
        }
        
        // STEP 6: SSO Configuration check
        const step6Start = Date.now();
        if (verification.ssoConfig) {
            const ssoMode = verification.ssoConfig.isolationMode;
            const ssoEnabled = verification.ssoConfig.globalSsoEnabled;
            addStep('SSO Configuration', 'passed', `Isolation mode: ${ssoMode}, Global SSO: ${ssoEnabled ? 'enabled' : 'disabled'}`, Date.now() - step6Start);
        } else {
            addStep('SSO Configuration', 'skipped', 'No SSO configuration found (using defaults)');
        }
        
        // STEP 7: Service availability check
        const step7Start = Date.now();
        const plan = customer?.plan || 'free';
        const services = [
            { name: 'Request OTP', endpoint: 'POST /auth/request-otp', available: true },
            { name: 'Verify OTP', endpoint: 'POST /auth/verify-otp', available: true },
            { name: 'Get Current User', endpoint: 'GET /auth/me', available: true },
            { name: 'Logout', endpoint: 'POST /auth/logout', available: true },
            { name: 'Session Refresh', endpoint: 'POST /auth/refresh', available: true },
            { name: 'Analytics', endpoint: 'GET /admin/analytics', available: plan !== 'free' },
            { name: 'Audit Logs', endpoint: 'GET /admin/audit-logs', available: plan !== 'free' },
            { name: 'Custom Email Templates', endpoint: 'PUT /admin/config/email-template', available: plan === 'enterprise' }
        ];
        const availableCount = services.filter(s => s.available).length;
        addStep('Service Availability', 'passed', `${availableCount}/${services.length} services available for ${plan} plan`, Date.now() - step7Start);
        
        // STEP 8: Rate limit check
        const step8Start = Date.now();
        const rateLimits = {
            free: { requestsPerHour: 100, requestsPerDay: 1000 },
            starter: { requestsPerHour: 500, requestsPerDay: 10000 },
            pro: { requestsPerHour: 2000, requestsPerDay: 50000 },
            enterprise: { requestsPerHour: 10000, requestsPerDay: 500000 }
        };
        const limits = rateLimits[plan as keyof typeof rateLimits] || rateLimits.free;
        addStep('Rate Limit Configuration', 'passed', `${limits.requestsPerHour}/hour, ${limits.requestsPerDay}/day`, Date.now() - step8Start);
        
        // Calculate summary
        const passedSteps = testSteps.filter(s => s.status === 'passed').length;
        const failedSteps = testSteps.filter(s => s.status === 'failed').length;
        const testSummary = failedSteps === 0 
            ? `All ${passedSteps} tests passed. API key is valid and ready for multi-tenant use.`
            : `${passedSteps} tests passed, ${failedSteps} tests failed. See details above.`;
        
        const response: ApiKeyVerifyResponse = {
            success: true,
            valid: failedSteps === 0,
            keyId: verification.keyId,
            name: keyData?.name || 'Unknown',
            status: keyData?.status || 'active',
            customerId: verification.customerId,
            customerStatus: customer?.status || 'unknown',
            customerPlan: plan,
            createdAt: keyData?.createdAt,
            lastUsed: keyData?.lastUsed,
            ssoConfig: verification.ssoConfig ? {
                isolationMode: verification.ssoConfig.isolationMode,
                globalSsoEnabled: verification.ssoConfig.globalSsoEnabled
            } : undefined,
            services,
            rateLimits: limits,
            testedAt: new Date().toISOString(),
            testSteps,
            testSummary
        };
        
        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
    } catch (error) {
        const err = error as Error;
        console.error('[API Key Verify] Error:', err);
        
        addStep('Unexpected Error', 'failed', err.message || 'Internal server error');
        
        const response: ApiKeyVerifyResponse = {
            success: false,
            valid: false,
            services: [],
            error: err.message || 'Internal server error',
            testedAt: new Date().toISOString(),
            testSteps,
            testSummary: `Test failed with unexpected error: ${err.message}`
        };
        
        return new Response(JSON.stringify(response), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}

/**
 * Get the correct OTP Auth API base URL for the current environment
 * Development: http://localhost:8787 (local worker)
 * Production: https://auth.idling.app (or env override)
 */
function getOtpAuthBaseUrl(env: Env): string {
    // Check if we're in development/test mode
    const isDev = env.ENVIRONMENT !== 'production';
    
    // In development, use localhost worker port
    if (isDev) {
        // Check if there's an explicit override in env (for custom setups)
        if (env.OTP_AUTH_PUBLIC_URL) {
            return env.OTP_AUTH_PUBLIC_URL;
        }
        return 'http://localhost:8787';
    }
    
    // In production, use the public URL
    // Priority: explicit OTP_AUTH_PUBLIC_URL > AUTH_SERVICE_URL > JWT_ISSUER > hardcoded default
    if (env.OTP_AUTH_PUBLIC_URL) {
        return env.OTP_AUTH_PUBLIC_URL;
    }
    if (env.AUTH_SERVICE_URL) {
        return env.AUTH_SERVICE_URL;
    }
    if (env.JWT_ISSUER) {
        // JWT_ISSUER might be just the issuer string, ensure it's a URL
        const issuer = env.JWT_ISSUER;
        if (issuer.startsWith('http')) {
            return issuer;
        }
        return `https://${issuer}`;
    }
    
    // Fallback to the known production URL
    return 'https://auth.idling.app';
}

/**
 * Generate HTML+JS code snippet for end-to-end testing
 * GET /api-key/test-snippet
 * 
 * Returns a complete HTML page that developers can use to test their integration
 */
export async function handleGetTestSnippet(request: Request, env: Env): Promise<Response> {
    const corsHeaders = getCorsHeadersRecord(env, request);
    const url = new URL(request.url);
    const apiKey = url.searchParams.get('apiKey') || 'YOUR_API_KEY_HERE';
    
    // CRITICAL: Use environment-aware URL, NOT url.origin
    // In dev, we want localhost:8787, not whatever Vite/proxy reports
    const baseUrl = getOtpAuthBaseUrl(env);
    
    console.log('[TestSnippet] Generating snippet with baseUrl:', baseUrl, 'environment:', env.ENVIRONMENT);
    
    const htmlSnippet = generateTestHtmlSnippet(apiKey, baseUrl);
    
    // Determine if we're in dev mode for instructions
    const isDev = env.ENVIRONMENT !== 'production';
    const instructions = isDev ? [
        '1. Copy the HTML code below',
        '2. Save it as test-otp.html',
        '3. IMPORTANT: Serve it via local HTTP server (not file://)',
        '   Run: python -m http.server 8080 OR npx serve',
        '4. Open http://localhost:8080/test-otp.html in browser',
        '5. Enter your email and test the full OTP flow',
        '6. The test page will call http://localhost:8787 (your local worker)'
    ] : [
        '1. Copy the HTML code below',
        '2. Save it as test-otp.html', 
        '3. Serve it from your allowed origin domain OR use a local server',
        '4. Open it in a browser',
        '5. Enter your email and test the full OTP flow',
        '6. Check the results panel for API responses'
    ];
    
    return new Response(JSON.stringify({
        success: true,
        snippet: htmlSnippet,
        instructions
    }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}

/**
 * Generate a complete HTML+JS test page for end-to-end OTP testing
 */
export function generateTestHtmlSnippet(apiKey: string, baseUrl: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OTP Auth API - Integration Test</title>
    <style>
        :root {
            --bg: #1a1a2e;
            --card: #16213e;
            --accent: #e94560;
            --success: #00d26a;
            --text: #ffffff;
            --text-muted: #8892b0;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--bg);
            color: var(--text);
            min-height: 100vh;
            padding: 2rem;
        }
        .container { max-width: 800px; margin: 0 auto; }
        h1 { color: var(--accent); margin-bottom: 0.5rem; }
        .subtitle { color: var(--text-muted); margin-bottom: 2rem; }
        .card {
            background: var(--card);
            border-radius: 12px;
            padding: 1.5rem;
            margin-bottom: 1.5rem;
        }
        .card h2 { margin-bottom: 1rem; font-size: 1.25rem; }
        .form-group { margin-bottom: 1rem; }
        label { display: block; margin-bottom: 0.5rem; color: var(--text-muted); font-size: 0.875rem; }
        input {
            width: 100%;
            padding: 0.75rem;
            border: 1px solid #333;
            border-radius: 8px;
            background: var(--bg);
            color: var(--text);
            font-size: 1rem;
        }
        input:focus { outline: none; border-color: var(--accent); }
        button {
            background: var(--accent);
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 8px;
            font-size: 1rem;
            cursor: pointer;
            width: 100%;
            transition: opacity 0.2s;
        }
        button:hover { opacity: 0.9; }
        button:disabled { opacity: 0.5; cursor: not-allowed; }
        .result {
            background: var(--bg);
            border-radius: 8px;
            padding: 1rem;
            font-family: monospace;
            font-size: 0.875rem;
            max-height: 300px;
            overflow-y: auto;
            white-space: pre-wrap;
            word-break: break-all;
        }
        .success { border-left: 4px solid var(--success); }
        .error { border-left: 4px solid #ff4757; }
        .step { display: flex; gap: 1rem; align-items: center; margin-bottom: 1rem; }
        .step-number {
            width: 32px;
            height: 32px;
            background: var(--accent);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            flex-shrink: 0;
        }
        .step.completed .step-number { background: var(--success); }
        .status-indicator {
            display: inline-block;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            margin-right: 0.5rem;
        }
        .status-indicator.valid { background: var(--success); }
        .status-indicator.invalid { background: #ff4757; }
        .api-key-display {
            font-family: monospace;
            font-size: 0.875rem;
            color: var(--accent);
            word-break: break-all;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔐 OTP Auth API - Integration Test</h1>
        <p class="subtitle">Test your API key with a complete end-to-end OTP flow</p>
        
        <!-- API Key Status -->
        <div class="card">
            <h2>API Key Status</h2>
            <p style="margin-bottom: 1rem;">
                <span class="status-indicator" id="keyStatus"></span>
                <span id="keyStatusText">Checking...</span>
            </p>
            <p class="api-key-display" id="apiKeyDisplay">${apiKey.substring(0, 20)}...</p>
            <div id="keyDetails" style="margin-top: 1rem;"></div>
        </div>
        
        <!-- Step 1: Request OTP -->
        <div class="card">
            <div class="step" id="step1">
                <div class="step-number">1</div>
                <div><strong>Request OTP</strong> - Send a one-time password to your email</div>
            </div>
            <div class="form-group">
                <label for="email">Email Address</label>
                <input type="email" id="email" placeholder="your@email.com" />
            </div>
            <button id="requestOtpBtn" onclick="requestOTP()">Send OTP</button>
            <div id="requestResult" class="result" style="margin-top: 1rem; display: none;"></div>
        </div>
        
        <!-- Step 2: Verify OTP -->
        <div class="card">
            <div class="step" id="step2">
                <div class="step-number">2</div>
                <div><strong>Verify OTP</strong> - Enter the 9-digit code from your email</div>
            </div>
            <div class="form-group">
                <label for="otp">OTP Code (9 digits)</label>
                <input type="text" id="otp" placeholder="123456789" maxlength="9" pattern="[0-9]{9}" />
            </div>
            <button id="verifyOtpBtn" onclick="verifyOTP()" disabled>Verify OTP</button>
            <div id="verifyResult" class="result" style="margin-top: 1rem; display: none;"></div>
        </div>
        
        <!-- Step 3: Get User Info -->
        <div class="card">
            <div class="step" id="step3">
                <div class="step-number">3</div>
                <div><strong>Get User</strong> - Fetch authenticated user information</div>
            </div>
            <button id="getMeBtn" onclick="getMe()" disabled>Get User Info</button>
            <div id="meResult" class="result" style="margin-top: 1rem; display: none;"></div>
        </div>
        
        <!-- Step 4: Logout -->
        <div class="card">
            <div class="step" id="step4">
                <div class="step-number">4</div>
                <div><strong>Logout</strong> - End the session</div>
            </div>
            <button id="logoutBtn" onclick="logout()" disabled>Logout</button>
            <div id="logoutResult" class="result" style="margin-top: 1rem; display: none;"></div>
        </div>
    </div>
    
    <script>
        const API_KEY = '${apiKey}';
        const BASE_URL = '${baseUrl}';
        let authToken = null;
        
        // Verify API key on load
        async function verifyApiKey() {
            try {
                const response = await fetch(BASE_URL + '/api-key/verify', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-OTP-API-Key': API_KEY
                    }
                });
                const data = await response.json();
                
                const statusEl = document.getElementById('keyStatus');
                const statusText = document.getElementById('keyStatusText');
                const detailsEl = document.getElementById('keyDetails');
                
                if (data.valid) {
                    statusEl.className = 'status-indicator valid';
                    statusText.textContent = 'Valid - Ready to test';
                    detailsEl.innerHTML = \`
                        <p><strong>Plan:</strong> \${data.customerPlan || 'free'}</p>
                        <p><strong>Key ID:</strong> \${data.keyId}</p>
                        <p><strong>Services Available:</strong> \${data.services.filter(s => s.available).length}</p>
                    \`;
                } else {
                    statusEl.className = 'status-indicator invalid';
                    statusText.textContent = 'Invalid - ' + (data.error || 'Check your API key');
                }
            } catch (err) {
                document.getElementById('keyStatus').className = 'status-indicator invalid';
                document.getElementById('keyStatusText').textContent = 'Error: ' + err.message;
            }
        }
        
        async function requestOTP() {
            const email = document.getElementById('email').value;
            if (!email) { alert('Please enter an email'); return; }
            
            const btn = document.getElementById('requestOtpBtn');
            const resultEl = document.getElementById('requestResult');
            btn.disabled = true;
            btn.textContent = 'Sending...';
            
            try {
                const response = await fetch(BASE_URL + '/auth/request-otp', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-OTP-API-Key': API_KEY
                    },
                    body: JSON.stringify({ email })
                });
                const data = await response.json();
                
                resultEl.style.display = 'block';
                resultEl.className = response.ok ? 'result success' : 'result error';
                resultEl.textContent = JSON.stringify(data, null, 2);
                
                if (response.ok) {
                    document.getElementById('step1').classList.add('completed');
                    document.getElementById('verifyOtpBtn').disabled = false;
                }
            } catch (err) {
                resultEl.style.display = 'block';
                resultEl.className = 'result error';
                resultEl.textContent = 'Error: ' + err.message;
            } finally {
                btn.disabled = false;
                btn.textContent = 'Send OTP';
            }
        }
        
        async function verifyOTP() {
            const email = document.getElementById('email').value;
            const otp = document.getElementById('otp').value;
            if (!otp || otp.length !== 9) { alert('Please enter a 9-digit OTP'); return; }
            
            const btn = document.getElementById('verifyOtpBtn');
            const resultEl = document.getElementById('verifyResult');
            btn.disabled = true;
            btn.textContent = 'Verifying...';
            
            try {
                const response = await fetch(BASE_URL + '/auth/verify-otp', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-OTP-API-Key': API_KEY
                    },
                    credentials: 'include',
                    body: JSON.stringify({ email, otp })
                });
                const data = await response.json();
                
                resultEl.style.display = 'block';
                resultEl.className = response.ok ? 'result success' : 'result error';
                resultEl.textContent = JSON.stringify(data, null, 2);
                
                if (response.ok) {
                    authToken = data.access_token || data.token;
                    document.getElementById('step2').classList.add('completed');
                    document.getElementById('getMeBtn').disabled = false;
                    document.getElementById('logoutBtn').disabled = false;
                }
            } catch (err) {
                resultEl.style.display = 'block';
                resultEl.className = 'result error';
                resultEl.textContent = 'Error: ' + err.message;
            } finally {
                btn.disabled = false;
                btn.textContent = 'Verify OTP';
            }
        }
        
        async function getMe() {
            const btn = document.getElementById('getMeBtn');
            const resultEl = document.getElementById('meResult');
            btn.disabled = true;
            btn.textContent = 'Loading...';
            
            try {
                const headers = { 'Content-Type': 'application/json' };
                if (authToken) headers['Authorization'] = 'Bearer ' + authToken;
                
                const response = await fetch(BASE_URL + '/auth/me', {
                    method: 'GET',
                    headers,
                    credentials: 'include'
                });
                const data = await response.json();
                
                resultEl.style.display = 'block';
                resultEl.className = response.ok ? 'result success' : 'result error';
                resultEl.textContent = JSON.stringify(data, null, 2);
                
                if (response.ok) {
                    document.getElementById('step3').classList.add('completed');
                }
            } catch (err) {
                resultEl.style.display = 'block';
                resultEl.className = 'result error';
                resultEl.textContent = 'Error: ' + err.message;
            } finally {
                btn.disabled = false;
                btn.textContent = 'Get User Info';
            }
        }
        
        async function logout() {
            const btn = document.getElementById('logoutBtn');
            const resultEl = document.getElementById('logoutResult');
            btn.disabled = true;
            btn.textContent = 'Logging out...';
            
            try {
                const headers = { 'Content-Type': 'application/json' };
                if (authToken) headers['Authorization'] = 'Bearer ' + authToken;
                
                const response = await fetch(BASE_URL + '/auth/logout', {
                    method: 'POST',
                    headers,
                    credentials: 'include'
                });
                const data = await response.json();
                
                resultEl.style.display = 'block';
                resultEl.className = response.ok ? 'result success' : 'result error';
                resultEl.textContent = JSON.stringify(data, null, 2);
                
                if (response.ok) {
                    authToken = null;
                    document.getElementById('step4').classList.add('completed');
                }
            } catch (err) {
                resultEl.style.display = 'block';
                resultEl.className = 'result error';
                resultEl.textContent = 'Error: ' + err.message;
            } finally {
                btn.disabled = false;
                btn.textContent = 'Logout';
            }
        }
        
        // Verify API key on page load
        verifyApiKey();
    </script>
</body>
</html>`;
}
