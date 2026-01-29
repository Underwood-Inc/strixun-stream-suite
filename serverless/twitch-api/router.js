/**
 * Twitch API Router
 * 
 * Routes requests to appropriate handlers for Twitch API worker
 */

import { handleCloudDelete, handleCloudList, handleCloudLoad, handleCloudSave } from './handlers/cloud-storage.js';
import { handleNotesDelete, handleNotesList, handleNotesLoad, handleNotesSave } from './handlers/notes.js';
import { handleOBSCredentialsDelete, handleOBSCredentialsLoad, handleOBSCredentialsSave } from './handlers/obs.js';
import { handleScrollbar, handleScrollbarCompensation, handleScrollbarCustomizer } from './handlers/scrollbar.js';
import { getAppAccessToken, handleClips, handleFollowing, handleGame, handleUser } from './handlers/twitch.js';
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
        message: 'Twitch API worker is running',
        features: ['twitch-api', 'cloud-storage', 'scrollbar-customizer'],
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
    // If yes, we must disable response encryption because JavaScript can't access HttpOnly cookies to decrypt
    const isHttpOnlyCookie = !!(cookieHeader && cookieHeader.includes('auth_token='));
    
    // For HttpOnly cookie requests, pass null to disable encryption
    // For Authorization header requests (service-to-service), pass auth object to enable encryption
    const authForEncryption = isHttpOnlyCookie ? null : (jwtToken ? { userId: 'anonymous', customerId: null, jwtToken } : null);

    // Wrap with encryption - disable for HttpOnly cookies
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
    // Dev-proxy normalization: allow apps to call through /twitch-api/* without 404s
    let path = url.pathname;
    if (path.startsWith('/twitch-api/')) {
        path = path.substring('/twitch-api'.length);
    }

    try {
        // Twitch API endpoints
        if (path === '/clips') return handleClips(request, env);
        if (path === '/following') return handleFollowing(request, env);
        if (path === '/game') return handleGame(request, env);
        if (path === '/user') return handleUser(request, env);
        
        // Cloud Storage endpoints
        // Authenticated cloud save endpoints (replaces device-based /cloud/*)
        if (path === '/cloud-save/save' && request.method === 'POST') return handleCloudSave(request, env, authenticateRequest);
        if (path === '/cloud-save/load' && request.method === 'GET') return handleCloudLoad(request, env, authenticateRequest);
        if (path === '/cloud-save/list' && request.method === 'GET') return handleCloudList(request, env, authenticateRequest);
        if (path === '/cloud-save/delete' && request.method === 'DELETE') return handleCloudDelete(request, env, authenticateRequest);
        
        // Legacy device-based endpoints (kept for backward compatibility)
        if (path === '/cloud/save' && request.method === 'POST') return handleCloudSave(request, env, authenticateRequest);
        if (path === '/cloud/load' && request.method === 'GET') return handleCloudLoad(request, env, authenticateRequest);
        if (path === '/cloud/list' && request.method === 'GET') return handleCloudList(request, env, authenticateRequest);
        if (path === '/cloud/delete' && request.method === 'DELETE') return handleCloudDelete(request, env, authenticateRequest);
        
        // CDN endpoints
        if (path === '/cdn/scrollbar.js' && request.method === 'GET') return handleScrollbar(request, env);
        if (path === '/cdn/scrollbar-customizer.js' && request.method === 'GET') return handleScrollbarCustomizer(request, env);
        if (path === '/cdn/scrollbar-compensation.js' && request.method === 'GET') return handleScrollbarCompensation(request, env);
        
        // Authentication endpoints (legacy - new auth should use OTP Auth Service)
        // NOTE: These endpoints generate JWTs, so they can't require JWT to call them
        // However, responses should still be encrypted if JWT is provided
        if (path === '/auth/request-otp' && request.method === 'POST') {
            const response = await handleRequestOTP(request, env);
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
            if (!jwtToken) {
                const authHeader = request.headers.get('Authorization');
                jwtToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
            }
            const isHttpOnlyCookie = !!(cookieHeader && cookieHeader.includes('auth_token='));
            const authForEncryption = isHttpOnlyCookie ? null : (jwtToken ? { userId: 'anonymous', customerId: null, jwtToken } : null);
            // Use requireJWT: false for auth endpoints that generate JWTs (temporary - needs architectural review)
            return await wrapWithEncryption(response, authForEncryption, request, env, { requireJWT: false });
        }
        if (path === '/auth/verify-otp' && request.method === 'POST') {
            const response = await handleVerifyOTP(request, env);
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
            if (!jwtToken) {
                const authHeader = request.headers.get('Authorization');
                jwtToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
            }
            const isHttpOnlyCookie = !!(cookieHeader && cookieHeader.includes('auth_token='));
            const authForEncryption = isHttpOnlyCookie ? null : (jwtToken ? { userId: 'anonymous', customerId: null, jwtToken } : null);
            // Use requireJWT: false for auth endpoints that generate JWTs (temporary - needs architectural review)
            return await wrapWithEncryption(response, authForEncryption, request, env, { requireJWT: false });
        }
        if (path === '/auth/me' && request.method === 'GET') {
            const response = await handleGetMe(request, env);
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
            if (!jwtToken) {
                const authHeader = request.headers.get('Authorization');
                jwtToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
            }
            const isHttpOnlyCookie = !!(cookieHeader && cookieHeader.includes('auth_token='));
            const authForEncryption = isHttpOnlyCookie ? null : (jwtToken ? { userId: 'anonymous', customerId: null, jwtToken } : null);
            // Use requireJWT: false for auth endpoints that generate JWTs (temporary - needs architectural review)
            return await wrapWithEncryption(response, authForEncryption, request, env, { requireJWT: false });
        }
        
        // Notes/Notebook endpoints (require authentication)
        if (path === '/notes/save' && request.method === 'POST') return handleNotesSave(request, env, authenticateRequest);
        if (path === '/notes/load' && request.method === 'GET') return handleNotesLoad(request, env, authenticateRequest);
        if (path === '/notes/list' && request.method === 'GET') return handleNotesList(request, env, authenticateRequest);
        if (path === '/notes/delete' && request.method === 'DELETE') return handleNotesDelete(request, env, authenticateRequest);
        
        // OBS Credentials endpoints (require authentication, 7 hour expiration)
        if (path === '/obs-credentials/save' && request.method === 'POST') return handleOBSCredentialsSave(request, env, authenticateRequest);
        if (path === '/obs-credentials/load' && request.method === 'GET') return handleOBSCredentialsLoad(request, env, authenticateRequest);
        if (path === '/obs-credentials/delete' && request.method === 'DELETE') return handleOBSCredentialsDelete(request, env, authenticateRequest);
        
        // Test endpoints
        if (path === '/test/email' && request.method === 'GET') return handleTestEmail(request, env);
        
        // Debug endpoints
        if (path === '/debug/clear-rate-limit' && request.method === 'POST') return handleClearRateLimit(request, env);
        
        // Health check
        if (path === '/health' || path === '/') return handleHealth(env, request);
        
        // Not found
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
        // Check if it's a JWT secret error (configuration issue)
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

