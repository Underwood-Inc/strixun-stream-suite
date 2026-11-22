import { describe, expect, test, vi, beforeEach } from "vitest";

vi.mock("./router.js", () => ({
  route: vi.fn(),
}));

describe("otp-auth worker", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  test("[FR-AUTH-052] does not attach _featureFlags — responses pass through from router", async () => {
    const { route } = await import("./router.js");
    const worker = (await import("./worker.js")).default;

    const expected = new Response(JSON.stringify({ access_token: "jwt" }), {
      status: 200,
      headers: [
        ["Content-Type", "application/json"],
        ["Set-Cookie", "auth_token=jwt; HttpOnly"],
      ],
    });
    vi.mocked(route).mockResolvedValue(expected);

    const request = new Request("https://auth.idling.app/auth/verify-otp", { method: "POST" });
    const out = await worker.fetch(request, { OTP_AUTH_KV: {} as KVNamespace }, {} as ExecutionContext);

    expect(out).toBe(expected);
    const body = (await out.json()) as { _featureFlags?: unknown };
    expect(body._featureFlags).toBeUndefined();
  });
});