import { describe, expect, test, vi, beforeEach } from "vitest";

describe("ui-feature-flags merge", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("[FR-FLAG-028] mergeFeatureFlagsEnvelope maps canon route.chat to uiFlags.routeChat", async () => {
    const { mergeFeatureFlagsEnvelope, uiFlags, bootstrapUiFeatureFlags } = await import("./ui-feature-flags");
    const { get } = await import("svelte/store");

    bootstrapUiFeatureFlags();
    expect(get(uiFlags).routeChat).toBe(false);

    mergeFeatureFlagsEnvelope({
      snapshotId: "1.0.0:production:route-on",
      product: "stream-suite",
      environment: "production",
      catalogRevision: "1.0.0",
      evaluatedAt: "2026-01-01T00:00:00.000Z",
      flags: { "stream-suite.route.chat": true },
    });

    expect(get(uiFlags).routeChat).toBe(true);

    bootstrapUiFeatureFlags();
    expect(get(uiFlags).routeChat).toBe(true);
  });
});