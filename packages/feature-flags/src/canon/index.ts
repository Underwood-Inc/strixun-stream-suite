import type { CanonRow, FlagId } from "../types.js";

export const FEATURE_FLAG_CATALOG_REVISION = "1.0.0";

export const FEATURE_FLAG_CANON_ROWS: readonly CanonRow[] = [
  {
    id: "auth.rate-limit.bypass-enabled",
    product: "auth",
    kind: "boolean",
    sensitivity: "security",
    defaultValue: true,
    description: "Estate-wide master switch for rate-limit bypass grants",
  },
  {
    id: "auth.rate-limit.bypass",
    product: "auth",
    kind: "boolean",
    sensitivity: "security",
    defaultValue: false,
    description: "Per-user bypass grant (identity override)",
  },
  {
    id: "auth.rate-limit.base-tries",
    product: "auth",
    kind: "number",
    sensitivity: "security",
    defaultValue: null,
    description: "Optional per-user OTP hourly cap override",
  },
  {
    id: "stream-suite.ui.sidebar",
    product: "stream-suite",
    kind: "boolean",
    sensitivity: "ui",
    defaultValue: false,
    description: "Left floating quick-actions panel",
  },
  {
    id: "stream-suite.ui.activity-log",
    product: "stream-suite",
    kind: "boolean",
    sensitivity: "ui",
    defaultValue: false,
    description: "Bottom resizable activity log split",
  },
  {
    id: "stream-suite.ui.log-drawer",
    product: "stream-suite",
    kind: "boolean",
    sensitivity: "ui",
    defaultValue: true,
    description: "Header alerts slide-over log when main log off",
  },
  {
    id: "stream-suite.ui.header-compact",
    product: "stream-suite",
    kind: "boolean",
    sensitivity: "ui",
    defaultValue: true,
    description: "Compact header with overflow menu",
  },
  {
    id: "stream-suite.ui.command-palette",
    product: "stream-suite",
    kind: "boolean",
    sensitivity: "ui",
    defaultValue: true,
    description: "Ctrl/Cmd+K command palette",
  },
  {
    id: "stream-suite.ui.onboarding-focused",
    product: "stream-suite",
    kind: "boolean",
    sensitivity: "ui",
    defaultValue: true,
    description: "First-run focused layout modal",
  },
  {
    id: "stream-suite.nav.production",
    product: "stream-suite",
    kind: "boolean",
    sensitivity: "ui",
    defaultValue: true,
    description: "Show Production nav tier",
  },
  {
    id: "stream-suite.nav.labs",
    product: "stream-suite",
    kind: "boolean",
    sensitivity: "ui",
    defaultValue: false,
    description: "Show Labs nav tier",
  },
  {
    id: "stream-suite.route.notes",
    product: "stream-suite",
    kind: "boolean",
    sensitivity: "ui",
    defaultValue: false,
    description: "Notes route",
  },
  {
    id: "stream-suite.route.chat",
    product: "stream-suite",
    kind: "boolean",
    sensitivity: "ui",
    defaultValue: false,
    description: "Chat route",
  },
  {
    id: "stream-suite.route.url-shortener",
    product: "stream-suite",
    kind: "boolean",
    sensitivity: "ui",
    defaultValue: true,
    description: "URL shortener route",
  },
  {
    id: "access.hub.experimental-docs",
    product: "access",
    kind: "boolean",
    sensitivity: "ui",
    defaultValue: false,
    description: "Experimental docs on access hub",
  },
] as const;

const byId = new Map(FEATURE_FLAG_CANON_ROWS.map((r) => [r.id, r]));

export function getCanonRow(id: FlagId): CanonRow | undefined {
  return byId.get(id);
}

export function isKnownFlagId(id: string): id is FlagId {
  return byId.has(id);
}

export function rowsForProduct(product: CanonRow["product"]): CanonRow[] {
  return FEATURE_FLAG_CANON_ROWS.filter((r) => r.product === product);
}