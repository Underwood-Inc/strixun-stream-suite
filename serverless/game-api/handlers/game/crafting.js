/**
 * End-Game Crafting Handler
 * 
 * Handles crafting sessions, recipe management, and quality calculation
 * Authentication is handled by the route wrapper with automatic encryption
 */

import { getCorsHeaders } from '../../utils/cors.js';
import { getCustomerKey } from '../../utils/customer.js';

/**
 * Start crafting session
 * POST /game/crafting/start
 * Authentication handled by route wrapper
 */
async function handleStartCrafting(request, env, userId, customerId) {
    try {

        const body = await request.json();
        const { characterId, recipeId, quantity = 1, specialMaterials = [] } = body;

        if (!characterId || !recipeId) {
            return new Response(JSON.stringify({
                error: 'Bad Request',
                message: 'characterId and recipeId are required'
            }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // TODO: Validate recipe, check ingredients, check skill levels
        // For now, create a crafting session

        const sessionId = `craft_${userId}_${Date.now()}`;
        const session = {
            id: sessionId,
            characterId,
            recipeId,
            quantity,
            specialMaterials,
            startedAt: new Date().toISOString(),
            completesAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours
            status: 'in_progress',
            progressPercent: 0
        };

        // Store session
        const sessionKey = getCustomerKey(customerId, `crafting_session_${sessionId}`);
        await env.GAME_KV.put(sessionKey, JSON.stringify(session), {
            expirationTtl: 60 * 60 * 24 * 7 // 7 days
        });

        // Add to character's active sessions
        const sessionsKey = getCustomerKey(customerId, `crafting_sessions_${characterId}`);
        const sessions = await env.GAME_KV.get(sessionsKey, { type: 'json' }) || [];
        sessions.push(sessionId);
        await env.GAME_KV.put(sessionsKey, JSON.stringify(sessions), {
            expirationTtl: 60 * 60 * 24 * 365
        });

        return new Response(JSON.stringify({
            success: true,
            session
        }), {
            status: 200,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Start crafting error:', error);
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
 * Collect crafting result
 * POST /game/crafting/collect
 * Authentication handled by route wrapper
 */
async function handleCollectCrafting(request, env, userId, customerId) {
    try {

        const body = await request.json();
        const { sessionId } = body;

        if (!sessionId) {
            return new Response(JSON.stringify({
                error: 'Bad Request',
                message: 'sessionId is required'
            }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Get session
        const sessionKey = getCustomerKey(customerId, `crafting_session_${sessionId}`);
        const session = await env.GAME_KV.get(sessionKey, { type: 'json' });

        if (!session) {
            return new Response(JSON.stringify({
                error: 'Not Found',
                message: 'Crafting session not found'
            }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Check if complete
        const now = new Date();
        const completesAt = new Date(session.completesAt);
        if (now < completesAt) {
            return new Response(JSON.stringify({
                error: 'Not Ready',
                message: 'Crafting session not yet complete',
                completesAt: session.completesAt
            }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Calculate quality and modifiers
        const quality = calculateCraftingQuality(session);
        const modifiers = generateCraftingModifiers(session, quality);

        // Generate result items
        const items = generateCraftingItems(session, quality, modifiers);

        // Update session
        session.status = 'completed';
        session.completedAt = now.toISOString();
        session.resultQuality = quality;
        session.resultModifiers = modifiers;

        await env.GAME_KV.put(sessionKey, JSON.stringify(session), {
            expirationTtl: 60 * 60 * 24 * 7
        });

        // TODO: Add items to inventory

        return new Response(JSON.stringify({
            success: true,
            items,
            quality,
            modifiers,
            experienceGained: 1000 // Would calculate based on recipe
        }), {
            status: 200,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Collect crafting error:', error);
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
 * Get crafting sessions
 * GET /game/crafting/sessions?characterId=123
 * Authentication handled by route wrapper
 */
async function handleGetCraftingSessions(request, env, userId, customerId) {
    try {

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

        // Get session IDs
        const sessionsKey = getCustomerKey(customerId, `crafting_sessions_${characterId}`);
        const sessionIds = await env.GAME_KV.get(sessionsKey, { type: 'json' }) || [];

        // Load all sessions
        const sessions = [];
        for (const sessionId of sessionIds) {
            const sessionKey = getCustomerKey(customerId, `crafting_session_${sessionId}`);
            const session = await env.GAME_KV.get(sessionKey, { type: 'json' });
            if (session) {
                // Calculate progress
                const now = new Date();
                const started = new Date(session.startedAt);
                const completes = new Date(session.completesAt);
                const total = completes - started;
                const elapsed = now - started;
                session.progressPercent = Math.min(100, Math.max(0, (elapsed / total) * 100));
                sessions.push(session);
            }
        }

        return new Response(JSON.stringify({
            success: true,
            sessions
        }), {
            status: 200,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Get crafting sessions error:', error);
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
 * Calculate crafting quality
 */
function calculateCraftingQuality(session) {
    // Base quality calculation
    let quality = 50; // Base

    // Special materials boost
    session.specialMaterials.forEach(material => {
        if (material.effect === 'quality_boost') {
            quality += material.value;
        }
    });

    // Random factor
    quality += Math.random() * 20;

    return Math.min(100, Math.max(0, Math.floor(quality)));
}

/**
 * Generate crafting modifiers
 */
function generateCraftingModifiers(session, quality) {
    const modifiers = {
        prefixes: [],
        suffixes: []
    };

    // Higher quality = more modifiers
    if (quality >= 90) {
        modifiers.prefixes.push({ name: 'Master', tier: 5 });
        modifiers.suffixes.push({ name: 'of Excellence', tier: 5 });
    } else if (quality >= 75) {
        modifiers.prefixes.push({ name: 'Superior', tier: 4 });
        modifiers.suffixes.push({ name: 'of Quality', tier: 4 });
    } else if (quality >= 60) {
        modifiers.prefixes.push({ name: 'Fine', tier: 3 });
    }

    // Special materials can guarantee modifiers
    session.specialMaterials.forEach(material => {
        if (material.effect === 'guaranteed_modifier') {
            modifiers.prefixes.push({ name: 'Enhanced', tier: 3 });
        }
    });

    return modifiers;
}

/**
 * Generate crafting result items
 */
function generateCraftingItems(session, quality, modifiers) {
    return [{
        itemTemplateId: `crafted_${session.recipeId}`,
        quantity: session.quantity,
        quality,
        modifiers
    }];
}

/**
 * Main handler dispatcher
 */
export async function handleGameCrafting(request, env, userId, customerId, action) {
    if (action === 'start') {
        return await handleStartCrafting(request, env, userId, customerId);
    } else if (action === 'collect') {
        return await handleCollectCrafting(request, env, userId, customerId);
    } else if (action === 'sessions') {
        return await handleGetCraftingSessions(request, env, userId, customerId);
    }

    return new Response(JSON.stringify({
        error: 'Bad Request',
        message: 'Invalid action'
    }), {
        status: 400,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
}


