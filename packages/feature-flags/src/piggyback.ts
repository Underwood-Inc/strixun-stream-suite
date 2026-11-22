import { getCanonRow, rowsForProduct } from "./canon/index.js";
import type { FlagProduct, FlagValue } from "./types.js";

export interface CallerAuthSlice {
  customerId?: string;
  roles: string[];
  isAnonymous: boolean;
}

export interface FeatureFlagsWireEnvelope {
  product: FlagProduct;
  environment: string;
  flags: Record<string, FlagValue>;
  revision: string;
}

export function sliceSnapshotForCaller(
  flags: Record<string, FlagValue>,
  auth: CallerAuthSlice,
  product: FlagProduct,
): Record<string, FlagValue> {
  const productRows = new Set(rowsForProduct(product).map((r) => r.id));
  const isSuperAdmin = auth.roles.includes("super-admin");

  const out: Record<string, FlagValue> = {};
  for (const [flagId, value] of Object.entries(flags)) {
    const row = getCanonRow(flagId);
    if (!row || row.product !== product) continue;
    if (!productRows.has(flagId)) continue;

    if (auth.isAnonymous && !isSuperAdmin && row.sensitivity === "security") {
      continue;
    }

    out[flagId] = value;
  }
  return out;
}

export function toWireEnvelope(input: {
  product: FlagProduct;
  environment: string;
  flags: Record<string, FlagValue>;
  revision: string;
}): FeatureFlagsWireEnvelope {
  return {
    product: input.product,
    environment: input.environment,
    flags: input.flags,
    revision: input.revision,
  };
}