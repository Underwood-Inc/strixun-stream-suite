/**
 * Suite API / Worker URL configuration
 *
 * Handles API server URL (manual override and auto-configured).
 * No Twitch or OAuth; only Worker/Suite API base URL for cloud save, auth, etc.
 */

import { storage } from './storage';

declare global {
  interface Window {
    getWorkerApiUrl?: () => string | null;
    STRIXUN_CONFIG?: { WORKER_API_URL?: string; [key: string]: unknown };
  }
}

function log(msg: string, type: string = 'info'): void {
  if ((window as any).App?.log) {
    (window as any).App.log(msg, type);
  } else {
    console.log(`[${type}] ${msg}`);
  }
}

/** Get Worker/Suite API base URL (from config.js / window.getWorkerApiUrl). */
export function getWorkerApiUrl(): string | null {
  if (typeof window !== 'undefined' && window.getWorkerApiUrl) {
    return window.getWorkerApiUrl() ?? null;
  }
  return null;
}

/** Load API URL settings into form (Setup page). */
export function loadApiSettings(): void {
  const apiServerEl = document.getElementById('apiServerUrl') as HTMLInputElement | null;
  const manual = (storage.get('suite_api_server') as string) || '';
  if (apiServerEl) apiServerEl.value = manual;
  const autoEl = document.getElementById('autoDetectedApiUrl') as HTMLElement | null;
  if (autoEl && typeof window.getWorkerApiUrl === 'function') {
    const url = window.getWorkerApiUrl!();
    autoEl.textContent = url ? `Auto: ${url}` : '';
  }
}

/** Save API URL from form to storage. */
export function saveApiSettings(): void {
  const apiServerEl = document.getElementById('apiServerUrl') as HTMLInputElement | null;
  const statusEl = document.getElementById('apiStatus') as HTMLElement | null;
  if (!apiServerEl) return;
  const url = apiServerEl.value.trim();
  storage.set('suite_api_server', url || '');
  if (statusEl) statusEl.textContent = url ? 'Saved. Clear field to use auto-detected URL.' : 'Cleared. Using auto-detected URL.';
  log('API URL settings saved', 'success');
}

/** Test Suite API connection (GET /health). */
export async function testApiConnection(): Promise<void> {
  const base = getWorkerApiUrl();
  const statusEl = document.getElementById('apiStatus') as HTMLElement | null;
  if (!base) {
    log('No API URL configured. Set in Setup → API Settings.', 'error');
    if (statusEl) statusEl.textContent = 'No API URL configured';
    return;
  }
  const url = base.replace(/\/$/, '') + '/health';
  try {
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    if (res.ok && (data.status === 'ok' || data.message)) {
      log('Suite API: Connected successfully', 'success');
      if (statusEl) statusEl.textContent = 'Connected';
    } else {
      log(`Suite API test failed: ${res.status}`, 'error');
      if (statusEl) statusEl.textContent = `Failed: ${res.status}`;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`Suite API test failed: ${msg}`, 'error');
    if (statusEl) statusEl.textContent = `Error: ${msg}`;
  }
}

export const SuiteAPI = {
  getWorkerApiUrl,
  loadApiSettings,
  saveApiSettings,
  testApiConnection,
};

if (typeof window !== 'undefined') {
  (window as any).SuiteAPI = SuiteAPI;
}
