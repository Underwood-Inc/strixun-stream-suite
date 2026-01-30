#!/usr/bin/env node
/**
 * Shared CI Migration Runner
 * 
 * Reusable migration runner for all services during GitHub Actions deployment.
 * Each service imports this and provides its config + migration implementations.
 * 
 * Usage:
 *   import { runMigrations } from '../../scripts/ci-migration-runner.js';
 *   runMigrations({
 *     servicePrefix: 'mods',
 *     kvBinding: 'MODS_KV',
 *     migrations: [
 *       { id: '001_example', run: (ns) => { ... } }
 *     ]
 *   });
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Get KV namespace ID from wrangler.toml
 */
export function getKvNamespaceId(wranglerPath, kvBinding) {
    try {
        const content = fs.readFileSync(wranglerPath, 'utf8');
        
        // Try multiple regex patterns to find the namespace ID
        const patterns = [
            new RegExp(`\\[\\[kv_namespaces\\]\\][^\\[]*binding\\s*=\\s*"${kvBinding}"[^\\[]*id\\s*=\\s*"([^"]+)"`, 's'),
            new RegExp(`binding\\s*=\\s*"${kvBinding}"[^\\]]*id\\s*=\\s*"([^"]+)"`, 's'),
            new RegExp(`id\\s*=\\s*"([^"]+)"[^\\]]*binding\\s*=\\s*"${kvBinding}"`, 's'),
        ];
        
        for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match) return match[1];
        }
        
        console.log(`⚠️  Could not find ${kvBinding} namespace ID in wrangler.toml`);
        return null;
    } catch (err) {
        console.error('Failed to read wrangler.toml:', err.message);
        return null;
    }
}

/**
 * Check if a migration has been run
 */
export function isMigrationRun(namespaceId, servicePrefix, migrationId) {
    const key = `migration_${servicePrefix}_${migrationId}`;
    try {
        const result = execSync(`pnpm exec wrangler kv key get "${key}" --namespace-id ${namespaceId} --remote`, {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe']
        });
        return result.trim() === 'true';
    } catch {
        return false;
    }
}

/**
 * Mark a migration as run
 */
export function markMigrationRun(namespaceId, servicePrefix, migrationId) {
    const key = `migration_${servicePrefix}_${migrationId}`;
    try {
        execSync(`pnpm exec wrangler kv key put "${key}" "true" --namespace-id ${namespaceId} --remote`, {
            encoding: 'utf8',
            stdio: 'inherit'
        });
        return true;
    } catch (err) {
        console.error(`Failed to mark migration ${migrationId} as run:`, err.message);
        return false;
    }
}

/**
 * List all keys with prefix
 */
export function listKeys(namespaceId, prefix) {
    try {
        const result = execSync(`pnpm exec wrangler kv key list --namespace-id ${namespaceId} --prefix "${prefix}" --remote`, {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe'],
            maxBuffer: 50 * 1024 * 1024
        });
        return JSON.parse(result);
    } catch {
        return [];
    }
}

/**
 * Get a value from KV
 */
export function kvGet(namespaceId, key) {
    try {
        return execSync(`pnpm exec wrangler kv key get "${key}" --namespace-id ${namespaceId} --remote`, {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe']
        });
    } catch {
        return null;
    }
}

/**
 * Put a value to KV
 */
export function kvPut(namespaceId, key, value) {
    try {
        const tempFile = `/tmp/kv-value-${Date.now()}-${Math.random().toString(36).substring(7)}.txt`;
        fs.writeFileSync(tempFile, value);
        execSync(`pnpm exec wrangler kv key put "${key}" --namespace-id ${namespaceId} --path "${tempFile}" --remote`, {
            encoding: 'utf8',
            stdio: 'inherit'
        });
        fs.unlinkSync(tempFile);
        return true;
    } catch (err) {
        console.error(`Failed to put key ${key}:`, err.message);
        return false;
    }
}

/**
 * Delete a key from KV
 */
export function kvDelete(namespaceId, key) {
    try {
        execSync(`pnpm exec wrangler kv key delete "${key}" --namespace-id ${namespaceId} --force --remote`, {
            encoding: 'utf8',
            stdio: 'inherit'
        });
        return true;
    } catch {
        return false;
    }
}

/**
 * Main migration runner
 * 
 * @param {Object} config
 * @param {string} config.servicePrefix - Service prefix for migration keys (e.g., 'mods')
 * @param {string} config.kvBinding - KV binding name from wrangler.toml (e.g., 'MODS_KV')
 * @param {string} config.wranglerPath - Path to wrangler.toml
 * @param {Array} config.migrations - Array of migration objects with { id, description?, run? }
 */
