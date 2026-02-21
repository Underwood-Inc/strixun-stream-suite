/**
 * Suite API Router
 *
 * Main Stream Suite backend: cloud storage, notes, OBS credentials, scrollbar CDN, legacy auth.
 */

import { handleCloudDelete, handleCloudList, handleCloudLoad, handleCloudSave } from './handlers/cloud-storage.js';
import { handleNotesDelete, handleNotesList, handleNotesLoad, handleNotesSave } from './handlers/notes.js';
import { handleOBSCredentialsDelete, handleOBSCredentialsLoad, handleOBSCredentialsSave } from './handlers/obs.js';
import { handleScrollbar, handleScrollbarCompensation, handleScrollbarCustomizer } from './handlers/scrollbar.js';
import { handleRequestOTP, handleVerifyOTP, handleGetMe, handleLogout, handleRefresh } from './handlers/auth.js';
import { handleTestEmail, handleClearRateLimit } from './handlers/test.js';
import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from './utils/errors.js';
import { authenticateRequest } from './utils/auth.js';
import { wrapWithEncryption } from '@strixun/api-framework';

/**
 * Health check endpoint
 * CRITICAL: JWT encryption is MANDATORY for all endpoints, including /health
 */
async function handleHealth(env, request) {
    // CRITICAL: Check HttpOnly cookie FIRST, then Authorization header
    let jwtToken = null;
    const cookieHeader = request.headers.get('Cookie');
    if (cookieHeader) {
        const cookies = cookieHeader.split(';').map(c => c.trim());
        const authCookie = cookies.find(c => c.startsWith('auth_token='));
        if (authCookie) {
            jwtToken = authCookie.substring('auth_token='.length).trim();
        }
    }
    
    // Fallback to Authorization header if no cookie
    if (!jwtToken) {
        const authHeader = request.headers.get('Authorization');
        jwtToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    }

    // Create health check response with CORS headers
    const healthData = { 
        status: 'ok', 
        message: 'Suite API worker is running',
        features: ['cloud-storage', 'scrollbar-customizer', 'notes', 'obs-credentials'],
        timestamp: new Date().toISOString()
    };
    
    const corsHeaders = createCORSHeaders(request, {
        credentials: true,
        allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
    });
    
    const response = new Response(JSON.stringify(healthData), {
        headers: {
            'Content-Type': 'application/json',
            ...Object.fromEntries(corsHeaders.entries()),
        },
    });

    // CRITICAL: Detect if request is using HttpOnly cookie (browser request)
    const isHttpOnlyCookie = !!(cookieHeader && cookieHeader.includes('auth_token='));
    const authForEncryption = isHttpOnlyCookie ? null : (jwtToken ? { userId: 'anonymous', customerId: null, jwtToken } : null);

    const encryptedResult = await wrapWithEncryption(response, authForEncryption, request, env, {
        requireJWT: authForEncryption ? true : false
    });
    return encryptedResult.response;
}

/**
 * Main router function
 */
