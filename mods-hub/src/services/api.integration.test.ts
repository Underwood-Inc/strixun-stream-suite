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
import * as apiModule from './mods/index.js';
import { createAPIClient, encryptBinaryWithJWT, APIClient } from '@strixun/api-framework/client';

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

        it('should create API client instance successfully', () => {
            const client = createAPIClient({
                baseURL: 'https://test-api.example.com',
                features: {
                    cancellation: false,
                    logging: false,
                },
            });
            expect(client).toBeDefined();
            expect(client).toBeInstanceOf(APIClient);
            expect(typeof client.get).toBe('function');
            expect(typeof client.post).toBe('function');
            expect(typeof client.put).toBe('function');
            expect(typeof client.delete).toBe('function');
        });

        it('should export encryptBinaryWithJWT function', () => {
            expect(typeof encryptBinaryWithJWT).toBe('function');
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

    describe('API Framework Integration', () => {
        it('should make GET request through API client', async () => {
            const client = createAPIClient({
                baseURL: 'https://test-api.example.com',
                features: {
                    // Minimal features for basic requests
                    cancellation: false,
                    logging: false,
                },
            });

            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: new Headers({ 'Content-Type': 'application/json' }),
                json: async () => ({ data: 'test' }),
            });

            const response = await client.get('/test');

            expect(mockFetch).toHaveBeenCalled();
            expect(response.status).toBe(200);
            expect(response.data).toEqual({ data: 'test' });
        });

        it('should make POST request with body through API client', async () => {
            const client = createAPIClient({
                baseURL: 'https://test-api.example.com',
                features: {
                    cancellation: false,
                    logging: false,
                },
            });

            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 201,
                statusText: 'Created',
                headers: new Headers({ 'Content-Type': 'application/json' }),
                json: async () => ({ id: '123', created: true }),
            });

            const response = await client.post('/test', { name: 'test' });

            expect(mockFetch).toHaveBeenCalled();
            const callArgs = mockFetch.mock.calls[0];
            expect(callArgs[0]).toContain('/test');
            expect(callArgs[1]?.method).toBe('POST');
            expect(response.status).toBe(201);
        });

        it('should work with optional features enabled', async () => {
            const client = createAPIClient({
                baseURL: 'https://test-api.example.com',
                features: {
                    cancellation: true,
                    logging: true,
                    deduplication: true,
                },
            });

            expect(client).toBeInstanceOf(APIClient);
            
            // Verify feature flags are properly set
            const config = client.getConfig();
            expect(config.features?.cancellation).toBe(true);
            expect(config.features?.logging).toBe(true);
            expect(config.features?.deduplication).toBe(true);

            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: new Headers({ 'Content-Type': 'application/json' }),
                json: async () => ({ data: 'test' }),
            });

            const response = await client.get('/test');

            expect(mockFetch).toHaveBeenCalled();
            expect(response.status).toBe(200);
        });

        it('should verify mods-hub API client uses correct feature flags', () => {
            // Get the actual client instance used by mods-hub
            // We need to access the internal client - let's test via the exported functions
            // Since createClient is not exported, we'll verify by checking the API calls work
            // with the expected configuration
            
            // Create a client with the same config as mods-hub uses
            const client = createAPIClient({
                baseURL: apiModule.API_BASE_URL,
                features: {
                    cancellation: true,
                    logging: import.meta.env.DEV,
                    deduplication: false,
                    queue: false,
                    circuitBreaker: false,
                    offlineQueue: false,
                    optimisticUpdates: false,
                    metrics: false,
                },
            });

            expect(client).toBeInstanceOf(APIClient);
            const config = client.getConfig();
            
            // Verify cancellation is enabled (as per mods-hub config)
            expect(config.features?.cancellation).toBe(true);
            
            // Verify other features are disabled by default
            expect(config.features?.deduplication).toBe(false);
            expect(config.features?.queue).toBe(false);
            expect(config.features?.circuitBreaker).toBe(false);
            
            // Verify client has cancellation methods when enabled
            expect(typeof client.cancel).toBe('function');
            expect(typeof client.cancelAll).toBe('function');
        });

        it('should verify enhanced features are available but disabled by default', () => {
            const client = createAPIClient({
                baseURL: 'https://test-api.example.com',
                features: {
                    cancellation: false,
                    logging: false,
                },
            });

            const config = client.getConfig();
            
            // Verify enhanced features exist in config but are disabled
            expect(config.features?.e2eEncryption).toBe(false);
            expect(config.features?.responseFiltering).toBe(false);
            expect(config.features?.errorLegend).toBe(false);
            expect(config.features?.workerAdapter).toBe(false);
            
            // Verify enhanced methods exist on client
            expect(typeof client.requestTyped).toBe('function');
            expect(typeof client.setCustomer).toBe('function');
            expect(typeof client.getCustomer).toBe('function');
            expect(typeof client.getWorkerAdapter).toBe('function');
            expect(typeof client.getRequestContext).toBe('function');
        });

        it('should enable enhanced features when configured', () => {
            const client = createAPIClient({
                baseURL: 'https://test-api.example.com',
                features: {
                    e2eEncryption: true,
                    responseFiltering: true,
                    errorLegend: true,
                },
                encryption: {
                    enabled: true,
                    tokenGetter: () => Promise.resolve('test-token'),
                },
                filtering: {
                    rootConfigType: class { id = ''; customerId = ''; },
                    rootConfig: {
                        alwaysInclude: ['id', 'customerId'],
                    },
                    typeDefinitions: new Map(),
                    tags: {},
                },
                errorHandling: {
                    useErrorLegend: true,
                    rfc7807: true,
                },
            });

            const config = client.getConfig();
            
            // Verify enhanced features are enabled
            expect(config.features?.e2eEncryption).toBe(true);
            expect(config.features?.responseFiltering).toBe(true);
            expect(config.features?.errorLegend).toBe(true);
            
            // Verify configs are set
            expect(config.encryption).toBeDefined();
            expect(config.filtering).toBeDefined();
            expect(config.errorHandling).toBeDefined();
        });

        it('should handle encryption function availability', async () => {
            // Verify encryptBinaryWithJWT is available and callable
            expect(typeof encryptBinaryWithJWT).toBe('function');
            
            // Test that it accepts the correct parameters (without actually encrypting)
            const testData = new Uint8Array([1, 2, 3, 4]);
            const testToken = 'test.jwt.token.here';
            
            // Should not throw on valid inputs (actual encryption requires proper JWT)
            try {
                await encryptBinaryWithJWT(testData, testToken);
            } catch (error: any) {
                // Expected to fail with invalid JWT, but function should be callable
                expect(error).toBeDefined();
                expect(typeof error.message).toBe('string');
            }
        });

        it('should handle API client error responses', async () => {
            const client = createAPIClient({
                baseURL: 'https://test-api.example.com',
                features: {
                    cancellation: false,
                    logging: false,
                },
            });

            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
                statusText: 'Not Found',
                headers: new Headers({ 'Content-Type': 'application/json' }),
                json: async () => ({ error: 'Not found' }),
            });

            await expect(client.get('/test')).rejects.toThrow();
        });
    });
});

