/**
 * KV Entities - Key Builders
 * 
 * Simple, consistent key patterns. No string manipulation bullshit.
 * 
 * Entity keys:  {service}:{entity}:{id}
 * Index keys:   idx:{service}:{relationship}:{parentId}
 */

import type { ServiceId, EntityKey, IndexKey } from './types.js';

/**
 * Build an entity key
 * 
 * @example
 * entityKey('mods', 'mod', 'abc123')
 * // Returns: { key: 'mods:mod:abc123', service: 'mods', entity: 'mod', id: 'abc123' }
 */
export function entityKey(service: ServiceId, entity: string, id: string): EntityKey {
    return {
        key: `${service}:${entity}:${id}`,
        service,
        entity,
        id
    };
}

/**
 * Build an index key
 * 
 * @example
 * indexKey('mods', 'by-customer', 'cust_123')
 * // Returns: { key: 'idx:mods:by-customer:cust_123', ... }
 * 
 * indexKey('mods', 'versions-for', 'mod_abc')
 * // Returns: { key: 'idx:mods:versions-for:mod_abc', ... }
 */
export function indexKey(service: ServiceId, relationship: string, parentId: string): IndexKey {
    return {
        key: `idx:${service}:${relationship}:${parentId}`,
        service,
        relationship,
        parentId
    };
}

/**
 * Parse an entity key back to components
 * Returns null if key doesn't match expected pattern
 */
export function parseEntityKey(key: string): EntityKey | null {
    const parts = key.split(':');
    if (parts.length !== 3) return null;
    
    const [service, entity, id] = parts;
    return {
        key,
        service: service as ServiceId,
        entity,
        id
    };
}

/**
 * Parse an index key back to components
 * Returns null if key doesn't match expected pattern
 */
export function parseIndexKey(key: string): IndexKey | null {
    const parts = key.split(':');
    if (parts.length !== 4 || parts[0] !== 'idx') return null;
    
    const [, service, relationship, parentId] = parts;
    return {
        key,
        service: service as ServiceId,
        relationship,
        parentId
    };
}

/**
 * Common entity key builders for convenience
 */
export const Keys = {
    // Mods service
    mod: (id: string) => entityKey('mods', 'mod', id),
    version: (id: string) => entityKey('mods', 'version', id),
    variant: (id: string) => entityKey('mods', 'variant', id),
    
    // Customer service
    customer: (id: string) => entityKey('customer', 'profile', id),
    customerSettings: (id: string) => entityKey('customer', 'settings', id),
    
    // Access service
    permission: (id: string) => entityKey('access', 'permission', id),
    accessDefinition: (id: string) => entityKey('access', 'definition', id),
    
    // Auth service
    session: (id: string) => entityKey('auth', 'session', id),
    otp: (email: string) => entityKey('auth', 'otp', email),
    
    // Streamkit service
    streamkitConfig: (customerId: string) => entityKey('streamkit', 'config', customerId),
};

/**
 * Common index key builders for convenience
 */
export const Indexes = {
    // Mods indexes
    modsByCustomer: (customerId: string) => indexKey('mods', 'by-customer', customerId),
    publicMods: () => indexKey('mods', 'by-visibility', 'public'),
    versionsByMod: (modId: string) => indexKey('mods', 'versions-for', modId),
    versionsByVariant: (variantId: string) => indexKey('mods', 'versions-for-variant', variantId),
    variantsByMod: (modId: string) => indexKey('mods', 'variants-for', modId),
    modBySlug: (slug: string) => indexKey('mods', 'by-slug', slug),
    
    // Customer indexes
    customerByEmail: (email: string) => indexKey('customer', 'by-email', email),
    
    // Access indexes
    permissionsByCustomer: (customerId: string) => indexKey('access', 'by-customer', customerId),
};
