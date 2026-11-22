import { describe, expect, test } from "vitest";
import { sliceSnapshotForCaller } from "./piggyback.js";

describe("sliceSnapshotForCaller", () => {
  test("[FR-FLAG-024] anonymous callers omit security flags", () => {
    const sliced = sliceSnapshotForCaller(
      {
        "auth.rate-limit.bypass-enabled": true,
        "auth.rate-limit.bypass": true,
      },
      { roles: [], isAnonymous: true },
      "auth",
    );
    expect(sliced["auth.rate-limit.bypass-enabled"]).toBeUndefined();
    expect(sliced["auth.rate-limit.bypass"]).toBeUndefined();
  });

  test("[FR-FLAG-025] cross-product isolation", () => {
    const sliced = sliceSnapshotForCaller(
      {
        "stream-suite.route.chat": true,
        "access.hub.experimental-docs": true,
      },
      { roles: ["user"], isAnonymous: false, customerId: "c1" },
      "stream-suite",
    );
    expect(sliced["stream-suite.route.chat"]).toBe(true);
    expect(sliced["access.hub.experimental-docs"]).toBeUndefined();
  });

  test("[FR-FLAG-026] super-admin anonymous still receives security flags", () => {
    const sliced = sliceSnapshotForCaller(
      { "auth.rate-limit.bypass-enabled": true },
      { roles: ["super-admin"], isAnonymous: true },
      "auth",
    );
    expect(sliced["auth.rate-limit.bypass-enabled"]).toBe(true);
  });
});