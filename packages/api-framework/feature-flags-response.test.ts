import { describe, expect, test, vi } from "vitest";
import {
  FEATURE_FLAGS_SNAPSHOT_HEADER,
  attachFeatureFlagsToResponse,
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
  test("[FR-FLAG-012] merges featureFlags into JSON body", async () => {
    const request = new Request("https://api.example/health", { method: "GET" });
    const response = new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });

    const env = { FLAGS_DB: {} as import("@strixun/feature-flags").FeatureFlagsD1Database, ENVIRONMENT: "production" };
    const out = await attachFeatureFlagsToResponse(request, response, env, {
      product: "stream-suite",
      includeAnonymous: true,
    });

    expect(out.headers.get(FEATURE_FLAGS_SNAPSHOT_HEADER)).toBe("1.0.0:production:abc");
    const body = await out.json();
    expect(body.ok).toBe(true);
    expect(body.featureFlags.flags["stream-suite.route.chat"]).toBe(true);
  });

  test("[FR-FLAG-013] parseFeatureFlagsEnvelope reads body envelope", () => {
    const headers = new Headers({ [FEATURE_FLAGS_SNAPSHOT_HEADER]: "1.0.0:production:abc" });
    const envelope = parseFeatureFlagsEnvelope(headers, {
      featureFlags: {
        snapshotId: "1.0.0:production:abc",
        product: "stream-suite",
        environment: "production",
        catalogRevision: "1.0.0",
        evaluatedAt: "t",
        flags: { "stream-suite.ui.sidebar": true },
      },
    });
    expect(envelope?.flags["stream-suite.ui.sidebar"]).toBe(true);
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