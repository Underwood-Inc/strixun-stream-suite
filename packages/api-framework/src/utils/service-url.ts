/**
 * Service URL Resolution Utility
 * 
 * Centralized, agnostic utility for resolving service URLs with automatic local dev detection.
 * All services should use this function to ensure they use localhost workers in development.
 * 
 * CRITICAL: In local development, ALWAYS use localhost workers, never external URLs.
 * This prevents accidental production API calls when running wrangler dev locally.
 */

/**
 * Environment interface for service URL resolution
 */
export interface ServiceUrlEnv {
    ENVIRONMENT?: string;
    [key: string]: any;
}

/**
 * Service URL configuration
 */
export interface ServiceUrlConfig {
    /** Default localhost port for local development */
    localPort: number;
    /** Environment variable name to check for explicit URL override (optional) */
    envVarName?: string;
    /** Production default URL */
    productionUrl: string;
}

/**
 * Check if we're running in local development
 * 
 * @param env - Environment object with ENVIRONMENT property
 * @returns true if running in local dev
 */
export function isLocalDev(env: ServiceUrlEnv): boolean {
    return env.ENVIRONMENT === 'test' || 
           env.ENVIRONMENT === 'development' || 
           env.ENVIRONMENT === 'dev' ||
           env.ENVIRONMENT === undefined; // Assume local if not set
}

/**
 * Resolve service URL with automatic local dev detection
 * 
 * Priority:
 * 1. localhost:{localPort} if ENVIRONMENT is 'test', 'development', 'dev', or undefined (local dev)
 *    CRITICAL: Local dev detection takes precedence over env vars to prevent production calls in local dev
 * 2. {envVarName} env var (if explicitly set and not in local dev)
 * 3. Production default URL
 * 
 * @param env - Environment object
 * @param config - Service URL configuration
 * @returns Resolved service URL
 * 
 * @example
 * ```typescript
 * // For auth API (port 8787)
 * const authUrl = getServiceUrl(env, {
 *   localPort: 8787,
 *   envVarName: 'AUTH_API_URL',
 *   productionUrl: 'https://auth.idling.app'
 * });
 * 
 * // For customer API (port 8790)
 * const customerUrl = getServiceUrl(env, {
 *   localPort: 8790,
 *   envVarName: 'CUSTOMER_API_URL',
 *   productionUrl: 'https://customer-api.idling.app'
 * });
 * ```
 */
export function getServiceUrl(env: ServiceUrlEnv, config: ServiceUrlConfig): string {
    // CRITICAL: Check ENVIRONMENT first - local dev detection takes precedence
    if (isLocalDev(env)) {
        return `http://localhost:${config.localPort}`;
    }
    
    // Only use env var if explicitly set and not in local dev
    if (config.envVarName && env[config.envVarName]) {
        return env[config.envVarName] as string;
    }
    
    // Production default
    return config.productionUrl;
}

/**
 * Convenience function for auth API URL resolution
 * 
 * @param env - Environment object
 * @returns Auth API URL (localhost:8787 in dev, or from AUTH_API_URL env var, or production default)
 */
export function getAuthApiUrl(env: ServiceUrlEnv): string {
    return getServiceUrl(env, {
        localPort: 8787,
        envVarName: 'AUTH_API_URL',
        productionUrl: 'https://auth.idling.app',
    });
}

/**
 * Convenience function for customer API URL resolution
 * 
 * @param env - Environment object
 * @returns Customer API URL (localhost:8790 in dev, or from CUSTOMER_API_URL env var, or production default)
 */
export function getCustomerApiUrl(env: ServiceUrlEnv): string {
    return getServiceUrl(env, {
        localPort: 8790,
        envVarName: 'CUSTOMER_API_URL',
        productionUrl: 'https://strixun-customer-api.strixuns-script-suite.workers.dev',
    });
}

/**
 * Convenience function for mods API URL resolution
 * 
 * @param env - Environment object
 * @returns Mods API URL (localhost:8788 in dev, or from MODS_API_URL env var, or production default)
 */
export function getModsApiUrl(env: ServiceUrlEnv): string {
    return getServiceUrl(env, {
        localPort: 8788,
        envVarName: 'MODS_API_URL',
        productionUrl: 'https://mods-api.idling.app',
    });
}
