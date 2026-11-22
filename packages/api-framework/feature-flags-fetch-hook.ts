/**
 * Browser-only: merge feature-flag snapshots from any fetch response (piggyback headers/body).
 */
import { mergeFlagsFromResponse, FEATURE_FLAGS_REVISION_HEADER, FEATURE_FLAGS_SNAPSHOT_HEADER } from "./feature-flags-response.js";

let fetchHookInstalled = false;

/** Patch `window.fetch` to call `mergeFlagsFromResponse` when flag headers are present. */
export function installFeatureFlagsFetchHook(): void {
  if (fetchHookInstalled || typeof window === "undefined" || typeof window.fetch !== "function") {
    return;
  }
  fetchHookInstalled = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
    const response = await originalFetch(...args);
    void (async () => {
      try {
        const snapshotId =
          response.headers.get(FEATURE_FLAGS_REVISION_HEADER) ??
          response.headers.get(FEATURE_FLAGS_SNAPSHOT_HEADER);
        if (!snapshotId) return;

        const contentType = response.headers.get("Content-Type") ?? "";
        if (contentType.includes("json")) {
          const clone = response.clone();
          const data = await clone.json();
          mergeFlagsFromResponse(data, response.headers);
        } else {
          mergeFlagsFromResponse(undefined, response.headers);
        }
      } catch {
        // non-blocking
      }
    })();

    return response;
  };
}