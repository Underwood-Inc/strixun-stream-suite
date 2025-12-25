/**
 * Character Handler
 * 
 * Handles character creation, appearance customization, and pixel editor saves
 */

import { getCorsHeaders } from '../../utils/cors.js';
import { verifyJWT, getJWTSecret } from '../../utils/crypto.js';
import { getCustomerKey } from '../../services/customer.js';

/**
 * Authenticate request
 */
async function authenticateRequest(request, env) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return { authenticated: false, error: 'Missing authorization header' };
        }

        const token = authHeader.substring(7);
        const jwtSecret = await getJWTSecret(env);
        const payload = await verifyJWT(token, jwtSecret);

        if (!payload || !payload.sub) {
            return { authenticated: false, error: 'Invalid token' };
        }

        return {
            authenticated: true,
            userId: payload.sub,
            email: payload.email,
            customerId: payload.customerId || null
        };
    } catch (error) {
        return { authenticated: false, error: error.message };
    }
}

/**
 * Get character
 * GET /game/character?characterId=123
 */
async function handleGetCharacter(request, env, userId, customerId) {
    try {
        const auth = await authenticateRequest(request, env);
        if (!auth.authenticated) {
            return new Response(JSON.stringify({
                error: 'Unauthorized',
                message: auth.error
            }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        const url = new URL(request.url);
        const characterId = url.searchParams.get('characterId');

        if (!characterId) {
            return new Response(JSON.stringify({
                error: 'Bad Request',
                message: 'characterId query parameter is required'
            }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Get character
        const characterKey = getCustomerKey(customerId, `character_${characterId}`);
        const character = await env.OTP_AUTH_KV.get(characterKey, { type: 'json' });

        if (!character) {
            return new Response(JSON.stringify({
                error: 'Not Found',
                message: 'Character not found'
            }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({
            success: true,
            character
        }), {
            status: 200,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Get character error:', error);
        return new Response(JSON.stringify({
            error: 'Internal server error',
            message: env.ENVIRONMENT === 'development' ? error.message : undefined
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Create character
 * POST /game/character
 */
async function handleCreateCharacter(request, env, userId, customerId) {
    try {
        const auth = await authenticateRequest(request, env);
        if (!auth.authenticated) {
            return new Response(JSON.stringify({
                error: 'Unauthorized',
                message: auth.error
            }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        const body = await request.json();
        const { name, appearance } = body;

        if (!name || !appearance) {
            return new Response(JSON.stringify({
                error: 'Bad Request',
                message: 'name and appearance are required'
            }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // TODO: Check character slot limits based on subscription

        // Create character
        const characterId = `char_${userId}_${Date.now()}`;
        const character = {
            id: characterId,
            userId: auth.userId,
            name,
            level: 1,
            experience: 0,
            vitals: {
                healthCurrent: 100,
                healthMax: 100,
                energyCurrent: 50,
                energyMax: 50
            },
            stats: {
                strength: 10,
                dexterity: 10,
                intelligence: 10,
                endurance: 10
            },
            position: {
                x: 0,
                y: 0,
                zone: 'starting_area'
            },
            appearance,
            createdAt: new Date().toISOString(),
            lastActive: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            totalPlayTimeSeconds: 0,
            totalItemsCrafted: 0,
            totalItemsTraded: 0,
            totalCoinsEarned: 0
        };

        // Store character
        const characterKey = getCustomerKey(customerId, `character_${characterId}`);
        await env.OTP_AUTH_KV.put(characterKey, JSON.stringify(character), {
            expirationTtl: 60 * 60 * 24 * 365
        });

        // Add to user's character list
        const charactersKey = getCustomerKey(customerId, `characters_${userId}`);
        const characters = await env.OTP_AUTH_KV.get(charactersKey, { type: 'json' }) || [];
        characters.push(characterId);
        await env.OTP_AUTH_KV.put(charactersKey, JSON.stringify(characters), {
            expirationTtl: 60 * 60 * 24 * 365
        });

        return new Response(JSON.stringify({
            success: true,
            character
        }), {
            status: 200,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Create character error:', error);
        return new Response(JSON.stringify({
            error: 'Internal server error',
            message: env.ENVIRONMENT === 'development' ? error.message : undefined
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Update character appearance (pixel editor saves)
 * PUT /game/character/appearance
 */
async function handleUpdateAppearance(request, env, userId, customerId) {
    try {
        const auth = await authenticateRequest(request, env);
        if (!auth.authenticated) {
            return new Response(JSON.stringify({
                error: 'Unauthorized',
                message: auth.error
            }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        const body = await request.json();
        const { characterId, appearance, customTextures } = body;

        if (!characterId || !appearance) {
            return new Response(JSON.stringify({
                error: 'Bad Request',
                message: 'characterId and appearance are required'
            }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Get character
        const characterKey = getCustomerKey(customerId, `character_${characterId}`);
        const character = await env.OTP_AUTH_KV.get(characterKey, { type: 'json' });

        if (!character) {
            return new Response(JSON.stringify({
                error: 'Not Found',
                message: 'Character not found'
            }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Update appearance
        character.appearance = {
            ...character.appearance,
            ...appearance
        };

        // Store custom textures if provided
        if (customTextures) {
            character.appearance.customTextures = customTextures;
            
            // Store textures separately for easier access
            Object.entries(customTextures).forEach(([type, texture]) => {
                if (texture && texture.data) {
                    const textureKey = getCustomerKey(customerId, `character_texture_${characterId}_${type}`);
                    env.OTP_AUTH_KV.put(textureKey, JSON.stringify(texture), {
                        expirationTtl: 60 * 60 * 24 * 365
                    });
                }
            });
        }

        character.updatedAt = new Date().toISOString();

        // Update character
        await env.OTP_AUTH_KV.put(characterKey, JSON.stringify(character), {
            expirationTtl: 60 * 60 * 24 * 365
        });

        return new Response(JSON.stringify({
            success: true,
            character: {
                id: character.id,
                appearance: character.appearance
            }
        }), {
            status: 200,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Update appearance error:', error);
        return new Response(JSON.stringify({
            error: 'Internal server error',
            message: env.ENVIRONMENT === 'development' ? error.message : undefined
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Main handler dispatcher
 */
export async function handleGameCharacter(request, env, userId, customerId, action) {
    if (action === 'get') {
        return await handleGetCharacter(request, env, userId, customerId);
    } else if (action === 'create') {
        return await handleCreateCharacter(request, env, userId, customerId);
    } else if (action === 'update-appearance') {
        return await handleUpdateAppearance(request, env, userId, customerId);
    }

    return new Response(JSON.stringify({
        error: 'Bad Request',
        message: 'Invalid action'
    }), {
        status: 400,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
}

