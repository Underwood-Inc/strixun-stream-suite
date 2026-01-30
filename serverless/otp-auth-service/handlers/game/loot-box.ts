/**
 * Daily Loot Box Handler
 * 
 * Handles daily loot box claims and status
 * Authentication is handled by the route wrapper with automatic encryption
 */

import { getCorsHeadersRecord } from '../../utils/cors.js';
import { getEntity, putEntity } from '@strixun/kv-entities';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    ENVIRONMENT?: string;
}

interface StreakData {
    currentStreak: number;
    longestStreak: number;
    lastClaimedAt: string | null;
}

interface LootBoxRewards {
    gold: number;
    experience: number;
    materials: Record<string, number>;
    items: Array<{ itemTemplateId: string; quantity: number; rarity: string }>;
}

interface ClaimRecord {
    userId: string;
    claimedAt: string;
    rewards: LootBoxRewards;
    streak: number;
    streakBonus: number;
}

/**
 * Get loot box status
 * GET /game/loot-box/status
 * Authentication handled by route wrapper
 */
async function handleGetLootBoxStatus(request: Request, env: Env, userId: string, customerId: string | null): Promise<Response> {
    try {
        // Get streak data using entity pattern
        const streakData: StreakData = await getEntity(env.OTP_AUTH_KV, 'otp-auth', 'loot-box-streak', userId) || {
            currentStreak: 0,
            longestStreak: 0,
            lastClaimedAt: null
        };

        // Check if daily box is available
        const today = new Date().toISOString().split('T')[0];
        const lastClaimed = streakData.lastClaimedAt 
            ? new Date(streakData.lastClaimedAt).toISOString().split('T')[0]
            : null;

        const isAvailable = lastClaimed !== today;
        const nextAvailableAt = isAvailable 
            ? new Date().toISOString()
            : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        // Calculate streak bonus
        let streakBonus = 1.0;
        if (streakData.currentStreak >= 31) {
            streakBonus = 2.0; // Legendary
        } else if (streakData.currentStreak >= 15) {
            streakBonus = 1.5; // Loyal
        } else if (streakData.currentStreak >= 8) {
            streakBonus = 1.25; // Committed
        } else if (streakData.currentStreak >= 4) {
            streakBonus = 1.1; // Dedicated
        }

        return new Response(JSON.stringify({
            success: true,
            available: isAvailable,
            nextAvailableAt,
            streak: {
                current: streakData.currentStreak,
                longest: streakData.longestStreak,
                bonus: streakBonus
            }
        }), {
            status: 200,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Get loot box status error:', error);
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
 * Claim daily loot box
 * POST /game/loot-box/claim
 * Authentication handled by route wrapper
 */
async function handleClaimLootBox(request: Request, env: Env, userId: string, customerId: string | null): Promise<Response> {
    try {
        // Get streak data using entity pattern
        const streakData: StreakData = await getEntity(env.OTP_AUTH_KV, 'otp-auth', 'loot-box-streak', userId) || {
            currentStreak: 0,
            longestStreak: 0,
            lastClaimedAt: null
        };

        // Check if already claimed today
        const today = new Date().toISOString().split('T')[0];
        const lastClaimed = streakData.lastClaimedAt 
            ? new Date(streakData.lastClaimedAt).toISOString().split('T')[0]
            : null;

        if (lastClaimed === today) {
            return new Response(JSON.stringify({
                error: 'Already Claimed',
                message: 'Daily loot box already claimed today'
            }), {
                status: 400,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Update streak
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        let newStreak = 1;
        
        if (lastClaimed === yesterday) {
            // Consecutive day
            newStreak = streakData.currentStreak + 1;
        } else if (lastClaimed && lastClaimed !== today && lastClaimed !== yesterday) {
            // Streak broken
            newStreak = 1;
        }

        const longestStreak = Math.max(newStreak, streakData.longestStreak || 0);

        // Calculate streak bonus
        let streakBonus = 1.0;
        if (newStreak >= 31) {
            streakBonus = 2.0;
        } else if (newStreak >= 15) {
            streakBonus = 1.5;
        } else if (newStreak >= 8) {
            streakBonus = 1.25;
        } else if (newStreak >= 4) {
            streakBonus = 1.1;
        }

        // Generate rewards (simplified - would use actual loot table system)
        const rewards = generateLootBoxRewards(streakBonus);

        // Update streak using entity pattern
        await putEntity(env.OTP_AUTH_KV, 'otp-auth', 'loot-box-streak', userId, {
            currentStreak: newStreak,
            longestStreak,
            lastClaimedAt: new Date().toISOString()
        }, {
            expirationTtl: 60 * 60 * 24 * 365 // 1 year
        });

        // Store claim record using entity pattern
        const claimRecord: ClaimRecord = {
            userId,
            claimedAt: new Date().toISOString(),
            rewards,
            streak: newStreak,
            streakBonus
        };
        await putEntity(env.OTP_AUTH_KV, 'otp-auth', 'loot-box-claim', `${userId}_${today}`, claimRecord, {
            expirationTtl: 60 * 60 * 24 * 7 // 7 days
        });

        return new Response(JSON.stringify({
            success: true,
            rewards,
            streak: {
                current: newStreak,
                longest: longestStreak,
                bonus: streakBonus
            },
            nextAvailableAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        }), {
            status: 200,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Claim loot box error:', error);
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
 * Generate loot box rewards based on streak bonus
 */
function generateLootBoxRewards(streakBonus: number): LootBoxRewards {
    const roll = Math.random() * 100;
    
    let rarity = 'common';
    if (roll < 0.1) {
        rarity = 'unique';
    } else if (roll < 1.0) {
        rarity = 'legendary';
    } else if (roll < 5.0) {
        rarity = 'epic';
    } else if (roll < 15.0) {
        rarity = 'rare';
    } else if (roll < 40.0) {
        rarity = 'uncommon';
    }

    // Base rewards
    const baseGold = 100;
    const baseExp = 50;
    const baseMaterials = 5;

    const rewards: LootBoxRewards = {
        gold: Math.floor(baseGold * streakBonus),
        experience: Math.floor(baseExp * streakBonus),
        materials: {
            iron_ore: Math.floor(baseMaterials * streakBonus)
        },
        items: []
    };

    // Add item based on rarity
    if (rarity !== 'common') {
        rewards.items.push({
            itemTemplateId: `equipment_${rarity}`,
            quantity: 1,
            rarity
        });
    }

    return rewards;
}

/**
 * Main handler dispatcher
 */
export async function handleGameLootBox(request: Request, env: Env, userId: string, customerId: string | null, action: string): Promise<Response> {
    if (action === 'claim') {
        return await handleClaimLootBox(request, env, userId, customerId);
    } else if (action === 'status') {
        return await handleGetLootBoxStatus(request, env, userId, customerId);
    }

    return new Response(JSON.stringify({
        error: 'Bad Request',
        message: 'Invalid action'
    }), {
        status: 400,
        headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
    });
}
