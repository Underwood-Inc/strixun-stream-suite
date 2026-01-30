/**
 * KV Entities - Access Control
 * 
 * Permission checking based on entity data, not key structure.
 * The entity contains customerId and visibility - use those for access decisions.
 */

import type { AccessContext, OwnedEntity, VisibleEntity } from './types.js';

/**
 * Check if a user can access an owned entity
 * 
 * Rules:
 * - Owner (customerId matches) can always access
 * - Admins can always access
 * - Otherwise, denied
 * 
 * @example
 * if (!canAccessOwned(mod, { customerId: auth.customerId, isAdmin })) {
 *   return 403;
 * }
 */
export function canAccessOwned(
    entity: OwnedEntity,
    context: AccessContext
): boolean {
    // Admins can access everything
    if (context.isAdmin) {
        return true;
    }
    
    // Owner can access their own entities
    if (context.customerId && entity.customerId === context.customerId) {
        return true;
    }
    
    return false;
}

/**
 * Check if a user can access an entity with visibility
 * 
 * Rules:
 * - Public entities: anyone can access
 * - Unlisted entities: anyone with the link can access
 * - Private entities: only owner and admins
 * 
 * @example
 * if (!canAccessVisible(mod, { customerId: auth.customerId, isAdmin })) {
 *   return 403;
 * }
 */
export function canAccessVisible(
    entity: VisibleEntity,
    context: AccessContext
): boolean {
    // Public and unlisted are accessible to all
    if (entity.visibility === 'public' || entity.visibility === 'unlisted') {
        return true;
    }
    
    // Private: fall back to ownership check
    return canAccessOwned(entity, context);
}

/**
 * Check if a user can modify an entity (create, update, delete)
 * 
 * Rules:
 * - Owner can modify their own entities
 * - Admins can modify any entity
 * 
 * @example
 * if (!canModify(mod, { customerId: auth.customerId, isAdmin })) {
 *   return 403;
 * }
 */
export function canModify(
    entity: OwnedEntity,
    context: AccessContext
): boolean {
    // Must be authenticated
    if (!context.customerId && !context.isAdmin) {
        return false;
    }
    
    // Admins can modify anything
    if (context.isAdmin) {
        return true;
    }
    
    // Owner can modify their own entities
    return entity.customerId === context.customerId;
}

/**
 * Check if a user can delete an entity
 * Same rules as modify for now, but separate function for future flexibility
 */
export function canDelete(
    entity: OwnedEntity,
    context: AccessContext
): boolean {
    return canModify(entity, context);
}

/**
 * Filter a list of entities to only those the user can access
 * 
 * @example
 * const accessibleMods = filterAccessible(allMods, { customerId, isAdmin });
 */
export function filterAccessible<T extends VisibleEntity>(
    entities: T[],
    context: AccessContext
): T[] {
    return entities.filter(entity => canAccessVisible(entity, context));
}

/**
 * Filter a list of owned entities to only those the user can access
 * (For entities without visibility field)
 */
export function filterAccessibleOwned<T extends OwnedEntity>(
    entities: T[],
    context: AccessContext
): T[] {
    return entities.filter(entity => canAccessOwned(entity, context));
}

/**
 * Assert access and throw if denied
 * 
 * @example
 * assertAccess(mod, context, 'view');
 */
export function assertAccess(
    entity: VisibleEntity | OwnedEntity,
    context: AccessContext,
    action: 'view' | 'modify' | 'delete'
): void {
    let allowed = false;
    
    if (action === 'view') {
        allowed = 'visibility' in entity 
            ? canAccessVisible(entity as VisibleEntity, context)
            : canAccessOwned(entity as OwnedEntity, context);
    } else if (action === 'modify') {
        allowed = canModify(entity as OwnedEntity, context);
    } else if (action === 'delete') {
        allowed = canDelete(entity as OwnedEntity, context);
    }
    
    if (!allowed) {
        const error = new Error(`Access denied: cannot ${action} entity`);
        (error as any).status = 403;
        throw error;
    }
}
