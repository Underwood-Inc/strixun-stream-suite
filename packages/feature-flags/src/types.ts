export type FlagSensitivity = "ui" | "security";
export type FlagKind = "boolean" | "number" | "json";
export type FlagValue = boolean | number | null | Record<string, unknown>;
export type FlagProduct = "auth" | "stream-suite" | "access" | "mappy";
export type FlagId = string;

export interface CanonRow {
  id: FlagId;
  product: FlagProduct;
  kind: FlagKind;
  sensitivity: FlagSensitivity;
  defaultValue: FlagValue;
  description: string;
}

export interface FlagState {
  flagId: FlagId;
  environment: string;
  value: FlagValue;
}

export interface IdentityOverride {
  flagId: FlagId;
  customerId: string;
  environment: string;
  value: FlagValue;
  expiresAt: string | null;
}

export interface TargetingRule {
  id: string;
  flagId: FlagId;
  environment: string;
  priority: number;
  match: { roles?: string[]; percent?: number };
  value: FlagValue;
}

export interface EvaluationContext {
  customerId?: string;
  roles: string[];
  environment: string;
  now?: number;
}