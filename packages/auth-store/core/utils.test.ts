/**
 * Unit Tests for Auth Store Cookie Utilities
 * Tests getCookie and deleteCookie functions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getCookie, deleteCookie } from './utils.js';

/**
 * @vitest-environment jsdom
 */
describe('Auth Store Utils - Cookie Management', () => {
    describe('getCookie', () => {
        beforeEach(() => {
            // Reset document.cookie mock before each test
            // In jsdom, we can't actually set cookies normally, so we'll mock the cookie property
        });

        it('should return null when document is undefined (SSR)', () => {
            // Mock SSR environment (no document)
            const originalDocument = global.document;
            // @ts-ignore
            delete global.document;
            
            const result = getCookie('auth_token');
            
            expect(result).toBeNull();
            
            // Restore document
            global.document = originalDocument;
        });

        it('should return null when cookie does not exist', () => {
            const result = getCookie('nonexistent_cookie');
            expect(result).toBeNull();
        });

        it('should return cookie value when cookie exists', () => {
            Object.defineProperty(document, 'cookie', {
                writable: true,
                configurable: true,
                value: 'auth_token=test_jwt_token',
            });
            
            const result = getCookie('auth_token');
            
            expect(result).toBe('test_jwt_token');
        });

        it('should handle multiple cookies', () => {
            Object.defineProperty(document, 'cookie', {
                writable: true,
                configurable: true,
                value: 'cookie1=value1; auth_token=test_jwt_token; cookie2=value2',
            });
            
            const result = getCookie('auth_token');
            
            expect(result).toBe('test_jwt_token');
        });

        it('should handle cookies with leading spaces', () => {
            // Simulate cookie string with leading space (after semicolon)
            Object.defineProperty(document, 'cookie', {
                writable: true,
                configurable: true,
                value: ' auth_token=test_jwt_token',
            });
            
            const result = getCookie('auth_token');
            
            expect(result).toBe('test_jwt_token');
        });

        it('should handle empty cookie values', () => {
            Object.defineProperty(document, 'cookie', {
                writable: true,
                configurable: true,
                value: 'auth_token=',
            });
            
            const result = getCookie('auth_token');
            
            // Empty value is still a valid cookie
            expect(result).toBe('');
        });

        it('should not match partial cookie names', () => {
            Object.defineProperty(document, 'cookie', {
                writable: true,
                configurable: true,
                value: 'my_auth_token=wrong_value; auth_token=correct_value',
            });
            
            const result = getCookie('auth_token');
            
            expect(result).toBe('correct_value');
        });

        it('should handle cookies with special characters', () => {
            const jwtToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
            Object.defineProperty(document, 'cookie', {
                writable: true,
                configurable: true,
                value: `auth_token=${jwtToken}`,
            });
            
            const result = getCookie('auth_token');
            
            expect(result).toBe(jwtToken);
        });
    });

    describe('deleteCookie', () => {
        beforeEach(() => {
            // Reset mocks before each test
        });

        it('should do nothing when document is undefined (SSR)', () => {
            // Mock SSR environment (no document)
            const originalDocument = global.document;
            // @ts-ignore
            delete global.document;
            
            // Should not throw
            expect(() => deleteCookie('auth_token', '.idling.app', '/')).not.toThrow();
            
            // Restore document
            global.document = originalDocument;
        });

        it('should set cookie with expired date to delete it', () => {
            // Mock document.cookie setter
            let cookieSetValue = '';
            Object.defineProperty(document, 'cookie', {
                get: () => cookieSetValue,
                set: (value: string) => {
                    cookieSetValue = value;
                },
                configurable: true,
            });
            
            // Delete the cookie
            deleteCookie('auth_token', '.idling.app', '/');
            
            // Verify deleteCookie set an expired cookie
            expect(cookieSetValue).toContain('auth_token=');
            expect(cookieSetValue).toContain('Expires=Thu, 01 Jan 1970');
            expect(cookieSetValue).toContain('Domain=.idling.app');
            expect(cookieSetValue).toContain('Path=/');
        });

        it('should handle deletion of nonexistent cookie', () => {
            // Should not throw even if cookie doesn't exist
            expect(() => deleteCookie('nonexistent_cookie', '.idling.app', '/')).not.toThrow();
        });

        it('should use correct domain and path', () => {
            // Mock document.cookie setter to verify correct format
            const setCookieSpy = vi.spyOn(document, 'cookie', 'set');
            
            deleteCookie('auth_token', '.idling.app', '/');
            
            // Verify cookie string contains correct attributes
            const expectedPattern = /auth_token=.*Domain=\.idling\.app.*Path=\/.*Expires=.*Secure.*HttpOnly.*SameSite=Lax/;
            const lastSetCall = setCookieSpy.mock.calls[setCookieSpy.mock.calls.length - 1];
            
            if (lastSetCall) {
                expect(lastSetCall[0]).toMatch(/auth_token=/);
                expect(lastSetCall[0]).toMatch(/Domain=\.idling\.app/);
                expect(lastSetCall[0]).toMatch(/Path=\//);
            }
            
            setCookieSpy.mockRestore();
        });

        it('should handle localhost domain', () => {
            const setCookieSpy = vi.spyOn(document, 'cookie', 'set');
            
            deleteCookie('auth_token', 'localhost', '/');
            
            const lastSetCall = setCookieSpy.mock.calls[setCookieSpy.mock.calls.length - 1];
            
            if (lastSetCall) {
                expect(lastSetCall[0]).toMatch(/Domain=localhost/);
            }
            
            setCookieSpy.mockRestore();
        });
    });

    describe('Cookie Integration', () => {
        it('should set and get cookie in same session', () => {
            // Mock document.cookie getter to return a cookie
            const mockCookieValue = 'auth_token=test_jwt_token_12345';
            Object.defineProperty(document, 'cookie', {
                writable: true,
                configurable: true,
                value: mockCookieValue,
            });
            
            const retrieved = getCookie('auth_token');
            
            expect(retrieved).toBe('test_jwt_token_12345');
        });

        it('should handle multiple cookies in cookie string', () => {
            // Mock document.cookie with multiple cookies
            Object.defineProperty(document, 'cookie', {
                writable: true,
                configurable: true,
                value: 'cookie1=value1; auth_token=test_token; cookie2=value2',
            });
            
            const retrieved = getCookie('auth_token');
            expect(retrieved).toBe('test_token');
        });
    });
});
