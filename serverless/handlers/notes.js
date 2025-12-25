/**
 * Notes/Notebook Handlers
 * 
 * Handles notebook save/load/list/delete operations
 */

import { getCorsHeaders } from '../utils/cors.js';

/**
 * Get notes storage key
 */
function getNotesKey(userId, notebookId) {
    return `notes_${userId}_${notebookId}`;
}

/**
 * Get user's notebook list key
 */
function getNotebookListKey(userId) {
    return `notes_list_${userId}`;
}

/**
 * Save notebook endpoint
 * POST /notes/save
 */
export async function handleNotesSave(request, env, authenticateRequest) {
    try {
        // Authenticate (require CSRF for state-changing operations like POST)
        const user = await authenticateRequest(request, env, true);
        if (!user) {
            return new Response(JSON.stringify({ error: 'Authentication required or invalid CSRF token' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        const body = await request.json();
        const { notebookId, content, metadata } = body;
        
        // Validate input
        if (!notebookId || !/^[a-zA-Z0-9_-]{1,64}$/.test(notebookId)) {
            return new Response(JSON.stringify({ error: 'Valid notebookId required (1-64 alphanumeric chars)' }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Allow empty strings for new notebooks, but reject null/undefined
        if (content === null || content === undefined) {
            return new Response(JSON.stringify({ error: 'Content required' }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Validate content size (10MB max)
        const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
        if (contentStr.length > 10 * 1024 * 1024) {
            return new Response(JSON.stringify({ error: 'Content too large (max 10MB)' }), {
                status: 413,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Create notebook data
        const notebookData = {
            version: 1,
            userId: user.userId,
            notebookId,
            content,
            metadata: {
                title: metadata?.title || 'Untitled',
                lastEdited: new Date().toISOString(),
                createdAt: metadata?.createdAt || new Date().toISOString(),
                ...(metadata || {}),
            },
            timestamp: new Date().toISOString(),
        };
        
        // Store in KV
        const key = getNotesKey(user.userId, notebookId);
        const dataStr = JSON.stringify(notebookData);
        await env.TWITCH_CACHE.put(key, dataStr, { expirationTtl: 31536000 }); // 1 year
        
        // Update notebook list
        const listKey = getNotebookListKey(user.userId);
        let notebookList = await env.TWITCH_CACHE.get(listKey, { type: 'json' });
        if (!notebookList) {
            notebookList = [];
        }
        
        // Add or update notebook in list
        const existingIndex = notebookList.findIndex(n => n.id === notebookId);
        const notebookInfo = {
            id: notebookId,
            title: notebookData.metadata.title,
            lastEdited: notebookData.metadata.lastEdited,
            createdAt: notebookData.metadata.createdAt,
        };
        
        if (existingIndex >= 0) {
            notebookList[existingIndex] = notebookInfo;
        } else {
            notebookList.push(notebookInfo);
        }
        
        await env.TWITCH_CACHE.put(listKey, JSON.stringify(notebookList), { expirationTtl: 31536000 });
        
        return new Response(JSON.stringify({ 
            success: true,
            notebookId,
            timestamp: notebookData.timestamp,
            size: dataStr.length,
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: 'Failed to save notebook',
            message: error.message 
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Load notebook endpoint
 * GET /notes/load?notebookId=notebook_1
 */
export async function handleNotesLoad(request, env, authenticateRequest) {
    try {
        // Authenticate
        const user = await authenticateRequest(request, env);
        if (!user) {
            return new Response(JSON.stringify({ error: 'Authentication required' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        const url = new URL(request.url);
        const notebookId = url.searchParams.get('notebookId');
        
        if (!notebookId) {
            return new Response(JSON.stringify({ error: 'notebookId parameter required' }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Load from KV
        const key = getNotesKey(user.userId, notebookId);
        const dataStr = await env.TWITCH_CACHE.get(key);
        
        if (!dataStr) {
            return new Response(JSON.stringify({ 
                error: 'Notebook not found',
                notebookId 
            }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        const notebookData = JSON.parse(dataStr);
        
        // Verify ownership
        if (notebookData.userId !== user.userId) {
            return new Response(JSON.stringify({ error: 'Access denied' }), {
                status: 403,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        return new Response(JSON.stringify({ 
            success: true,
            notebookId: notebookData.notebookId,
            content: notebookData.content,
            metadata: notebookData.metadata,
            timestamp: notebookData.timestamp,
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: 'Failed to load notebook',
            message: error.message 
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * List notebooks endpoint
 * GET /notes/list
 */
export async function handleNotesList(request, env, authenticateRequest) {
    try {
        // Authenticate
        const user = await authenticateRequest(request, env);
        if (!user) {
            return new Response(JSON.stringify({ error: 'Authentication required' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Load notebook list
        const listKey = getNotebookListKey(user.userId);
        const notebookList = await env.TWITCH_CACHE.get(listKey, { type: 'json' }) || [];
        
        return new Response(JSON.stringify({ 
            success: true,
            notebooks: notebookList,
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: 'Failed to list notebooks',
            message: error.message 
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Delete notebook endpoint
 * DELETE /notes/delete?notebookId=notebook_1
 */
export async function handleNotesDelete(request, env, authenticateRequest) {
    try {
        // Authenticate (require CSRF for DELETE operations)
        const user = await authenticateRequest(request, env, true);
        if (!user) {
            return new Response(JSON.stringify({ error: 'Authentication required or invalid CSRF token' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        const url = new URL(request.url);
        const notebookId = url.searchParams.get('notebookId');
        
        if (!notebookId) {
            return new Response(JSON.stringify({ error: 'notebookId parameter required' }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Delete notebook
        const key = getNotesKey(user.userId, notebookId);
        await env.TWITCH_CACHE.delete(key);
        
        // Update notebook list
        const listKey = getNotebookListKey(user.userId);
        let notebookList = await env.TWITCH_CACHE.get(listKey, { type: 'json' });
        if (notebookList) {
            notebookList = notebookList.filter(n => n.id !== notebookId);
            if (notebookList.length > 0) {
                await env.TWITCH_CACHE.put(listKey, JSON.stringify(notebookList), { expirationTtl: 31536000 });
            } else {
                await env.TWITCH_CACHE.delete(listKey);
            }
        }
        
        return new Response(JSON.stringify({ 
            success: true,
            notebookId,
            message: 'Notebook deleted',
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: 'Failed to delete notebook',
            message: error.message 
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

