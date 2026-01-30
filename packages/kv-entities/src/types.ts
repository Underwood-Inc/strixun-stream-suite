/**
 * KV Entities - Type Definitions
 * 
 * Core types for the unified entity storage pattern.
 */

/**
 * KVNamespace interface (Cloudflare Workers)
 * Defined here to avoid dependency on @cloudflare/workers-types
 */
export interface KVNamespace {
    get(key: string, options?: { type?: 'text' | 'json' | 'arrayBuffer' | 'stream' }): Promise<any>;
    put(key: string, value: string | ArrayBuffer | ReadableStream, options?: { expiration?: number; expirationTtl?: number; metadata?: any }): Promise<void>;
    delete(key: string): Promise<void>;
    list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
        keys: { name: string; expiration?: number; metadata?: any }[];
        list_complete: boolean;
        cursor?: string;
    }>;
}

/**
 * Service identifiers for key namespacing
 */
export type ServiceId = 
    | 'mods'
    | 'customer'
    | 'access'
    | 'auth'
    | 'streamkit'
    | 'chat'
    | 'twitch'
    | 'music'
    | 'game'
    | 'url';

/**
 * Base entity interface - all entities must have an id
 */
export interface BaseEntity {
    id: string;
    createdAt: string;
    updatedAt: string;
}

/**
 * Entity with ownership - entities that belong to a customer
 */
export interface OwnedEntity extends BaseEntity {
    customerId: string;
}

/**
 * Entity with visibility - entities that can be public/private
 */
export interface VisibleEntity extends OwnedEntity {
    visibility: 'public' | 'private' | 'unlisted';
}

/**
 * Key builder result
 */
export interface EntityKey {
    key: string;
    service: ServiceId;
    entity: string;
    id: string;
}

/**
 * Index key builder result
 */
export interface IndexKey {
    key: string;
    service: ServiceId;
    relationship: string;
    parentId: string;
}

/**
 * Access check context
 */
export interface AccessContext {
    customerId: string | null;
    isAdmin: boolean;
}

/**
 * Migration record for tracking progress
 */
export interface MigrationRecord {
    id: string;
    name: string;
    startedAt: string;
    completedAt: string | null;
    status: 'running' | 'completed' | 'failed';
    processedCount: number;
    errorCount: number;
    errors: string[];
}
