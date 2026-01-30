/**
 * Inventory Handler
 * 
 * Handles inventory management, item operations, and equipment
 * Authentication is handled by the route wrapper with automatic encryption
 */

import { getCorsHeadersRecord } from '../../utils/cors.js';
import { getEntity, putEntity, deleteEntity } from '@strixun/kv-entities';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    ENVIRONMENT?: string;
}

interface InventorySlot {
    slotIndex: number;
    itemId?: string;
    quantity: number;
    isEmpty: boolean;
}

interface Inventory {
    characterId: string;
    maxSlots: number;
    slots: InventorySlot[];
    usedSlots: number;
    freeSlots: number;
}

interface Equipment {
    characterId: string;
    slots: Record<string, string>;
}

interface Item {
    id: string;
    ownerCharacterId: string;
    createdAt: string;
    [key: string]: unknown;
}

/**
 * Get inventory
 * GET /game/inventory?characterId=123
 * Authentication handled by route wrapper
 */
async function handleGetInventory(request: Request, env: Env, userId: string, customerId: string | null): Promise<Response> {
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

        // Get inventory using entity pattern
        const inventory: Inventory = await getEntity(env.OTP_AUTH_KV, 'otp-auth', 'inventory', characterId) || {
            characterId,
            maxSlots: 20,
            slots: [],
            usedSlots: 0,
            freeSlots: 20
        };

        // Get equipment using entity pattern
        const equipment: Equipment = await getEntity(env.OTP_AUTH_KV, 'otp-auth', 'equipment', characterId) || {
            characterId,
            slots: {}
        };

        return new Response(JSON.stringify({
            success: true,
            inventory,
            equipment
        }), {
            status: 200,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Get inventory error:', error);
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
 * Add item to inventory
 * POST /game/inventory/item
 * Authentication handled by route wrapper
 */
async function handleAddItem(request: Request, env: Env, userId: string, customerId: string | null): Promise<Response> {
    try {
        const body = await request.json() as { characterId?: string; item?: { quantity?: number; [key: string]: unknown } };
        const { characterId, item } = body;

        if (!characterId || !item) {
            return new Response(JSON.stringify({
                error: 'Bad Request',
                message: 'characterId and item are required'
            }), {
                status: 400,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Get inventory using entity pattern
        const inventory: Inventory = await getEntity(env.OTP_AUTH_KV, 'otp-auth', 'inventory', characterId) || {
            characterId,
            maxSlots: 20,
            slots: [],
            usedSlots: 0,
            freeSlots: 20
        };

        // Check if there's space
        if (inventory.usedSlots >= inventory.maxSlots) {
            return new Response(JSON.stringify({
                error: 'Inventory Full',
                message: 'No space in inventory'
            }), {
                status: 400,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Add item to first empty slot
        const itemId = `item_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const slot: InventorySlot = {
            slotIndex: inventory.slots.length,
            itemId,
            quantity: item.quantity || 1,
            isEmpty: false
        };

        inventory.slots.push(slot);
        inventory.usedSlots += 1;
        inventory.freeSlots = inventory.maxSlots - inventory.usedSlots;

        // Store item using entity pattern
        const itemData: Item = {
            id: itemId,
            ...item,
            ownerCharacterId: characterId,
            createdAt: new Date().toISOString()
        };
        await putEntity(env.OTP_AUTH_KV, 'otp-auth', 'item', itemId, itemData, {
            expirationTtl: 60 * 60 * 24 * 365
        });

        // Update inventory using entity pattern
        await putEntity(env.OTP_AUTH_KV, 'otp-auth', 'inventory', characterId, inventory, {
            expirationTtl: 60 * 60 * 24 * 365
        });

        return new Response(JSON.stringify({
            success: true,
            itemId,
            slot,
            inventory
        }), {
            status: 200,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Add item error:', error);
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
 * Remove item from inventory
 * DELETE /game/inventory/item?itemId=123
 * Authentication handled by route wrapper
 */
async function handleRemoveItem(request: Request, env: Env, userId: string, customerId: string | null): Promise<Response> {
    try {
        const url = new URL(request.url);
        const itemId = url.searchParams.get('itemId');
        const characterId = url.searchParams.get('characterId');

        if (!itemId || !characterId) {
            return new Response(JSON.stringify({
                error: 'Bad Request',
                message: 'itemId and characterId query parameters are required'
            }), {
                status: 400,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Get inventory using entity pattern
        const inventory = await getEntity<Inventory>(env.OTP_AUTH_KV, 'otp-auth', 'inventory', characterId);

        if (!inventory) {
            return new Response(JSON.stringify({
                error: 'Not Found',
                message: 'Inventory not found'
            }), {
                status: 404,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Find and remove item
        const slotIndex = inventory.slots.findIndex(slot => slot.itemId === itemId);
        if (slotIndex === -1) {
            return new Response(JSON.stringify({
                error: 'Not Found',
                message: 'Item not found in inventory'
            }), {
                status: 404,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }

        inventory.slots[slotIndex] = {
            slotIndex,
            itemId: undefined,
            quantity: 0,
            isEmpty: true
        };
        inventory.usedSlots -= 1;
        inventory.freeSlots = inventory.maxSlots - inventory.usedSlots;

        // Delete item using entity pattern
        await deleteEntity(env.OTP_AUTH_KV, 'otp-auth', 'item', itemId);

        // Update inventory using entity pattern
        await putEntity(env.OTP_AUTH_KV, 'otp-auth', 'inventory', characterId, inventory, {
            expirationTtl: 60 * 60 * 24 * 365
        });

        return new Response(JSON.stringify({
            success: true,
            inventory
        }), {
            status: 200,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Remove item error:', error);
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
 * Equip item
 * POST /game/inventory/equip
 * Authentication handled by route wrapper
 */
async function handleEquipItem(request: Request, env: Env, userId: string, customerId: string | null): Promise<Response> {
    try {
        const body = await request.json() as { characterId?: string; itemId?: string; slot?: string };
        const { characterId, itemId, slot } = body;

        if (!characterId || !itemId || !slot) {
            return new Response(JSON.stringify({
                error: 'Bad Request',
                message: 'characterId, itemId, and slot are required'
            }), {
                status: 400,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Get equipment using entity pattern
        const equipment: Equipment = await getEntity(env.OTP_AUTH_KV, 'otp-auth', 'equipment', characterId) || {
            characterId,
            slots: {}
        };

        // Unequip existing item in slot if any
        const previousItemId = equipment.slots[slot];
        if (previousItemId) {
            // Return to inventory (would need inventory handler)
        }

        // Equip new item
        equipment.slots[slot] = itemId;

        // Update equipment using entity pattern
        await putEntity(env.OTP_AUTH_KV, 'otp-auth', 'equipment', characterId, equipment, {
            expirationTtl: 60 * 60 * 24 * 365
        });

        return new Response(JSON.stringify({
            success: true,
            equipment
        }), {
            status: 200,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Equip item error:', error);
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
export async function handleGameInventory(request: Request, env: Env, userId: string, customerId: string | null, action: string): Promise<Response> {
    if (action === 'get') {
        return await handleGetInventory(request, env, userId, customerId);
    } else if (action === 'add') {
        return await handleAddItem(request, env, userId, customerId);
    } else if (action === 'remove') {
        return await handleRemoveItem(request, env, userId, customerId);
    } else if (action === 'equip') {
        return await handleEquipItem(request, env, userId, customerId);
    }

    return new Response(JSON.stringify({
        error: 'Bad Request',
        message: 'Invalid action'
    }), {
        status: 400,
        headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
    });
}
