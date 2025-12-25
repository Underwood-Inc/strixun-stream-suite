/**
 * Asset Serving Handlers
 * Handles serving landing page and dashboard assets
 */

import { getCorsHeaders } from '../utils/cors.js';

// Dashboard and landing page assets - loaded lazily to avoid Wrangler bundling issues
let dashboardAssets = null;
let dashboardAssetsLoaded = false;
let landingPageAssets = null;
let landingPageAssetsLoaded = false;

/**
 * Lazy load dashboard assets (only when needed, not at top level)
 */
export async function loadDashboardAssets() {
    if (dashboardAssetsLoaded) return dashboardAssets;
    dashboardAssetsLoaded = true;
    try {
        const dashboardModule = await import('../dashboard-assets.js');
        dashboardAssets = dashboardModule.default;
    } catch (e) {
        // Dashboard not built yet - will proxy to dev server in dev mode
        dashboardAssets = null;
    }
    return dashboardAssets;
}

/**
 * Lazy load landing page assets (only when needed, not at top level)
 */
export async function loadLandingPageAssets() {
    if (landingPageAssetsLoaded) return landingPageAssets;
    landingPageAssetsLoaded = true;
    try {
        const landingPageModule = await import('../landing-page-assets.js');
        landingPageAssets = landingPageModule.default;
    } catch (e) {
        // Landing page not built yet - will proxy to dev server in dev mode
        landingPageAssets = null;
    }
    return landingPageAssets;
}

/**
 * Handle landing page request
 * Serves the landing page SPA at root path
 */
export async function handleLandingPage(request, env) {
    // In local dev (wrangler dev), always try Vite first
    // ENVIRONMENT is not set by default in wrangler dev, so !env.ENVIRONMENT means local dev
    const isDev = env.ENVIRONMENT === 'development' || !env.ENVIRONMENT || env.ENVIRONMENT === 'local';
    
    // In dev mode, always try Vite first (don't even try to load built assets)
    if (isDev) {
        // Proxy to Vite dev server in development
        try {
            const viteUrl = new URL(request.url);
            viteUrl.hostname = 'localhost';
            viteUrl.port = '5175';
            viteUrl.protocol = 'http:';
            
            // Create a new request with the updated URL
            const proxiedRequest = new Request(viteUrl.toString(), {
                method: request.method,
                headers: request.headers,
                body: request.body,
            });
            
            return fetch(proxiedRequest);
        } catch (error) {
            return new Response(`Landing page dev server not running. Start with: pnpm dev:landing\n\nError: ${error.message}`, {
                status: 503,
                headers: { 'Content-Type': 'text/plain' },
            });
        }
    }
    
    // Production mode: load and serve built assets
    const assets = await loadLandingPageAssets();
    if (!assets) {
        return new Response('Landing page not built. Run: pnpm build', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' },
        });
    }
    
    const url = new URL(request.url);
    let filePath = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    
    // Remove leading slash if present (shouldn't be, but just in case)
    if (filePath.startsWith('/')) {
        filePath = filePath.slice(1);
    }
    
    // SPA routing - all non-file routes serve index.html
    if (!assets[filePath] && !filePath.includes('.')) {
        filePath = 'index.html';
    }
    
    const file = assets[filePath];
    if (!file) {
        // If it's an asset request that's not found, return 404
        if (filePath.includes('.')) {
            return new Response('Asset not found: ' + filePath, { 
                status: 404,
                headers: { 'Content-Type': 'text/plain' }
            });
        }
        // Otherwise fallback to index.html for SPA routing
        filePath = 'index.html';
        const indexFile = assets[filePath];
        if (!indexFile) {
            return new Response('Landing page index.html not found', { 
                status: 404,
                headers: { 'Content-Type': 'text/plain' }
            });
        }
        return new Response(indexFile, {
            headers: {
                'Content-Type': 'text/html',
                'Cache-Control': 'public, max-age=3600',
            },
        });
    }
    
    // Handle data URIs for binary files
    let content = file;
    let contentType = 'text/html';
    
    if (filePath.endsWith('.js')) {
        contentType = 'application/javascript';
    } else if (filePath.endsWith('.css')) {
        contentType = 'text/css';
    } else if (filePath.endsWith('.json')) {
        contentType = 'application/json';
    } else if (filePath.endsWith('.png')) {
        contentType = 'image/png';
    } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
        contentType = 'image/jpeg';
    } else if (filePath.endsWith('.svg')) {
        contentType = 'image/svg+xml';
    } else if (filePath.endsWith('.woff')) {
        contentType = 'font/woff';
    } else if (filePath.endsWith('.woff2')) {
        contentType = 'font/woff2';
    } else if (filePath.endsWith('.ico')) {
        contentType = 'image/x-icon';
    }
    
    // If it's a data URI, extract the base64 content
    if (typeof file === 'string' && file.startsWith('data:')) {
        const base64Match = file.match(/^data:[^;]+;base64,(.+)$/);
        if (base64Match) {
            const base64Content = base64Match[1];
            const binaryContent = Uint8Array.from(atob(base64Content), c => c.charCodeAt(0));
            return new Response(binaryContent, {
                headers: {
                    'Content-Type': contentType,
                    'Cache-Control': 'public, max-age=3600',
                },
            });
        }
    }
    
    return new Response(file, {
        headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=3600',
        },
    });
}

