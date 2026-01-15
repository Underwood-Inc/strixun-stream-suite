/**
 * Game Save State Handler
 * 
 * Handles saving and loading game state with OTP auth integration
 * Authentication is handled by the route wrapper with automatic encryption
 */

import { getCorsHeaders, getCorsHeadersRecord } from '../../utils/cors.js';
import { getCustomerKey } from '../../services/customer.js';

/**
 * Main handler dispatcher
 */
export async function handleGameSaveState(request, env, userId, customerId, action) {
    if (action === 'save') {
        return await handleSaveGameState(request, env, userId, customerId);
    } else if (action === 'load') {
        return await handleLoadGameState(request, env, userId, customerId);
    }

    return new Response(JSON.stringify({
        error: 'Bad Request',
        message: 'Invalid action'
    }), {
        status: 400,
        headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
    });
}

/**
 * Save game state
 * POST /game/save-state
 * Authentication handled by route wrapper
 */
async function handleSaveGameState(request, env, userId, customerId) {
    try {
        const body = await request.json();
        const { characterId, saveData, version } = body;

        if (!characterId || !saveData) {
            return new Response(JSON.stringify({
                error: 'Bad Request',
                message: 'characterId and saveData are required'
            }), {
                status: 400,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Store save state in KV
        const saveKey = getCustomerKey(customerId, `game_save_${userId}_${characterId}`);
        const saveState = {
            userId,
            characterId,
            saveData,
            version: version || '1.0.0',
            savedAt: new Date().toISOString(),
            customerId
        };

        await env.OTP_AUTH_KV.put(saveKey, JSON.stringify(saveState), {
            expirationTtl: 60 * 60 * 24 * 365 // 1 year
        });

        return new Response(JSON.stringify({
            success: true,
            savedAt: saveState.savedAt
        }), {
            status: 200,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Save state error:', error);
        return new Response(JSON.stringify({
            error: 'Internal server error',
            message: env.ENVIRONMENT === 'development' ? error.message : undefined
        }), {
            status: 500,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Load game state
 * GET /game/save-state?characterId=123
 * Authentication handled by route wrapper
 */
async function handleLoadGameState(request, env, userId, customerId) {
    try {
        const url = new URL(request.url);
        const characterId = url.searchParams.get('characterId');

        if (!characterId) {
            return new Response(JSON.stringify({
                error: 'Bad Request',
                message: 'characterId query parameter is required'
            }), {
                status: 400,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Load save state from KV
        const saveKey = getCustomerKey(customerId, `game_save_${userId}_${characterId}`);
        const saveStateData = await env.OTP_AUTH_KV.get(saveKey, { type: 'json' });

        if (!saveStateData) {
            return new Response(JSON.stringify({
                error: 'Not Found',
                message: 'No save state found for this character'
            }), {
                status: 404,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({
            success: true,
            saveState: saveStateData
        }), {
            status: 200,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Load state error:', error);
        return new Response(JSON.stringify({
            error: 'Internal server error',
            message: env.ENVIRONMENT === 'development' ? error.message : undefined
        }), {
            status: 500,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    }
}

