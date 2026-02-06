/**
 * API Key Verification Handler
 * Allows developers to test and verify their API keys work correctly
 */

import { getCorsHeadersRecord } from '../../utils/cors.js';
import { verifyApiKey, getApiKeysForCustomer } from '../../services/api-key.js';
import { fetchCustomerByCustomerId } from '@strixun/api-framework';
import { generateTestHtmlSnippet } from '../../templates/test-snippet/index.js';

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
