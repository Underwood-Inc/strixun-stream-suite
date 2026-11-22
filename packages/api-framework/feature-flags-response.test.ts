import { describe, expect, test, vi } from "vitest";
import {
  FEATURE_FLAGS_BODY_KEY,
  FEATURE_FLAGS_REVISION_HEADER,
  FEATURE_FLAGS_SNAPSHOT_HEADER,
  attachFeatureFlagsEnvelope,
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

test("[FR-FLAG-028] piggyback failures never replace the handler response", async () => {
  const { evaluateProductFlagsFromD1 } = await import("@strixun/feature-flags");
  vi.mocked(evaluateProductFlagsFromD1).mockRejectedValueOnce(new Error("D1 unavailable"));

  const request = new Request("https://auth.idling.app/auth/verify-otp", { method: "POST" });
  const response = new Response(JSON.stringify({ access_token: "tok" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

  const out = await attachFeatureFlagsToResponse(request, response, {
    FLAGS_DB: {} as import("@strixun/feature-flags").FeatureFlagsD1Database,
    ENVIRONMENT: "production",
  });

  expect(out.status).toBe(200);
  const body = (await out.json()) as { access_token?: string; _featureFlags?: unknown };
  expect(body.access_token).toBe("tok");
  expect(body._featureFlags).toBeUndefined();
});

test("[FR-FLAG-029] skipPathPatterns bypasses piggyback on verify-otp", async () => {
  const request = new Request("https://auth.idling.app/auth/verify-otp", { method: "POST" });
  const response = new Response(JSON.stringify({ access_token: "tok" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

  const out = await attachFeatureFlagsToResponse(request, response, {
    FLAGS_DB: {} as import("@strixun/feature-flags").FeatureFlagsD1Database,
    ENVIRONMENT: "production",
  }, {
    includeAnonymous: true,
    skipPathPatterns: [/^\/auth\/verify-otp$/],
  });

  expect(out.headers.get(FEATURE_FLAGS_REVISION_HEADER)).toBeNull();
  const body = (await out.json()) as Record<string, unknown>;
  expect(body.access_token).toBe("tok");
  expect(body[FEATURE_FLAGS_BODY_KEY]).toBeUndefined();
});

test("[FR-FLAG-030] attachFeatureFlagsEnvelope keeps multiple Set-Cookie headers", async () => {
  const response = new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: [
      ["Content-Type", "application/json"],
      ["Set-Cookie", "auth_token=a; Path=/; HttpOnly"],
      ["Set-Cookie", "refresh_token=r; Path=/; HttpOnly"],
    ],
  });

  const out = await attachFeatureFlagsEnvelope(response, {
    product: "auth",
    environment: "production",
    revision: "1.0.0:production:abc",
    flags: { "auth.route.login": true },
  });

  const cookies =
    typeof out.headers.getSetCookie === "function"
      ? out.headers.getSetCookie()
      : (out.headers.get("Set-Cookie") ?? "").split(/,(?=\s*\w+=)/);
  expect(cookies.length).toBeGreaterThanOrEqual(2);
  expect(cookies.some((c) => c.startsWith("auth_token="))).toBe(true);
  expect(cookies.some((c) => c.startsWith("refresh_token="))).toBe(true);
});