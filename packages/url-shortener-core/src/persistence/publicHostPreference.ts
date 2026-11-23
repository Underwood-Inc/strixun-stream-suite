const UI_SHORTENER_PUBLIC_HOST_KEY = 'ui_shortener_public_host';

export function readPreferredPublicHostKey(storage?: Storage | null): string | null {
  try {
    return storage?.getItem(UI_SHORTENER_PUBLIC_HOST_KEY) ?? null;
  } catch {
    return null;
  }
}

export function writePreferredPublicHostKey(hostKey: string, storage?: Storage | null): void {
  try {
    storage?.setItem(UI_SHORTENER_PUBLIC_HOST_KEY, hostKey);
  } catch {
    // ignore quota / private mode
  }
}