/**
 * Helper function to serve dashboard files
 */
function serveDashboardFile(fileContent, filePath, env, request) {
    // Determine content type
    let contentType = 'text/plain';
    if (filePath.endsWith('.html')) contentType = 'text/html; charset=utf-8';
    else if (filePath.endsWith('.js')) contentType = 'application/javascript; charset=utf-8';
    else if (filePath.endsWith('.css')) contentType = 'text/css; charset=utf-8';
    else if (filePath.endsWith('.json')) contentType = 'application/json';
    else if (filePath.endsWith('.png')) contentType = 'image/png';
    else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) contentType = 'image/jpeg';
    else if (filePath.endsWith('.svg')) contentType = 'image/svg+xml';
    else if (filePath.endsWith('.woff')) contentType = 'font/woff';
    else if (filePath.endsWith('.woff2')) contentType = 'font/woff2';
    else if (filePath.endsWith('.ico')) contentType = 'image/x-icon';
    
    // Handle base64 encoded files (binary) vs text files
    let content;
    if (typeof fileContent === 'string' && fileContent.startsWith('data:')) {
        // Base64 encoded binary file
        const base64Data = fileContent.split(',')[1];
        content = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    } else {
        // Text file
        content = fileContent;
    }
    
    return new Response(content, {
        headers: {
            'Content-Type': contentType,
            'Cache-Control': filePath === 'index.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
            ...getCorsHeaders(env, request),
        },
    });
}

/**
 * Handle dashboard request
 * Serves the dashboard SPA at /dashboard path
 */
export async function handleDashboard(request, env) {
    // In development, proxy to main Vite dev server (same as landing page)
    // In production, serve built files from main app
    const isDev = env.ENVIRONMENT === 'development' || !env.ENVIRONMENT || env.ENVIRONMENT === 'local';
    
    if (isDev) {
        // Proxy to main Vite dev server - dashboard is part of the main app now
        try {
            const url = new URL(request.url);
            const viteUrl = `http://localhost:5175${url.pathname}`;
            const viteRequest = new Request(viteUrl, {
                method: request.method,
                headers: request.headers,
                body: request.body,
            });
            
            const viteResponse = await fetch(viteRequest);
            
            // Clone response and update any absolute URLs in HTML to be relative
            const contentType = viteResponse.headers.get('content-type') || '';
            let body = await viteResponse.text();
            
            // If it's HTML, we might need to fix asset paths, but Vite handles this
            // For now, just proxy as-is since Vite dev server handles paths correctly
            
            return new Response(body, {
                status: viteResponse.status,
                statusText: viteResponse.statusText,
                headers: {
                    ...Object.fromEntries(viteResponse.headers),
                    ...getCorsHeaders(env, request),
                },
            });
        } catch (error) {
            // Vite server not running - show helpful message
            return new Response(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Dashboard - Dev Server Required</title>
                    <style>
                        body { font-family: system-ui; background: #1a1611; color: #f9f9f9; padding: 2rem; }
                        .container { max-width: 600px; margin: 0 auto; text-align: center; }
                        code { background: #252017; padding: 0.25rem 0.5rem; border-radius: 4px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>🚀 Start Dev Server</h1>
                        <p>To view the dashboard in development, start the Vite dev server:</p>
                        <pre style="background: #252017; padding: 1rem; border-radius: 8px; margin: 1rem 0; text-align: left;"><code>pnpm dev:all</code></pre>
                        <p>Or separately:</p>
                        <pre style="background: #252017; padding: 1rem; border-radius: 8px; margin: 1rem 0; text-align: left;"><code>cd dashboard
pnpm dev</code></pre>
                    </div>
                </body>
                </html>
            `, {
                headers: {
                    'Content-Type': 'text/html; charset=utf-8',
                    ...getCorsHeaders(env, request),
                },
            });
        }
    }
    
    // Production: serve dashboard assets from dashboard-assets.js
    // The dashboard handles routing client-side, so /dashboard serves index.html
    const assets = await loadDashboardAssets();
    if (!assets) {
        return new Response('Dashboard not built. Run: pnpm build', {
            status: 503,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'text/plain' },
        });
    }
    
    // For /dashboard routes, serve index.html (SPA routing handled client-side)
    // For asset requests, remove /dashboard prefix
    const url = new URL(request.url);
    let filePath = url.pathname.replace(/^\/dashboard\/?/, '') || 'index.html';
    if (filePath === '') filePath = 'index.html';
    
    // Handle SPA routing - all non-file routes serve index.html
    if (!assets[filePath] && !filePath.includes('.')) {
        filePath = 'index.html';
    }
    
    // Get file content
    const fileContent = assets[filePath];
    if (!fileContent) {
        // Fallback to index.html for SPA routing
        if (filePath !== 'index.html' && assets['index.html']) {
            filePath = 'index.html';
            return serveDashboardFile(assets[filePath], filePath, env, request);
        }
        return new Response('File not found', {
            status: 404,
            headers: getCorsHeaders(env, request),
        });
    }
    
    return serveDashboardFile(fileContent, filePath, env, request);
}

