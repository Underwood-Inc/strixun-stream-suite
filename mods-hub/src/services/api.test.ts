/**
 * Unit Tests for Mods Hub API Service
 * 
 * Tests all API functions with mocked API client to ensure:
 * - Correct API calls are made
 * - Parameters are properly formatted
 * - Responses are correctly transformed
 * - Error handling works correctly
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    API_BASE_URL,
    listMods,
    getModDetail,
    uploadMod,
    updateMod,
    deleteMod,
    uploadVersion,
    listAllMods,
    getModReview,
    updateModStatus,
    addReviewComment,
    adminDeleteMod,
    getModRatings,
    submitModRating,
    listUsers,
    getUserDetails,
    updateUser,
    getUserMods,
    checkUploadPermission,
    getAdminSettings,
    updateAdminSettings,
    downloadVersion,
    listR2Files,
    detectDuplicates,
    deleteR2File,
    bulkDeleteR2Files,
} from './api.js';

// Mock the API framework client
const mockApiClient = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
};

vi.mock('@strixun/api-framework/client', () => ({
    createAPIClient: vi.fn(() => mockApiClient),
}));

describe('Mods Hub API Service - Unit Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('API_BASE_URL', () => {
        it('should export API_BASE_URL constant', () => {
            expect(API_BASE_URL).toBeDefined();
            expect(typeof API_BASE_URL).toBe('string');
        });
    });

    describe('listMods', () => {
        it('should call API with correct endpoint and no filters', async () => {
            const mockResponse = {
                data: {
                    mods: [],
                    total: 0,
                    page: 1,
                    pageSize: 20,
                },
                status: 200,
                statusText: 'OK',
            };
            mockApiClient.get.mockResolvedValue(mockResponse);

            const result = await listMods({});

            expect(mockApiClient.get).toHaveBeenCalledWith('/mods');
            expect(result).toEqual(mockResponse.data);
        });

        it('should build query string with all filters', async () => {
            const mockResponse = {
                data: {
                    mods: [{ id: '1' }],
                    total: 1,
                    page: 2,
                    pageSize: 10,
                },
                status: 200,
                statusText: 'OK',
            };
            mockApiClient.get.mockResolvedValue(mockResponse);

            await listMods({
                page: 2,
                pageSize: 10,
                category: 'rpg',
                search: 'test',
                authorId: 'user_123',
                featured: true,
                visibility: 'public',
            });

            expect(mockApiClient.get).toHaveBeenCalledWith(
                '/mods?page=2&pageSize=10&category=rpg&search=test&authorId=user_123&featured=true&visibility=public'
            );
        });

        it('should handle undefined filters correctly', async () => {
            const mockResponse = {
                data: { mods: [], total: 0, page: 1, pageSize: 20 },
                status: 200,
                statusText: 'OK',
            };
            mockApiClient.get.mockResolvedValue(mockResponse);

            await listMods({
                page: 1,
                featured: false,
            });

            expect(mockApiClient.get).toHaveBeenCalledWith(
                '/mods?page=1&featured=false'
            );
        });
    });

    describe('getModDetail', () => {
        it('should call API with correct endpoint', async () => {
            const mockResponse = {
                data: { id: 'mod_123', title: 'Test Mod' },
                status: 200,
                statusText: 'OK',
            };
            mockApiClient.get.mockResolvedValue(mockResponse);

            const result = await getModDetail('test-slug');

            expect(mockApiClient.get).toHaveBeenCalledWith('/mods/test-slug');
            expect(result).toEqual(mockResponse.data);
        });
    });

    describe('uploadMod', () => {
        it('should create FormData and call API with file and metadata', async () => {
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
            const mockResponse = {
                data: { mod: { id: 'mod_123' }, version: { id: 'ver_123' } },
                status: 201,
                statusText: 'Created',
            };
            mockApiClient.post.mockResolvedValue(mockResponse);

            const result = await uploadMod(mockFile, mockMetadata);

            expect(mockApiClient.post).toHaveBeenCalledWith(
                '/mods',
                expect.any(FormData)
            );
            expect(result).toEqual(mockResponse.data);
        });

        it('should include thumbnail in FormData when provided', async () => {
            const mockFile = new File(['content'], 'test.zip', { type: 'application/zip' });
            const mockThumbnail = new File(['image'], 'thumb.png', { type: 'image/png' });
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
            const mockResponse = {
                data: { mod: { id: 'mod_123' }, version: { id: 'ver_123' } },
                status: 201,
                statusText: 'Created',
            };
            mockApiClient.post.mockResolvedValue(mockResponse);

            await uploadMod(mockFile, mockMetadata, mockThumbnail);

            expect(mockApiClient.post).toHaveBeenCalledWith(
                '/mods',
                expect.any(FormData)
            );
        });
    });

    describe('updateMod', () => {
        it('should call API with correct endpoint and updates', async () => {
            const mockUpdates = { title: 'Updated Title', description: 'New description' };
            const mockResponse = {
                data: { id: 'mod_123', ...mockUpdates },
                status: 200,
                statusText: 'OK',
            };
            mockApiClient.put.mockResolvedValue(mockResponse);

            const result = await updateMod('test-slug', mockUpdates);

            expect(mockApiClient.put).toHaveBeenCalledWith('/mods/test-slug', mockUpdates);
            expect(result).toEqual(mockResponse.data);
        });
    });

    describe('deleteMod', () => {
        it('should call API delete with correct endpoint', async () => {
            mockApiClient.delete.mockResolvedValue({ status: 200, statusText: 'OK' });

            await deleteMod('test-slug');

            expect(mockApiClient.delete).toHaveBeenCalledWith('/mods/test-slug');
        });
    });

    describe('uploadVersion', () => {
        it('should create FormData and call API with file and metadata', async () => {
            const mockFile = new File(['content'], 'v2.zip', { type: 'application/zip' });
            const mockMetadata = { version: '2.0.0', changelog: 'Updates', gameVersions: [] };
            const mockResponse = {
                data: { id: 'ver_456' },
                status: 201,
                statusText: 'Created',
            };
            mockApiClient.post.mockResolvedValue(mockResponse);

            const result = await uploadVersion('mod_123', mockFile, mockMetadata);

            expect(mockApiClient.post).toHaveBeenCalledWith(
                '/mods/mod_123/versions',
                expect.any(FormData)
            );
            expect(result).toEqual(mockResponse.data);
        });
    });

    describe('listAllMods', () => {
        it('should call admin endpoint with filters', async () => {
            const mockResponse = {
                data: { mods: [], total: 0, page: 1, pageSize: 20 },
                status: 200,
                statusText: 'OK',
            };
            mockApiClient.get.mockResolvedValue(mockResponse);

            await listAllMods({ page: 1, status: 'pending' });

            expect(mockApiClient.get).toHaveBeenCalledWith(
                '/admin/mods?page=1&status=pending'
            );
        });
    });

    describe('getModReview', () => {
        it('should call API with review endpoint', async () => {
            const mockResponse = {
                data: { modId: 'mod_123', status: 'pending' },
                status: 200,
                statusText: 'OK',
            };
            mockApiClient.get.mockResolvedValue(mockResponse);

            const result = await getModReview('test-slug');

            expect(mockApiClient.get).toHaveBeenCalledWith('/mods/test-slug/review');
            expect(result).toEqual(mockResponse.data);
        });
    });

    describe('updateModStatus', () => {
        it('should call API with status update', async () => {
            const mockResponse = {
                data: { id: 'mod_123', status: 'approved' },
                status: 200,
                statusText: 'OK',
            };
            mockApiClient.put.mockResolvedValue(mockResponse);

            const result = await updateModStatus('mod_123', 'approved', 'Looks good');

            expect(mockApiClient.put).toHaveBeenCalledWith(
                '/admin/mods/mod_123/status',
                { status: 'approved', reason: 'Looks good' }
            );
            expect(result).toEqual(mockResponse.data);
        });

        it('should handle optional reason parameter', async () => {
            const mockResponse = {
                data: { id: 'mod_123', status: 'denied' },
                status: 200,
                statusText: 'OK',
            };
            mockApiClient.put.mockResolvedValue(mockResponse);

            await updateModStatus('mod_123', 'denied');

            expect(mockApiClient.put).toHaveBeenCalledWith(
                '/admin/mods/mod_123/status',
                { status: 'denied', reason: undefined }
            );
        });
    });

    describe('addReviewComment', () => {
        it('should call API with comment', async () => {
            const mockResponse = {
                data: { id: 'comment_123', content: 'Test comment' },
                status: 201,
                statusText: 'Created',
            };
            mockApiClient.post.mockResolvedValue(mockResponse);

            const result = await addReviewComment('mod_123', 'Test comment');

            expect(mockApiClient.post).toHaveBeenCalledWith(
                '/mods/mod_123/review/comments',
                { content: 'Test comment' }
            );
            expect(result).toEqual(mockResponse.data);
        });
    });

    describe('adminDeleteMod', () => {
        it('should call admin delete endpoint', async () => {
            mockApiClient.delete.mockResolvedValue({ status: 200, statusText: 'OK' });

            await adminDeleteMod('mod_123');

            expect(mockApiClient.delete).toHaveBeenCalledWith('/admin/mods/mod_123');
        });
    });

    describe('getModRatings', () => {
        it('should call API and return ratings', async () => {
            const mockResponse = {
                data: {
                    ratings: [{ rating: 5, comment: 'Great!' }],
                    average: 5,
                    total: 1,
                },
                status: 200,
                statusText: 'OK',
            };
            mockApiClient.get.mockResolvedValue(mockResponse);

            const result = await getModRatings('mod_123');

            expect(mockApiClient.get).toHaveBeenCalledWith('/mods/mod_123/ratings');
            expect(result).toEqual(mockResponse.data);
        });
    });

    describe('submitModRating', () => {
        it('should call API with rating and optional comment', async () => {
            const mockResponse = {
                data: { id: 'rating_123', rating: 5 },
                status: 201,
                statusText: 'Created',
            };
            mockApiClient.post.mockResolvedValue(mockResponse);

            const result = await submitModRating('mod_123', 5, 'Great mod!');

            expect(mockApiClient.post).toHaveBeenCalledWith(
                '/mods/mod_123/ratings',
                { rating: 5, comment: 'Great mod!' }
            );
            expect(result).toEqual(mockResponse.data);
        });

        it('should handle rating without comment', async () => {
            const mockResponse = {
                data: { id: 'rating_123', rating: 4 },
                status: 201,
                statusText: 'Created',
            };
            mockApiClient.post.mockResolvedValue(mockResponse);

            await submitModRating('mod_123', 4);

            expect(mockApiClient.post).toHaveBeenCalledWith(
                '/mods/mod_123/ratings',
                { rating: 4, comment: undefined }
            );
        });
    });

    describe('listUsers', () => {
        it('should call admin users endpoint with filters', async () => {
            const mockResponse = {
                data: { users: [], total: 0, page: 1, pageSize: 20 },
                status: 200,
                statusText: 'OK',
            };
            mockApiClient.get.mockResolvedValue(mockResponse);

            await listUsers({ page: 1, search: 'test' });

            expect(mockApiClient.get).toHaveBeenCalledWith(
                '/admin/users?page=1&search=test'
            );
        });
    });

    describe('getUserDetails', () => {
        it('should call API with user ID', async () => {
            const mockResponse = {
                data: { id: 'user_123', email: 'test@example.com' },
                status: 200,
                statusText: 'OK',
            };
            mockApiClient.get.mockResolvedValue(mockResponse);

            const result = await getUserDetails('user_123');

            expect(mockApiClient.get).toHaveBeenCalledWith('/admin/users/user_123');
            expect(result).toEqual(mockResponse.data);
        });
    });

    describe('updateUser', () => {
        it('should call API with user updates', async () => {
            const mockUpdates = { displayName: 'New Name' };
            const mockResponse = {
                data: { id: 'user_123', ...mockUpdates },
                status: 200,
                statusText: 'OK',
            };
            mockApiClient.put.mockResolvedValue(mockResponse);

            const result = await updateUser('user_123', mockUpdates);

            expect(mockApiClient.put).toHaveBeenCalledWith(
                '/admin/users/user_123',
                mockUpdates
            );
            expect(result).toEqual(mockResponse.data);
        });
    });

    describe('getUserMods', () => {
        it('should call API with user ID and pagination', async () => {
            const mockResponse = {
                data: { mods: [], total: 0, page: 1, pageSize: 20 },
                status: 200,
                statusText: 'OK',
            };
            mockApiClient.get.mockResolvedValue(mockResponse);

            await getUserMods('user_123', { page: 1, pageSize: 10 });

            expect(mockApiClient.get).toHaveBeenCalledWith(
                '/admin/users/user_123/mods?page=1&pageSize=10'
            );
        });
    });

    describe('checkUploadPermission', () => {
        it('should call permissions endpoint', async () => {
            const mockResponse = {
                data: { hasPermission: true },
                status: 200,
                statusText: 'OK',
            };
            mockApiClient.get.mockResolvedValue(mockResponse);

            const result = await checkUploadPermission();

            expect(mockApiClient.get).toHaveBeenCalledWith('/mods/permissions/me');
            expect(result).toEqual(mockResponse.data);
        });
    });

    describe('getAdminSettings', () => {
        it('should call admin settings endpoint', async () => {
            const mockResponse = {
                data: {
                    allowedFileExtensions: ['.zip', '.rar'],
                    updatedAt: '2024-01-01T00:00:00Z',
                    updatedBy: 'admin_123',
                },
                status: 200,
                statusText: 'OK',
            };
            mockApiClient.get.mockResolvedValue(mockResponse);

            const result = await getAdminSettings();

            expect(mockApiClient.get).toHaveBeenCalledWith('/admin/settings');
            expect(result).toEqual(mockResponse.data);
        });
    });

    describe('updateAdminSettings', () => {
        it('should call API with settings update', async () => {
            const mockSettings = { allowedFileExtensions: ['.zip'] };
            const mockResponse = {
                data: {
                    ...mockSettings,
                    updatedAt: '2024-01-01T00:00:00Z',
                    updatedBy: 'admin_123',
                },
                status: 200,
                statusText: 'OK',
            };
            mockApiClient.put.mockResolvedValue(mockResponse);

            const result = await updateAdminSettings(mockSettings);

            expect(mockApiClient.put).toHaveBeenCalledWith('/admin/settings', mockSettings);
            expect(result).toEqual(mockResponse.data);
        });
    });

    describe('downloadVersion', () => {
        it('should download file and trigger download', async () => {
            const mockArrayBuffer = new ArrayBuffer(8);
            const mockResponse = {
                data: mockArrayBuffer,
                status: 200,
                statusText: 'OK',
            };
            mockApiClient.get.mockResolvedValue(mockResponse);

            await downloadVersion('test-slug', 'ver_123', 'test.zip');

            expect(mockApiClient.get).toHaveBeenCalledWith(
                '/mods/test-slug/versions/ver_123/download'
            );
            expect(global.URL.createObjectURL).toHaveBeenCalled();
            expect(document.createElement).toHaveBeenCalledWith('a');
        });

        it('should throw error on failed download', async () => {
            const mockResponse = {
                data: new ArrayBuffer(0),
                status: 404,
                statusText: 'Not Found',
            };
            mockApiClient.get.mockResolvedValue(mockResponse);

            await expect(
                downloadVersion('test-slug', 'ver_123', 'test.zip')
            ).rejects.toThrow('Failed to download version: Not Found');
        });
    });

    describe('listR2Files', () => {
        it('should call API and transform dates', async () => {
            const mockResponse = {
                data: {
                    files: [
                        {
                            key: 'file1.zip',
                            size: 1024,
                            uploaded: '2024-01-01T00:00:00Z',
                            contentType: 'application/zip',
                        },
                    ],
                    total: 1,
                },
                status: 200,
                statusText: 'OK',
            };
            mockApiClient.get.mockResolvedValue(mockResponse);

            const result = await listR2Files();

            expect(mockApiClient.get).toHaveBeenCalledWith('/admin/r2/files');
            expect(result.files[0].uploaded).toBeInstanceOf(Date);
        });

        it('should include limit in query string when provided', async () => {
            const mockResponse = {
                data: { files: [], total: 0 },
                status: 200,
                statusText: 'OK',
            };
            mockApiClient.get.mockResolvedValue(mockResponse);

            await listR2Files({ limit: 50 });

            expect(mockApiClient.get).toHaveBeenCalledWith('/admin/r2/files?limit=50');
        });
    });

    describe('detectDuplicates', () => {
        it('should call API and transform dates in duplicates and orphaned', async () => {
            const mockResponse = {
                data: {
                    duplicates: [
                        {
                            files: [
                                {
                                    key: 'file1.zip',
                                    size: 1024,
                                    uploaded: '2024-01-01T00:00:00Z',
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
                            uploaded: '2024-01-02T00:00:00Z',
                        },
                    ],
                },
                status: 200,
                statusText: 'OK',
            };
            mockApiClient.get.mockResolvedValue(mockResponse);

            const result = await detectDuplicates();

            expect(mockApiClient.get).toHaveBeenCalledWith('/admin/r2/duplicates');
            expect(result.duplicateGroups[0].files[0].uploaded).toBeInstanceOf(Date);
            expect(result.orphanedFiles[0].uploaded).toBeInstanceOf(Date);
        });
    });

    describe('deleteR2File', () => {
        it('should encode key and call delete endpoint', async () => {
            mockApiClient.delete.mockResolvedValue({ status: 200, statusText: 'OK' });

            await deleteR2File('mods/test file.zip');

            expect(mockApiClient.delete).toHaveBeenCalledWith(
                '/admin/r2/files/mods%2Ftest%20file.zip'
            );
        });
    });

    describe('bulkDeleteR2Files', () => {
        it('should call API with keys array', async () => {
            const mockResponse = {
                data: { deleted: 2, failed: 0 },
                status: 200,
                statusText: 'OK',
            };
            mockApiClient.post.mockResolvedValue(mockResponse);

            const result = await bulkDeleteR2Files(['file1.zip', 'file2.zip']);

            expect(mockApiClient.post).toHaveBeenCalledWith(
                '/admin/r2/files/delete',
                { keys: ['file1.zip', 'file2.zip'] }
            );
            expect(result).toEqual(mockResponse.data);
        });

        it('should handle errors in response', async () => {
            const mockResponse = {
                data: {
                    deleted: 1,
                    failed: 1,
                    errors: [{ key: 'file2.zip', error: 'Not found' }],
                },
                status: 200,
                statusText: 'OK',
            };
            mockApiClient.post.mockResolvedValue(mockResponse);

            const result = await bulkDeleteR2Files(['file1.zip', 'file2.zip']);

            expect(result.errors).toBeDefined();
            expect(result.errors?.[0].error).toBe('Not found');
        });
    });
});

