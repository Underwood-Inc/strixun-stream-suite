/**
 * UI feature flags for Stream Suite — snapshot from flags-api with canon fallbacks.
 */
import { writable, get } from "svelte/store";
import { FEATURE_FLAG_CANON_ROWS } from "@strixun/feature-flags";

export type UiFlagSnapshot = Record<string, boolean | number | null>;

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

export async function refreshUiFeatureFlags(): Promise<void> {
  const base =
    typeof import.meta !== "undefined" && import.meta.env?.VITE_FLAGS_API_URL
      ? String(import.meta.env.VITE_FLAGS_API_URL)
      : typeof window !== "undefined" &&
          (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
        ? "/flags-api"
        : "https://flags-api.idling.app";

  try {
    const url = `${base.replace(/\/$/, "")}/v1/snapshot?product=stream-suite&environment=production`;
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as { flags?: UiFlagSnapshot };
    applySnapshot({ ...defaults(), ...(data.flags ?? {}) });
  } catch {
    applySnapshot(defaults());
  }
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