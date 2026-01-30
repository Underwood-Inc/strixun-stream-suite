/**
 * Loot Generation Handler
 * 
 * Handles Path of Exile-style loot generation
 * Authentication is handled by the route wrapper with automatic encryption
 */

import { getCorsHeadersRecord } from '../../utils/cors.js';
import { getEntity } from '@strixun/kv-entities';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    ENVIRONMENT?: string;
}

interface LootTable {
    id: string;
    name: string;
    itemLevel: number;
    baseRarity?: string;
    dropChances?: Record<string, number>;
    modifierCounts?: Record<string, { minPrefixes: number; maxPrefixes: number; minSuffixes: number; maxSuffixes: number }>;
    baseStats?: Record<string, number>;
}

interface Modifier {
    name: string;
    tier: number;
    stats: Record<string, number>;
}

interface GeneratedItem {
    template: {
        id: number;
        itemCode: string;
        displayName: string;
        description: string;
        itemType: string;
        rarity: string;
        baseStats: Record<string, number>;
        maxStack: number;
        isTradeable: boolean;
        isCraftable: boolean;
        requiredLevel: number;
        baseSellPrice: number;
        isActive: boolean;
    };
    baseName: string;
    fullName: string;
    rarity: string;
    itemLevel: number;
    prefixes: Modifier[];
    suffixes: Modifier[];
    finalStats: Record<string, number>;
    colorPalette: { primary: string; secondary: string; glow?: string };
    generatedAt: string;
    seed?: number;
}

/**
 * Generate loot item
 * POST /game/loot/generate
 * Authentication handled by route wrapper
 */
