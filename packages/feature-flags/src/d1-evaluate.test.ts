import { describe, expect, test } from "vitest";
import { evaluateProductFlagsFromD1 } from "./d1-evaluate.js";

test("[FR-FLAG-010] evaluateProductFlagsFromD1 returns null without FLAGS_DB", async () => {
  const result = await evaluateProductFlagsFromD1(
    {},
    "stream-suite",
    { roles: [], environment: "production" },
  );
  expect(result).toBeNull();
});

describe("evaluateProductFlagsFromD1", () => {
  test("[FR-FLAG-011] stream-suite envelope includes snapshot id", async () => {
    const mockDb = {
      prepare(sql: string) {
        return {
          bind: (..._args: unknown[]) => ({
            async all() {
              if (sql.includes("identity_override")) {
                return { results: [] };
              }
              return {
                results: [
                  {
                    flag_id: "stream-suite.route.chat",
                    value_json: "true",
                  },
                ],
              };
            },
          }),
        };
      },
    } as unknown as import("./d1-evaluate.js").FeatureFlagsD1Database;

    const envelope = await evaluateProductFlagsFromD1(
      { FLAGS_DB: mockDb, ENVIRONMENT: "production" },
      "stream-suite",
      { roles: [], environment: "production" },
    );

    expect(envelope).not.toBeNull();
    expect(envelope!.flags["stream-suite.route.chat"]).toBe(true);
    expect(envelope!.snapshotId).toContain("production");
  });

  test("[FR-FLAG-011b] unmigrated D1 falls back to catalog defaults", async () => {
    const brokenDb = {
      prepare() {
        return {
          bind: () => ({
            async all() {
              throw new Error("no such table: flag_state: SQLITE_ERROR");
            },
          }),
        };
      },
    } as unknown as import("./d1-evaluate.js").FeatureFlagsD1Database;

    const envelope = await evaluateProductFlagsFromD1(
      { FLAGS_DB: brokenDb, ENVIRONMENT: "test" },
      "stream-suite",
      { roles: [], environment: "test" },
    );

    expect(envelope).not.toBeNull();
    expect(envelope!.flags["stream-suite.route.chat"]).toBe(false);
  });
});