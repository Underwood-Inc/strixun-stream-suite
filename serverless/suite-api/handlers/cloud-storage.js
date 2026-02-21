/**
 * Cloud Storage Handlers
 * 
 * Handles authenticated cloud save/load operations
 */

import { getCorsHeaders } from '../utils/cors.js';
import { MAX_CLOUD_SAVE_SIZE, formatFileSize } from '../utils/upload-limits.js';

/**
 * Get cloud save storage key
 */
function getCloudSaveKey(userId, slot = 'default') {
    return `cloudsave_${userId}_${slot}`;
}

/**
 * Update slot list for user
 */
async function updateCloudSaveSlotList(env, userId, slot, metadata) {
    const slotListKey = `cloudsave_${userId}_slots`;
    const slotsStr = await env.SUITE_CACHE.get(slotListKey);
    const slots = slotsStr ? JSON.parse(slotsStr) : [];
    
    // Add slot if not exists
    if (!slots.includes(slot)) {
        slots.push(slot);
    }
    
    // Store updated list
    await env.SUITE_CACHE.put(slotListKey, JSON.stringify(slots), { expirationTtl: 31536000 });
}

/**
 * Handle authenticated cloud save upload
 * POST /cloud-save/save?slot=default
 */
export async function handleCloudSave(request, env, authenticateRequest) {
    try {
        // Authenticate request (require CSRF for state-changing operations)
        const user = await authenticateRequest(request, env, true);
        if (!user) {
            return new Response(JSON.stringify({ error: 'Authentication required or invalid CSRF token' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        const userId = user.userId;
        const url = new URL(request.url);
        const slot = url.searchParams.get('slot') || 'default';
        
        // Validate slot name
        if (!/^[a-zA-Z0-9_-]{1,32}$/.test(slot)) {
            return new Response(JSON.stringify({ error: 'Invalid slot name (1-32 alphanumeric chars)' }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Parse body
        const body = await request.json();
        const backup = body.backup;
        
        if (!backup || !backup.version || !backup.timestamp) {
            return new Response(JSON.stringify({ error: 'Invalid backup data format' }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Create save data with metadata
        const saveData = {
            version: backup.version || 2,
            userId,
            slot,
            timestamp: new Date().toISOString(),
            backupTimestamp: backup.timestamp,
            userAgent: request.headers.get('User-Agent') || 'unknown',
            backup: backup,
            metadata: body.metadata || {},
        };

        // Validate payload size (KV limit is 25MB, we limit to MAX_CLOUD_SAVE_SIZE for safety)
        const saveDataStr = JSON.stringify(saveData);
        if (saveDataStr.length > MAX_CLOUD_SAVE_SIZE) {
            return new Response(JSON.stringify({ 
                error: 'Save data too large',
                detail: `Save data size (${formatFileSize(saveDataStr.length)}) exceeds maximum allowed size of ${formatFileSize(MAX_CLOUD_SAVE_SIZE)}`
            }), {
                status: 413,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Save to KV with TTL of 1 year (31536000 seconds)
        const key = getCloudSaveKey(userId, slot);
        await env.SUITE_CACHE.put(key, saveDataStr, { expirationTtl: 31536000 });

        // Also update the slot list for this user
        await updateCloudSaveSlotList(env, userId, slot, saveData.metadata);

        return new Response(JSON.stringify({ 
            success: true,
            userId,
            slot,
            timestamp: saveData.timestamp,
            size: saveDataStr.length,
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: 'Failed to save',
            message: error.message 
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Handle authenticated cloud save download
 * GET /cloud-save/load?slot=default
 */
export async function handleCloudLoad(request, env, authenticateRequest) {
    try {
        // Authenticate request (GET operations don't require CSRF)
        const user = await authenticateRequest(request, env, false);
        if (!user) {
            return new Response(JSON.stringify({ error: 'Authentication required' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        const userId = user.userId;
        const url = new URL(request.url);
        const slot = url.searchParams.get('slot') || 'default';

        const key = getCloudSaveKey(userId, slot);
        const saveDataStr = await env.SUITE_CACHE.get(key);

        if (!saveDataStr) {
            return new Response(JSON.stringify({ 
                error: 'Save not found',
                userId,
                slot 
            }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        const saveData = JSON.parse(saveDataStr);

        return new Response(JSON.stringify({ 
            success: true,
            backup: saveData.backup,
            metadata: saveData.metadata,
            timestamp: saveData.timestamp,
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: 'Failed to load',
            message: error.message 
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Handle listing all save slots for authenticated user
 * GET /cloud-save/list
 */
export async function handleCloudList(request, env, authenticateRequest) {
    try {
        // Authenticate request (GET operations don't require CSRF)
        const user = await authenticateRequest(request, env, false);
        if (!user) {
            return new Response(JSON.stringify({ error: 'Authentication required' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        const userId = user.userId;
        const slotListKey = `cloudsave_${userId}_slots`;
        const slotsStr = await env.SUITE_CACHE.get(slotListKey);
        const slots = slotsStr ? JSON.parse(slotsStr) : [];

        // Load metadata for each slot
        const saveList = [];
        for (const slot of slots) {
            const key = getCloudSaveKey(userId, slot);
            const saveDataStr = await env.SUITE_CACHE.get(key);
            if (saveDataStr) {
                try {
                    const saveData = JSON.parse(saveDataStr);
                    const backup = saveData.backup || {};
                    saveList.push({
                        slot: saveData.slot,
                        timestamp: saveData.timestamp,
                        backupTimestamp: saveData.backupTimestamp,
                        version: saveData.version,
                        size: saveDataStr.length,
                        metadata: saveData.metadata || {},
                        exportedCategories: backup.exportedCategories || [],
                    });
                } catch (e) {
                    // Skip corrupted saves
                }
            }
        }

        // Sort by timestamp descending
        saveList.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        return new Response(JSON.stringify({ 
            success: true,
            userId,
            saves: saveList,
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: 'Failed to list saves',
            message: error.message 
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Handle deleting an authenticated save slot
 * DELETE /cloud-save/delete?slot=default
 */
export async function handleCloudDelete(request, env, authenticateRequest) {
    try {
        // Authenticate request (require CSRF for state-changing operations)
        const user = await authenticateRequest(request, env, true);
        if (!user) {
            return new Response(JSON.stringify({ error: 'Authentication required or invalid CSRF token' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        const userId = user.userId;
        const url = new URL(request.url);
        const slot = url.searchParams.get('slot') || 'default';

        const key = getCloudSaveKey(userId, slot);
        await env.SUITE_CACHE.delete(key);

        // Remove from slot list
        const slotListKey = `cloudsave_${userId}_slots`;
        const slotsStr = await env.SUITE_CACHE.get(slotListKey);
        if (slotsStr) {
            const slots = JSON.parse(slotsStr);
            const filtered = slots.filter(s => s !== slot);
            if (filtered.length > 0) {
                await env.SUITE_CACHE.put(slotListKey, JSON.stringify(filtered), { expirationTtl: 31536000 });
            } else {
                await env.SUITE_CACHE.delete(slotListKey);
            }
        }

        return new Response(JSON.stringify({ 
            success: true,
            userId,
            slot,
            message: 'Save deleted',
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: 'Failed to delete',
            message: error.message 
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