async function handleGenerateLoot(request: Request, env: Env, userId: string, customerId: string | null): Promise<Response> {
    try {
        const body = await request.json() as { lootTableId?: string; options?: { forcedRarity?: string; itemLevel?: number; seed?: number } };
        const { lootTableId, options = {} } = body;

        if (!lootTableId) {
            return new Response(JSON.stringify({
                error: 'Bad Request',
                message: 'lootTableId is required'
            }), {
                status: 400,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Get loot table using entity pattern
        const lootTable = await getEntity<LootTable>(env.OTP_AUTH_KV, 'otp-auth', 'loot-table', lootTableId);

        if (!lootTable) {
            // Use default loot table if not found
            const defaultLootTable = getDefaultLootTable(lootTableId);
            if (!defaultLootTable) {
                return new Response(JSON.stringify({
                    error: 'Not Found',
                    message: 'Loot table not found'
                }), {
                    status: 404,
                    headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
                });
            }
            return generateLootItem(defaultLootTable, options, env, request);
        }

        return generateLootItem(lootTable, options, env, request);
    } catch (error) {
        console.error('Generate loot error:', error);
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
 * Get available loot tables
 * GET /game/loot/tables
 * Authentication handled by route wrapper
 */
async function handleGetLootTables(request: Request, env: Env, userId: string, customerId: string | null): Promise<Response> {
    try {
        // Return default loot tables
        const lootTables = [
            {
                id: 'common',
                name: 'Common Loot',
                itemLevel: 1,
                description: 'Basic loot table for low-level content'
            },
            {
                id: 'rare',
                name: 'Rare Loot',
                itemLevel: 25,
                description: 'Enhanced loot table with better modifiers'
            },
            {
                id: 'epic',
                name: 'Epic Loot',
                itemLevel: 50,
                description: 'High-tier loot table for end-game content'
            },
            {
                id: 'legendary',
                name: 'Legendary Loot',
                itemLevel: 75,
                description: 'Ultra-rare loot table for challenging content'
            }
        ];

        return new Response(JSON.stringify({
            success: true,
            lootTables
        }), {
            status: 200,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Get loot tables error:', error);
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
 * Generate loot item from loot table
 */
async function generateLootItem(lootTable: LootTable, options: { forcedRarity?: string; itemLevel?: number; seed?: number }, env: Env, request: Request): Promise<Response> {
    // Roll rarity
    const rarity = rollRarity(lootTable, options.forcedRarity);

    // Generate modifiers
    const modifiers = generateModifiers(lootTable, rarity, options.itemLevel || lootTable.itemLevel);

    // Calculate final stats
    const finalStats = calculateFinalStats(lootTable.baseStats || {}, modifiers);

    // Generate item name
    const fullName = generateItemName(lootTable.name, modifiers.prefixes, modifiers.suffixes);

    // Create generated item
    const generatedItem: GeneratedItem = {
        template: {
            id: 0,
            itemCode: `${lootTable.id}_${rarity}`,
            displayName: lootTable.name,
            description: `Generated ${rarity} item`,
            itemType: 'equipment',
            rarity,
            baseStats: lootTable.baseStats || {},
            maxStack: 1,
            isTradeable: true,
            isCraftable: false,
            requiredLevel: options.itemLevel || lootTable.itemLevel,
            baseSellPrice: calculateBasePrice(rarity, options.itemLevel || lootTable.itemLevel),
            isActive: true
        },
        baseName: lootTable.name,
        fullName,
        rarity,
        itemLevel: options.itemLevel || lootTable.itemLevel,
        prefixes: modifiers.prefixes,
        suffixes: modifiers.suffixes,
        finalStats,
        colorPalette: getRarityColorPalette(rarity),
        generatedAt: new Date().toISOString(),
        seed: options.seed
    };

    return new Response(JSON.stringify({
        success: true,
        item: generatedItem
    }), {
        status: 200,
        headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
    });
}

/**
 * Roll rarity based on drop chances
 */
function rollRarity(lootTable: LootTable, forcedRarity?: string): string {
    if (forcedRarity) return forcedRarity;

    const random = Math.random() * 100;
    let cumulative = 0;

    const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'unique'];
    const dropChances = lootTable.dropChances || {
        common: 60,
        uncommon: 25,
        rare: 10,
        epic: 4,
        legendary: 0.9,
        unique: 0.1
    };

    for (const rarity of rarities) {
        cumulative += dropChances[rarity] || 0;
        if (random <= cumulative) {
            return rarity;
        }
    }

    return 'common';
}

/**
 * Generate modifiers
 */
function generateModifiers(lootTable: LootTable, rarity: string, itemLevel: number): { prefixes: Modifier[]; suffixes: Modifier[] } {
    const modifierCounts = lootTable.modifierCounts || {
        common: { minPrefixes: 0, maxPrefixes: 0, minSuffixes: 0, maxSuffixes: 0 },
        uncommon: { minPrefixes: 0, maxPrefixes: 1, minSuffixes: 0, maxSuffixes: 1 },
        rare: { minPrefixes: 1, maxPrefixes: 2, minSuffixes: 1, maxSuffixes: 2 },
        epic: { minPrefixes: 2, maxPrefixes: 3, minSuffixes: 2, maxSuffixes: 3 },
        legendary: { minPrefixes: 3, maxPrefixes: 4, minSuffixes: 3, maxSuffixes: 4 },
        unique: { minPrefixes: 4, maxPrefixes: 6, minSuffixes: 4, maxSuffixes: 6 }
    };

    const counts = modifierCounts[rarity] || modifierCounts.common;
    const prefixCount = Math.floor(Math.random() * (counts.maxPrefixes - counts.minPrefixes + 1)) + counts.minPrefixes;
    const suffixCount = Math.floor(Math.random() * (counts.maxSuffixes - counts.minSuffixes + 1)) + counts.minSuffixes;

    const prefixes = generateModifierList('prefix', prefixCount, itemLevel);
    const suffixes = generateModifierList('suffix', suffixCount, itemLevel);

    return { prefixes, suffixes };
}

/**
 * Generate modifier list
 */
function generateModifierList(type: 'prefix' | 'suffix', count: number, itemLevel: number): Modifier[] {
    const modifiers: Modifier[] = [];
    const modifierPools: Record<string, Modifier[]> = {
        prefix: [
            { name: 'Fiery', tier: 3, stats: { fireDamage: 15, critChance: 5 } },
            { name: 'Thunderous', tier: 5, stats: { lightningDamage: 150, attackSpeed: 25 } },
            { name: 'Blessed', tier: 4, stats: { healthRegen: 30, experienceBonus: 15 } },
            { name: 'Void', tier: 5, stats: { attack: 200, critDamage: 50 } }
        ],
        suffix: [
            { name: 'of the Bear', tier: 2, stats: { strength: 20, health: 50 } },
            { name: 'of Power', tier: 4, stats: { intelligence: 75, spellDamage: 25 } },
            { name: 'of Annihilation', tier: 5, stats: { strength: 100, dexterity: 100, bossDamage: 50 } },
            { name: 'of Fortitude', tier: 4, stats: { health: 100, endurance: 50 } }
        ]
    };

    const pool = modifierPools[type] || [];
    for (let i = 0; i < count && i < pool.length; i++) {
        modifiers.push(pool[i]);
    }

    return modifiers;
}

/**
 * Calculate final stats
 */
function calculateFinalStats(baseStats: Record<string, number>, modifiers: { prefixes: Modifier[]; suffixes: Modifier[] }): Record<string, number> {
    const finalStats = { ...baseStats };

    [...modifiers.prefixes, ...modifiers.suffixes].forEach(modifier => {
        Object.entries(modifier.stats || {}).forEach(([key, value]) => {
            finalStats[key] = (finalStats[key] || 0) + value;
        });
    });

    return finalStats;
}

/**
 * Generate item name
 */
function generateItemName(baseName: string, prefixes: Modifier[], suffixes: Modifier[]): string {
    const parts: string[] = [];
    if (prefixes.length > 0) {
        parts.push(prefixes.map(p => p.name).join(' '));
    }
    parts.push(baseName);
    if (suffixes.length > 0) {
        parts.push(suffixes.map(s => s.name).join(' '));
    }
    return parts.join(' ');
}

/**
 * Calculate base price
 */
function calculateBasePrice(rarity: string, itemLevel: number): number {
    const multipliers: Record<string, number> = {
        common: 1,
        uncommon: 2,
        rare: 5,
        epic: 10,
        legendary: 25,
        unique: 50
    };

    return Math.floor(itemLevel * 10 * (multipliers[rarity] || 1));
}

/**
 * Get rarity color palette
 */
function getRarityColorPalette(rarity: string): { primary: string; secondary: string; glow?: string } {
    const palettes: Record<string, { primary: string; secondary: string; glow?: string }> = {
        common: { primary: '#9d9d9d', secondary: '#6b6b6b' },
        uncommon: { primary: '#1eff00', secondary: '#15cc00' },
        rare: { primary: '#0070dd', secondary: '#005ab1', glow: '#3f9fff' },
        epic: { primary: '#a335ee', secondary: '#8229be', glow: '#c05fff' },
        legendary: { primary: '#ff8000', secondary: '#cc6600', glow: '#ffab4f' },
        unique: { primary: '#e6cc80', secondary: '#b8a366', glow: '#fff0b3' }
    };

    return palettes[rarity] || palettes.common;
}

/**
 * Get default loot table
 */
function getDefaultLootTable(lootTableId: string): LootTable | null {
    const defaultTables: Record<string, LootTable> = {
        common: {
            id: 'common',
            name: 'Common Item',
            itemLevel: 1,
            baseRarity: 'common',
            dropChances: {
                common: 60,
                uncommon: 25,
                rare: 10,
                epic: 4,
                legendary: 0.9,
                unique: 0.1
            },
            modifierCounts: {
                common: { minPrefixes: 0, maxPrefixes: 0, minSuffixes: 0, maxSuffixes: 0 },
                uncommon: { minPrefixes: 0, maxPrefixes: 1, minSuffixes: 0, maxSuffixes: 1 },
                rare: { minPrefixes: 1, maxPrefixes: 2, minSuffixes: 1, maxSuffixes: 2 },
                epic: { minPrefixes: 2, maxPrefixes: 3, minSuffixes: 2, maxSuffixes: 3 },
                legendary: { minPrefixes: 3, maxPrefixes: 4, minSuffixes: 3, maxSuffixes: 4 },
                unique: { minPrefixes: 4, maxPrefixes: 6, minSuffixes: 4, maxSuffixes: 6 }
            },
            baseStats: {}
        }
    };

    return defaultTables[lootTableId] || defaultTables.common;
}

/**
 * Main handler dispatcher
 */
export async function handleGameLoot(request: Request, env: Env, userId: string, customerId: string | null, action: string): Promise<Response> {
    if (action === 'generate') {
        return await handleGenerateLoot(request, env, userId, customerId);
    } else if (action === 'tables') {
        return await handleGetLootTables(request, env, userId, customerId);
    }

    return new Response(JSON.stringify({
        error: 'Bad Request',
        message: 'Invalid action'
    }), {
        status: 400,
        headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
    });
}
