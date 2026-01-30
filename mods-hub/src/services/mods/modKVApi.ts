/**
 * KV Browser & Entity API
 * Admin-only endpoints for browsing KV storage and viewing entity hierarchies
 */

import { createAPIClient } from '@strixun/api-framework/client';
import { sharedClientConfig } from '../authConfig';
import { API_BASE_URL } from './modsApi';

const api = createAPIClient({
    ...sharedClientConfig,
    baseURL: API_BASE_URL,
});

// ===== KV Browser Types =====

export interface KVKeyInfo {
    key: string;
    expiration?: number;
    metadata?: Record<string, unknown>;
    valuePreview?: string;
    valueSize?: number;
    entityType?: string;
}

export interface KVKeyListResponse {
    keys: KVKeyInfo[];
    cursor?: string;
    hasMore: boolean;
    total: number;
    prefix?: string;
}

export interface KVKeyValueResponse {
    key: string;
    value: unknown;
    valueType: 'json' | 'string' | 'binary';
    valueSize: number;
    expiration?: number;
    metadata?: Record<string, unknown>;
    entityType?: string;
    relatedEntities?: Array<{
        type: string;
        id: string;
        key: string;
    }>;
}

export interface KVPrefixInfo {
    prefix: string;
    label: string;
    description: string;
    count: number;
    hasMore: boolean;
}

export interface KVPrefixesResponse {
    prefixes: KVPrefixInfo[];
}

// ===== Entity Types =====

export interface ModEntitySummary {
    modId: string;
    title: string;
    slug: string;
    authorId: string;
    authorDisplayName?: string;
    status: string;
    visibility: string;
    category: string;
    downloadCount: number;
    createdAt: string;
    updatedAt: string;
    versionCount: number;
    variantCount: number;
    hasR2Thumbnail: boolean;
    thumbnailExtension?: string;
}

export interface ModEntityListResponse {
    mods: ModEntitySummary[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
}

export interface VariantEntityDetail {
    variantId: string;
    name: string;
    versionId: string;
    modId: string;
    fileName?: string;
    fileSize?: number;
    downloadCount: number;
    createdAt: string;
    r2FileKey?: string;
    r2FileExists?: boolean;
}

export interface VersionEntityDetail {
    versionId: string;
    version: string;
    modId: string;
    fileName?: string;
    fileSize?: number;
    downloadCount: number;
    createdAt: string;
    updatedAt: string;
    r2FileKey?: string;
    r2FileExists?: boolean;
    variants: VariantEntityDetail[];
}

export interface ModEntityDetailResponse {
    mod: {
        modId: string;
        title: string;
        slug: string;
        authorId: string;
        authorDisplayName?: string;
        description: string;
        status: string;
        visibility: string;
        category: string;
        downloadCount: number;
        createdAt: string;
        updatedAt: string;
        thumbnailUrl?: string;
        thumbnailExtension?: string;
        r2ThumbnailKey?: string;
        r2ThumbnailExists?: boolean;
    };
    versions: VersionEntityDetail[];
    kvKeys: Array<{
        key: string;
        type: string;
        description: string;
    }>;
}

// ===== KV Browser API Functions =====

/**
 * List KV keys with optional prefix filter
 */
export async function listKVKeys(params: {
    prefix?: string;
    limit?: number;
    cursor?: string;
    includePreview?: boolean;
}): Promise<KVKeyListResponse> {
    try {
        const urlParams = new URLSearchParams();
        if (params.prefix) urlParams.append('prefix', params.prefix);
        if (params.limit) urlParams.append('limit', params.limit.toString());
        if (params.cursor) urlParams.append('cursor', params.cursor);
        if (params.includePreview) urlParams.append('includePreview', 'true');
        
        const queryString = urlParams.toString() ? `?${urlParams.toString()}` : '';
        const response = await api.get<KVKeyListResponse>(`/admin/kv/keys${queryString}`);
        return response.data;
    } catch (error) {
        console.error('[ModKVAPI] Failed to list KV keys:', error);
        throw new Error(`Failed to list KV keys: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Get single KV key value
 */
export async function getKVValue(key: string): Promise<KVKeyValueResponse> {
    try {
        const encodedKey = encodeURIComponent(key);
        const response = await api.get<KVKeyValueResponse>(`/admin/kv/keys/${encodedKey}`);
        return response.data;
    } catch (error) {
        console.error('[ModKVAPI] Failed to get KV value:', error);
        throw new Error(`Failed to get KV value: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Get KV key prefixes for navigation
 */
export async function getKVPrefixes(): Promise<KVPrefixesResponse> {
    try {
        const response = await api.get<KVPrefixesResponse>('/admin/kv/prefixes');
        return response.data;
    } catch (error) {
        console.error('[ModKVAPI] Failed to get KV prefixes:', error);
        throw new Error(`Failed to get KV prefixes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

// ===== Entity API Functions =====

/**
 * List all mods with version/variant counts
 */
export async function listModEntities(params: {
    page?: number;
    pageSize?: number;
    search?: string;
}): Promise<ModEntityListResponse> {
    try {
        const urlParams = new URLSearchParams();
        if (params.page) urlParams.append('page', params.page.toString());
        if (params.pageSize) urlParams.append('pageSize', params.pageSize.toString());
        if (params.search) urlParams.append('search', params.search);
        
        const queryString = urlParams.toString() ? `?${urlParams.toString()}` : '';
        const response = await api.get<ModEntityListResponse>(`/admin/entities/mods${queryString}`);
        return response.data;
    } catch (error) {
        console.error('[ModKVAPI] Failed to list mod entities:', error);
        throw new Error(`Failed to list mod entities: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Get full mod entity detail with versions, variants, and KV keys
 */
export async function getModEntityDetail(modId: string): Promise<ModEntityDetailResponse> {
    try {
        const response = await api.get<ModEntityDetailResponse>(`/admin/entities/mods/${modId}`);
        return response.data;
    } catch (error) {
        console.error('[ModKVAPI] Failed to get mod entity detail:', error);
        throw new Error(`Failed to get mod entity detail: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
