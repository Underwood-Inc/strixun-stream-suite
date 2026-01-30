/**
 * Character Handler
 * 
 * Handles character creation, appearance customization, and pixel editor saves
 * Authentication is handled by the route wrapper with automatic encryption
 */

import { getCorsHeadersRecord } from '../../utils/cors.js';
import { getEntity, putEntity, indexAdd, indexGet } from '@strixun/kv-entities';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    ENVIRONMENT?: string;
}

interface CharacterAppearance {
    [key: string]: unknown;
    customTextures?: Record<string, { data?: string }>;
}

interface Character {
    id: string;
    userId: string;
    customerId: string | null;
    name: string;
    level: number;
    experience: number;
    vitals: {
        healthCurrent: number;
        healthMax: number;
        energyCurrent: number;
        energyMax: number;
    };
    stats: {
        strength: number;
        dexterity: number;
        intelligence: number;
        endurance: number;
    };
    position: {
        x: number;
        y: number;
        zone: string;
    };
    appearance: CharacterAppearance;
    createdAt: string;
    lastActive: string;
    updatedAt: string;
    totalPlayTimeSeconds: number;
    totalItemsCrafted: number;
    totalItemsTraded: number;
    totalCoinsEarned: number;
}

/**
 * Get character
 * GET /game/character?characterId=123
 * Authentication handled by route wrapper
 */
async function handleGetCharacter(request: Request, env: Env, userId: string, customerId: string | null): Promise<Response> {
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

        // Get character using entity pattern
        const character = await getEntity<Character>(env.OTP_AUTH_KV, 'otp-auth', 'character', characterId);

        if (!character) {
            return new Response(JSON.stringify({
                error: 'Not Found',
                message: 'Character not found'
            }), {
                status: 404,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({
            success: true,
            character
        }), {
            status: 200,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Get character error:', error);
        const err = error as Error;
        return new Response(JSON.stringify({
            error: 'Internal server error',
            message: env.ENVIRONMENT === 'development' ? err.message : undefined
        }), {
            status: 500,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Create character
 * POST /game/character
 * Authentication handled by route wrapper
 */
async function handleCreateCharacter(request: Request, env: Env, userId: string, customerId: string | null): Promise<Response> {
    try {
        const body = await request.json() as { name?: string; appearance?: CharacterAppearance };
        const { name, appearance } = body;

        if (!name || !appearance) {
            return new Response(JSON.stringify({
                error: 'Bad Request',
                message: 'name and appearance are required'
            }), {
                status: 400,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }

        // TODO: Check character slot limits based on subscription

        // Create character
        const characterId = `char_${userId}_${Date.now()}`;
        const character: Character = {
            id: characterId,
            userId,
            customerId,
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

        // Store character using entity pattern
        await putEntity(env.OTP_AUTH_KV, 'otp-auth', 'character', characterId, character, {
            expirationTtl: 60 * 60 * 24 * 365
        });

        // Add to user's character list using index
        await indexAdd(env.OTP_AUTH_KV, 'otp-auth', 'user-characters', userId, characterId);

        return new Response(JSON.stringify({
            success: true,
            character
        }), {
            status: 200,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Create character error:', error);
        const err = error as Error;
        return new Response(JSON.stringify({
            error: 'Internal server error',
            message: env.ENVIRONMENT === 'development' ? err.message : undefined
        }), {
            status: 500,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Update character appearance (pixel editor saves)
 * PUT /game/character/appearance
 * Authentication handled by route wrapper
 */
async function handleUpdateAppearance(request: Request, env: Env, userId: string, customerId: string | null): Promise<Response> {
    try {
        const body = await request.json() as { characterId?: string; appearance?: CharacterAppearance; customTextures?: Record<string, { data?: string }> };
        const { characterId, appearance, customTextures } = body;

        if (!characterId || !appearance) {
            return new Response(JSON.stringify({
                error: 'Bad Request',
                message: 'characterId and appearance are required'
            }), {
                status: 400,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Get character using entity pattern
        const character = await getEntity<Character>(env.OTP_AUTH_KV, 'otp-auth', 'character', characterId);

        if (!character) {
            return new Response(JSON.stringify({
                error: 'Not Found',
                message: 'Character not found'
            }), {
                status: 404,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
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
            for (const [type, texture] of Object.entries(customTextures)) {
                if (texture && texture.data) {
                    await putEntity(env.OTP_AUTH_KV, 'otp-auth', 'character-texture', `${characterId}_${type}`, texture, {
                        expirationTtl: 60 * 60 * 24 * 365
                    });
                }
            }
        }

        character.updatedAt = new Date().toISOString();

        // Update character using entity pattern
        await putEntity(env.OTP_AUTH_KV, 'otp-auth', 'character', characterId, character, {
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
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Update appearance error:', error);
        const err = error as Error;
        return new Response(JSON.stringify({
            error: 'Internal server error',
            message: env.ENVIRONMENT === 'development' ? err.message : undefined
        }), {
            status: 500,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Main handler dispatcher
 */
export async function handleGameCharacter(request: Request, env: Env, userId: string, customerId: string | null, action: string): Promise<Response> {
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
        headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
    });
}
