import { getCanonRow } from "./canon/index.js";
import { stickyPercentBucket } from "./hash.js";
import type {
  EvaluationContext,
  FlagState,
  FlagValue,
  IdentityOverride,
  TargetingRule,
} from "./types.js";

export interface EvaluateInput {
  flagId: string;
  context: EvaluationContext;
  state: FlagState | null;
  override: IdentityOverride | null;
  rules: TargetingRule[];
}

function isExpired(expiresAt: string | null, now: number): boolean {
  if (!expiresAt) return false;
  return Date.parse(expiresAt) <= now;
}

function ruleMatches(
  rule: TargetingRule,
  ctx: EvaluationContext,
  now: number,
): boolean {
  const { roles, percent } = rule.match;
  if (roles?.length) {
    const has = roles.some((r) => ctx.roles.includes(r));
    if (!has) return false;
  }
  if (percent !== undefined) {
    const cid = ctx.customerId ?? "";
    if (!cid) return false;
    if (stickyPercentBucket(rule.flagId, cid) >= percent) return false;
  }
  return true;
}

export function evaluateFlag(input: EvaluateInput): FlagValue {
  const canon = getCanonRow(input.flagId);
  if (!canon) return false;
  const now = input.context.now ?? Date.now();

  if (
    input.override &&
    input.override.environment === input.context.environment &&
    !isExpired(input.override.expiresAt, now)
  ) {
    return input.override.value;
  }

  const sorted = [...input.rules]
    .filter((r) => r.flagId === input.flagId && r.environment === input.context.environment)
    .sort((a, b) => b.priority - a.priority);

  for (const rule of sorted) {
    if (ruleMatches(rule, input.context, now)) return rule.value;
  }

  if (input.state) return input.state.value;
  return canon.defaultValue;
}

export function evaluateProductSnapshot(
  flagIds: string[],
  context: EvaluationContext,
  lookup: (flagId: string) => Omit<EvaluateInput, "flagId" | "context">,
): Record<string, FlagValue> {
  const out: Record<string, FlagValue> = {};
  for (const id of flagIds) {
    if (!getCanonRow(id)) continue;
    const rest = lookup(id);
    out[id] = evaluateFlag({ flagId: id, context, ...rest });
  }
  return out;
}