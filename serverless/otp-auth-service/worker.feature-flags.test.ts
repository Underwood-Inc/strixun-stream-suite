import { describe, expect, test } from "vitest";
import { attachFeatureFlagsToResponse } from "@strixun/api-framework";
import { AUTH_FLAG_PIGGYBACK_SKIP_PATHS } from "./feature-flag-piggyback.js";

describe("otp-auth worker feature-flag piggyback", () => {
  test("[FR-AUTH-052] verify-otp response shape unchanged when FLAGS_DB is bound", async () => {
    const request = new Request("https://auth.idling.app/auth/verify-otp", { method: "POST" });
    const response = new Response(
      JSON.stringify({ token_type: "Bearer", access_token: "jwt-body-token" }),
      {
        status: 200,
        headers: [
          ["Content-Type", "application/json"],
          ["Set-Cookie", "auth_token=cookie-jwt; Path=/; HttpOnly"],
          ["Set-Cookie", "refresh_token=refresh; Path=/; HttpOnly"],
        ],
      },
    );

    const out = await attachFeatureFlagsToResponse(
      request,
      response,
      { FLAGS_DB: {} as import("@strixun/feature-flags").FeatureFlagsD1Database, ENVIRONMENT: "production" },
      { includeAnonymous: true, skipPathPatterns: AUTH_FLAG_PIGGYBACK_SKIP_PATHS },
    );

    const body = (await out.json()) as { access_token?: string; _featureFlags?: unknown };
    expect(body.access_token).toBe("jwt-body-token");
    expect(body._featureFlags).toBeUndefined();

    const cookies =
      typeof out.headers.getSetCookie === "function"
        ? out.headers.getSetCookie()
        : (out.headers.get("Set-Cookie") ?? "").split(/,(?=\s*\w+=)/);
    expect(cookies.some((c) => c.includes("auth_token=cookie-jwt"))).toBe(true);
  });
});