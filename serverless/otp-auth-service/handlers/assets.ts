/**
 * Asset Serving Handlers
 * Handles serving landing page and dashboard assets
 */

import { getCorsHeaders } from '../utils/cors.js';

interface Env {
    ENVIRONMENT?: string;
    [key: string]: any;
}

/**
 * Asset map type - file paths to file contents (string or data URI)
 */
type AssetMap = Record<string, string> | null;

// Dashboard and landing page assets - loaded lazily to avoid Wrangler bundling issues
let dashboardAssets: AssetMap = null;
let dashboardAssetsLoaded = false;
let landingPageAssets: AssetMap = null;
let landingPageAssetsLoaded = false;

/**
 * Lazy load dashboard assets (only when needed, not at top level)
 */
export async function loadDashboardAssets(): Promise<AssetMap> {
    if (dashboardAssetsLoaded) return dashboardAssets;
    dashboardAssetsLoaded = true;
    try {
        const dashboardModule = await import('../dashboard-assets.js');
        dashboardAssets = dashboardModule.default as AssetMap;
    } catch (e) {
        // Dashboard not built yet - will proxy to dev server in dev mode
        dashboardAssets = null;
    }
    return dashboardAssets;
}

/**
 * Lazy load landing page assets (only when needed, not at top level)
 */
export async function loadLandingPageAssets(): Promise<AssetMap> {
    if (landingPageAssetsLoaded) return landingPageAssets;
    landingPageAssetsLoaded = true;
    try {
        const landingPageModule = await import('../landing-page-assets.js');
        landingPageAssets = landingPageModule.default as AssetMap;
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
export async function handleLandingPage(request: Request, env: Env): Promise<Response> {
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
            const errorMessage = error instanceof Error ? error.message : String(error);
            return new Response(`Landing page dev server not running. Start with: pnpm dev:landing\n\nError: ${errorMessage}`, {
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
    
    // Check if this is an asset request (has file extension and is not index.html)
    const isAssetRequest = filePath.includes('.') && filePath !== 'index.html';
    
    // SPA routing - all non-file routes serve index.html
    // BUT: if it's an asset request, don't fallback to index.html
    if (!assets[filePath] && !isAssetRequest) {
        filePath = 'index.html';
    }
    
    const file = assets[filePath];
    if (!file) {
        // If it's an asset request that's not found, return 404 immediately
        // Don't fallback to index.html for asset requests
        if (isAssetRequest) {
            return new Response('Asset not found: ' + filePath, { 
                status: 404,
                headers: { 'Content-Type': 'text/plain' }
            });
        }
        // Otherwise fallback to index.html for SPA routing (no file extension)
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
    let content: string | Uint8Array = file;
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
            content = Uint8Array.from(atob(base64Content), c => c.charCodeAt(0));
            return new Response(content, {
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
function serveDashboardFile(
    fileContent: string,
    filePath: string,
    env: Env,
    request: Request
): Response {
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
    let content: string | Uint8Array;
    if (typeof fileContent === 'string' && fileContent.startsWith('data:')) {
        // Base64 encoded binary file
        const base64Data = fileContent.split(',')[1];
        if (!base64Data) {
            throw new Error('Invalid data URI: missing base64 data');
        }
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
export async function handleDashboard(request: Request, env: Env): Promise<Response> {
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
            const body = await viteResponse.text();
            
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
                        <h1>[DEPLOY] Start Dev Server</h1>
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
    // For asset requests, handle both /dashboard/assets/... and /assets/... paths
    const url = new URL(request.url);
    let filePath = url.pathname;
    
    // Remove /dashboard prefix if present
    filePath = filePath.replace(/^\/dashboard\/?/, '');
    
    // If path is empty or just '/', serve index.html
    if (filePath === '' || filePath === '/') {
        filePath = 'index.html';
    }
    
    // Remove leading slash from asset paths (assets/main-xxx.js not /assets/main-xxx.js)
    if (filePath.startsWith('/')) {
        filePath = filePath.slice(1);
    }
    
    // Check if this is an asset request (has file extension and is not index.html)
    const isAssetRequest = filePath.includes('.') && filePath !== 'index.html';
    
    // Handle SPA routing - all non-file routes serve index.html
    // BUT: if it's an asset request, don't fallback to index.html
    if (!assets[filePath] && !isAssetRequest) {
        filePath = 'index.html';
    }
    
    // Get file content
    const fileContent = assets[filePath];
    if (!fileContent) {
        // If it's an asset request that's not found, return 404 immediately
        // Don't fallback to index.html for asset requests
        if (isAssetRequest) {
            return new Response('File not found: ' + filePath, {
                status: 404,
                headers: getCorsHeaders(env, request),
            });
        }
        // Only fallback to index.html for SPA routes (no file extension)
        if (filePath !== 'index.html' && assets['index.html']) {
            filePath = 'index.html';
            const indexContent = assets[filePath];
            if (!indexContent) {
                return new Response('Dashboard index.html not found', {
                    status: 404,
                    headers: getCorsHeaders(env, request),
                });
            }
            return serveDashboardFile(indexContent, filePath, env, request);
        }
        return new Response('File not found', {
            status: 404,
            headers: getCorsHeaders(env, request),
        });
    }
    
    return serveDashboardFile(fileContent, filePath, env, request);
}

