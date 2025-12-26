/**
 * Game Routes
 * Handles all idle game API endpoints
 * Uses reusable API architecture with automatic end-to-end encryption
 */

import { handleGameCharacter } from '../handlers/game/character.js';
import { handleGameCrafting } from '../handlers/game/crafting.js';
import { handleGameDungeons } from '../handlers/game/dungeons.js';
import { handleGameIdle } from '../handlers/game/idle.js';
import { handleGameInventory } from '../handlers/game/inventory.js';
import { handleGameLootBox } from '../handlers/game/loot-box.js';
import { handleGameLoot } from '../handlers/game/loot.js';
import { handleGameSaveState } from '../handlers/game/save-state.js';
import { getCorsHeaders } from '../utils/cors.js';
import { getJWTSecret, verifyJWT } from '../utils/crypto.js';

/**
 * Authenticate request and extract user info
 * Returns auth object with userId, customerId, and jwtToken for encryption
 */
async function authenticateRequest(request, env) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return null;
        }

        const token = authHeader.substring(7);
        const jwtSecret = await getJWTSecret(env);
        const payload = await verifyJWT(token, jwtSecret);

        if (!payload || !payload.sub) {
            return null;
        }

        return {
            userId: payload.sub,
            email: payload.email,
            customerId: payload.customerId || null,
            jwtToken: token // Include JWT token for encryption
        };
    } catch (error) {
        console.error('Authentication error:', error);
        return null;
    }
}

/**
 * Helper to wrap game route handlers with authentication and automatic encryption
 * Uses the same pattern as admin routes for consistency
 */
async function handleGameRoute(handler, request, env, auth) {
    if (!auth) {
        return {
            response: new Response(JSON.stringify({
                error: 'Unauthorized',
                message: 'Authentication required. Please provide a valid JWT token.'
            }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            }),
            customerId: null
        };
    }

    // Get handler response
    const handlerResponse = await handler(request, env, auth.userId, auth.customerId);

    // If JWT token is present, encrypt the response (automatic E2E encryption)
    // Uses shared encryption suite from serverless/shared/encryption
    if (auth.jwtToken && handlerResponse.ok) {
        try {
            const { encryptWithJWT } = await import('@strixun/api-framework');
            const responseData = await handlerResponse.json();
            const encrypted = await encryptWithJWT(responseData, auth.jwtToken);

            // Preserve original headers and add encryption flag
            const headers = new Headers(handlerResponse.headers);
            headers.set('Content-Type', 'application/json');
            headers.set('X-Encrypted', 'true'); // Flag to indicate encrypted response

            return {
                response: new Response(JSON.stringify(encrypted), {
                    status: handlerResponse.status,
                    statusText: handlerResponse.statusText,
                    headers: headers,
                }),
                customerId: auth.customerId
            };
        } catch (error) {
            console.error('Failed to encrypt response:', error);
            // Return unencrypted response if encryption fails (shouldn't happen)
            return { response: handlerResponse, customerId: auth.customerId };
        }
    }

    // For non-OK responses, return as-is (no encryption)
    return { response: handlerResponse, customerId: auth.customerId };
}

/**
 * Handle game routes
 * Uses reusable API architecture with automatic encryption
 */
