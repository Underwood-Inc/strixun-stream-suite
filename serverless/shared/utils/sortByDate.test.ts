/**
 * Tests for sortByDate utilities
 * Uses actual data schemas from mods-api for confidence
 */

import { describe, it, expect } from 'vitest';
import { sortByDateDesc, sortByDateAsc } from './sortByDate.js';

/**
 * ModVersion schema (matching serverless/mods-api/types/mod.ts)
 */
interface ModVersion {
    versionId: string;
    modId: string;
    version: string;
    changelog: string;
    fileSize: number;
    fileName: string;
    r2Key: string;
    downloadUrl: string;
    sha256: string;
    createdAt: string;
    downloads: number;
    gameVersions: string[];
}

/**
 * ModMetadata schema (matching serverless/mods-api/types/mod.ts)
 */
interface ModMetadata {
    modId: string;
    slug: string;
    authorId: string;
    title: string;
    description: string;
    category: string;
    tags: string[];
    createdAt: string;
    updatedAt: string;
    latestVersion: string;
    downloadCount: number;
    visibility: string;
    featured: boolean;
    customerId: string | null;
    status: string;
}

describe('sortByDateDesc', () => {
    describe('with ModVersion data (createdAt field)', () => {
        it('should sort versions newest first', () => {
            const versions: ModVersion[] = [
                createVersion('1.1.6', '2026-01-06T12:00:00.000Z'),
                createVersion('1.1.7', '2026-01-16T12:00:00.000Z'),
                createVersion('1.0.0', '2025-12-01T12:00:00.000Z'),
            ];

            versions.sort(sortByDateDesc('createdAt'));

            expect(versions[0].version).toBe('1.1.7'); // Jan 16 - newest
            expect(versions[1].version).toBe('1.1.6'); // Jan 6
            expect(versions[2].version).toBe('1.0.0'); // Dec 1 - oldest
        });

        it('should handle versions uploaded on same day with different times', () => {
            const versions: ModVersion[] = [
                createVersion('1.0.1', '2026-01-16T08:00:00.000Z'),
                createVersion('1.0.2', '2026-01-16T16:00:00.000Z'),
                createVersion('1.0.0', '2026-01-16T04:00:00.000Z'),
            ];

            versions.sort(sortByDateDesc('createdAt'));

            expect(versions[0].version).toBe('1.0.2'); // 4pm - newest
            expect(versions[1].version).toBe('1.0.1'); // 8am
            expect(versions[2].version).toBe('1.0.0'); // 4am - oldest
        });

        it('should handle ISO date strings without timezone', () => {
            const versions: ModVersion[] = [
                createVersion('1.0.0', '2026-01-06T12:00:00'),
                createVersion('1.0.1', '2026-01-16T12:00:00'),
            ];

            versions.sort(sortByDateDesc('createdAt'));

            expect(versions[0].version).toBe('1.0.1');
            expect(versions[1].version).toBe('1.0.0');
        });

        it('should handle date-only strings', () => {
            const versions: ModVersion[] = [
                createVersion('1.0.0', '2026-01-06'),
                createVersion('1.0.1', '2026-01-16'),
            ];

            versions.sort(sortByDateDesc('createdAt'));

            expect(versions[0].version).toBe('1.0.1');
            expect(versions[1].version).toBe('1.0.0');
        });
    });

    describe('with ModMetadata data (updatedAt field)', () => {
        it('should sort mods by updatedAt newest first', () => {
            const mods: ModMetadata[] = [
                createMod('old-mod', '2025-12-01T12:00:00.000Z'),
                createMod('new-mod', '2026-01-16T12:00:00.000Z'),
                createMod('mid-mod', '2026-01-06T12:00:00.000Z'),
            ];

            mods.sort(sortByDateDesc('updatedAt'));

            expect(mods[0].slug).toBe('new-mod');
            expect(mods[1].slug).toBe('mid-mod');
            expect(mods[2].slug).toBe('old-mod');
        });
    });

    describe('edge cases', () => {
        it('should handle null createdAt (sorts to end)', () => {
            const versions = [
                createVersion('1.0.0', '2026-01-16T12:00:00.000Z'),
                { ...createVersion('1.0.1', ''), createdAt: null as unknown as string },
            ];

            versions.sort(sortByDateDesc('createdAt'));

            expect(versions[0].version).toBe('1.0.0'); // Valid date first
            expect(versions[1].version).toBe('1.0.1'); // Null date last
        });

        it('should handle undefined createdAt (sorts to end)', () => {
            const versions = [
                createVersion('1.0.0', '2026-01-16T12:00:00.000Z'),
                { ...createVersion('1.0.1', ''), createdAt: undefined as unknown as string },
            ];

            versions.sort(sortByDateDesc('createdAt'));

            expect(versions[0].version).toBe('1.0.0');
            expect(versions[1].version).toBe('1.0.1');
        });

        it('should handle invalid date strings (sorts to end)', () => {
            const versions: ModVersion[] = [
                createVersion('1.0.0', '2026-01-16T12:00:00.000Z'),
                createVersion('1.0.1', 'not-a-date'),
                createVersion('1.0.2', 'invalid'),
            ];

            versions.sort(sortByDateDesc('createdAt'));

            expect(versions[0].version).toBe('1.0.0'); // Valid date first
            // Invalid dates sort to end (order between them is stable)
        });

        it('should handle empty string (sorts to end)', () => {
            const versions: ModVersion[] = [
                createVersion('1.0.0', '2026-01-16T12:00:00.000Z'),
                createVersion('1.0.1', ''),
            ];

            versions.sort(sortByDateDesc('createdAt'));

            expect(versions[0].version).toBe('1.0.0');
            expect(versions[1].version).toBe('1.0.1');
        });

        it('should handle empty array', () => {
            const versions: ModVersion[] = [];
            versions.sort(sortByDateDesc('createdAt'));
            expect(versions).toEqual([]);
        });

        it('should handle single item array', () => {
            const versions: ModVersion[] = [
                createVersion('1.0.0', '2026-01-16T12:00:00.000Z'),
            ];
            versions.sort(sortByDateDesc('createdAt'));
            expect(versions.length).toBe(1);
            expect(versions[0].version).toBe('1.0.0');
        });

        it('should handle two items with same date', () => {
            const versions: ModVersion[] = [
                createVersion('1.0.0', '2026-01-16T12:00:00.000Z'),
                createVersion('1.0.1', '2026-01-16T12:00:00.000Z'),
            ];
            versions.sort(sortByDateDesc('createdAt'));
            // Both have same date, order is stable
            expect(versions.length).toBe(2);
        });

        it('should handle mixed valid and invalid dates', () => {
            const versions = [
                createVersion('1.0.0', '2026-01-10T12:00:00.000Z'),
                { ...createVersion('1.0.1', ''), createdAt: null as unknown as string },
                createVersion('1.0.2', '2026-01-20T12:00:00.000Z'),
                createVersion('1.0.3', 'garbage'),
                createVersion('1.0.4', '2026-01-15T12:00:00.000Z'),
            ];

            versions.sort(sortByDateDesc('createdAt'));

            // Valid dates should be first, sorted newest to oldest
            expect(versions[0].version).toBe('1.0.2'); // Jan 20
            expect(versions[1].version).toBe('1.0.4'); // Jan 15
            expect(versions[2].version).toBe('1.0.0'); // Jan 10
            // Invalid dates at end (null, garbage)
        });
    });
});

