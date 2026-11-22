import { describe, test, expect } from "vitest";
import { evaluateFlag, evaluateProductSnapshot } from "./evaluate.js";
import { resolveRateBudget } from "./resolveRateBudget.js";
import { rowsForProduct } from "./canon/index.js";

const ctx = { roles: ["customer"], environment: "production", customerId: "cust-a" };

test("[FR-FLAG-001] override beats state and default", () => {
  const v = evaluateFlag({
    flagId: "stream-suite.ui.sidebar",
    context: ctx,
    state: { flagId: "stream-suite.ui.sidebar", environment: "production", value: true },
    override: {
      flagId: "stream-suite.ui.sidebar",
      customerId: "cust-a",
      environment: "production",
      value: false,
      expiresAt: null,
    },
    rules: [],
  });
  expect(v).toBe(false);
});

test("[FR-FLAG-002] unknown flag id evaluates false", () => {
  expect(
    evaluateFlag({
      flagId: "not-in-canon",
      context: ctx,
      state: null,
      override: null,
      rules: [],
    }),
  ).toBe(false);
});

test("[FR-FLAG-003] kill switch disables bypass", () => {
  const budget = resolveRateBudget(
    { ...ctx, roles: ["super-admin"] },
    {
      states: new Map([
        ["auth.rate-limit.bypass-enabled", { flagId: "auth.rate-limit.bypass-enabled", environment: "production", value: false }],
      ]),
      overrides: new Map([
        ["cust-a:auth.rate-limit.bypass", {
          flagId: "auth.rate-limit.bypass",
          customerId: "cust-a",
          environment: "production",
          value: true,
          expiresAt: null,
        }],
      ]),
      rules: [],
    },
  );
  expect(budget.bypass).toBe(false);
});

test("[FR-FLAG-004] stream-suite snapshot uses catalog defaults", () => {
  const ids = rowsForProduct("stream-suite").map((r) => r.id);
  const snap = evaluateProductSnapshot(ids, ctx, () => ({
    state: null,
    override: null,
    rules: [],
  }));
  expect(snap["stream-suite.ui.sidebar"]).toBe(false);
  expect(snap["stream-suite.ui.log-drawer"]).toBe(true);
});