export async function handleGameRoutes(request, path, env) {
    // Only handle /game/* routes
    if (!path.startsWith('/game/')) {
        return null;
    }

    // Authenticate request (returns null if not authenticated)
    const auth = await authenticateRequest(request, env);

    // Route to appropriate handler with automatic encryption wrapper
    try {
        // Save State
        if (path === '/game/save-state' && request.method === 'POST') {
            return await handleGameRoute(
                (req, e, userId, customerId) => handleGameSaveState(req, e, userId, customerId, 'save'),
                request, env, auth
            );
        }
        if (path === '/game/save-state' && request.method === 'GET') {
            return await handleGameRoute(
                (req, e, userId, customerId) => handleGameSaveState(req, e, userId, customerId, 'load'),
                request, env, auth
            );
        }

        // Loot Boxes
        if (path === '/game/loot-box/claim' && request.method === 'POST') {
            return await handleGameRoute(
                (req, e, userId, customerId) => handleGameLootBox(req, e, userId, customerId, 'claim'),
                request, env, auth
            );
        }
        if (path === '/game/loot-box/status' && request.method === 'GET') {
            return await handleGameRoute(
                (req, e, userId, customerId) => handleGameLootBox(req, e, userId, customerId, 'status'),
                request, env, auth
            );
        }

        // Idle Mechanics
        if (path === '/game/idle/claim' && request.method === 'POST') {
            return await handleGameRoute(
                (req, e, userId, customerId) => handleGameIdle(req, e, userId, customerId, 'claim'),
                request, env, auth
            );
        }
        if (path === '/game/idle/progress' && request.method === 'GET') {
            return await handleGameRoute(
                (req, e, userId, customerId) => handleGameIdle(req, e, userId, customerId, 'progress'),
                request, env, auth
            );
        }
        if (path === '/game/idle/activity/start' && request.method === 'POST') {
            return await handleGameRoute(
                (req, e, userId, customerId) => handleGameIdle(req, e, userId, customerId, 'start'),
                request, env, auth
            );
        }
        if (path === '/game/idle/activity/stop' && request.method === 'POST') {
            return await handleGameRoute(
                (req, e, userId, customerId) => handleGameIdle(req, e, userId, customerId, 'stop'),
                request, env, auth
            );
        }

        // Crafting
        if (path === '/game/crafting/start' && request.method === 'POST') {
            return await handleGameRoute(
                (req, e, userId, customerId) => handleGameCrafting(req, e, userId, customerId, 'start'),
                request, env, auth
            );
        }
        if (path === '/game/crafting/collect' && request.method === 'POST') {
            return await handleGameRoute(
                (req, e, userId, customerId) => handleGameCrafting(req, e, userId, customerId, 'collect'),
                request, env, auth
            );
        }
        if (path === '/game/crafting/sessions' && request.method === 'GET') {
            return await handleGameRoute(
                (req, e, userId, customerId) => handleGameCrafting(req, e, userId, customerId, 'sessions'),
                request, env, auth
            );
        }

        // Dungeons
        if (path === '/game/dungeons/start' && request.method === 'POST') {
            return await handleGameRoute(
                (req, e, userId, customerId) => handleGameDungeons(req, e, userId, customerId, 'start'),
                request, env, auth
            );
        }
        if (path === '/game/dungeons/complete-room' && request.method === 'POST') {
            return await handleGameRoute(
                (req, e, userId, customerId) => handleGameDungeons(req, e, userId, customerId, 'complete-room'),
                request, env, auth
            );
        }
        if (path === '/game/dungeons/complete' && request.method === 'POST') {
            return await handleGameRoute(
                (req, e, userId, customerId) => handleGameDungeons(req, e, userId, customerId, 'complete'),
                request, env, auth
            );
        }
        if (path === '/game/dungeons/instances' && request.method === 'GET') {
            return await handleGameRoute(
                (req, e, userId, customerId) => handleGameDungeons(req, e, userId, customerId, 'instances'),
                request, env, auth
            );
        }

        // Inventory
        if (path === '/game/inventory' && request.method === 'GET') {
            return await handleGameRoute(
                (req, e, userId, customerId) => handleGameInventory(req, e, userId, customerId, 'get'),
                request, env, auth
            );
        }
        if (path === '/game/inventory/item' && request.method === 'POST') {
            return await handleGameRoute(
                (req, e, userId, customerId) => handleGameInventory(req, e, userId, customerId, 'add'),
                request, env, auth
            );
        }
        if (path === '/game/inventory/item' && request.method === 'DELETE') {
            return await handleGameRoute(
                (req, e, userId, customerId) => handleGameInventory(req, e, userId, customerId, 'remove'),
                request, env, auth
            );
        }
        if (path === '/game/inventory/equip' && request.method === 'POST') {
            return await handleGameRoute(
                (req, e, userId, customerId) => handleGameInventory(req, e, userId, customerId, 'equip'),
                request, env, auth
            );
        }

        // Character
        if (path === '/game/character' && request.method === 'GET') {
            return await handleGameRoute(
                (req, e, userId, customerId) => handleGameCharacter(req, e, userId, customerId, 'get'),
                request, env, auth
            );
        }
        if (path === '/game/character' && request.method === 'POST') {
            return await handleGameRoute(
                (req, e, userId, customerId) => handleGameCharacter(req, e, userId, customerId, 'create'),
                request, env, auth
            );
        }
        if (path === '/game/character/appearance' && request.method === 'PUT') {
            return await handleGameRoute(
                (req, e, userId, customerId) => handleGameCharacter(req, e, userId, customerId, 'update-appearance'),
                request, env, auth
            );
        }

        // Loot Generation
        if (path === '/game/loot/generate' && request.method === 'POST') {
            return await handleGameRoute(
                (req, e, userId, customerId) => handleGameLoot(req, e, userId, customerId, 'generate'),
                request, env, auth
            );
        }
        if (path === '/game/loot/tables' && request.method === 'GET') {
            return await handleGameRoute(
                (req, e, userId, customerId) => handleGameLoot(req, e, userId, customerId, 'tables'),
                request, env, auth
            );
        }

        // 404 for unknown game routes
        return {
            response: new Response(JSON.stringify({ error: 'Game endpoint not found' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            }),
            customerId: auth?.customerId || null
        };
    } catch (error) {
        console.error('Game route handler error:', error);
        return {
            response: new Response(JSON.stringify({
                error: 'Internal server error',
                message: env.ENVIRONMENT === 'development' ? error.message : undefined
            }), {
                status: 500,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            }),
            customerId: auth?.customerId || null
        };
    }
}