describe('sortByDateAsc', () => {
    it('should sort versions oldest first', () => {
        const versions: ModVersion[] = [
            createVersion('1.1.7', '2026-01-16T12:00:00.000Z'),
            createVersion('1.1.6', '2026-01-06T12:00:00.000Z'),
            createVersion('1.0.0', '2025-12-01T12:00:00.000Z'),
        ];

        versions.sort(sortByDateAsc('createdAt'));

        expect(versions[0].version).toBe('1.0.0'); // Dec 1 - oldest
        expect(versions[1].version).toBe('1.1.6'); // Jan 6
        expect(versions[2].version).toBe('1.1.7'); // Jan 16 - newest
    });

    it('should handle null/undefined (sorts to start)', () => {
        const versions = [
            createVersion('1.0.0', '2026-01-16T12:00:00.000Z'),
            { ...createVersion('1.0.1', ''), createdAt: null as unknown as string },
        ];

        versions.sort(sortByDateAsc('createdAt'));

        expect(versions[0].version).toBe('1.0.1'); // Null first (0 timestamp)
        expect(versions[1].version).toBe('1.0.0'); // Valid date second
    });
});

// Helper to create ModVersion with required fields
function createVersion(version: string, createdAt: string): ModVersion {
    return {
        versionId: `ver_${version.replace(/\./g, '_')}`,
        modId: 'mod_test',
        version,
        changelog: `Changelog for ${version}`,
        fileSize: 1024,
        fileName: `test-${version}.jar`,
        r2Key: `mods/test/${version}.jar`,
        downloadUrl: `https://example.com/download/${version}`,
        sha256: 'abc123',
        createdAt,
        downloads: 0,
        gameVersions: ['1.21.11'],
    };
}

// Helper to create ModMetadata with required fields
function createMod(slug: string, updatedAt: string): ModMetadata {
    return {
        modId: `mod_${slug}`,
        slug,
        authorId: 'cust_test',
        title: slug,
        description: `Description for ${slug}`,
        category: 'plugin',
        tags: [],
        createdAt: updatedAt,
        updatedAt,
        latestVersion: '1.0.0',
        downloadCount: 0,
        visibility: 'public',
        featured: false,
        customerId: 'cust_test',
        status: 'approved',
    };
}
