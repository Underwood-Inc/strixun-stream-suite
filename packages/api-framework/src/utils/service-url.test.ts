/**
 * Unit Tests for Service URL Resolution Utility
 * 
 * Comprehensive tests to ensure service URLs are correctly resolved in all environments:
 * - Local dev detection (test, development, dev, undefined)
 * - Environment variable overrides
 * - Production defaults
 * - All convenience functions
 * - Edge cases
 */

// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
    isLocalDev,
    getServiceUrl,
    getAuthApiUrl,
    getCustomerApiUrl,
    getModsApiUrl,
    type ServiceUrlEnv,
    type ServiceUrlConfig,
} from './service-url';

describe('Service URL Resolution Utility', () => {
    describe('isLocalDev', () => {
        it('should return true for ENVIRONMENT=test', () => {
            const env: ServiceUrlEnv = { ENVIRONMENT: 'test' };
            expect(isLocalDev(env)).toBe(true);
        });

        it('should return true for ENVIRONMENT=development', () => {
            const env: ServiceUrlEnv = { ENVIRONMENT: 'development' };
            expect(isLocalDev(env)).toBe(true);
        });

        it('should return true for ENVIRONMENT=dev', () => {
            const env: ServiceUrlEnv = { ENVIRONMENT: 'dev' };
            expect(isLocalDev(env)).toBe(true);
        });

        it('should return true for undefined ENVIRONMENT', () => {
            const env: ServiceUrlEnv = {};
            expect(isLocalDev(env)).toBe(true);
        });

        it('should return true for ENVIRONMENT explicitly set to undefined', () => {
            const env: ServiceUrlEnv = { ENVIRONMENT: undefined };
            expect(isLocalDev(env)).toBe(true);
        });

        it('should return false for ENVIRONMENT=production', () => {
            const env: ServiceUrlEnv = { ENVIRONMENT: 'production' };
            expect(isLocalDev(env)).toBe(false);
        });

        it('should return false for ENVIRONMENT=staging', () => {
            const env: ServiceUrlEnv = { ENVIRONMENT: 'staging' };
            expect(isLocalDev(env)).toBe(false);
        });

        it('should return false for ENVIRONMENT=prod', () => {
            const env: ServiceUrlEnv = { ENVIRONMENT: 'prod' };
            expect(isLocalDev(env)).toBe(false);
        });

        it('should return false for empty string ENVIRONMENT', () => {
            const env: ServiceUrlEnv = { ENVIRONMENT: '' };
            expect(isLocalDev(env)).toBe(false);
        });

        it('should be case-sensitive (Test should not match)', () => {
            const env: ServiceUrlEnv = { ENVIRONMENT: 'Test' };
            expect(isLocalDev(env)).toBe(false);
        });

        it('should be case-sensitive (DEVELOPMENT should not match)', () => {
            const env: ServiceUrlEnv = { ENVIRONMENT: 'DEVELOPMENT' };
            expect(isLocalDev(env)).toBe(false);
        });
    });

    describe('getServiceUrl', () => {
        const testConfig: ServiceUrlConfig = {
            localPort: 8080,
            envVarName: 'TEST_API_URL',
            productionUrl: 'https://test-api.example.com',
        };

        describe('Local dev detection (takes precedence)', () => {
            it('should return localhost URL for ENVIRONMENT=test', () => {
                const env: ServiceUrlEnv = { ENVIRONMENT: 'test' };
                const url = getServiceUrl(env, testConfig);
                expect(url).toBe('http://localhost:8080');
            });

            it('should return localhost URL for ENVIRONMENT=development', () => {
                const env: ServiceUrlEnv = { ENVIRONMENT: 'development' };
                const url = getServiceUrl(env, testConfig);
                expect(url).toBe('http://localhost:8080');
            });

            it('should return localhost URL for ENVIRONMENT=dev', () => {
                const env: ServiceUrlEnv = { ENVIRONMENT: 'dev' };
                const url = getServiceUrl(env, testConfig);
                expect(url).toBe('http://localhost:8080');
            });

            it('should return localhost URL for undefined ENVIRONMENT', () => {
                const env: ServiceUrlEnv = {};
                const url = getServiceUrl(env, testConfig);
                expect(url).toBe('http://localhost:8080');
            });

            it('should ignore env var when in local dev', () => {
                const env: ServiceUrlEnv = {
                    ENVIRONMENT: 'test',
                    TEST_API_URL: 'https://custom-url.example.com',
                };
                const url = getServiceUrl(env, testConfig);
                // Should use localhost, not the env var
                expect(url).toBe('http://localhost:8080');
                expect(url).not.toBe('https://custom-url.example.com');
            });
        });

        describe('Environment variable override (when not in local dev)', () => {
            it('should use env var when ENVIRONMENT=production and env var is set', () => {
                const env: ServiceUrlEnv = {
                    ENVIRONMENT: 'production',
                    TEST_API_URL: 'https://custom-url.example.com',
                };
                const url = getServiceUrl(env, testConfig);
                expect(url).toBe('https://custom-url.example.com');
            });

            it('should use env var when ENVIRONMENT=staging and env var is set', () => {
                const env: ServiceUrlEnv = {
                    ENVIRONMENT: 'staging',
                    TEST_API_URL: 'https://staging-api.example.com',
                };
                const url = getServiceUrl(env, testConfig);
                expect(url).toBe('https://staging-api.example.com');
            });

            it('should use env var when ENVIRONMENT is empty string and env var is set', () => {
                const env: ServiceUrlEnv = {
                    ENVIRONMENT: '',
                    TEST_API_URL: 'https://custom-url.example.com',
                };
                const url = getServiceUrl(env, testConfig);
                expect(url).toBe('https://custom-url.example.com');
            });
        });

        describe('Production default (when not in local dev and no env var)', () => {
            it('should use production default when ENVIRONMENT=production and no env var', () => {
                const env: ServiceUrlEnv = { ENVIRONMENT: 'production' };
                const url = getServiceUrl(env, testConfig);
                expect(url).toBe('https://test-api.example.com');
            });

            it('should use production default when ENVIRONMENT=staging and no env var', () => {
                const env: ServiceUrlEnv = { ENVIRONMENT: 'staging' };
                const url = getServiceUrl(env, testConfig);
                expect(url).toBe('https://test-api.example.com');
            });

            it('should use production default when ENVIRONMENT is empty string and no env var', () => {
                const env: ServiceUrlEnv = { ENVIRONMENT: '' };
                const url = getServiceUrl(env, testConfig);
                expect(url).toBe('https://test-api.example.com');
            });
        });

        describe('Config without envVarName', () => {
            it('should work without envVarName in local dev', () => {
                const config: ServiceUrlConfig = {
                    localPort: 9000,
                    productionUrl: 'https://api.example.com',
                };
                const env: ServiceUrlEnv = { ENVIRONMENT: 'test' };
                const url = getServiceUrl(env, config);
                expect(url).toBe('http://localhost:9000');
            });

            it('should use production default when not in local dev and no envVarName', () => {
                const config: ServiceUrlConfig = {
                    localPort: 9000,
                    productionUrl: 'https://api.example.com',
                };
                const env: ServiceUrlEnv = { ENVIRONMENT: 'production' };
                const url = getServiceUrl(env, config);
                expect(url).toBe('https://api.example.com');
            });
        });

        describe('Different ports', () => {
            it('should use correct port for different services', () => {
                const env: ServiceUrlEnv = { ENVIRONMENT: 'test' };
                
                const config1: ServiceUrlConfig = {
                    localPort: 8787,
                    productionUrl: 'https://auth.example.com',
                };
                expect(getServiceUrl(env, config1)).toBe('http://localhost:8787');
                
                const config2: ServiceUrlConfig = {
                    localPort: 8788,
                    productionUrl: 'https://mods.example.com',
                };
                expect(getServiceUrl(env, config2)).toBe('http://localhost:8788');
                
                const config3: ServiceUrlConfig = {
                    localPort: 8790,
                    productionUrl: 'https://customer.example.com',
                };
                expect(getServiceUrl(env, config3)).toBe('http://localhost:8790');
            });
        });
    });

    describe('getAuthApiUrl', () => {
        it('should return localhost:8787 for ENVIRONMENT=test', () => {
            const env: ServiceUrlEnv = { ENVIRONMENT: 'test' };
            expect(getAuthApiUrl(env)).toBe('http://localhost:8787');
        });

        it('should return localhost:8787 for ENVIRONMENT=development', () => {
            const env: ServiceUrlEnv = { ENVIRONMENT: 'development' };
            expect(getAuthApiUrl(env)).toBe('http://localhost:8787');
        });

        it('should return localhost:8787 for ENVIRONMENT=dev', () => {
            const env: ServiceUrlEnv = { ENVIRONMENT: 'dev' };
            expect(getAuthApiUrl(env)).toBe('http://localhost:8787');
        });

        it('should return localhost:8787 for undefined ENVIRONMENT', () => {
            const env: ServiceUrlEnv = {};
            expect(getAuthApiUrl(env)).toBe('http://localhost:8787');
        });

        it('should ignore AUTH_API_URL when in local dev', () => {
            const env: ServiceUrlEnv = {
                ENVIRONMENT: 'test',
                AUTH_API_URL: 'https://custom-auth.example.com',
            };
            expect(getAuthApiUrl(env)).toBe('http://localhost:8787');
        });

        it('should use AUTH_API_URL when ENVIRONMENT=production and env var is set', () => {
            const env: ServiceUrlEnv = {
                ENVIRONMENT: 'production',
                AUTH_API_URL: 'https://custom-auth.example.com',
            };
            expect(getAuthApiUrl(env)).toBe('https://custom-auth.example.com');
        });

        it('should use production default when ENVIRONMENT=production and no env var', () => {
            const env: ServiceUrlEnv = { ENVIRONMENT: 'production' };
            expect(getAuthApiUrl(env)).toBe('https://auth.idling.app');
        });

        it('should use production default when ENVIRONMENT=staging and no env var', () => {
            const env: ServiceUrlEnv = { ENVIRONMENT: 'staging' };
            expect(getAuthApiUrl(env)).toBe('https://auth.idling.app');
        });
    });

    describe('getCustomerApiUrl', () => {
        it('should return localhost:8790 for ENVIRONMENT=test', () => {
            const env: ServiceUrlEnv = { ENVIRONMENT: 'test' };
            expect(getCustomerApiUrl(env)).toBe('http://localhost:8790');
        });

        it('should return localhost:8790 for ENVIRONMENT=development', () => {
            const env: ServiceUrlEnv = { ENVIRONMENT: 'development' };
            expect(getCustomerApiUrl(env)).toBe('http://localhost:8790');
        });

        it('should return localhost:8790 for ENVIRONMENT=dev', () => {
            const env: ServiceUrlEnv = { ENVIRONMENT: 'dev' };
            expect(getCustomerApiUrl(env)).toBe('http://localhost:8790');
        });

        it('should return localhost:8790 for undefined ENVIRONMENT', () => {
            const env: ServiceUrlEnv = {};
            expect(getCustomerApiUrl(env)).toBe('http://localhost:8790');
        });

        it('should ignore CUSTOMER_API_URL when in local dev', () => {
            const env: ServiceUrlEnv = {
                ENVIRONMENT: 'test',
                CUSTOMER_API_URL: 'https://custom-customer.example.com',
            };
            expect(getCustomerApiUrl(env)).toBe('http://localhost:8790');
        });

        it('should use CUSTOMER_API_URL when ENVIRONMENT=production and env var is set', () => {
            const env: ServiceUrlEnv = {
                ENVIRONMENT: 'production',
                CUSTOMER_API_URL: 'https://custom-customer.example.com',
            };
            expect(getCustomerApiUrl(env)).toBe('https://custom-customer.example.com');
        });

        it('should use production default when ENVIRONMENT=production and no env var', () => {
            const env: ServiceUrlEnv = { ENVIRONMENT: 'production' };
            expect(getCustomerApiUrl(env)).toBe('https://strixun-customer-api.strixuns-script-suite.workers.dev');
        });
    });

    describe('getModsApiUrl', () => {
        it('should return localhost:8788 for ENVIRONMENT=test', () => {
            const env: ServiceUrlEnv = { ENVIRONMENT: 'test' };
            expect(getModsApiUrl(env)).toBe('http://localhost:8788');
        });

        it('should return localhost:8788 for ENVIRONMENT=development', () => {
            const env: ServiceUrlEnv = { ENVIRONMENT: 'development' };
            expect(getModsApiUrl(env)).toBe('http://localhost:8788');
        });

        it('should return localhost:8788 for ENVIRONMENT=dev', () => {
            const env: ServiceUrlEnv = { ENVIRONMENT: 'dev' };
            expect(getModsApiUrl(env)).toBe('http://localhost:8788');
        });

        it('should return localhost:8788 for undefined ENVIRONMENT', () => {
            const env: ServiceUrlEnv = {};
            expect(getModsApiUrl(env)).toBe('http://localhost:8788');
        });

        it('should ignore MODS_API_URL when in local dev', () => {
            const env: ServiceUrlEnv = {
                ENVIRONMENT: 'test',
                MODS_API_URL: 'https://custom-mods.example.com',
            };
            expect(getModsApiUrl(env)).toBe('http://localhost:8788');
        });

        it('should use MODS_API_URL when ENVIRONMENT=production and env var is set', () => {
            const env: ServiceUrlEnv = {
                ENVIRONMENT: 'production',
                MODS_API_URL: 'https://custom-mods.example.com',
            };
            expect(getModsApiUrl(env)).toBe('https://custom-mods.example.com');
        });

        it('should use production default when ENVIRONMENT=production and no env var', () => {
            const env: ServiceUrlEnv = { ENVIRONMENT: 'production' };
            expect(getModsApiUrl(env)).toBe('https://mods-api.idling.app');
        });
    });

    describe('Edge cases and integration scenarios', () => {
        it('should handle env with additional properties', () => {
            const env: ServiceUrlEnv = {
                ENVIRONMENT: 'test',
                JWT_SECRET: 'secret',
                ALLOWED_ORIGINS: '*',
                CUSTOMER_API_URL: 'https://should-be-ignored.com',
            };
            expect(getCustomerApiUrl(env)).toBe('http://localhost:8790');
        });

        it('should handle env with null/undefined values', () => {
            const env: ServiceUrlEnv = {
                ENVIRONMENT: undefined,
                AUTH_API_URL: null as any,
            };
            expect(getAuthApiUrl(env)).toBe('http://localhost:8787');
        });

        it('should handle empty string env var (should not match)', () => {
            const env: ServiceUrlEnv = {
                ENVIRONMENT: 'production',
                AUTH_API_URL: '',
            };
            // Empty string should not be considered a valid override
            expect(getAuthApiUrl(env)).toBe('https://auth.idling.app');
        });

        it('should ensure local dev always takes precedence regardless of env vars', () => {
            const env: ServiceUrlEnv = {
                ENVIRONMENT: 'development',
                AUTH_API_URL: 'https://production-auth.example.com',
                CUSTOMER_API_URL: 'https://production-customer.example.com',
                MODS_API_URL: 'https://production-mods.example.com',
            };
            
            // All should use localhost, ignoring production URLs
            expect(getAuthApiUrl(env)).toBe('http://localhost:8787');
            expect(getCustomerApiUrl(env)).toBe('http://localhost:8790');
            expect(getModsApiUrl(env)).toBe('http://localhost:8788');
        });

        it('should work correctly in production with env var overrides', () => {
            const env: ServiceUrlEnv = {
                ENVIRONMENT: 'production',
                AUTH_API_URL: 'https://staging-auth.example.com',
                CUSTOMER_API_URL: 'https://staging-customer.example.com',
                MODS_API_URL: 'https://staging-mods.example.com',
            };
            
            // Should use env vars, not production defaults
            expect(getAuthApiUrl(env)).toBe('https://staging-auth.example.com');
            expect(getCustomerApiUrl(env)).toBe('https://staging-customer.example.com');
            expect(getModsApiUrl(env)).toBe('https://staging-mods.example.com');
        });

        it('should work correctly in production without env var overrides', () => {
            const env: ServiceUrlEnv = {
                ENVIRONMENT: 'production',
            };
            
            // Should use production defaults
            expect(getAuthApiUrl(env)).toBe('https://auth.idling.app');
            expect(getCustomerApiUrl(env)).toBe('https://strixun-customer-api.strixuns-script-suite.workers.dev');
            expect(getModsApiUrl(env)).toBe('https://mods-api.idling.app');
        });
    });

    describe('Real-world scenarios', () => {
        it('should handle wrangler dev scenario (ENVIRONMENT undefined)', () => {
            // When running `wrangler dev`, ENVIRONMENT is often undefined
            const env: ServiceUrlEnv = {};
            
            expect(getAuthApiUrl(env)).toBe('http://localhost:8787');
            expect(getCustomerApiUrl(env)).toBe('http://localhost:8790');
            expect(getModsApiUrl(env)).toBe('http://localhost:8788');
        });

        it('should handle CI test scenario (ENVIRONMENT=test)', () => {
            const env: ServiceUrlEnv = { ENVIRONMENT: 'test' };
            
            expect(getAuthApiUrl(env)).toBe('http://localhost:8787');
            expect(getCustomerApiUrl(env)).toBe('http://localhost:8790');
            expect(getModsApiUrl(env)).toBe('http://localhost:8788');
        });

        it('should handle local development scenario (ENVIRONMENT=development)', () => {
            const env: ServiceUrlEnv = { ENVIRONMENT: 'development' };
            
            expect(getAuthApiUrl(env)).toBe('http://localhost:8787');
            expect(getCustomerApiUrl(env)).toBe('http://localhost:8790');
            expect(getModsApiUrl(env)).toBe('http://localhost:8788');
        });

        it('should handle production deployment scenario', () => {
            const env: ServiceUrlEnv = { ENVIRONMENT: 'production' };
            
            expect(getAuthApiUrl(env)).toBe('https://auth.idling.app');
            expect(getCustomerApiUrl(env)).toBe('https://strixun-customer-api.strixuns-script-suite.workers.dev');
            expect(getModsApiUrl(env)).toBe('https://mods-api.idling.app');
        });

        it('should handle staging deployment scenario with custom URLs', () => {
            const env: ServiceUrlEnv = {
                ENVIRONMENT: 'staging',
                AUTH_API_URL: 'https://staging-auth.example.com',
                CUSTOMER_API_URL: 'https://staging-customer.example.com',
                MODS_API_URL: 'https://staging-mods.example.com',
            };
            
            expect(getAuthApiUrl(env)).toBe('https://staging-auth.example.com');
            expect(getCustomerApiUrl(env)).toBe('https://staging-customer.example.com');
            expect(getModsApiUrl(env)).toBe('https://staging-mods.example.com');
        });
    });
});
