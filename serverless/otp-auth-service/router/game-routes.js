/**
 * Game Routes
 * Handles all idle game API endpoints
 * Uses reusable API architecture with automatic end-to-end encryption
 */

import { getCorsHeaders } from '../utils/cors.js';
import { verifyJWT, getJWTSecret } from '../utils/crypto.js';
import { handleGameSaveState } from '../handlers/game/save-state.js';
import { handleGameLootBox } from '../handlers/game/loot-box.js';
import { handleGameIdle } from '../handlers/game/idle.js';
import { handleGameCrafting } from '../handlers/game/crafting.js';
import { handleGameDungeons } from '../handlers/game/dungeons.js';
import { handleGameInventory } from '../handlers/game/inventory.js';
import { handleGameCharacter } from '../handlers/game/character.js';
import { handleGameLoot } from '../handlers/game/loot.js';

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
    if (auth.jwtToken && handlerResponse.ok) {
        try {
            const { encryptWithJWT } = await import('../utils/jwt-encryption.js');
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
 */
export async function handleGameRoutes(request, path, env) {
    // Only handle /game/* routes
    if (!path.startsWith('/game/')) {
        return null;
    }

    // Authenticate request
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
        return {
            response: new Response(JSON.stringify({
                error: 'Unauthorized',
                message: auth.error || 'Authentication required'
            }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            }),
            customerId: null
        };
    }

    const userId = auth.userId;
    const customerId = auth.customerId;

    // Route to appropriate handler
    try {
        // Save State
        if (path === '/game/save-state' && request.method === 'POST') {
            return {
                response: await handleGameSaveState(request, env, userId, customerId, 'save'),
                customerId
            };
        }
        if (path === '/game/save-state' && request.method === 'GET') {
            return {
                response: await handleGameSaveState(request, env, userId, customerId, 'load'),
                customerId
            };
        }

        // Loot Boxes
        if (path === '/game/loot-box/claim' && request.method === 'POST') {
            return {
                response: await handleGameLootBox(request, env, userId, customerId, 'claim'),
                customerId
            };
        }
        if (path === '/game/loot-box/status' && request.method === 'GET') {
            return {
                response: await handleGameLootBox(request, env, userId, customerId, 'status'),
                customerId
            };
        }

        // Idle Mechanics
        if (path === '/game/idle/claim' && request.method === 'POST') {
            return {
                response: await handleGameIdle(request, env, userId, customerId, 'claim'),
                customerId
            };
        }
        if (path === '/game/idle/progress' && request.method === 'GET') {
            return {
                response: await handleGameIdle(request, env, userId, customerId, 'progress'),
                customerId
            };
        }
        if (path === '/game/idle/activity/start' && request.method === 'POST') {
            return {
                response: await handleGameIdle(request, env, userId, customerId, 'start'),
                customerId
            };
        }
        if (path === '/game/idle/activity/stop' && request.method === 'POST') {
            return {
                response: await handleGameIdle(request, env, userId, customerId, 'stop'),
                customerId
            };
        }

        // Crafting
        if (path === '/game/crafting/start' && request.method === 'POST') {
            return {
                response: await handleGameCrafting(request, env, userId, customerId, 'start'),
                customerId
            };
        }
        if (path === '/game/crafting/collect' && request.method === 'POST') {
            return {
                response: await handleGameCrafting(request, env, userId, customerId, 'collect'),
                customerId
            };
        }
        if (path === '/game/crafting/sessions' && request.method === 'GET') {
            return {
                response: await handleGameCrafting(request, env, userId, customerId, 'sessions'),
                customerId
            };
        }

        // Dungeons
        if (path === '/game/dungeons/start' && request.method === 'POST') {
            return {
                response: await handleGameDungeons(request, env, userId, customerId, 'start'),
                customerId
            };
        }
        if (path === '/game/dungeons/complete-room' && request.method === 'POST') {
            return {
                response: await handleGameDungeons(request, env, userId, customerId, 'complete-room'),
                customerId
            };
        }
        if (path === '/game/dungeons/complete' && request.method === 'POST') {
            return {
                response: await handleGameDungeons(request, env, userId, customerId, 'complete'),
                customerId
            };
        }
        if (path === '/game/dungeons/instances' && request.method === 'GET') {
            return {
                response: await handleGameDungeons(request, env, userId, customerId, 'instances'),
                customerId
            };
        }

        // Inventory
        if (path === '/game/inventory' && request.method === 'GET') {
            return {
                response: await handleGameInventory(request, env, userId, customerId, 'get'),
                customerId
            };
        }
        if (path === '/game/inventory/item' && request.method === 'POST') {
            return {
                response: await handleGameInventory(request, env, userId, customerId, 'add'),
                customerId
            };
        }
        if (path === '/game/inventory/item' && request.method === 'DELETE') {
            return {
                response: await handleGameInventory(request, env, userId, customerId, 'remove'),
                customerId
            };
        }
        if (path === '/game/inventory/equip' && request.method === 'POST') {
            return {
                response: await handleGameInventory(request, env, userId, customerId, 'equip'),
                customerId
            };
        }

        // Character
        if (path === '/game/character' && request.method === 'GET') {
            return {
                response: await handleGameCharacter(request, env, userId, customerId, 'get'),
                customerId
            };
        }
        if (path === '/game/character' && request.method === 'POST') {
            return {
                response: await handleGameCharacter(request, env, userId, customerId, 'create'),
                customerId
            };
        }
        if (path === '/game/character/appearance' && request.method === 'PUT') {
            return {
                response: await handleGameCharacter(request, env, userId, customerId, 'update-appearance'),
                customerId
            };
        }

        // Loot Generation
        if (path === '/game/loot/generate' && request.method === 'POST') {
            return {
                response: await handleGameLoot(request, env, userId, customerId, 'generate'),
                customerId
            };
        }
        if (path === '/game/loot/tables' && request.method === 'GET') {
            return {
                response: await handleGameLoot(request, env, userId, customerId, 'tables'),
                customerId
            };
        }

        // 404 for unknown game routes
        return {
            response: new Response(JSON.stringify({ error: 'Game endpoint not found' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            }),
            customerId
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
            customerId
        };
    }
}

