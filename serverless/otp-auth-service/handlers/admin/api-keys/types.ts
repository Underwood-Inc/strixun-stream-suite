/**
 * API Key Admin Handlers – shared types
 * Used by list, create, rotate, reveal, revoke, and update-origins handlers.
 */

export interface ApiKeysEnv {
    OTP_AUTH_KV: KVNamespace;
    JWT_SECRET?: string;
    [key: string]: any;
}

/** Key record as stored in index (apikeys-for-customer) and entity (apikey by hash). */
export interface ApiKeyData {
    keyId: string;
    name: string;
    createdAt: string;
    lastUsed: string | null;
    status: 'active' | 'inactive' | 'revoked' | 'rotated';
    encryptedKey: string;
    rotatedAt?: string;
    replacedBy?: string;
    revokedAt?: string;
    allowedOrigins?: string[];
    allowedScopes?: string[];
    /** Hash of the API key; used to update the entity when origins/scopes change. */
    apiKeyHash?: string;
}

/** Double-encrypted key payload returned to the dashboard (encrypted with customer JWT). */
export interface EncryptedKeyData {
    doubleEncrypted: boolean;
    encrypted: boolean;
    algorithm: string;
    iv: string;
    salt: string;
    tokenHash: string;
    data: string;
    timestamp: string;
}

/** Single key in list response. */
export interface ApiKeyResponse {
    keyId: string;
    name: string;
    createdAt: string;
    lastUsed: string | null;
    status: string;
    apiKey: EncryptedKeyData | null;
    allowedOrigins?: string[];
    allowedScopes?: string[];
}

export interface CreateApiKeyBody {
    name?: string;
    allowedOrigins?: string[];
    allowedScopes?: string[];
}

export interface CreateApiKeyResponse {
    success: boolean;
    apiKey: string;
    keyId: string;
    name: string;
    message: string;
}

export interface ListApiKeysResponse {
    success: boolean;
    apiKeys: ApiKeyResponse[];
}

export interface RotateApiKeyResponse {
    success: boolean;
    apiKey: string;
    keyId: string;
    oldKeyId: string;
    message: string;
}

export interface RevealApiKeyResponse {
    success: boolean;
    apiKey: string | null;
    keyId: string;
    name: string;
    message: string;
}

export interface RevokeApiKeyResponse {
    success: boolean;
    message: string;
}

export interface UpdateOriginsBody {
    allowedOrigins: string[];
    allowedScopes?: string[];
}

export interface UpdateOriginsResponse {
    success: boolean;
    keyId: string;
    allowedOrigins: string[];
    allowedScopes?: string[];
    message: string;
}
