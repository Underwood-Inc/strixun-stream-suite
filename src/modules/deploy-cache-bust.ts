import {
  DEPLOY_SHA_STORAGE_KEY,
  resolveDeployVersionGuardAction,
} from '../lib/deploy-version-guard';

const RELOAD_SESSION_KEY = 'ss_deploy_reload';

export interface DeployVersionPayload {
  gitSha?: string;
  shortSha?: string;
  deployedAt?: string;
}

function readConfigSha(): string | null {
  const cfg = (window as { STRIXUN_CONFIG?: { GIT_SHA?: string } }).STRIXUN_CONFIG;
  const sha = cfg?.GIT_SHA;
  if (!sha || sha.includes('%%')) return null;
  return sha;
}

async function fetchLiveDeployVersion(): Promise<DeployVersionPayload | null> {
  try {
    const res = await fetch(`/version.json?_=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as DeployVersionPayload;
  } catch {
    return null;
  }
}

async function clearServiceWorkers(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((r) => r.unregister()));
}

function watchServiceWorkerLifecycle(): void {
  if (!('serviceWorker' in navigator)) return;
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}

/**
 * After deploy, compare live git sha to what this browser last ran; reload once if stale.
 */
export async function runDeployCacheBust(): Promise<void> {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;

  watchServiceWorkerLifecycle();

  const payload = await fetchLiveDeployVersion();
  const liveSha =
    payload?.gitSha ?? payload?.shortSha ?? readConfigSha();
  const storedSha = localStorage.getItem(DEPLOY_SHA_STORAGE_KEY);
  const action = resolveDeployVersionGuardAction(storedSha, liveSha);

  if (action === 'noop') return;

  if (action === 'store' && liveSha) {
    localStorage.setItem(DEPLOY_SHA_STORAGE_KEY, liveSha);
    return;
  }

  if (action === 'reload' && liveSha) {
    if (sessionStorage.getItem(RELOAD_SESSION_KEY)) {
      localStorage.setItem(DEPLOY_SHA_STORAGE_KEY, liveSha);
      return;
    }
    sessionStorage.setItem(RELOAD_SESSION_KEY, '1');
    localStorage.setItem(DEPLOY_SHA_STORAGE_KEY, liveSha);
    await clearServiceWorkers();
    window.location.reload();
  }
}