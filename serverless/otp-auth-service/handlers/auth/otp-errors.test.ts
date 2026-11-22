import { describe, expect, test } from "vitest";
import { createInternalErrorResponse } from "./otp-errors.js";

describe("createInternalErrorResponse", () => {
  test("returns 400 for missing email or otp in verify-otp body", async () => {
    const request = new Request("https://auth.idling.app/auth/verify-otp", {
      method: "POST",
    });
    const response = createInternalErrorResponse(
      request,
      new Error("Missing email or otp in request body"),
      { ENVIRONMENT: "production" },
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { errorCode?: string };
    expect(body.errorCode).toBe("invalid_request_format");
  });
});