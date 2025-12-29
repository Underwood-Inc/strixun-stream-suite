/**
 * Strixun Stream Suite - Serverless API Worker
 * Cloudflare Worker for Twitch API proxy + Cloud Storage
 * 
 * This worker handles:
 * - App Access Token management (cached)
 * - Clips fetching
 * - User following fetching
 * - Game data fetching
 * - Cloud Save System (backup/restore configs across devices)
 * - Notes/Notebook System
 * - OBS Credentials storage
 * - Scrollbar CDN assets
 * 
 * @version 3.0.0 - Refactored and modularized
 * 
 * NOTE: OTP Auth has been removed - use otp-auth-service instead
 */

import { getCorsHeaders } from './utils/cors.js';
import { authenticateRequest } from './utils/auth.js';
import { handleClips, handleFollowing, handleGame, handleUser, getAppAccessToken } from './handlers/twitch.js';
import { handleCloudSave, handleCloudLoad, handleCloudList, handleCloudDelete } from './handlers/cloud-storage.js';
import { handleNotesSave, handleNotesLoad, handleNotesList, handleNotesDelete } from './handlers/notes.js';
import { handleOBSCredentialsSave, handleOBSCredentialsLoad, handleOBSCredentialsDelete } from './handlers/obs.js';
import { createEnhancedRouter } from './shared/enhanced-router.js';
import { initializeServiceTypes } from '@strixun/types';

// Initialize service types for enhanced framework
initializeServiceTypes();

// TODO: Extract scrollbar handlers - large inline code strings (~750 lines)
// For now, scrollbar endpoints are handled inline in original worker
// Import scrollbar handlers when code is extracted to files
// import { handleScrollbar, handleScrollbarCustomizer, handleScrollbarCompensation } from './handlers/scrollbar.js';

/**
 * Health check endpoint
 */
