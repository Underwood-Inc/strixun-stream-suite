/**
 * Inventory Handler
 * 
 * Handles inventory management, item operations, and equipment
 * Authentication is handled by the route wrapper with automatic encryption
 */

import { getCorsHeaders } from '../../utils/cors.js';
import { getCustomerKey } from '../../utils/customer.js';

/**
 * Get inventory
 * GET /game/inventory?characterId=123
 * Authentication handled by route wrapper
 */
async function handleGetInventory(request, env, userId, customerId) {
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

        // Get inventory
        const inventoryKey = getCustomerKey(customerId, `inventory_${characterId}`);
        const inventory = await env.GAME_KV.get(inventoryKey, { type: 'json' }) || {
            characterId,
            maxSlots: 20,
            slots: [],
            usedSlots: 0,
            freeSlots: 20
        };

        // Get equipment
        const equipmentKey = getCustomerKey(customerId, `equipment_${characterId}`);
        const equipment = await env.GAME_KV.get(equipmentKey, { type: 'json' }) || {
            characterId,
            slots: {}
        };

        return new Response(JSON.stringify({
            success: true,
            inventory,
            equipment
        }), {
            status: 200,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Get inventory error:', error);
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
 * Add item to inventory
 * POST /game/inventory/item
 * Authentication handled by route wrapper
 */
async function handleAddItem(request, env, userId, customerId) {
    try {

        const body = await request.json();
        const { characterId, item } = body;

        if (!characterId || !item) {
            return new Response(JSON.stringify({
                error: 'Bad Request',
                message: 'characterId and item are required'
            }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Get inventory
        const inventoryKey = getCustomerKey(customerId, `inventory_${characterId}`);
        const inventory = await env.GAME_KV.get(inventoryKey, { type: 'json' }) || {
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
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Add item to first empty slot
        const itemId = `item_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const slot = {
            slotIndex: inventory.slots.length,
            itemId,
            quantity: item.quantity || 1,
            isEmpty: false
        };

        inventory.slots.push(slot);
        inventory.usedSlots += 1;
        inventory.freeSlots = inventory.maxSlots - inventory.usedSlots;

        // Store item
        const itemKey = getCustomerKey(customerId, `item_${itemId}`);
        await env.GAME_KV.put(itemKey, JSON.stringify({
            id: itemId,
            ...item,
            ownerCharacterId: characterId,
            createdAt: new Date().toISOString()
        }), {
            expirationTtl: 60 * 60 * 24 * 365
        });

        // Update inventory
        await env.GAME_KV.put(inventoryKey, JSON.stringify(inventory), {
            expirationTtl: 60 * 60 * 24 * 365
        });

        return new Response(JSON.stringify({
            success: true,
            itemId,
            slot,
            inventory
        }), {
            status: 200,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Add item error:', error);
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
 * Remove item from inventory
 * DELETE /game/inventory/item?itemId=123
 * Authentication handled by route wrapper
 */
async function handleRemoveItem(request, env, userId, customerId) {
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
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Get inventory
        const inventoryKey = getCustomerKey(customerId, `inventory_${characterId}`);
        const inventory = await env.GAME_KV.get(inventoryKey, { type: 'json' });

        if (!inventory) {
            return new Response(JSON.stringify({
                error: 'Not Found',
                message: 'Inventory not found'
            }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
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
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
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

        // Delete item
        const itemKey = getCustomerKey(customerId, `item_${itemId}`);
        await env.GAME_KV.delete(itemKey);

        // Update inventory
        await env.GAME_KV.put(inventoryKey, JSON.stringify(inventory), {
            expirationTtl: 60 * 60 * 24 * 365
        });

        return new Response(JSON.stringify({
            success: true,
            inventory
        }), {
            status: 200,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Remove item error:', error);
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
 * Equip item
 * POST /game/inventory/equip
 * Authentication handled by route wrapper
 */
async function handleEquipItem(request, env, userId, customerId) {
    try {

        const body = await request.json();
        const { characterId, itemId, slot } = body;

        if (!characterId || !itemId || !slot) {
            return new Response(JSON.stringify({
                error: 'Bad Request',
                message: 'characterId, itemId, and slot are required'
            }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Get equipment
        const equipmentKey = getCustomerKey(customerId, `equipment_${characterId}`);
        const equipment = await env.GAME_KV.get(equipmentKey, { type: 'json' }) || {
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

        // Update equipment
        await env.GAME_KV.put(equipmentKey, JSON.stringify(equipment), {
            expirationTtl: 60 * 60 * 24 * 365
        });

        return new Response(JSON.stringify({
            success: true,
            equipment
        }), {
            status: 200,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Equip item error:', error);
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
export async function handleGameInventory(request, env, userId, customerId, action) {
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
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
}


