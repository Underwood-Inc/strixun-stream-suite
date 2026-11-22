/**
 * UI feature flags for Stream Suite — refreshed from API responses carrying `_featureFlags`.
 */
import { writable, get } from "svelte/store";
import { FEATURE_FLAG_CANON_ROWS, type EvaluatedFeatureFlagsEnvelope } from "@strixun/feature-flags";
import { installFeatureFlagsFetchHook as installGlobalFeatureFlagsFetchHook } from "@strixun/api-framework/client";

export type UiFlagSnapshot = Record<string, boolean | number | null>;

let lastMergedSnapshotId: string | null = null;

const defaults = (): UiFlagSnapshot => {
  const snap: UiFlagSnapshot = {};
  for (const row of FEATURE_FLAG_CANON_ROWS) {
    if (row.product !== "stream-suite") continue;
    snap[row.id] = row.defaultValue as boolean;
  }
  return snap;
};

function pickBoolean(snap: UiFlagSnapshot, id: string, fallback: boolean): boolean {
  const v = snap[id];
  return typeof v === "boolean" ? v : fallback;
}

export const uiFeatureFlags = writable(defaults());

export const uiFlags = writable({
  sidebar: false,
  activityLog: false,
  logDrawer: true,
  headerCompact: true,
  commandPalette: true,
  navProduction: true,
  navLabs: false,
  routeNotes: false,
  routeChat: false,
  routeUrlShortener: true,
});

function applySnapshot(snap: UiFlagSnapshot) {
  uiFeatureFlags.set(snap);
  uiFlags.set({
    sidebar: pickBoolean(snap, "stream-suite.ui.sidebar", false),
    activityLog: pickBoolean(snap, "stream-suite.ui.activity-log", false),
    logDrawer: pickBoolean(snap, "stream-suite.ui.log-drawer", true),
    headerCompact: pickBoolean(snap, "stream-suite.ui.header-compact", true),
    commandPalette: pickBoolean(snap, "stream-suite.ui.command-palette", true),
    navProduction: pickBoolean(snap, "stream-suite.nav.production", true),
    navLabs: pickBoolean(snap, "stream-suite.nav.labs", false),
    routeNotes: pickBoolean(snap, "stream-suite.route.notes", false),
    routeChat: pickBoolean(snap, "stream-suite.route.chat", false),
    routeUrlShortener: pickBoolean(snap, "stream-suite.route.url-shortener", true),
  });
}

function envelopeToSnapshot(envelope: EvaluatedFeatureFlagsEnvelope): UiFlagSnapshot {
  const snap = defaults();
  for (const [id, value] of Object.entries(envelope.flags)) {
    if (typeof value === "boolean" || typeof value === "number" || value === null) {
      snap[id] = value;
    }
  }
  return snap;
}

/** Apply canon defaults until the first API response supplies `_featureFlags`. */
export function bootstrapUiFeatureFlags(): void {
  if (lastMergedSnapshotId !== null) return;
  applySnapshot(defaults());
}

/** Merge flags from a parsed API envelope (idempotent per snapshotId). */
export function mergeFeatureFlagsEnvelope(envelope: EvaluatedFeatureFlagsEnvelope | null | undefined): void {
  if (!envelope?.flags) return;
  if (envelope.snapshotId && envelope.snapshotId === lastMergedSnapshotId) return;
  lastMergedSnapshotId = envelope.snapshotId ?? lastMergedSnapshotId;
  const current = get(uiFeatureFlags);
  applySnapshot({ ...current, ...envelopeToSnapshot(envelope) });
}

/** @deprecated Use bootstrapUiFeatureFlags — flags refresh via API activity, not polling. */
export async function refreshUiFeatureFlags(): Promise<void> {
  bootstrapUiFeatureFlags();
}

export function installFeatureFlagsFetchHook(): void {
  (globalThis as { __strixunMergeFeatureFlags?: typeof mergeFeatureFlagsEnvelope }).__strixunMergeFeatureFlags =
    mergeFeatureFlagsEnvelope;
  installGlobalFeatureFlagsFetchHook();
}

export function isRouteEnabled(path: string, flags = get(uiFlags)): boolean {
  if (path === "/notes") return flags.routeNotes;
  if (path === "/chat") return flags.routeChat;
  if (path === "/url-shortener") return flags.routeUrlShortener;
  return true;
}

/** Labs routes toggled via stream-suite.route.* — visible when on even if nav.labs is off. */
const ROUTE_FLAGGED_LABS_PATHS = new Set(["/notes", "/chat"]);

export function isNavRouteVisible(
  route: { path: string; navTier?: "production" | "labs" },
  flags = get(uiFlags),
): boolean {
  if (!isRouteEnabled(route.path, flags)) return false;
  const tier = route.navTier ?? "production";
  if (tier === "labs" && !flags.navLabs) {
    return ROUTE_FLAGGED_LABS_PATHS.has(route.path);
  }
  if (tier === "production" && !flags.navProduction) return false;
  return true;
}