export async function runMigrations(config) {
    const { servicePrefix, kvBinding, wranglerPath, migrations = [] } = config;
    const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
    
    // GitHub Actions annotation helpers
    const ghNotice = (title, msg) => isCI ? console.log(`::notice title=${title}::${msg}`) : console.log(`[NOTICE] ${title}: ${msg}`);
    const ghWarning = (title, msg) => isCI ? console.log(`::warning title=${title}::${msg}`) : console.log(`[WARNING] ${title}: ${msg}`);
    const ghError = (title, msg) => isCI ? console.log(`::error title=${title}::${msg}`) : console.log(`[ERROR] ${title}: ${msg}`);
    const ghGroup = (name) => isCI ? console.log(`::group::${name}`) : console.log(`\n=== ${name} ===`);
    const ghEndGroup = () => isCI ? console.log('::endgroup::') : console.log('');
    
    ghGroup(`Migrations for ${servicePrefix}`);
    console.log(`Service: ${servicePrefix}`);
    console.log(`KV Binding: ${kvBinding}`);
    console.log(`Total registered: ${migrations.length}`);
    
    const namespaceId = getKvNamespaceId(wranglerPath, kvBinding);
    if (!namespaceId) {
        ghWarning(`${servicePrefix} migrations`, `No KV namespace found for ${kvBinding} - skipping migrations`);
        ghEndGroup();
        return { success: true, ran: [], skipped: [], pending: [] };
    }
    console.log(`Namespace ID: ${namespaceId}`);
    
    if (migrations.length === 0) {
        ghNotice(`${servicePrefix} migrations`, 'No migrations registered for this service');
        ghEndGroup();
        return { success: true, ran: [], skipped: [], pending: [] };
    }
    
    const ran = [];
    const skipped = [];
    const failed = [];
    const pending = [];
    
    console.log('');
    console.log('Checking migration status...');
    
    for (const migration of migrations) {
        const alreadyRun = isMigrationRun(namespaceId, servicePrefix, migration.id);
        
        if (alreadyRun) {
            console.log(`  ⏭️  ${migration.id} - already run`);
            skipped.push(migration.id);
            continue;
        }
        
        if (!migration.run) {
            console.log(`  ⚠️  ${migration.id} - pending (no CI implementation)`);
            pending.push(migration.id);
            continue;
        }
        
        console.log(`  🔄 ${migration.id} - running...`);
        if (migration.description) {
            console.log(`     ${migration.description}`);
        }
        
        try {
            await migration.run(namespaceId, {
                listKeys: (prefix) => listKeys(namespaceId, prefix),
                kvGet: (key) => kvGet(namespaceId, key),
                kvPut: (key, value) => kvPut(namespaceId, key, value),
                kvDelete: (key) => kvDelete(namespaceId, key),
            });
            markMigrationRun(namespaceId, servicePrefix, migration.id);
            console.log(`  ✅ ${migration.id} - complete`);
            ran.push(migration.id);
        } catch (err) {
            console.error(`  ❌ ${migration.id} - failed: ${err.message}`);
            failed.push(migration.id);
        }
    }
    
    ghEndGroup();
    
    // Summary
    console.log('');
    console.log('─'.repeat(50));
    console.log(`MIGRATION SUMMARY FOR ${servicePrefix.toUpperCase()}`);
    console.log('─'.repeat(50));
    console.log(`Total registered: ${migrations.length}`);
    console.log(`Ran successfully: ${ran.length}${ran.length > 0 ? ` (${ran.join(', ')})` : ''}`);
    console.log(`Already run:      ${skipped.length}${skipped.length > 0 ? ` (${skipped.join(', ')})` : ''}`);
    console.log(`Pending (manual): ${pending.length}${pending.length > 0 ? ` (${pending.join(', ')})` : ''}`);
    console.log(`Failed:           ${failed.length}${failed.length > 0 ? ` (${failed.join(', ')})` : ''}`);
    console.log('─'.repeat(50));
    
    // GitHub Actions annotations for summary
    if (ran.length > 0) {
        ghNotice(`${servicePrefix} migrations ran`, `${ran.length} migration(s) executed: ${ran.join(', ')}`);
    }
    if (skipped.length > 0 && ran.length === 0 && pending.length === 0) {
        ghNotice(`${servicePrefix} migrations`, `All ${skipped.length} migration(s) already run: ${skipped.join(', ')}`);
    }
    if (pending.length > 0) {
        ghWarning(`${servicePrefix} pending migrations`, `${pending.length} migration(s) need manual execution: ${pending.join(', ')}`);
    }
    if (failed.length > 0) {
        ghError(`${servicePrefix} migrations failed`, `${failed.length} migration(s) failed: ${failed.join(', ')}`);
        throw new Error(`${failed.length} migration(s) failed: ${failed.join(', ')}`);
    }
    
    return { success: true, ran, skipped, pending, failed };
}

// Allow direct execution for testing
if (process.argv[1] === import.meta.url.replace('file://', '')) {
    console.log('CI Migration Runner - Import this module to use');
}
