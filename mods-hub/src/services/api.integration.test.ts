/**
 * Integration Tests for Mods Hub API Service
 * 
 * Tests verify actual API framework integration:
 * - Real API client creation and configuration
 * - Token getter/expiration handling
 * - Request/response transformation
 * - Error handling through the framework
 * 
 * NOTE: These tests use the real API framework but mock fetch/network calls.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as apiModule from './api.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Mods Hub API Service - Integration Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset localStorage
        localStorage.clear();
        // Reset fetch mock
        mockFetch.mockClear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('API Client Configuration', () => {
        it('should use correct base URL from environment', () => {
            expect(apiModule.API_BASE_URL).toBeDefined();
            // In test environment, should use default or env var
            expect(typeof apiModule.API_BASE_URL).toBe('string');
        });
    });

    describe('Authentication Integration', () => {
        it('should include auth token from localStorage in requests', async () => {
            localStorage.setItem('auth_token', 'test-token-123');
            
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: new Headers({ 'Content-Type': 'application/json' }),
                json: async () => ({ mods: [], total: 0, page: 1, pageSize: 20 }),
            });

            await apiModule.listMods({});

            expect(mockFetch).toHaveBeenCalled();
            const callArgs = mockFetch.mock.calls[0];
            const headers = callArgs[1]?.headers as Headers;
            expect(headers?.get('Authorization')).toContain('test-token-123');
        });

        it('should fallback to access_token if auth_token not found', async () => {
            localStorage.setItem('access_token', 'fallback-token-456');
            
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: new Headers({ 'Content-Type': 'application/json' }),
                json: async () => ({ mods: [], total: 0, page: 1, pageSize: 20 }),
            });

            await apiModule.listMods({});

            expect(mockFetch).toHaveBeenCalled();
            const callArgs = mockFetch.mock.calls[0];
            const headers = callArgs[1]?.headers as Headers;
            expect(headers?.get('Authorization')).toContain('fallback-token-456');
        });

        it('should handle token expiration and dispatch logout event', async () => {
            localStorage.setItem('auth_token', 'expired-token');
            
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
                statusText: 'Unauthorized',
                headers: new Headers({ 'Content-Type': 'application/json' }),
                json: async () => ({ error: 'Token expired' }),
            });

            const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

            try {
                await apiModule.listMods({});
            } catch {
                // Expected to throw
            }

            // Verify logout event was dispatched
            expect(dispatchEventSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'auth:logout',
                })
            );
        });
    });

    describe('Request Transformation', () => {
        it('should properly format query parameters', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: new Headers({ 'Content-Type': 'application/json' }),
                json: async () => ({ mods: [], total: 0, page: 1, pageSize: 20 }),
            });

            await apiModule.listMods({
                page: 2,
                pageSize: 10,
                category: 'rpg',
                search: 'test query',
            });

            expect(mockFetch).toHaveBeenCalled();
            const url = mockFetch.mock.calls[0][0];
            expect(url).toContain('page=2');
            expect(url).toContain('pageSize=10');
            expect(url).toContain('category=rpg');
            expect(url).toContain('search=test+query');
        });

        it('should handle FormData for file uploads', async () => {
            const mockFile = new File(['content'], 'test.zip', { type: 'application/zip' });
            const mockMetadata = { 
                title: 'Test', 
                version: '1.0.0', 
                category: 'script' as const,
                description: 'Test description',
                tags: [],
                changelog: 'Test changelog',
                gameVersions: [],
                visibility: 'public' as const
            };
            
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 201,
                statusText: 'Created',
                headers: new Headers({ 'Content-Type': 'application/json' }),
                json: async () => ({ mod: { id: 'mod_123' }, version: { id: 'ver_123' } }),
            });

            await apiModule.uploadMod(mockFile, mockMetadata);

            expect(mockFetch).toHaveBeenCalled();
            const callArgs = mockFetch.mock.calls[0];
            const body = callArgs[1]?.body;
            expect(body).toBeInstanceOf(FormData);
        });
    });

    describe('Response Transformation', () => {
        it('should transform date strings to Date objects in listR2Files', async () => {
            const mockDate = '2024-01-01T00:00:00Z';
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: new Headers({ 'Content-Type': 'application/json' }),
                json: async () => ({
                    files: [
                        {
                            key: 'file1.zip',
                            size: 1024,
                            uploaded: mockDate,
                            contentType: 'application/zip',
                        },
                    ],
                    total: 1,
                }),
            });

            const result = await apiModule.listR2Files();

            expect(result.files[0].uploaded).toBeInstanceOf(Date);
            expect(result.files[0].uploaded.getTime()).toBe(new Date(mockDate).getTime());
        });

        it('should transform dates in detectDuplicates response', async () => {
            const mockDate = '2024-01-01T00:00:00Z';
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: new Headers({ 'Content-Type': 'application/json' }),
                json: async () => ({
                    duplicates: [
                        {
                            files: [
                                {
                                    key: 'file1.zip',
                                    size: 1024,
                                    uploaded: mockDate,
                                },
                            ],
                            size: 1024,
                            count: 1,
                        },
                    ],
                    orphaned: [
                        {
                            key: 'file2.zip',
                            size: 2048,
                            uploaded: mockDate,
                        },
                    ],
                }),
            });

            const result = await apiModule.detectDuplicates();

            expect(result.duplicateGroups[0].files[0].uploaded).toBeInstanceOf(Date);
            expect(result.orphanedFiles[0].uploaded).toBeInstanceOf(Date);
        });
    });

    describe('Error Handling', () => {
        it('should throw error on failed download', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
                statusText: 'Not Found',
                headers: new Headers({ 'Content-Type': 'application/json' }),
                arrayBuffer: async () => new ArrayBuffer(0),
            });

            await expect(
                apiModule.downloadVersion('test-slug', 'ver_123', 'test.zip')
            ).rejects.toThrow('Failed to download version');
        });

        it('should handle network errors gracefully', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            await expect(apiModule.listMods({})).rejects.toThrow();
        });
    });

    describe('Binary Response Handling', () => {
        it('should handle ArrayBuffer response for downloads', async () => {
            const mockArrayBuffer = new ArrayBuffer(8);
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: new Headers({ 'Content-Type': 'application/octet-stream' }),
                arrayBuffer: async () => mockArrayBuffer,
            });

            await apiModule.downloadVersion('test-slug', 'ver_123', 'test.zip');

            expect(global.URL.createObjectURL).toHaveBeenCalled();
            expect(document.createElement).toHaveBeenCalledWith('a');
        });
    });

    describe('URL Encoding', () => {
        it('should properly encode R2 file keys with special characters', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: new Headers({ 'Content-Type': 'application/json' }),
                json: async () => ({ success: true }),
            });

            await apiModule.deleteR2File('mods/test file.zip');

            expect(mockFetch).toHaveBeenCalled();
            const url = mockFetch.mock.calls[0][0];
            expect(url).toContain('mods%2Ftest%20file.zip');
        });
    });
});

