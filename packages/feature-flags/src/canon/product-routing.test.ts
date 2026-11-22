import { describe, expect, test } from "vitest";
import { resolveProductForRequest } from "./product-routing.js";

describe("resolveProductForRequest", () => {
  test("[FR-FLAG-020] maps mods-api host to mods-hub", () => {
    const product = resolveProductForRequest(
      new Request("https://mods-api.idling.app/api/health"),
    );
    expect(product).toBe("mods-hub");
  });

  test("[FR-FLAG-021] maps chat-api host to chat-hub", () => {
    const product = resolveProductForRequest(
      new Request("https://chat-api.idling.app/signal"),
    );
    expect(product).toBe("chat-hub");
  });

  test("[FR-FLAG-022] maps access-api host to access", () => {
    const product = resolveProductForRequest(
      new Request("https://access-api.idling.app/health"),
    );
    expect(product).toBe("access");
  });

  test("[FR-FLAG-023] X-Strixun-Product header overrides host", () => {
    const product = resolveProductForRequest(
      new Request("https://example.test/any", {
        headers: { "X-Strixun-Product": "url-shortener" },
      }),
    );
    expect(product).toBe("url-shortener");
  });
});