/**
 * API Keys Service
 * Handles API key management and SSO configuration
 */

import { getAuthHeaders } from './authConfig';

const BASE_URL = import.meta.env.VITE_AUTH_API_URL || 'https://auth.idling.app';

// SSO Isolation Mode
export type SSOIsolationMode = 'none' | 'selective' | 'complete';

// SSO Configuration
export interface SSOConfig {
    isolationMode: SSOIsolationMode;
    allowedKeyIds: string[];
    globalSsoEnabled: boolean;
    configVersion: number;
    updatedAt: string;
}

// API Key Data
export interface APIKeyData {
    keyId: string;
    name: string;
    status: 'active' | 'inactive' | 'revoked';
    createdAt: string;
    lastUsed: string | null;
    ssoConfig?: SSOConfig;
}

// API Key List Response
export interface APIKeysListResponse {
    keys: APIKeyData[];
    total: number;
}

// API Key SSO Config Response
export interface APIKeySSOConfigResponse {
    keyId: string;
    name: string;
    ssoConfig?: SSOConfig;
    compatibleKeys: string[];
}

/**
 * List all API keys for the authenticated customer
 */
export async function listAPIKeys(): Promise<APIKeysListResponse> {
    const response = await fetch(`${BASE_URL}/auth/api-keys`, {
        method: 'GET',
        headers: await getAuthHeaders(),
        credentials: 'include' // Include cookies for HttpOnly auth_token
    });
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `Failed to list API keys: ${response.statusText}`);
    }
    
    return response.json();
}

/**
 * Get SSO configuration for a specific API key
 */
export async function getAPIKeySSOConfig(keyId: string): Promise<APIKeySSOConfigResponse> {
    const response = await fetch(`${BASE_URL}/auth/api-key/${keyId}/sso-config`, {
        method: 'GET',
        headers: await getAuthHeaders(),
        credentials: 'include'
    });
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `Failed to get SSO config: ${response.statusText}`);
    }
    
    return response.json();
}

/**
 * Update SSO configuration for a specific API key
 */
export async function updateAPIKeySSOConfig(
    keyId: string,
    ssoConfig: Partial<SSOConfig>
): Promise<{ success: boolean; keyId: string; ssoConfig?: SSOConfig }> {
    const response = await fetch(`${BASE_URL}/auth/api-key/${keyId}/sso-config`, {
        method: 'PUT',
        headers: {
            ...(await getAuthHeaders()),
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(ssoConfig)
    });
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `Failed to update SSO config: ${response.statusText}`);
    }
    
    return response.json();
}

/**
 * Run API keys SSO migration (super admin only)
 */
export async function runAPIKeysSSOMigration(): Promise<{
    success: boolean;
    totalCustomers: number;
    totalKeys: number;
    migratedKeys: number;
    skippedKeys: number;
    errors: string[];
}> {
    const response = await fetch(`${BASE_URL}/migrations/api-keys-sso`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        credentials: 'include'
    });
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `Failed to run migration: ${response.statusText}`);
    }
    
    return response.json();
}