async function handleHealth(env, request) {
    try {
        // Test token generation
        await getAppAccessToken(env);
        return new Response(JSON.stringify({ 
            status: 'ok', 
            message: 'Strixun Stream Suite API is running',
            features: ['twitch-api', 'cloud-storage', 'scrollbar-customizer'],
            timestamp: new Date().toISOString()
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            status: 'error', 
            message: error.message 
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Test email sending endpoint
 * GET /test/email?to=your@email.com
 */
async function handleTestEmail(request, env) {
    try {
        const url = new URL(request.url);
        const to = url.searchParams.get('to');
        
        if (!to) {
            return new Response(JSON.stringify({ error: 'to parameter required' }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Validate email format
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
            return new Response(JSON.stringify({ error: 'Invalid email format' }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Check if RESEND_API_KEY is configured
        if (!env.RESEND_API_KEY) {
            return new Response(JSON.stringify({ 
                error: 'RESEND_API_KEY not configured',
                message: 'Please add RESEND_API_KEY secret using: wrangler secret put RESEND_API_KEY'
            }), {
                status: 500,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Send test email via Resend
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${env.RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: env.RESEND_FROM_EMAIL || (() => { throw new Error('RESEND_FROM_EMAIL must be set'); })(),
                to: to,
                subject: 'Test Email from Strixun Stream Suite',
                html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="utf-8">
                        <style>
                            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                            .success { background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin: 20px 0; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <h1>✅ Test Email Successful!</h1>
                            <div class="success">
                                <p><strong>If you're reading this, Resend is working correctly!</strong></p>
                                <p>This is a test email from your Cloudflare Worker.</p>
                            </div>
                            <p>Your email integration is set up and ready to use for OTP authentication.</p>
                            <hr>
                            <p style="font-size: 12px; color: #666;">
                                Strixun Stream Suite - Email Test<br>
                                Sent from Cloudflare Worker
                            </p>
                        </div>
                    </body>
                    </html>
                `,
            }),
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch (e) {
                errorData = { message: errorText };
            }
            
            return new Response(JSON.stringify({ 
                error: 'Failed to send email',
                status: response.status,
                details: errorData
            }), {
                status: 500,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        const data = await response.json();
        
        return new Response(JSON.stringify({ 
            success: true,
            message: 'Test email sent successfully!',
            emailId: data.id,
            to: to,
            timestamp: new Date().toISOString()
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: 'Failed to send email',
            message: error.message,
            stack: error.stack
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Original request handler
 */
async function originalFetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: getCorsHeaders(env, request) });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
        // Twitch API endpoints
        if (path === '/clips') return handleClips(request, env);
        if (path === '/following') return handleFollowing(request, env);
        if (path === '/game') return handleGame(request, env);
        if (path === '/user') return handleUser(request, env);
        
        // Cloud Storage endpoints
        // Authenticated cloud save endpoints (replaces device-based /cloud/*)
        if (path === '/cloud-save/save' && request.method === 'POST') {
            return handleCloudSave(request, env, authenticateRequest);
        }
        if (path === '/cloud-save/load' && request.method === 'GET') {
            return handleCloudLoad(request, env, authenticateRequest);
        }
        if (path === '/cloud-save/list' && request.method === 'GET') {
            return handleCloudList(request, env, authenticateRequest);
        }
        if (path === '/cloud-save/delete' && request.method === 'DELETE') {
            return handleCloudDelete(request, env, authenticateRequest);
        }
        
        // Legacy device-based endpoints (kept for backward compatibility)
        if (path === '/cloud/save' && request.method === 'POST') {
            return handleCloudSave(request, env, authenticateRequest);
        }
        if (path === '/cloud/load' && request.method === 'GET') {
            return handleCloudLoad(request, env, authenticateRequest);
        }
        if (path === '/cloud/list' && request.method === 'GET') {
            return handleCloudList(request, env, authenticateRequest);
        }
        if (path === '/cloud/delete' && request.method === 'DELETE') {
            return handleCloudDelete(request, env, authenticateRequest);
        }
        
        // CDN endpoints
        // TODO: Extract scrollbar code to separate files and implement handlers
        // For now, these endpoints need to be handled by importing from original worker
        // or extracting the large inline code strings (~750 lines) to files first
        if (path === '/cdn/scrollbar.js' && request.method === 'GET') {
            return new Response(JSON.stringify({ 
                error: 'Scrollbar endpoint - needs code extraction from original worker.js',
                note: 'Large inline code strings need to be extracted to separate files first'
            }), {
                status: 501,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        if (path === '/cdn/scrollbar-customizer.js' && request.method === 'GET') {
            return new Response(JSON.stringify({ 
                error: 'Scrollbar customizer endpoint - needs code extraction',
                note: 'Large inline code strings need to be extracted to separate files first'
            }), {
                status: 501,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        if (path === '/cdn/scrollbar-compensation.js' && request.method === 'GET') {
            return new Response(JSON.stringify({ 
                error: 'Scrollbar compensation endpoint - needs code extraction',
                note: 'Large inline code strings need to be extracted to separate files first'
            }), {
                status: 501,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Notes/Notebook endpoints (require authentication)
        if (path === '/notes/save' && request.method === 'POST') {
            return handleNotesSave(request, env, authenticateRequest);
        }
        if (path === '/notes/load' && request.method === 'GET') {
            return handleNotesLoad(request, env, authenticateRequest);
        }
        if (path === '/notes/list' && request.method === 'GET') {
            return handleNotesList(request, env, authenticateRequest);
        }
        if (path === '/notes/delete' && request.method === 'DELETE') {
            return handleNotesDelete(request, env, authenticateRequest);
        }
        
        // OBS Credentials endpoints (require authentication, 7 hour expiration)
        if (path === '/obs-credentials/save' && request.method === 'POST') {
            return handleOBSCredentialsSave(request, env, authenticateRequest);
        }
        if (path === '/obs-credentials/load' && request.method === 'GET') {
            return handleOBSCredentialsLoad(request, env, authenticateRequest);
        }
        if (path === '/obs-credentials/delete' && request.method === 'DELETE') {
            return handleOBSCredentialsDelete(request, env, authenticateRequest);
        }
        
        // Test endpoints
        if (path === '/test/email' && request.method === 'GET') {
            return handleTestEmail(request, env);
        }
        
        // Health check
        if (path === '/health' || path === '/') {
            return handleHealth(env, request);
        }
        
        // Not found
        return new Response(JSON.stringify({ error: 'Not found' }), {
            status: 404,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        // Check if it's a JWT secret error (configuration issue)
        if (error.message && error.message.includes('JWT_SECRET')) {
            return new Response(JSON.stringify({ 
                error: 'Server configuration error',
                message: 'JWT_SECRET environment variable is required. Please contact the administrator.',
                details: 'The server is not properly configured. JWT_SECRET must be set via: wrangler secret put JWT_SECRET'
            }), {
                status: 500,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        return new Response(JSON.stringify({ error: 'Internal server error', message: error.message }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

// Create enhanced router
const enhancedFetch = createEnhancedRouter(originalFetch);

/**
 * Main request handler
 */
export default {
    async fetch(request, env, ctx) {
        return enhancedFetch(request, env, ctx);
    },
};

