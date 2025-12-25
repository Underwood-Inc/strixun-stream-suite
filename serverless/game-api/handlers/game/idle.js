/**
 * Idle Mechanics Handler
 * 
 * Handles idle progress, activity management, and reward claims
 * Authentication is handled by the route wrapper with automatic encryption
 */

import { getCorsHeaders } from '../../utils/cors.js';
import { getCustomerKey } from '../../utils/customer.js';

/**
 * Get idle progress
 * GET /game/idle/progress
 * Authentication handled by route wrapper
 */
async function handleGetIdleProgress(request, env, userId, customerId) {
    try {

        // Get character's last active time
        const characterKey = getCustomerKey(customerId, `character_${userId}_active`);
        const characterData = await env.GAME_KV.get(characterKey, { type: 'json' });

        if (!characterData || !characterData.lastActiveAt) {
            return new Response(JSON.stringify({
                success: true,
                offlineHours: 0,
                rewards: {
                    gold: 0,
                    experience: 0,
                    materials: {}
                }
            }), {
                status: 200,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        const lastActive = new Date(characterData.lastActiveAt);
        const now = new Date();
        const offlineMs = now - lastActive;
        const offlineHours = Math.min(offlineMs / (1000 * 60 * 60), 24); // Cap at 24 hours

        // Get active activities
        const activitiesKey = getCustomerKey(customerId, `idle_activities_${userId}`);
        const activities = await env.GAME_KV.get(activitiesKey, { type: 'json' }) || [];

        // Calculate rewards based on activities
        const rewards = calculateIdleRewards(offlineHours, activities, customerId);

        return new Response(JSON.stringify({
            success: true,
            offlineHours,
            cappedHours: offlineHours,
            lastActiveAt: characterData.lastActiveAt,
            activeActivities: activities,
            rewards
        }), {
            status: 200,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Get idle progress error:', error);
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
 * Claim idle rewards
 * POST /game/idle/claim
 * Authentication handled by route wrapper
 */
async function handleClaimIdleRewards(request, env, userId, customerId) {
    try {

        const body = await request.json();
        const { slotIndex } = body; // Optional: claim specific slot, or all if not provided

        // Get progress
        const progressResponse = await handleGetIdleProgress(request, env, userId, customerId);
        const progressData = await progressResponse.json();

        if (!progressData.success) {
            return progressResponse;
        }

        // Update last active time (reset offline progress)
        const characterKey = getCustomerKey(customerId, `character_${userId}_active`);
        await env.GAME_KV.put(characterKey, JSON.stringify({
            lastActiveAt: new Date().toISOString()
        }), {
            expirationTtl: 60 * 60 * 24 * 365
        });

        // TODO: Add rewards to character inventory/currency
        // This would integrate with inventory system

        return new Response(JSON.stringify({
            success: true,
            claimed: progressData.rewards,
            message: 'Rewards claimed successfully'
        }), {
            status: 200,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Claim idle rewards error:', error);
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
 * Start idle activity
 * POST /game/idle/activity/start
 * Authentication handled by route wrapper
 */
async function handleStartIdleActivity(request, env, userId, customerId) {
    try {

        const body = await request.json();
        const { activityId, slotIndex } = body;

        if (!activityId) {
            return new Response(JSON.stringify({
                error: 'Bad Request',
                message: 'activityId is required'
            }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Get current activities
        const activitiesKey = getCustomerKey(customerId, `idle_activities_${userId}`);
        const activities = await env.GAME_KV.get(activitiesKey, { type: 'json' }) || [];

        // Check slot limits based on subscription
        const maxSlots = getMaxIdleSlots(customerId); // Would get from customer data
        if (activities.length >= maxSlots) {
            return new Response(JSON.stringify({
                error: 'Limit Reached',
                message: `Maximum ${maxSlots} idle activities allowed`
            }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Add activity
        const activity = {
            id: activityId,
            startedAt: new Date().toISOString(),
            slotIndex: slotIndex || activities.length
        };

        activities.push(activity);

        await env.GAME_KV.put(activitiesKey, JSON.stringify(activities), {
            expirationTtl: 60 * 60 * 24 * 365
        });

        return new Response(JSON.stringify({
            success: true,
            activity,
            slotIndex: activity.slotIndex
        }), {
            status: 200,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Start idle activity error:', error);
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
 * Stop idle activity
 * POST /game/idle/activity/stop
 * Authentication handled by route wrapper
 */
async function handleStopIdleActivity(request, env, userId, customerId) {
    try {

        const body = await request.json();
        const { slotIndex } = body;

        if (slotIndex === undefined) {
            return new Response(JSON.stringify({
                error: 'Bad Request',
                message: 'slotIndex is required'
            }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Get current activities
        const activitiesKey = getCustomerKey(customerId, `idle_activities_${userId}`);
        const activities = await env.GAME_KV.get(activitiesKey, { type: 'json' }) || [];

        // Find and remove activity
        const activityIndex = activities.findIndex(a => a.slotIndex === slotIndex);
        if (activityIndex === -1) {
            return new Response(JSON.stringify({
                error: 'Not Found',
                message: 'Activity not found in slot'
            }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        const activity = activities[activityIndex];
        activities.splice(activityIndex, 1);

        await env.GAME_KV.put(activitiesKey, JSON.stringify(activities), {
            expirationTtl: 60 * 60 * 24 * 365
        });

        // Calculate rewards for the activity duration
        const startedAt = new Date(activity.startedAt);
        const now = new Date();
        const hours = (now - startedAt) / (1000 * 60 * 60);
        const rewards = calculateActivityRewards(activity.id, hours);

        return new Response(JSON.stringify({
            success: true,
            rewards,
            stoppedAt: now.toISOString()
        }), {
            status: 200,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Stop idle activity error:', error);
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
 * Calculate idle rewards
 */
function calculateIdleRewards(offlineHours, activities, customerId) {
    const multiplier = getIdleMultiplier(customerId);
    const rewards = {
        gold: 0,
        experience: 0,
        materials: {}
    };

    // Base offline rewards
    rewards.gold = Math.floor(20 * offlineHours * multiplier);
    rewards.experience = Math.floor(50 * offlineHours * multiplier);

    // Activity-specific rewards
    activities.forEach(activity => {
        const activityRewards = calculateActivityRewards(activity.id, offlineHours);
        rewards.gold += activityRewards.gold;
        rewards.experience += activityRewards.experience;
        Object.entries(activityRewards.materials || {}).forEach(([key, value]) => {
            rewards.materials[key] = (rewards.materials[key] || 0) + value;
        });
    });

    return rewards;
}

/**
 * Calculate activity-specific rewards
 */
function calculateActivityRewards(activityId, hours) {
    const rates = {
        auto_mining: { gold: 10, experience: 30, materials: { iron_ore: 3, copper_ore: 1 } },
        auto_woodcutting: { gold: 8, experience: 25, materials: { wood: 5 } },
        auto_fishing: { gold: 12, experience: 35, materials: { fish: 4 } },
        auto_combat: { gold: 15, experience: 50, materials: { leather: 2 } },
        auto_crafting: { gold: 5, experience: 20, materials: {} }
    };

    const rate = rates[activityId] || rates.auto_mining;
    
    return {
        gold: Math.floor(rate.gold * hours),
        experience: Math.floor(rate.experience * hours),
        materials: Object.fromEntries(
            Object.entries(rate.materials).map(([key, value]) => [key, Math.floor(value * hours)])
        )
    };
}

/**
 * Get idle multiplier based on subscription
 */
function getIdleMultiplier(customerId) {
    // Would get from customer data
    // For now, return base multiplier
    return 1.0;
}

/**
 * Get max idle slots based on subscription
 */
function getMaxIdleSlots(customerId) {
    // Would get from customer data
    // For now, return base slots
    return 1;
}

/**
 * Main handler dispatcher
 */
export async function handleGameIdle(request, env, userId, customerId, action) {
    if (action === 'progress') {
        return await handleGetIdleProgress(request, env, userId, customerId);
    } else if (action === 'claim') {
        return await handleClaimIdleRewards(request, env, userId, customerId);
    } else if (action === 'start') {
        return await handleStartIdleActivity(request, env, userId, customerId);
    } else if (action === 'stop') {
        return await handleStopIdleActivity(request, env, userId, customerId);
    }

    return new Response(JSON.stringify({
        error: 'Bad Request',
        message: 'Invalid action'
    }), {
        status: 400,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
}


