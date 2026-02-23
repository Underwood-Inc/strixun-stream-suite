/**
 * DownloadCounter Durable Object
 *
 * Provides race-condition-free download counter increments.
 * Each instance is keyed by modId — all downloads for a single mod
 * (versions + variants) are serialized through one DO instance.
 *
 * Counters are stored in DO transactional storage (source of truth)
 * and synced back to KV entities so the existing read paths stay unchanged.
 */

import { DurableObject } from 'cloudflare:workers';
import {
    getEntity,
    putEntity,
} from '@strixun/kv-entities';
import type { ModMetadata, ModVersion } from '../types/mod.js';

interface Env {
    MODS_KV: KVNamespace;
    [key: string]: any;
}

export class DownloadCounter extends DurableObject<Env> {

    /**
     * Atomically increment download counters for a mod download event.
     *
     * Because Durable Objects process one request at a time, concurrent
     * calls to this method are serialized — no lost updates, ever.
     *
     * @param modId      - The mod whose counters to bump
     * @param versionId  - The specific version that was downloaded
     * @param variantId  - Optional variant whose totalDownloads should also bump
     */
    async increment(
        modId: string,
        versionId: string,
        variantId?: string | null,
    ): Promise<void> {
        // -- 1. Increment counters in DO storage (atomic, single-threaded) -----

        const modKey = 'modDownloads';
        const versionKey = `version:${versionId}`;
        const variantKey = variantId ? `variant:${variantId}` : null;

        let modCount = await this.ctx.storage.get<number>(modKey);
        let versionCount = await this.ctx.storage.get<number>(versionKey);

        // Seed from KV on first encounter so existing counts aren't lost
        if (modCount === undefined) {
            const mod = await getEntity<ModMetadata>(this.env.MODS_KV, 'mods', 'mod', modId);
            modCount = mod?.downloadCount ?? 0;
        }
        if (versionCount === undefined) {
            const ver = await getEntity<ModVersion>(this.env.MODS_KV, 'mods', 'version', versionId);
            versionCount = ver?.downloads ?? 0;
        }

        modCount += 1;
        versionCount += 1;

        const batch: Record<string, number> = {
            [modKey]: modCount,
            [versionKey]: versionCount,
        };

        let variantCount: number | undefined;
        if (variantKey) {
            variantCount = await this.ctx.storage.get<number>(variantKey);
            if (variantCount === undefined) {
                const mod = await getEntity<ModMetadata>(this.env.MODS_KV, 'mods', 'mod', modId);
                const variant = mod?.variants?.find(v => v.variantId === variantId);
                variantCount = variant?.totalDownloads ?? 0;
            }
            variantCount += 1;
            batch[variantKey] = variantCount;
        }

        // Batch put is atomic in DO storage
        await this.ctx.storage.put(batch);

        // -- 2. Sync authoritative counts back to KV -------------------------
        //    The DO is the single writer for these counter fields, so even if
        //    a concurrent metadata update races on the KV key, the next
        //    download will restore the correct count.

        await this.syncToKV(modId, modCount, versionId, versionCount, variantId ?? null, variantCount ?? null);
    }

    private async syncToKV(
        modId: string,
        modCount: number,
        versionId: string,
        versionCount: number,
        variantId: string | null,
        variantCount: number | null,
    ): Promise<void> {
        // Sync version
        try {
            const freshVersion = await getEntity<ModVersion>(this.env.MODS_KV, 'mods', 'version', versionId);
            if (freshVersion) {
                freshVersion.downloads = versionCount;
                await putEntity(this.env.MODS_KV, 'mods', 'version', versionId, freshVersion);
            }
        } catch (err) {
            console.error('[DownloadCounter] Failed to sync version count to KV:', err);
        }

        // Sync mod (and variant if applicable)
        try {
            const freshMod = await getEntity<ModMetadata>(this.env.MODS_KV, 'mods', 'mod', modId);
            if (freshMod) {
                freshMod.downloadCount = modCount;

                if (variantId && variantCount !== null && freshMod.variants) {
                    const variant = freshMod.variants.find(v => v.variantId === variantId);
                    if (variant) {
                        variant.totalDownloads = variantCount;
                    }
                }

                await putEntity(this.env.MODS_KV, 'mods', 'mod', modId, freshMod);
            }
        } catch (err) {
            console.error('[DownloadCounter] Failed to sync mod count to KV:', err);
        }
    }
}
