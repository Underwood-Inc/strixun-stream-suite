import { evaluateFlag } from "./evaluate.js";
import type { EvaluationContext, FlagState, IdentityOverride, TargetingRule } from "./types.js";

export interface RateBudget {
  bypass: boolean;
  baseTries: number | null;
}

export function resolveRateBudget(
  ctx: EvaluationContext,
  data: {
    states: Map<string, FlagState>;
    overrides: Map<string, IdentityOverride>;
    rules: TargetingRule[];
  },
): RateBudget {
  const pack = (flagId: string) => ({
    state: data.states.get(flagId) ?? null,
    override: data.overrides.get(`${ctx.customerId ?? ""}:${flagId}`) ?? null,
    rules: data.rules,
  });

  const kill = evaluateFlag({
    flagId: "auth.rate-limit.bypass-enabled",
    context: ctx,
    ...pack("auth.rate-limit.bypass-enabled"),
  });
  const grant = evaluateFlag({
    flagId: "auth.rate-limit.bypass",
    context: ctx,
    ...pack("auth.rate-limit.bypass"),
  });
  const tries = evaluateFlag({
    flagId: "auth.rate-limit.base-tries",
    context: ctx,
    ...pack("auth.rate-limit.base-tries"),
  });

  const bypass = kill === true && grant === true;
  const baseTries = typeof tries === "number" ? tries : null;
  return { bypass, baseTries };
}