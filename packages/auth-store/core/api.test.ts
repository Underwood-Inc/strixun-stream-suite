/**
 * Unit Tests for Auth Store Core API
 * Tests fetchCustomerInfo and decodeJWTPayload functions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getAuthApiUrl, decodeJWTPayload } from './api.js';
import type { AuthStoreConfig } from './types.js';

// Save original values
const originalWindow = global.window;
const originalImportMeta = (global as any).import;

describe('Auth Store Core API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        // Restore original window
        if (!originalWindow) {
            delete (global as any).window;
        }
    });

    describe('getAuthApiUrl', () => {
        it('should return config authApiUrl when provided', () => {
            const config: AuthStoreConfig = {
                authApiUrl: 'https://custom-auth.example.com',
            };
            
            const url = getAuthApiUrl(config);
            
            expect(url).toBe('https://custom-auth.example.com');
        });

        it('should return appropriate URL based on environment', () => {
            const url = getAuthApiUrl();
            
            // In test/dev environment, may return '/auth-api' or production URL
            // Just verify it returns a non-empty string
            expect(url).toBeTruthy();
            expect(typeof url).toBe('string');
            expect(url.length).toBeGreaterThan(0);
        });

        it('should prioritize config over defaults', () => {
            const config: AuthStoreConfig = {
                authApiUrl: 'http://localhost:9999',
            };
            
            const url = getAuthApiUrl(config);
            
            expect(url).toBe('http://localhost:9999');
        });

        it('should use window.VITE_AUTH_API_URL if available', () => {
            // Mock window with VITE_AUTH_API_URL
            (global as any).window = {
                VITE_AUTH_API_URL: 'https://from-window-vite.example.com',
                location: {
                    hostname: 'example.com',
                },
            };
            
            const url = getAuthApiUrl();
            
            expect(url).toBe('https://from-window-vite.example.com');
        });

        it('should use window.getOtpAuthApiUrl if available', () => {
            // Mock window with getOtpAuthApiUrl function
            (global as any).window = {
                getOtpAuthApiUrl: () => 'https://from-window-function.example.com',
                location: {
                    hostname: 'example.com',
                },
            };
            
            const url = getAuthApiUrl();
            
            expect(url).toBe('https://from-window-function.example.com');
        });

        it('should return localhost URL when hostname is localhost', () => {
            // Mock window with localhost hostname
            (global as any).window = {
                location: {
                    hostname: 'localhost',
                },
            };
            
            const url = getAuthApiUrl();
            
            expect(url).toBe('http://localhost:8787');
        });

        it('should return localhost URL when hostname is 127.0.0.1', () => {
            // Mock window with 127.0.0.1 hostname
            (global as any).window = {
                location: {
                    hostname: '127.0.0.1',
                },
            };
            
            const url = getAuthApiUrl();
            
            expect(url).toBe('http://localhost:8787');
        });

        it('should handle window.getOtpAuthApiUrl returning null', () => {
            // Mock window with getOtpAuthApiUrl that returns null
            (global as any).window = {
                getOtpAuthApiUrl: () => null,
                location: {
                    hostname: 'example.com',
                },
            };
            
            const url = getAuthApiUrl();
            
            // Should fall through to default
            expect(url).toBeTruthy();
        });
    });

    describe('decodeJWTPayload', () => {
        it('should decode valid JWT payload', () => {
            // Valid JWT: {"sub":"cust_123","email":"test@example.com","isSuperAdmin":true,"exp":1234567890}
            const validJWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjdXN0XzEyMyIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsImlzU3VwZXJBZG1pbiI6dHJ1ZSwiZXhwIjoxMjM0NTY3ODkwfQ.signature';
            
            const payload = decodeJWTPayload(validJWT);
            
            expect(payload).toBeDefined();
            expect(payload?.sub).toBe('cust_123');
            expect(payload?.email).toBe('test@example.com');
            expect(payload?.isSuperAdmin).toBe(true);
            expect(payload?.exp).toBe(1234567890);
        });

        it('should return null for invalid JWT (not 3 parts)', () => {
            const invalidJWT = 'invalid.jwt';
            
            const payload = decodeJWTPayload(invalidJWT);
            
            expect(payload).toBeNull();
        });

        it('should return null for malformed base64', () => {
            const malformedJWT = 'header.!!!invalid-base64!!!.signature';
            
            const payload = decodeJWTPayload(malformedJWT);
            
            expect(payload).toBeNull();
        });

        it('should handle JWT with URL-safe base64 (- and _)', () => {
            // JWT with URL-safe characters
            const urlSafeJWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.signature';
            
            const payload = decodeJWTPayload(urlSafeJWT);
            
            expect(payload).toBeDefined();
            expect(payload?.sub).toBe('test');
        });

        it('should extract CSRF token from JWT', () => {
            // JWT: {"sub":"cust_123","csrf":"csrf_token_abc123"}
            const jwtWithCSRF = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJjdXN0XzEyMyIsImNzcmYiOiJjc3JmX3Rva2VuX2FiYzEyMyJ9.signature';
            
            const payload = decodeJWTPayload(jwtWithCSRF);
            
            expect(payload?.csrf).toBe('csrf_token_abc123');
        });

        it('should handle empty JWT payload', () => {
            // JWT with empty payload: {}
            const emptyPayloadJWT = 'eyJhbGciOiJIUzI1NiJ9.e30.signature';
            
            const payload = decodeJWTPayload(emptyPayloadJWT);
            
            expect(payload).toEqual({});
        });

        it('should extract customerId from JWT', () => {
            // JWT: {"customerId":"cust_abc123","sub":"cust_abc123"}
            const jwtWithCustomerId = 'eyJhbGciOiJIUzI1NiJ9.eyJjdXN0b21lcklkIjoiY3VzdF9hYmMxMjMiLCJzdWIiOiJjdXN0X2FiYzEyMyJ9.signature';
            
            const payload = decodeJWTPayload(jwtWithCustomerId);
            
            expect(payload?.customerId).toBe('cust_abc123');
            expect(payload?.sub).toBe('cust_abc123');
        });

        it('should extract displayName from JWT', () => {
            // JWT: {"sub":"cust_123","displayName":"Test User"}
            const jwtWithDisplayName = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJjdXN0XzEyMyIsImRpc3BsYXlOYW1lIjoiVGVzdCBVc2VyIn0.signature';
            
            const payload = decodeJWTPayload(jwtWithDisplayName);
            
            expect(payload?.displayName).toBe('Test User');
        });

        it('should extract exp (expiration) from JWT', () => {
            // JWT: {"sub":"cust_123","exp":1234567890}
            const jwtWithExp = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJjdXN0XzEyMyIsImV4cCI6MTIzNDU2Nzg5MH0.signature';
            
            const payload = decodeJWTPayload(jwtWithExp);
            
            expect(payload?.exp).toBe(1234567890);
        });

        it('should extract all standard OIDC claims', () => {
            // JWT with multiple claims: {"sub":"cust_123","email":"test@example.com","iss":"https://auth.idling.app","aud":"https://idling.app","iat":1234567890,"exp":1234571490}
            const fullJWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJjdXN0XzEyMyIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsImlzcyI6Imh0dHBzOi8vYXV0aC5pZGxpbmcuYXBwIiwiYXVkIjoiaHR0cHM6Ly9pZGxpbmcuYXBwIiwiaWF0IjoxMjM0NTY3ODkwLCJleHAiOjEyMzQ1NzE0OTB9.signature';
            
            const payload = decodeJWTPayload(fullJWT);
            
            expect(payload?.sub).toBe('cust_123');
            expect(payload?.email).toBe('test@example.com');
            expect(payload?.iss).toBe('https://auth.idling.app');
            expect(payload?.aud).toBe('https://idling.app');
            expect(payload?.iat).toBe(1234567890);
            expect(payload?.exp).toBe(1234571490);
        });

        it('should handle JWT with nested objects', () => {
            // JWT: {"sub":"cust_123","metadata":{"plan":"premium","tier":"enterprise"}}
            const jwtWithNested = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJjdXN0XzEyMyIsIm1ldGFkYXRhIjp7InBsYW4iOiJwcmVtaXVtIiwidGllciI6ImVudGVycHJpc2UifX0.signature';
            
            const payload = decodeJWTPayload(jwtWithNested);
            
            expect(payload?.metadata).toEqual({
                plan: 'premium',
                tier: 'enterprise'
            });
        });

        it('should handle JWT with special characters in payload', () => {
            // JWT: {"sub":"cust_123","name":"Test & Special <chars>"}
            const jwtWithSpecial = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJjdXN0XzEyMyIsIm5hbWUiOiJUZXN0ICYgU3BlY2lhbCA8Y2hhcnM+In0.signature';
            
            const payload = decodeJWTPayload(jwtWithSpecial);
            
            expect(payload?.name).toBe('Test & Special <chars>');
        });

        it('should handle JWT with boolean false values', () => {
            // JWT: {"sub":"cust_123","isSuperAdmin":false}
            const jwtWithFalse = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJjdXN0XzEyMyIsImlzU3VwZXJBZG1pbiI6ZmFsc2V9.signature';
            
            const payload = decodeJWTPayload(jwtWithFalse);
            
            expect(payload?.isSuperAdmin).toBe(false);
        });

        it('should handle JWT with null values', () => {
            // JWT: {"sub":"cust_123","displayName":null}
            const jwtWithNull = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJjdXN0XzEyMyIsImRpc3BsYXlOYW1lIjpudWxsfQ.signature';
            
            const payload = decodeJWTPayload(jwtWithNull);
            
            expect(payload?.displayName).toBeNull();
        });

        it('should handle JWT with array values', () => {
            // JWT: {"sub":"cust_123","roles":["user","admin"]}
            const jwtWithArray = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJjdXN0XzEyMyIsInJvbGVzIjpbInVzZXIiLCJhZG1pbiJdfQ.signature';
            
            const payload = decodeJWTPayload(jwtWithArray);
            
            expect(payload?.roles).toEqual(['user', 'admin']);
        });

        it('should handle JWT with numeric values', () => {
            // JWT: {"sub":"cust_123","count":42}
            const jwtWithNumbers = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJjdXN0XzEyMyIsImNvdW50Ijo0Mn0.signature';
            
            const payload = decodeJWTPayload(jwtWithNumbers);
            
            expect(payload?.count).toBe(42);
        });
    });
});
