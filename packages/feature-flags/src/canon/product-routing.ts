import type { FlagProduct } from "../types.js";

export const FEATURE_FLAG_PRODUCTS: readonly FlagProduct[] = [
  "auth",
  "stream-suite",
  "access",
  "mods-hub",
  "chat-hub",
  "url-shortener",
  "flags-admin",
  "mappy",
] as const;

export function isFeatureFlagProduct(value: string): value is FlagProduct {
  return (FEATURE_FLAG_PRODUCTS as readonly string[]).includes(value);
}

export interface RequestAuthHint {
  customerId?: string;
  roles?: string[];
}

type HostRule = { match: (host: string) => boolean; product: FlagProduct };

const HOST_RULES: HostRule[] = [
  { match: (h) => h.includes("auth."), product: "auth" },
  { match: (h) => h.includes("flags-api") || h.startsWith("flags."), product: "flags-admin" },
  { match: (h) => h.includes("access-api") || h.includes("access."), product: "access" },
  { match: (h) => h.includes("mods-api") || h.includes("mods."), product: "mods-hub" },
  { match: (h) => h.includes("chat-api") || h.includes("chat."), product: "chat-hub" },
  { match: (h) => h.includes("streamkit") || h.includes("sss."), product: "stream-suite" },
  { match: (h) => h.includes("suite-api") || h === "api.idling.app", product: "stream-suite" },
  {
    match: (h) =>
      h.includes("s.idling") ||
      h.includes("short.idling") ||
      h.includes("shorten.idling") ||
      h.includes("short.army"),
    product: "url-shortener",
  },
  { match: (h) => h.includes("customer-api"), product: "stream-suite" },
  { match: (h) => h.includes("music-api"), product: "stream-suite" },
  { match: (h) => h.includes("game-api"), product: "stream-suite" },
];

const PATH_PREFIX_PRODUCT: Array<[string, FlagProduct]> = [
  ["/mods", "mods-hub"],
  ["/chat", "chat-hub"],
  ["/access", "access"],
  ["/v1/flags", "flags-admin"],
  ["/api/short", "url-shortener"],
  ["/auth", "auth"],
];

/**
 * Map an incoming HTTP request to the feature-flag product catalog key for that caller surface.
 */
export function resolveProductForRequest(
  request: Request,
  _auth?: RequestAuthHint | null,
  explicitProduct?: FlagProduct,
): FlagProduct {
  if (explicitProduct) return explicitProduct;

  const headerProduct = request.headers.get("X-Strixun-Product");
  if (headerProduct && isFeatureFlagProduct(headerProduct)) {
    return headerProduct;
  }

  const host = new URL(request.url).hostname.toLowerCase();
  for (const rule of HOST_RULES) {
    if (rule.match(host)) return rule.product;
  }

  const path = new URL(request.url).pathname.toLowerCase();
  for (const [prefix, product] of PATH_PREFIX_PRODUCT) {
    if (path.startsWith(prefix)) return product;
  }

  return "stream-suite";
}