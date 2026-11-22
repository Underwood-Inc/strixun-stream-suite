import { describe, expect, test, vi } from "vitest";
import {
  FEATURE_FLAGS_BODY_KEY,
  FEATURE_FLAGS_REVISION_HEADER,
  FEATURE_FLAGS_SNAPSHOT_HEADER,
  attachFeatureFlagsToResponse,
  mergeFlagsFromResponse,
  parseFeatureFlagsEnvelope,
} from "./feature-flags-response.js";

vi.mock("@strixun/feature-flags", async () => {
  const actual = await vi.importActual<typeof import("@strixun/feature-flags")>("@strixun/feature-flags");
  return {
    ...actual,
    evaluateProductFlagsFromD1: vi.fn(async () => ({
      snapshotId: "1.0.0:production:abc",
      product: "stream-suite",
      environment: "production",
      catalogRevision: "1.0.0",
      evaluatedAt: "2026-01-01T00:00:00.000Z",
      flags: { "stream-suite.route.chat": true },
    })),
  };
});

describe("attachFeatureFlagsToResponse", () => {
  test("[FR-FLAG-012] merges _featureFlags into JSON body", async () => {
    const request = new Request("https://streamkit.idling.app/health", { method: "GET" });
    const response = new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });

    const env = { FLAGS_DB: {} as import("@strixun/feature-flags").FeatureFlagsD1Database, ENVIRONMENT: "production" };
    const out = await attachFeatureFlagsToResponse(request, response, env, {
      includeAnonymous: true,
    });

    expect(out.headers.get(FEATURE_FLAGS_REVISION_HEADER)).toBe("1.0.0:production:abc");
    expect(out.headers.get(FEATURE_FLAGS_SNAPSHOT_HEADER)).toBeNull();
    const body = await out.json();
    expect(body.ok).toBe(true);
    expect(body[FEATURE_FLAGS_BODY_KEY].flags["stream-suite.route.chat"]).toBe(true);
    expect("featureFlags" in body).toBe(false);
  });

  test("[FR-FLAG-013] parseFeatureFlagsEnvelope reads wire envelope", () => {
    const headers = new Headers({ [FEATURE_FLAGS_REVISION_HEADER]: "1.0.0:production:abc" });
    const envelope = parseFeatureFlagsEnvelope(headers, {
      [FEATURE_FLAGS_BODY_KEY]: {
        product: "stream-suite",
        environment: "production",
        revision: "1.0.0:production:abc",
        flags: { "stream-suite.ui.sidebar": true },
      },
    });
    expect(envelope?.flags["stream-suite.ui.sidebar"]).toBe(true);
  });

  test("[FR-FLAG-013b] parseFeatureFlagsEnvelope reads _featureFlags without revision header", () => {
    const envelope = parseFeatureFlagsEnvelope(new Headers(), {
      [FEATURE_FLAGS_BODY_KEY]: {
        product: "stream-suite",
        environment: "production",
        revision: "1.0.0:production:abc",
        flags: { "stream-suite.route.chat": true },
      },
    });
    expect(envelope?.flags["stream-suite.route.chat"]).toBe(true);
  });

  test("[FR-FLAG-027] mergeFlagsFromResponse returns envelope", () => {
    const body = {
      [FEATURE_FLAGS_BODY_KEY]: {
        product: "mods-hub",
        environment: "production",
        revision: "1.0.0:production:xyz",
        flags: { "stream-suite.route.chat": false },
      },
    };
    const merged = mergeFlagsFromResponse(body, new Headers({ [FEATURE_FLAGS_REVISION_HEADER]: "1.0.0:production:xyz" }));
    expect(merged?.product).toBe("mods-hub");
  });
});

test("[FR-FLAG-014] OPTIONS requests pass through unchanged", async () => {
  const request = new Request("https://api.example/", { method: "OPTIONS" });
  const response = new Response(null, { status: 204 });
  const out = await attachFeatureFlagsToResponse(request, response, {
    FLAGS_DB: {} as import("@strixun/feature-flags").FeatureFlagsD1Database,
  });
  expect(out.status).toBe(204);
});