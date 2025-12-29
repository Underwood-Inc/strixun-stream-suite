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
            // Set auth token required for upload
            localStorage.setItem('auth_token', 'test-token-123');
            
            const mockFile = new File(['content'], 'test.zip', { type: 'application/zip' });
            // Add arrayBuffer method to mock File
            mockFile.arrayBuffer = async () => new ArrayBuffer(8);
            
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

            expect(result.files).toBeDefined();
            expect(result.files).toHaveLength(1);
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
                    summary: {
                        totalFiles: 2,
                        referencedFiles: 1,
                        orphanedFiles: 1,
                        orphanedSize: 2048,
                        duplicateGroups: 1,
                        duplicateWastedSize: 0,
                    },
                    duplicateGroups: [
                        {
                            files: [
                                {
                                    key: 'file1.zip',
                                    size: 1024,
                                    uploaded: mockDate,
                                },
                            ],
                            count: 1,
                            totalSize: 1024,
                        },
                    ],
                    orphanedFiles: [
                        {
                            key: 'file2.zip',
                            size: 2048,
                            uploaded: mockDate,
                        },
                    ],
                }),
            });

            const result = await apiModule.detectDuplicates();

            expect(result.duplicateGroups).toBeDefined();
            expect(result.orphanedFiles).toBeDefined();
            expect(result.duplicateGroups).toHaveLength(1);
            expect(result.duplicateGroups[0].files).toHaveLength(1);
            expect(result.duplicateGroups[0].files[0].uploaded).toBeInstanceOf(Date);
            expect(result.orphanedFiles).toHaveLength(1);
            expect(result.orphanedFiles[0].uploaded).toBeInstanceOf(Date);
        });
    });

    describe('Error Handling', () => {
        it('should throw error on failed download', async () => {
            // The API framework will throw an error for non-2xx responses
            // We need to mock a response that the framework will process as an error
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
                statusText: 'Not Found',
                headers: new Headers({ 'Content-Type': 'application/json' }),
                json: async () => ({ error: 'Not found' }),
                arrayBuffer: async () => new ArrayBuffer(0),
            });

            // The framework will throw an APIError, but downloadVersion should catch and re-throw
            // with its own message, OR the framework error will propagate
            await expect(
                apiModule.downloadVersion('test-slug', 'ver_123', 'test.zip')
            ).rejects.toThrow();
        });

        it('should handle network errors gracefully', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            await expect(apiModule.listMods({})).rejects.toThrow();
        });
    });

    describe('Binary Response Handling', () => {
        it('should handle ArrayBuffer response for downloads', async () => {
            const mockArrayBuffer = new ArrayBuffer(8);
            // Mock URL.createObjectURL and document.createElement
            const createObjectURLSpy = vi.spyOn(global.URL, 'createObjectURL').mockReturnValue('blob:mock-url');
            const mockLink = {
                href: '',
                download: '',
                click: vi.fn(),
            };
            const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
            const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as any);
            const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as any);
            const revokeObjectURLSpy = vi.spyOn(global.URL, 'revokeObjectURL').mockImplementation(() => {});
            
            // Mock the API framework to return ArrayBuffer directly
            // The framework converts binary responses to ArrayBuffer
            // Use Response constructor for proper Response object
            const mockResponse = new Response(mockArrayBuffer, {
                status: 200,
                statusText: 'OK',
                headers: { 'Content-Type': 'application/octet-stream' },
            });
            mockFetch.mockResolvedValueOnce(mockResponse);

            await apiModule.downloadVersion('test-slug', 'ver_123', 'test.zip');

            expect(createObjectURLSpy).toHaveBeenCalled();
            expect(createElementSpy).toHaveBeenCalledWith('a');
            expect(mockLink.click).toHaveBeenCalled();
            
            // Cleanup
            createObjectURLSpy.mockRestore();
            createElementSpy.mockRestore();
            appendChildSpy.mockRestore();
            removeChildSpy.mockRestore();
            revokeObjectURLSpy.mockRestore();
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

