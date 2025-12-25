/**
 * Dungeon Handler
 * 
 * Handles dungeon instances, room completion, and rewards
 * Authentication is handled by the route wrapper with automatic encryption
 */

import { getCorsHeaders } from '../../utils/cors.js';
import { getCustomerKey } from '../../services/customer.js';

/**
 * Start dungeon instance
 * POST /game/dungeons/start
 * Authentication handled by route wrapper
 */
async function handleStartDungeon(request, env, userId, customerId) {
    try {

        const body = await request.json();
        const { characterId, dungeonId, difficulty = 'normal', instanceType = 'solo' } = body;

        if (!characterId || !dungeonId) {
            return new Response(JSON.stringify({
                error: 'Bad Request',
                message: 'characterId and dungeonId are required'
            }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // TODO: Validate dungeon requirements (level, etc.)

        // Create dungeon instance
        const instanceId = `dungeon_${userId}_${Date.now()}`;
        const instance = {
            id: instanceId,
            dungeonId,
            characterId,
            difficulty,
            instanceType,
            currentFloor: 1,
            currentRoom: 1,
            completedRooms: [],
            status: 'in_progress',
            startedAt: new Date().toISOString(),
            collectedRewards: {
                experience: 0,
                gold: 0,
                items: [],
                materials: {}
            }
        };

        // Store instance
        const instanceKey = getCustomerKey(customerId, `dungeon_instance_${instanceId}`);
        await env.OTP_AUTH_KV.put(instanceKey, JSON.stringify(instance), {
            expirationTtl: 60 * 60 * 24 // 24 hours
        });

        // Add to character's active instances
        const instancesKey = getCustomerKey(customerId, `dungeon_instances_${characterId}`);
        const instances = await env.OTP_AUTH_KV.get(instancesKey, { type: 'json' }) || [];
        instances.push(instanceId);
        await env.OTP_AUTH_KV.put(instancesKey, JSON.stringify(instances), {
            expirationTtl: 60 * 60 * 24 * 365
        });

        return new Response(JSON.stringify({
            success: true,
            instance
        }), {
            status: 200,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Start dungeon error:', error);
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
 * Complete dungeon room
 * POST /game/dungeons/complete-room
 */
/**
 * Complete dungeon room
 * POST /game/dungeons/complete-room
 * Authentication handled by route wrapper
 */
async function handleCompleteRoom(request, env, userId, customerId) {
    try {

        const body = await request.json();
        const { instanceId, roomId, result = 'victory' } = body;

        if (!instanceId || !roomId) {
            return new Response(JSON.stringify({
                error: 'Bad Request',
                message: 'instanceId and roomId are required'
            }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Get instance
        const instanceKey = getCustomerKey(customerId, `dungeon_instance_${instanceId}`);
        const instance = await env.OTP_AUTH_KV.get(instanceKey, { type: 'json' });

        if (!instance) {
            return new Response(JSON.stringify({
                error: 'Not Found',
                message: 'Dungeon instance not found'
            }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        if (result === 'victory') {
            // Mark room as completed
            if (!instance.completedRooms.includes(roomId)) {
                instance.completedRooms.push(roomId);
            }

            // Generate room rewards
            const rewards = generateRoomRewards(instance.difficulty);
            instance.collectedRewards.experience += rewards.experience;
            instance.collectedRewards.gold += rewards.gold;
            instance.collectedRewards.items.push(...rewards.items);
            Object.entries(rewards.materials || {}).forEach(([key, value]) => {
                instance.collectedRewards.materials[key] = (instance.collectedRewards.materials[key] || 0) + value;
            });

            // Move to next room
            instance.currentRoom += 1;
        }

        // Update instance
        await env.OTP_AUTH_KV.put(instanceKey, JSON.stringify(instance), {
            expirationTtl: 60 * 60 * 24
        });

        return new Response(JSON.stringify({
            success: true,
            instance,
            rewards: result === 'victory' ? generateRoomRewards(instance.difficulty) : null
        }), {
            status: 200,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Complete room error:', error);
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
 * Complete dungeon
 * POST /game/dungeons/complete
 * Authentication handled by route wrapper
 */
async function handleCompleteDungeon(request, env, userId, customerId) {
    try {

        const body = await request.json();
        const { instanceId } = body;

        if (!instanceId) {
            return new Response(JSON.stringify({
                error: 'Bad Request',
                message: 'instanceId is required'
            }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Get instance
        const instanceKey = getCustomerKey(customerId, `dungeon_instance_${instanceId}`);
        const instance = await env.OTP_AUTH_KV.get(instanceKey, { type: 'json' });

        if (!instance) {
            return new Response(JSON.stringify({
                error: 'Not Found',
                message: 'Dungeon instance not found'
            }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Add completion bonus
        const completionBonus = getCompletionBonus(instance.difficulty);
        instance.collectedRewards.experience += completionBonus.experience;
        instance.collectedRewards.gold += completionBonus.gold;

        // Mark as completed
        instance.status = 'completed';
        instance.completedAt = new Date().toISOString();

        // Update instance
        await env.OTP_AUTH_KV.put(instanceKey, JSON.stringify(instance), {
            expirationTtl: 60 * 60 * 24 * 7 // Keep for 7 days
        });

        // TODO: Add rewards to character inventory

        return new Response(JSON.stringify({
            success: true,
            finalRewards: instance.collectedRewards,
            instance
        }), {
            status: 200,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Complete dungeon error:', error);
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
 * Get dungeon instances
 * GET /game/dungeons/instances?characterId=123
 * Authentication handled by route wrapper
 */
async function handleGetDungeonInstances(request, env, userId, customerId) {
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

        // Get instance IDs
        const instancesKey = getCustomerKey(customerId, `dungeon_instances_${characterId}`);
        const instanceIds = await env.OTP_AUTH_KV.get(instancesKey, { type: 'json' }) || [];

        // Load all instances
        const instances = [];
        for (const instanceId of instanceIds) {
            const instanceKey = getCustomerKey(customerId, `dungeon_instance_${instanceId}`);
            const instance = await env.OTP_AUTH_KV.get(instanceKey, { type: 'json' });
            if (instance && instance.status === 'in_progress') {
                instances.push(instance);
            }
        }

        return new Response(JSON.stringify({
            success: true,
            instances
        }), {
            status: 200,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Get dungeon instances error:', error);
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
 * Generate room rewards
 */
function generateRoomRewards(difficulty) {
    const multipliers = {
        normal: 1.0,
        hard: 1.5,
        expert: 2.0,
        master: 2.5,
        nightmare: 3.0
    };

    const multiplier = multipliers[difficulty] || 1.0;

    return {
        experience: Math.floor(1000 * multiplier),
        gold: Math.floor(500 * multiplier),
        items: [],
        materials: {
            dungeon_scrap: Math.floor(5 * multiplier)
        }
    };
}

/**
 * Get completion bonus
 */
function getCompletionBonus(difficulty) {
    const bonuses = {
        normal: { experience: 10000, gold: 5000 },
        hard: { experience: 15000, gold: 7500 },
        expert: { experience: 20000, gold: 10000 },
        master: { experience: 25000, gold: 12500 },
        nightmare: { experience: 30000, gold: 15000 }
    };

    return bonuses[difficulty] || bonuses.normal;
}

/**
 * Main handler dispatcher
 */
export async function handleGameDungeons(request, env, userId, customerId, action) {
    if (action === 'start') {
        return await handleStartDungeon(request, env, userId, customerId);
    } else if (action === 'complete-room') {
        return await handleCompleteRoom(request, env, userId, customerId);
    } else if (action === 'complete') {
        return await handleCompleteDungeon(request, env, userId, customerId);
    } else if (action === 'instances') {
        return await handleGetDungeonInstances(request, env, userId, customerId);
    }

    return new Response(JSON.stringify({
        error: 'Bad Request',
        message: 'Invalid action'
    }), {
        status: 400,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
}

