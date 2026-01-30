/**
 * Dungeon Handler
 * 
 * Handles dungeon instances, room completion, and rewards
 * Authentication is handled by the route wrapper with automatic encryption
 */

import { getCorsHeadersRecord } from '../../utils/cors.js';
import { getEntity, putEntity, indexAdd, indexGet } from '@strixun/kv-entities';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    ENVIRONMENT?: string;
}

type Difficulty = 'normal' | 'hard' | 'expert' | 'master' | 'nightmare';

interface CollectedRewards {
    experience: number;
    gold: number;
    items: unknown[];
    materials: Record<string, number>;
}

interface DungeonInstance {
    id: string;
    dungeonId: string;
    characterId: string;
    difficulty: Difficulty;
    instanceType: string;
    currentFloor: number;
    currentRoom: number;
    completedRooms: string[];
    status: 'in_progress' | 'completed';
    startedAt: string;
    completedAt?: string;
    collectedRewards: CollectedRewards;
}

interface RoomRewards {
    experience: number;
    gold: number;
    items: unknown[];
    materials: Record<string, number>;
}

/**
 * Start dungeon instance
 * POST /game/dungeons/start
 * Authentication handled by route wrapper
 */
async function handleStartDungeon(request: Request, env: Env, userId: string, customerId: string | null): Promise<Response> {
    try {
        const body = await request.json() as { characterId?: string; dungeonId?: string; difficulty?: Difficulty; instanceType?: string };
        const { characterId, dungeonId, difficulty = 'normal', instanceType = 'solo' } = body;

        if (!characterId || !dungeonId) {
            return new Response(JSON.stringify({
                error: 'Bad Request',
                message: 'characterId and dungeonId are required'
            }), {
                status: 400,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }

        // TODO: Validate dungeon requirements (level, etc.)

        // Create dungeon instance
        const instanceId = `dungeon_${userId}_${Date.now()}`;
        const instance: DungeonInstance = {
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

        // Store instance using entity pattern
        await putEntity(env.OTP_AUTH_KV, 'otp-auth', 'dungeon-instance', instanceId, instance, {
            expirationTtl: 60 * 60 * 24 // 24 hours
        });

        // Add to character's active instances using index
        await indexAdd(env.OTP_AUTH_KV, 'otp-auth', 'character-dungeon-instances', characterId, instanceId);

        return new Response(JSON.stringify({
            success: true,
            instance
        }), {
            status: 200,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Start dungeon error:', error);
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
 * Complete dungeon room
 * POST /game/dungeons/complete-room
 * Authentication handled by route wrapper
 */
async function handleCompleteRoom(request: Request, env: Env, userId: string, customerId: string | null): Promise<Response> {
    try {
        const body = await request.json() as { instanceId?: string; roomId?: string; result?: string };
        const { instanceId, roomId, result = 'victory' } = body;

        if (!instanceId || !roomId) {
            return new Response(JSON.stringify({
                error: 'Bad Request',
                message: 'instanceId and roomId are required'
            }), {
                status: 400,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Get instance using entity pattern
        const instance = await getEntity<DungeonInstance>(env.OTP_AUTH_KV, 'otp-auth', 'dungeon-instance', instanceId);

        if (!instance) {
            return new Response(JSON.stringify({
                error: 'Not Found',
                message: 'Dungeon instance not found'
            }), {
                status: 404,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }

        let rewards: RoomRewards | null = null;
        if (result === 'victory') {
            // Mark room as completed
            if (!instance.completedRooms.includes(roomId)) {
                instance.completedRooms.push(roomId);
            }

            // Generate room rewards
            rewards = generateRoomRewards(instance.difficulty);
            instance.collectedRewards.experience += rewards.experience;
            instance.collectedRewards.gold += rewards.gold;
            instance.collectedRewards.items.push(...rewards.items);
            Object.entries(rewards.materials || {}).forEach(([key, value]) => {
                instance.collectedRewards.materials[key] = (instance.collectedRewards.materials[key] || 0) + value;
            });

            // Move to next room
            instance.currentRoom += 1;
        }

        // Update instance using entity pattern
        await putEntity(env.OTP_AUTH_KV, 'otp-auth', 'dungeon-instance', instanceId, instance, {
            expirationTtl: 60 * 60 * 24
        });

        return new Response(JSON.stringify({
            success: true,
            instance,
            rewards
        }), {
            status: 200,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Complete room error:', error);
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
 * Complete dungeon
 * POST /game/dungeons/complete
 * Authentication handled by route wrapper
 */
async function handleCompleteDungeon(request: Request, env: Env, userId: string, customerId: string | null): Promise<Response> {
    try {
        const body = await request.json() as { instanceId?: string };
        const { instanceId } = body;

        if (!instanceId) {
            return new Response(JSON.stringify({
                error: 'Bad Request',
                message: 'instanceId is required'
            }), {
                status: 400,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Get instance using entity pattern
        const instance = await getEntity<DungeonInstance>(env.OTP_AUTH_KV, 'otp-auth', 'dungeon-instance', instanceId);

        if (!instance) {
            return new Response(JSON.stringify({
                error: 'Not Found',
                message: 'Dungeon instance not found'
            }), {
                status: 404,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Add completion bonus
        const completionBonus = getCompletionBonus(instance.difficulty);
        instance.collectedRewards.experience += completionBonus.experience;
        instance.collectedRewards.gold += completionBonus.gold;

        // Mark as completed
        instance.status = 'completed';
        instance.completedAt = new Date().toISOString();

        // Update instance using entity pattern
        await putEntity(env.OTP_AUTH_KV, 'otp-auth', 'dungeon-instance', instanceId, instance, {
            expirationTtl: 60 * 60 * 24 * 7 // Keep for 7 days
        });

        // TODO: Add rewards to character inventory

        return new Response(JSON.stringify({
            success: true,
            finalRewards: instance.collectedRewards,
            instance
        }), {
            status: 200,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Complete dungeon error:', error);
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
 * Get dungeon instances
 * GET /game/dungeons/instances?characterId=123
 * Authentication handled by route wrapper
 */
async function handleGetDungeonInstances(request: Request, env: Env, userId: string, customerId: string | null): Promise<Response> {
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

        // Get instance IDs using index
        const instanceIds = await indexGet<string[]>(env.OTP_AUTH_KV, 'otp-auth', 'character-dungeon-instances', characterId) || [];

        // Load all instances
        const instances: DungeonInstance[] = [];
        for (const instanceId of instanceIds) {
            const instance = await getEntity<DungeonInstance>(env.OTP_AUTH_KV, 'otp-auth', 'dungeon-instance', instanceId);
            if (instance && instance.status === 'in_progress') {
                instances.push(instance);
            }
        }

        return new Response(JSON.stringify({
            success: true,
            instances
        }), {
            status: 200,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Get dungeon instances error:', error);
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
 * Generate room rewards
 */
function generateRoomRewards(difficulty: Difficulty): RoomRewards {
    const multipliers: Record<Difficulty, number> = {
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
function getCompletionBonus(difficulty: Difficulty): { experience: number; gold: number } {
    const bonuses: Record<Difficulty, { experience: number; gold: number }> = {
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
export async function handleGameDungeons(request: Request, env: Env, userId: string, customerId: string | null, action: string): Promise<Response> {
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
        headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
    });
}