export async function route(request, env) {
    const url = new URL(request.url);
    // Dev-proxy normalization: allow apps to call through /suite-api/* without 404s
    let path = url.pathname;
    if (path.startsWith('/suite-api/')) {
        path = path.substring('/suite-api'.length);
    }

    try {
        // Cloud Storage endpoints
        if (path === '/cloud-save/save' && request.method === 'POST') return handleCloudSave(request, env, authenticateRequest);
        if (path === '/cloud-save/load' && request.method === 'GET') return handleCloudLoad(request, env, authenticateRequest);
        if (path === '/cloud-save/list' && request.method === 'GET') return handleCloudList(request, env, authenticateRequest);
        if (path === '/cloud-save/delete' && request.method === 'DELETE') return handleCloudDelete(request, env, authenticateRequest);
        
        if (path === '/cloud/save' && request.method === 'POST') return handleCloudSave(request, env, authenticateRequest);
        if (path === '/cloud/load' && request.method === 'GET') return handleCloudLoad(request, env, authenticateRequest);
        if (path === '/cloud/list' && request.method === 'GET') return handleCloudList(request, env, authenticateRequest);
        if (path === '/cloud/delete' && request.method === 'DELETE') return handleCloudDelete(request, env, authenticateRequest);
        
        // CDN endpoints
        if (path === '/cdn/scrollbar.js' && request.method === 'GET') return handleScrollbar(request, env);
        if (path === '/cdn/scrollbar-customizer.js' && request.method === 'GET') return handleScrollbarCustomizer(request, env);
        if (path === '/cdn/scrollbar-compensation.js' && request.method === 'GET') return handleScrollbarCompensation(request, env);
        
        // Authentication endpoints (legacy - new auth should use OTP Auth Service)
        if (path === '/auth/request-otp' && request.method === 'POST') {
            const response = await handleRequestOTP(request, env);
            let jwtToken = null;
            const cookieHeader = request.headers.get('Cookie');
            if (cookieHeader) {
                const cookies = cookieHeader.split(';').map(c => c.trim());
                const authCookie = cookies.find(c => c.startsWith('auth_token='));
                if (authCookie) jwtToken = authCookie.substring('auth_token='.length).trim();
            }
            if (!jwtToken) {
                const authHeader = request.headers.get('Authorization');
                jwtToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
            }
            const isHttpOnlyCookie = !!(cookieHeader && cookieHeader.includes('auth_token='));
            const authForEncryption = isHttpOnlyCookie ? null : (jwtToken ? { userId: 'anonymous', customerId: null, jwtToken } : null);
            return await wrapWithEncryption(response, authForEncryption, request, env, { requireJWT: false });
        }
        if (path === '/auth/verify-otp' && request.method === 'POST') {
            const response = await handleVerifyOTP(request, env);
            let jwtToken = null;
            const cookieHeader = request.headers.get('Cookie');
            if (cookieHeader) {
                const cookies = cookieHeader.split(';').map(c => c.trim());
                const authCookie = cookies.find(c => c.startsWith('auth_token='));
                if (authCookie) jwtToken = authCookie.substring('auth_token='.length).trim();
            }
            if (!jwtToken) {
                const authHeader = request.headers.get('Authorization');
                jwtToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
            }
            const isHttpOnlyCookie = !!(cookieHeader && cookieHeader.includes('auth_token='));
            const authForEncryption = isHttpOnlyCookie ? null : (jwtToken ? { userId: 'anonymous', customerId: null, jwtToken } : null);
            return await wrapWithEncryption(response, authForEncryption, request, env, { requireJWT: false });
        }
        if (path === '/auth/me' && request.method === 'GET') {
            const response = await handleGetMe(request, env);
            let jwtToken = null;
            const cookieHeader = request.headers.get('Cookie');
            if (cookieHeader) {
                const cookies = cookieHeader.split(';').map(c => c.trim());
                const authCookie = cookies.find(c => c.startsWith('auth_token='));
                if (authCookie) jwtToken = authCookie.substring('auth_token='.length).trim();
            }
            if (!jwtToken) {
                const authHeader = request.headers.get('Authorization');
                jwtToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
            }
            const isHttpOnlyCookie = !!(cookieHeader && cookieHeader.includes('auth_token='));
            const authForEncryption = isHttpOnlyCookie ? null : (jwtToken ? { userId: 'anonymous', customerId: null, jwtToken } : null);
            return await wrapWithEncryption(response, authForEncryption, request, env, {
                requireJWT: authForEncryption ? true : false
            });
        }
        if (path === '/auth/logout' && request.method === 'POST') {
            const response = await handleLogout(request, env);
            let jwtToken = null;
            const cookieHeader = request.headers.get('Cookie');
            if (cookieHeader) {
                const cookies = cookieHeader.split(';').map(c => c.trim());
                const authCookie = cookies.find(c => c.startsWith('auth_token='));
                if (authCookie) jwtToken = authCookie.substring('auth_token='.length).trim();
            }
            if (!jwtToken) {
                const authHeader = request.headers.get('Authorization');
                jwtToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
            }
            const isHttpOnlyCookie = !!(cookieHeader && cookieHeader.includes('auth_token='));
            const authForEncryption = isHttpOnlyCookie ? null : (jwtToken ? { userId: 'anonymous', customerId: null, jwtToken } : null);
            return await wrapWithEncryption(response, authForEncryption, request, env, {
                requireJWT: authForEncryption ? true : false
            });
        }
        if (path === '/auth/refresh' && request.method === 'POST') {
            const response = await handleRefresh(request, env);
            let jwtToken = null;
            const cookieHeader = request.headers.get('Cookie');
            if (cookieHeader) {
                const cookies = cookieHeader.split(';').map(c => c.trim());
                const authCookie = cookies.find(c => c.startsWith('auth_token='));
                if (authCookie) jwtToken = authCookie.substring('auth_token='.length).trim();
            }
            if (!jwtToken) {
                const authHeader = request.headers.get('Authorization');
                jwtToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
            }
            const isHttpOnlyCookie = !!(cookieHeader && cookieHeader.includes('auth_token='));
            const authForEncryption = isHttpOnlyCookie ? null : (jwtToken ? { userId: 'anonymous', customerId: null, jwtToken } : null);
            return await wrapWithEncryption(response, authForEncryption, request, env, { requireJWT: false });
        }
        
        // Notes/Notebook endpoints
        if (path === '/notes/save' && request.method === 'POST') return handleNotesSave(request, env, authenticateRequest);
        if (path === '/notes/load' && request.method === 'GET') return handleNotesLoad(request, env, authenticateRequest);
        if (path === '/notes/list' && request.method === 'GET') return handleNotesList(request, env, authenticateRequest);
        if (path === '/notes/delete' && request.method === 'DELETE') return handleNotesDelete(request, env, authenticateRequest);
        
        // OBS Credentials endpoints
        if (path === '/obs-credentials/save' && request.method === 'POST') return handleOBSCredentialsSave(request, env, authenticateRequest);
        if (path === '/obs-credentials/load' && request.method === 'GET') return handleOBSCredentialsLoad(request, env, authenticateRequest);
        if (path === '/obs-credentials/delete' && request.method === 'DELETE') return handleOBSCredentialsDelete(request, env, authenticateRequest);
        
        if (path === '/test/email' && request.method === 'GET') return handleTestEmail(request, env);
        if (path === '/debug/clear-rate-limit' && request.method === 'POST') return handleClearRateLimit(request, env);
        if (path === '/health' || path === '/') return handleHealth(env, request);
        
        const rfcError404 = createError(request, 404, 'Not Found', 'The requested endpoint was not found');
        const corsHeaders404 = createCORSHeaders(request, {
            credentials: true,
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        return new Response(JSON.stringify(rfcError404), {
            status: 404,
            headers: {
                'Content-Type': 'application/problem+json',
                ...Object.fromEntries(corsHeaders404.entries()),
            },
        });
    } catch (error) {
        if (error.message && error.message.includes('JWT_SECRET')) {
            const rfcError = createError(
                request,
                500,
                'Server Configuration Error',
                'JWT_SECRET environment variable is required. Please contact the administrator.'
            );
            const corsHeaders = createCORSHeaders(request, {
                credentials: true,
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
            });
            return new Response(JSON.stringify(rfcError), {
                status: 500,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }
        
        const rfcError = createError(
            request,
            500,
            'Internal Server Error',
            error.message || 'An internal server error occurred'
        );
        const corsHeaders = createCORSHeaders(request, {
            credentials: true,
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        return new Response(JSON.stringify(rfcError), {
            status: 500,
            headers: {
                'Content-Type': 'application/problem+json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    }
}
