/**
 * Migration: Fix customer role upload permissions
 * 
 * PROBLEM: The 'customer' role was deployed with NO permissions, breaking all mod uploads
 * FIX: Update 'customer' role to include upload:mod, edit:mod-own, delete:mod-own
 */

import type { Migration } from '../../shared/migration-runner.js';

export const migration: Migration = {
    id: '001_fix_customer_upload_permissions',
    description: 'Add upload permissions to customer role',
    
    async up(kv): Promise<void> {
        console.log('[Migration 001] Fixing customer role permissions...');
        
        // Update the customer role definition in KV (using unified key pattern)
        const roleKey = 'access:role:customer';
        const customerRole = {
            name: 'customer',
            displayName: 'Customer',
            description: 'Basic customer access with mod upload capabilities',
            permissions: [
                'upload:mod',
                'edit:mod-own',
                'delete:mod-own',
            ],
            defaultQuotas: {
                'upload:mod': { limit: 10, period: 'day' },
            },
            priority: 10,
            version: 2,
        };
        
        await kv.put(roleKey, JSON.stringify(customerRole));
        
        console.log('[Migration 001] ✓ Customer role updated with upload permissions');
        console.log('[Migration 001] All customers with "customer" role will now have upload access');
    },
    
    async down(kv): Promise<void> {
        console.log('[Migration 001] Rolling back customer role permissions...');
        
        // Revert to broken state (for testing only - should never be needed in production)
        const roleKey = 'access:role:customer';
        const customerRole = {
            name: 'customer',
            displayName: 'Customer',
            description: 'Basic customer access',
            permissions: [],
            priority: 10,
            version: 1,
        };
        
        await kv.put(roleKey, JSON.stringify(customerRole));
        
        console.log('[Migration 001] ✓ Rolled back customer role');
    },
};
