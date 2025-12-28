var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// ../../src/core/api/middleware/index.ts
var init_middleware = __esm({
  "../../src/core/api/middleware/index.ts"() {
    "use strict";
  }
});

// ../../src/core/api/middleware/auth.ts
var init_auth = __esm({
  "../../src/core/api/middleware/auth.ts"() {
    "use strict";
  }
});

// ../shared/encryption/jwt-encryption.ts
async function hashToken(token2) {
  const encoder = new TextEncoder();
  const data = encoder.encode(token2);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function deriveKeyFromToken(token2, salt) {
  const encoder = new TextEncoder();
  const tokenKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(token2),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );
  const saltBuffer = new ArrayBuffer(salt.byteLength);
  const saltView = new Uint8Array(saltBuffer);
  saltView.set(salt);
  const saltArray = saltView;
  const key2 = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltArray,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256"
    },
    tokenKey,
    { name: "AES-GCM", length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
  return key2;
}
function arrayBufferToBase64(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
async function encryptWithJWT(data, token2) {
  if (!token2 || token2.length < 10) {
    throw new Error("Valid JWT token is required for encryption");
  }
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key2 = await deriveKeyFromToken(token2, salt);
  const tokenHash = await hashToken(token2);
  const encoder = new TextEncoder();
  const dataStr = JSON.stringify(data);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key2,
    encoder.encode(dataStr)
  );
  return {
    version: 3,
    encrypted: true,
    algorithm: "AES-GCM-256",
    iv: arrayBufferToBase64(iv),
    salt: arrayBufferToBase64(salt),
    tokenHash,
    data: arrayBufferToBase64(encrypted),
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function decryptWithJWT(encryptedData, token2) {
  if (!encryptedData || typeof encryptedData !== "object" || !("encrypted" in encryptedData)) {
    return encryptedData;
  }
  const encrypted = encryptedData;
  if (!encrypted.encrypted) {
    return encryptedData;
  }
  if (!token2 || token2.length < 10) {
    throw new Error("Valid JWT token is required for decryption");
  }
  const salt = base64ToArrayBuffer(encrypted.salt);
  const iv = base64ToArrayBuffer(encrypted.iv);
  const encryptedDataBuffer = base64ToArrayBuffer(encrypted.data);
  if (encrypted.tokenHash) {
    const tokenHash = await hashToken(token2);
    if (encrypted.tokenHash !== tokenHash) {
      throw new Error(
        "Decryption failed - token does not match. Only authenticated users (with email OTP access) can decrypt this data."
      );
    }
  }
  const key2 = await deriveKeyFromToken(token2, new Uint8Array(salt));
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(iv) },
      key2,
      encryptedDataBuffer
    );
    const decoder = new TextDecoder();
    const dataStr = decoder.decode(decrypted);
    return JSON.parse(dataStr);
  } catch (error) {
    throw new Error(
      "Decryption failed - incorrect token or corrupted data. Only authenticated users (with email OTP access) can decrypt this data."
    );
  }
}
var PBKDF2_ITERATIONS, SALT_LENGTH, IV_LENGTH, KEY_LENGTH;
var init_jwt_encryption = __esm({
  "../shared/encryption/jwt-encryption.ts"() {
    "use strict";
    PBKDF2_ITERATIONS = 1e5;
    SALT_LENGTH = 16;
    IV_LENGTH = 12;
    KEY_LENGTH = 256;
    __name(hashToken, "hashToken");
    __name(deriveKeyFromToken, "deriveKeyFromToken");
    __name(arrayBufferToBase64, "arrayBufferToBase64");
    __name(base64ToArrayBuffer, "base64ToArrayBuffer");
    __name(encryptWithJWT, "encryptWithJWT");
    __name(decryptWithJWT, "decryptWithJWT");
  }
});

// ../../src/core/api/enhanced/encryption/jwt-encryption.ts
var init_jwt_encryption2 = __esm({
  "../../src/core/api/enhanced/encryption/jwt-encryption.ts"() {
    "use strict";
    init_jwt_encryption();
  }
});

// ../../src/core/api/utils/response-handler.ts
var init_response_handler = __esm({
  "../../src/core/api/utils/response-handler.ts"() {
    "use strict";
    init_jwt_encryption2();
  }
});

// ../../src/core/api/middleware/error.ts
var init_error = __esm({
  "../../src/core/api/middleware/error.ts"() {
    "use strict";
    init_response_handler();
  }
});

// ../../src/core/api/middleware/transform.ts
var init_transform = __esm({
  "../../src/core/api/middleware/transform.ts"() {
    "use strict";
  }
});

// ../../src/core/api/utils/request-builder.ts
var init_request_builder = __esm({
  "../../src/core/api/utils/request-builder.ts"() {
    "use strict";
  }
});

// ../../src/core/services/encryption.ts
var init_encryption = __esm({
  "../../src/core/services/encryption.ts"() {
    "use strict";
  }
});

// ../../src/core/api/client.ts
var init_client = __esm({
  "../../src/core/api/client.ts"() {
    "use strict";
    init_middleware();
    init_auth();
    init_error();
    init_transform();
    init_request_builder();
    init_response_handler();
    init_encryption();
  }
});

// ../../src/core/api/request/deduplicator.ts
var init_deduplicator = __esm({
  "../../src/core/api/request/deduplicator.ts"() {
    "use strict";
  }
});

// ../../src/core/api/request/priority.ts
var init_priority = __esm({
  "../../src/core/api/request/priority.ts"() {
    "use strict";
  }
});

// ../../src/core/api/request/queue.ts
var init_queue = __esm({
  "../../src/core/api/request/queue.ts"() {
    "use strict";
    init_priority();
  }
});

// ../../src/core/api/request/cancellation.ts
var init_cancellation = __esm({
  "../../src/core/api/request/cancellation.ts"() {
    "use strict";
  }
});

// ../../src/core/api/resilience/retry.ts
var init_retry = __esm({
  "../../src/core/api/resilience/retry.ts"() {
    "use strict";
    init_response_handler();
  }
});

// ../../src/core/api/resilience/circuit-breaker.ts
var init_circuit_breaker = __esm({
  "../../src/core/api/resilience/circuit-breaker.ts"() {
    "use strict";
  }
});

// ../../src/core/api/resilience/offline.ts
var init_offline = __esm({
  "../../src/core/api/resilience/offline.ts"() {
    "use strict";
  }
});

// ../../src/core/api/cache/memory.ts
var init_memory = __esm({
  "../../src/core/api/cache/memory.ts"() {
    "use strict";
  }
});

// ../../src/core/api/cache/indexeddb.ts
var init_indexeddb = __esm({
  "../../src/core/api/cache/indexeddb.ts"() {
    "use strict";
  }
});

// ../../src/core/api/cache/strategies.ts
var init_strategies = __esm({
  "../../src/core/api/cache/strategies.ts"() {
    "use strict";
    init_memory();
    init_indexeddb();
  }
});

// ../../src/core/api/optimistic/updates.ts
var init_updates = __esm({
  "../../src/core/api/optimistic/updates.ts"() {
    "use strict";
  }
});

// ../../src/core/api/plugins/logging.ts
var init_logging = __esm({
  "../../src/core/api/plugins/logging.ts"() {
    "use strict";
  }
});

// ../../src/core/api/plugins/metrics.ts
var init_metrics = __esm({
  "../../src/core/api/plugins/metrics.ts"() {
    "use strict";
  }
});

// ../../src/core/api/plugins/analytics.ts
var init_analytics = __esm({
  "../../src/core/api/plugins/analytics.ts"() {
    "use strict";
  }
});

// ../../src/core/api/plugins/index.ts
var init_plugins = __esm({
  "../../src/core/api/plugins/index.ts"() {
    "use strict";
    init_logging();
    init_metrics();
    init_analytics();
  }
});

// ../../src/core/api/enhanced-client.ts
var init_enhanced_client = __esm({
  "../../src/core/api/enhanced-client.ts"() {
    "use strict";
    init_client();
    init_deduplicator();
    init_queue();
    init_cancellation();
    init_retry();
    init_circuit_breaker();
    init_offline();
    init_strategies();
    init_updates();
    init_plugins();
  }
});

// ../../src/core/api/enhanced/encryption/index.ts
var init_encryption2 = __esm({
  "../../src/core/api/enhanced/encryption/index.ts"() {
    "use strict";
    init_jwt_encryption2();
  }
});

// ../../src/core/api/enhanced/filtering/response-filter.ts
var init_response_filter = __esm({
  "../../src/core/api/enhanced/filtering/response-filter.ts"() {
    "use strict";
  }
});

// ../../src/core/api/enhanced/filtering/tag-system.ts
var init_tag_system = __esm({
  "../../src/core/api/enhanced/filtering/tag-system.ts"() {
    "use strict";
  }
});

// ../../src/core/api/enhanced/filtering/type-parser.ts
var init_type_parser = __esm({
  "../../src/core/api/enhanced/filtering/type-parser.ts"() {
    "use strict";
  }
});

// ../../src/core/api/enhanced/filtering/index.ts
var init_filtering = __esm({
  "../../src/core/api/enhanced/filtering/index.ts"() {
    "use strict";
    init_response_filter();
    init_tag_system();
    init_type_parser();
  }
});

// ../../src/core/api/enhanced/errors/rfc7807.ts
function createRFC7807Error(request, status, title, detail, additionalFields) {
  const errorType = getErrorType(status);
  const error = {
    type: errorType,
    title,
    status,
    detail,
    instance: request.url || request.path,
    ...additionalFields
  };
  return error;
}
function getErrorType(status) {
  const types = {
    400: "https://tools.ietf.org/html/rfc7231#section-6.5.1",
    // Bad Request
    401: "https://tools.ietf.org/html/rfc7235#section-3.1",
    // Unauthorized
    403: "https://tools.ietf.org/html/rfc7231#section-6.5.3",
    // Forbidden
    404: "https://tools.ietf.org/html/rfc7231#section-6.5.4",
    // Not Found
    409: "https://tools.ietf.org/html/rfc7231#section-6.5.8",
    // Conflict
    429: "https://tools.ietf.org/html/rfc6585#section-4",
    // Too Many Requests
    500: "https://tools.ietf.org/html/rfc7231#section-6.6.1",
    // Internal Server Error
    502: "https://tools.ietf.org/html/rfc7231#section-6.6.2",
    // Bad Gateway
    503: "https://tools.ietf.org/html/rfc7231#section-6.6.4",
    // Service Unavailable
    504: "https://tools.ietf.org/html/rfc7231#section-6.6.5"
    // Gateway Timeout
  };
  return types[status] || "https://tools.ietf.org/html/rfc7231#section-6.6.1";
}
var init_rfc7807 = __esm({
  "../../src/core/api/enhanced/errors/rfc7807.ts"() {
    "use strict";
    __name(createRFC7807Error, "createRFC7807Error");
    __name(getErrorType, "getErrorType");
  }
});

// ../../shared-components/error-mapping/error-legend.ts
var init_error_legend = __esm({
  "../../shared-components/error-mapping/error-legend.ts"() {
    "use strict";
  }
});

// ../../src/core/api/enhanced/errors/legend-integration.ts
var init_legend_integration = __esm({
  "../../src/core/api/enhanced/errors/legend-integration.ts"() {
    "use strict";
    init_error_legend();
  }
});

// ../../src/core/api/enhanced/errors/index.ts
var init_errors = __esm({
  "../../src/core/api/enhanced/errors/index.ts"() {
    "use strict";
    init_rfc7807();
    init_legend_integration();
  }
});

// ../../src/core/api/enhanced/workers/platform.ts
var init_platform = __esm({
  "../../src/core/api/enhanced/workers/platform.ts"() {
    "use strict";
  }
});

// ../../src/core/api/enhanced/workers/kv-cache.ts
var init_kv_cache = __esm({
  "../../src/core/api/enhanced/workers/kv-cache.ts"() {
    "use strict";
  }
});

// ../../src/core/api/enhanced/workers/cors.ts
function isOriginAllowed(origin, allowedOrigins) {
  if (typeof allowedOrigins === "function") {
    return allowedOrigins(origin);
  }
  if (allowedOrigins.includes("*")) {
    return true;
  }
  return allowedOrigins.includes(origin);
}
function createCORSHeaders(request, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const headers = new Headers();
  const origin = request.headers.get("Origin");
  if (origin && isOriginAllowed(origin, opts.allowedOrigins)) {
    headers.set("Access-Control-Allow-Origin", origin);
    if (opts.credentials) {
      headers.set("Access-Control-Allow-Credentials", "true");
    }
  } else if (Array.isArray(opts.allowedOrigins) && opts.allowedOrigins.includes("*")) {
    headers.set("Access-Control-Allow-Origin", "*");
  } else if (typeof opts.allowedOrigins === "function") {
    const origin2 = request.headers.get("Origin");
    if (origin2 && opts.allowedOrigins(origin2)) {
      headers.set("Access-Control-Allow-Origin", origin2);
    }
  }
  if (request.method === "OPTIONS") {
    headers.set("Access-Control-Allow-Methods", opts.allowedMethods.join(", "));
    headers.set("Access-Control-Allow-Headers", opts.allowedHeaders.join(", "));
    headers.set("Access-Control-Max-Age", opts.maxAge.toString());
    if (opts.exposedHeaders.length > 0) {
      headers.set("Access-Control-Expose-Headers", opts.exposedHeaders.join(", "));
    }
  } else if (opts.exposedHeaders.length > 0) {
    headers.set("Access-Control-Expose-Headers", opts.exposedHeaders.join(", "));
  }
  return headers;
}
var DEFAULT_OPTIONS;
var init_cors = __esm({
  "../../src/core/api/enhanced/workers/cors.ts"() {
    "use strict";
    DEFAULT_OPTIONS = {
      allowedOrigins: ["*"],
      allowedMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
      exposedHeaders: [],
      maxAge: 86400,
      // 24 hours
      credentials: false
    };
    __name(isOriginAllowed, "isOriginAllowed");
    __name(createCORSHeaders, "createCORSHeaders");
  }
});

// ../../src/core/api/enhanced/workers/adapter.ts
var init_adapter = __esm({
  "../../src/core/api/enhanced/workers/adapter.ts"() {
    "use strict";
    init_platform();
    init_cors();
    init_kv_cache();
  }
});

// ../../src/core/api/enhanced/workers/index.ts
var init_workers = __esm({
  "../../src/core/api/enhanced/workers/index.ts"() {
    "use strict";
    init_platform();
    init_kv_cache();
    init_cors();
    init_adapter();
  }
});

// ../../src/core/api/enhanced/client.ts
var init_client2 = __esm({
  "../../src/core/api/enhanced/client.ts"() {
    "use strict";
    init_enhanced_client();
    init_encryption2();
    init_filtering();
    init_errors();
    init_workers();
  }
});

// ../../src/core/api/enhanced/building/metric-computer.ts
var init_metric_computer = __esm({
  "../../src/core/api/enhanced/building/metric-computer.ts"() {
    "use strict";
  }
});

// ../../src/core/api/enhanced/building/response-builder.ts
var init_response_builder = __esm({
  "../../src/core/api/enhanced/building/response-builder.ts"() {
    "use strict";
    init_metric_computer();
  }
});

// ../../src/core/api/enhanced/building/index.ts
var init_building = __esm({
  "../../src/core/api/enhanced/building/index.ts"() {
    "use strict";
    init_response_builder();
    init_metric_computer();
  }
});

// ../../src/core/api/enhanced/workers/handler.ts
var init_handler = __esm({
  "../../src/core/api/enhanced/workers/handler.ts"() {
    "use strict";
    init_response_builder();
    init_errors();
    init_filtering();
    init_adapter();
    init_encryption2();
  }
});

// ../../src/core/api/enhanced/registry/type-registry.ts
var init_type_registry = __esm({
  "../../src/core/api/enhanced/registry/type-registry.ts"() {
    "use strict";
  }
});

// ../../src/core/api/enhanced/registry/index.ts
var init_registry = __esm({
  "../../src/core/api/enhanced/registry/index.ts"() {
    "use strict";
    init_type_registry();
  }
});

// ../../src/core/api/enhanced/middleware/compose.ts
var init_compose = __esm({
  "../../src/core/api/enhanced/middleware/compose.ts"() {
    "use strict";
  }
});

// ../../src/core/api/enhanced/middleware/index.ts
var init_middleware2 = __esm({
  "../../src/core/api/enhanced/middleware/index.ts"() {
    "use strict";
    init_compose();
  }
});

// ../../src/core/api/enhanced/index.ts
var init_enhanced = __esm({
  "../../src/core/api/enhanced/index.ts"() {
    "use strict";
    init_client2();
    init_encryption2();
    init_filtering();
    init_building();
    init_errors();
    init_cors();
    init_platform();
    init_kv_cache();
    init_adapter();
    init_handler();
    init_registry();
    init_middleware2();
  }
});

// ../shared/api/enhanced.ts
var init_enhanced2 = __esm({
  "../shared/api/enhanced.ts"() {
    "use strict";
    init_enhanced();
  }
});

// utils/errors.ts
function requestToAPIRequest(request) {
  const url = new URL(request.url);
  return {
    id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    method: request.method,
    url: request.url,
    path: url.pathname,
    params: Object.fromEntries(url.searchParams.entries()),
    headers: Object.fromEntries(request.headers.entries())
  };
}
function createError2(request, status, title, detail, additionalFields) {
  const apiRequest = requestToAPIRequest(request);
  return createRFC7807Error(apiRequest, status, title, detail, additionalFields);
}
var init_errors2 = __esm({
  "utils/errors.ts"() {
    "use strict";
    init_enhanced2();
    __name(requestToAPIRequest, "requestToAPIRequest");
    __name(createError2, "createError");
  }
});

// utils/customer.ts
function getCustomerKey(customerId, key2) {
  if (customerId) {
    return `customer_${customerId}_${key2}`;
  }
  return key2;
}
function getCustomerR2Key(customerId, key2) {
  if (customerId) {
    return `customer_${customerId}/${key2}`;
  }
  return key2;
}
var init_customer = __esm({
  "utils/customer.ts"() {
    "use strict";
    __name(getCustomerKey, "getCustomerKey");
    __name(getCustomerR2Key, "getCustomerR2Key");
  }
});

// utils/admin.ts
var admin_exports = {};
__export(admin_exports, {
  approveUserUpload: () => approveUserUpload,
  getApprovedUploaders: () => getApprovedUploaders,
  getSuperAdminEmails: () => getSuperAdminEmails,
  hasUploadPermission: () => hasUploadPermission,
  isSuperAdminEmail: () => isSuperAdminEmail,
  revokeUserUpload: () => revokeUserUpload
});
async function getSuperAdminEmails(env) {
  if (env.SUPER_ADMIN_EMAILS) {
    return env.SUPER_ADMIN_EMAILS.split(",").map((email) => email.trim().toLowerCase());
  }
  if (env.MODS_KV) {
    try {
      const kvEmails = await env.MODS_KV.get("super_admin_emails");
      if (kvEmails) {
        return kvEmails.split(",").map((email) => email.trim().toLowerCase());
      }
    } catch (e) {
    }
  }
  return [];
}
async function isSuperAdminEmail(email, env) {
  if (!email) return false;
  const adminEmails = await getSuperAdminEmails(env);
  return adminEmails.includes(email.toLowerCase());
}
async function hasUploadPermission(userId, email, env) {
  if (email && await isSuperAdminEmail(email, env)) {
    return true;
  }
  if (env.MODS_KV) {
    try {
      const approvalKey = `upload_approval_${userId}`;
      const approval = await env.MODS_KV.get(approvalKey);
      return approval === "approved";
    } catch (e) {
      return false;
    }
  }
  return false;
}
async function approveUserUpload(userId, email, env) {
  if (!env.MODS_KV) {
    throw new Error("MODS_KV not available");
  }
  const approvalKey = `upload_approval_${userId}`;
  await env.MODS_KV.put(approvalKey, "approved", {
    metadata: {
      approvedAt: (/* @__PURE__ */ new Date()).toISOString(),
      email: email.toLowerCase()
    }
  });
  const approvedListKey = "approved_uploaders";
  const existingList = await env.MODS_KV.get(approvedListKey, { type: "json" });
  const updatedList = [...existingList || [], userId].filter((id, index2, arr) => arr.indexOf(id) === index2);
  await env.MODS_KV.put(approvedListKey, JSON.stringify(updatedList));
}
async function revokeUserUpload(userId, env) {
  if (!env.MODS_KV) {
    throw new Error("MODS_KV not available");
  }
  const approvalKey = `upload_approval_${userId}`;
  await env.MODS_KV.delete(approvalKey);
  const approvedListKey = "approved_uploaders";
  const existingList = await env.MODS_KV.get(approvedListKey, { type: "json" });
  if (existingList) {
    const updatedList = existingList.filter((id) => id !== userId);
    await env.MODS_KV.put(approvedListKey, JSON.stringify(updatedList));
  }
}
async function getApprovedUploaders(env) {
  if (!env.MODS_KV) {
    return [];
  }
  try {
    const approvedListKey = "approved_uploaders";
    const list = await env.MODS_KV.get(approvedListKey, { type: "json" });
    return list || [];
  } catch (e) {
    return [];
  }
}
var init_admin = __esm({
  "utils/admin.ts"() {
    "use strict";
    __name(getSuperAdminEmails, "getSuperAdminEmails");
    __name(isSuperAdminEmail, "isSuperAdminEmail");
    __name(hasUploadPermission, "hasUploadPermission");
    __name(approveUserUpload, "approveUserUpload");
    __name(revokeUserUpload, "revokeUserUpload");
    __name(getApprovedUploaders, "getApprovedUploaders");
  }
});

// utils/slug.ts
async function findModBySlug(slug, env, auth) {
  const isAdmin = auth?.email ? await isSuperAdminEmail(auth.email, env) : false;
  const globalListKey = "mods_list_public";
  const globalModsList = await env.MODS_KV.get(globalListKey, { type: "json" });
  if (globalModsList) {
    for (const modId2 of globalModsList) {
      const globalModKey = `mod_${modId2}`;
      const mod = await env.MODS_KV.get(globalModKey, { type: "json" });
      if (mod && mod.slug === slug) {
        if (!isAdmin) {
          const modStatus = mod.status || "published";
          if (mod.visibility !== "public" || modStatus !== "published") {
            if (mod.authorId !== auth?.userId) {
              continue;
            }
          }
        }
        return mod;
      }
    }
  }
  if (auth?.customerId) {
    const customerListKey = getCustomerKey(auth.customerId, "mods_list");
    const customerModsList = await env.MODS_KV.get(customerListKey, { type: "json" });
    if (customerModsList) {
      for (const modId2 of customerModsList) {
        const customerModKey = getCustomerKey(auth.customerId, `mod_${modId2}`);
        const mod = await env.MODS_KV.get(customerModKey, { type: "json" });
        if (mod && mod.slug === slug) {
          if (!isAdmin && mod.authorId !== auth.userId) {
            continue;
          }
          return mod;
        }
      }
    }
  }
  return null;
}
var init_slug = __esm({
  "utils/slug.ts"() {
    "use strict";
    init_customer();
    init_admin();
    __name(findModBySlug, "findModBySlug");
  }
});

// utils/hash.ts
async function calculateFileHash(file) {
  let data;
  if (file instanceof File) {
    data = await file.arrayBuffer();
  } else if (file instanceof Uint8Array) {
    data = file.buffer;
  } else {
    data = file;
  }
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
function formatStrixunHash(hash2) {
  return `strixun:sha256:${hash2}`;
}
var init_hash = __esm({
  "utils/hash.ts"() {
    "use strict";
    __name(calculateFileHash, "calculateFileHash");
    __name(formatStrixunHash, "formatStrixunHash");
  }
});

// handlers/mods/permissions.ts
var permissions_exports = {};
__export(permissions_exports, {
  handleGetUserPermissions: () => handleGetUserPermissions
});
async function handleGetUserPermissions(request, env, auth) {
  try {
    const hasPermission = await hasUploadPermission(auth.userId, auth.email, env);
    const isSuperAdmin = auth.email ? await isSuperAdminEmail(auth.email, env) : false;
    const corsHeaders = createCORSHeaders(request, {
      allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
    });
    return new Response(JSON.stringify({
      hasUploadPermission: hasPermission,
      isSuperAdmin,
      userId: auth.userId,
      email: auth.email
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...Object.fromEntries(corsHeaders.entries())
      }
    });
  } catch (error) {
    const rfcError = createError2(
      request,
      500,
      "Internal Server Error",
      "Failed to check user permissions"
    );
    const corsHeaders = createCORSHeaders(request, {
      allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
    });
    return new Response(JSON.stringify(rfcError), {
      status: 500,
      headers: {
        "Content-Type": "application/problem+json",
        ...Object.fromEntries(corsHeaders.entries())
      }
    });
  }
}
var init_permissions = __esm({
  "handlers/mods/permissions.ts"() {
    "use strict";
    init_enhanced2();
    init_errors2();
    init_admin();
    __name(handleGetUserPermissions, "handleGetUserPermissions");
  }
});

// handlers/mods/review.ts
var review_exports = {};
__export(review_exports, {
  handleGetModReview: () => handleGetModReview
});
async function handleGetModReview(request, env, slug, auth) {
  try {
    if (!auth) {
      const rfcError = createError2(request, 401, "Unauthorized", "Authentication required");
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 401,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    let mod = await findModBySlug(slug, env, auth);
    if (!mod) {
      const globalModKey = `mod_${slug}`;
      mod = await env.MODS_KV.get(globalModKey, { type: "json" });
      if (!mod && auth?.customerId) {
        const customerModKey = getCustomerKey(auth.customerId, `mod_${slug}`);
        mod = await env.MODS_KV.get(customerModKey, { type: "json" });
      }
    }
    if (!mod) {
      const rfcError = createError2(
        request,
        404,
        "Mod Not Found",
        "The requested mod was not found"
      );
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 404,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    const isAdmin = auth.email && await isSuperAdminEmail(auth.email, env);
    const isUploader = mod.authorId === auth.userId;
    if (!isAdmin && !isUploader) {
      const rfcError = createError2(
        request,
        403,
        "Forbidden",
        "Only admins and the mod author can access the review page"
      );
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 403,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    const modId2 = mod.modId;
    let versionIds = [];
    const globalVersionsKey = `mod_${modId2}_versions`;
    const globalVersionsData = await env.MODS_KV.get(globalVersionsKey, { type: "json" });
    if (globalVersionsData) {
      versionIds = globalVersionsData;
    } else if (auth?.customerId) {
      const customerVersionsKey = getCustomerKey(auth.customerId, `mod_${modId2}_versions`);
      const customerVersionsData = await env.MODS_KV.get(customerVersionsKey, { type: "json" });
      versionIds = customerVersionsData || [];
    }
    const versions = [];
    for (const versionId of versionIds) {
      let version = null;
      const globalVersionKey = `version_${versionId}`;
      version = await env.MODS_KV.get(globalVersionKey, { type: "json" });
      if (!version && auth?.customerId) {
        const customerVersionKey = getCustomerKey(auth.customerId, `version_${versionId}`);
        version = await env.MODS_KV.get(customerVersionKey, { type: "json" });
      }
      if (version) {
        versions.push(version);
      }
    }
    versions.sort((a, b) => {
      const aParts = a.version.split(".").map(Number);
      const bParts = b.version.split(".").map(Number);
      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aPart = aParts[i] || 0;
        const bPart = bParts[i] || 0;
        if (aPart !== bPart) {
          return bPart - aPart;
        }
      }
      return 0;
    });
    const response = {
      mod,
      versions
    };
    const corsHeaders = createCORSHeaders(request, {
      allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
    });
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...Object.fromEntries(corsHeaders.entries())
      }
    });
  } catch (error) {
    console.error("Get mod review error:", error);
    const rfcError = createError2(
      request,
      500,
      "Failed to Get Mod Review",
      env.ENVIRONMENT === "development" ? error.message : "An error occurred while fetching mod review"
    );
    const corsHeaders = createCORSHeaders(request, {
      allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
    });
    return new Response(JSON.stringify(rfcError), {
      status: 500,
      headers: {
        "Content-Type": "application/problem+json",
        ...Object.fromEntries(corsHeaders.entries())
      }
    });
  }
}
var init_review = __esm({
  "handlers/mods/review.ts"() {
    "use strict";
    init_enhanced2();
    init_errors2();
    init_customer();
    init_slug();
    init_admin();
    __name(handleGetModReview, "handleGetModReview");
  }
});

// handlers/mods/ratings.ts
var ratings_exports = {};
__export(ratings_exports, {
  handleGetModRatings: () => handleGetModRatings,
  handleSubmitModRating: () => handleSubmitModRating
});
function generateRatingId() {
  return `rating_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}
async function handleGetModRatings(request, env, modId2, auth) {
  try {
    const modKey = getCustomerKey(null, `mod_${modId2}`);
    let mod = await env.MODS_KV.get(modKey, { type: "json" });
    if (!mod && auth?.customerId) {
      const customerModKey = getCustomerKey(auth.customerId, `mod_${modId2}`);
      mod = await env.MODS_KV.get(customerModKey, { type: "json" });
    }
    if (!mod) {
      const rfcError = createError2(request, 404, "Mod Not Found", "The requested mod was not found");
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 404,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    if (mod.visibility !== "public" && mod.status !== "published") {
      if (!auth || mod.authorId !== auth.userId) {
        const rfcError = createError2(request, 403, "Forbidden", "Ratings are only available for published public mods");
        const corsHeaders2 = createCORSHeaders(request, {
          allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
        });
        return new Response(JSON.stringify(rfcError), {
          status: 403,
          headers: {
            "Content-Type": "application/problem+json",
            ...Object.fromEntries(corsHeaders2.entries())
          }
        });
      }
    }
    const ratingsListKey = getCustomerKey(null, `mod_${modId2}_ratings`);
    const ratingsListJson = await env.MODS_KV.get(ratingsListKey, { type: "json" });
    const ratingIds = ratingsListJson || [];
    const ratings = [];
    for (const ratingId of ratingIds) {
      const ratingKey = getCustomerKey(null, `rating_${ratingId}`);
      const rating = await env.MODS_KV.get(ratingKey, { type: "json" });
      if (rating) {
        ratings.push(rating);
      }
    }
    ratings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const averageRating = ratings.length > 0 ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length : 0;
    const response = {
      ratings,
      averageRating: Math.round(averageRating * 10) / 10,
      // Round to 1 decimal
      totalRatings: ratings.length
    };
    const corsHeaders = createCORSHeaders(request, {
      allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
    });
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...Object.fromEntries(corsHeaders.entries())
      }
    });
  } catch (error) {
    const rfcError = createError2(
      request,
      500,
      "Internal Server Error",
      "Failed to fetch mod ratings"
    );
    const corsHeaders = createCORSHeaders(request, {
      allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
    });
    return new Response(JSON.stringify(rfcError), {
      status: 500,
      headers: {
        "Content-Type": "application/problem+json",
        ...Object.fromEntries(corsHeaders.entries())
      }
    });
  }
}
async function handleSubmitModRating(request, env, modId2, auth) {
  try {
    const body = await request.json();
    if (!body.rating || body.rating < 1 || body.rating > 5) {
      const rfcError = createError2(request, 400, "Invalid Rating", "Rating must be between 1 and 5");
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 400,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    const modKey = getCustomerKey(null, `mod_${modId2}`);
    let mod = await env.MODS_KV.get(modKey, { type: "json" });
    if (!mod && auth.customerId) {
      const customerModKey = getCustomerKey(auth.customerId, `mod_${modId2}`);
      mod = await env.MODS_KV.get(customerModKey, { type: "json" });
    }
    if (!mod) {
      const rfcError = createError2(request, 404, "Mod Not Found", "The requested mod was not found");
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 404,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    if (mod.status !== "published") {
      const rfcError = createError2(request, 403, "Forbidden", "Only published mods can be rated");
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 403,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    const ratingsListKey = getCustomerKey(null, `mod_${modId2}_ratings`);
    const ratingsListJson = await env.MODS_KV.get(ratingsListKey, { type: "json" });
    const ratingIds = ratingsListJson || [];
    for (const ratingId2 of ratingIds) {
      const ratingKey2 = getCustomerKey(null, `rating_${ratingId2}`);
      const existingRating = await env.MODS_KV.get(ratingKey2, { type: "json" });
      if (existingRating && existingRating.userId === auth.userId) {
        const updatedRating = {
          ...existingRating,
          rating: body.rating,
          comment: body.comment || existingRating.comment,
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        await env.MODS_KV.put(ratingKey2, JSON.stringify(updatedRating));
        const corsHeaders2 = createCORSHeaders(request, {
          allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
        });
        return new Response(JSON.stringify({ rating: updatedRating }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...Object.fromEntries(corsHeaders2.entries())
          }
        });
      }
    }
    const ratingId = generateRatingId();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const rating = {
      ratingId,
      modId: modId2,
      userId: auth.userId,
      userEmail: auth.email || "",
      rating: body.rating,
      comment: body.comment,
      createdAt: now
    };
    const ratingKey = getCustomerKey(null, `rating_${ratingId}`);
    await env.MODS_KV.put(ratingKey, JSON.stringify(rating));
    const updatedRatingsList = [...ratingIds, ratingId];
    await env.MODS_KV.put(ratingsListKey, JSON.stringify(updatedRatingsList));
    const corsHeaders = createCORSHeaders(request, {
      allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
    });
    return new Response(JSON.stringify({ rating }), {
      status: 201,
      headers: {
        "Content-Type": "application/json",
        ...Object.fromEntries(corsHeaders.entries())
      }
    });
  } catch (error) {
    const rfcError = createError2(
      request,
      500,
      "Internal Server Error",
      "Failed to submit rating"
    );
    const corsHeaders = createCORSHeaders(request, {
      allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
    });
    return new Response(JSON.stringify(rfcError), {
      status: 500,
      headers: {
        "Content-Type": "application/problem+json",
        ...Object.fromEntries(corsHeaders.entries())
      }
    });
  }
}
var init_ratings = __esm({
  "handlers/mods/ratings.ts"() {
    "use strict";
    init_enhanced2();
    init_errors2();
    init_customer();
    __name(generateRatingId, "generateRatingId");
    __name(handleGetModRatings, "handleGetModRatings");
    __name(handleSubmitModRating, "handleSubmitModRating");
  }
});

// handlers/versions/verify.ts
var verify_exports = {};
__export(verify_exports, {
  handleVerifyVersion: () => handleVerifyVersion
});
async function handleVerifyVersion(request, env, modId2, versionId, auth) {
  try {
    const modKey = getCustomerKey(auth?.customerId || null, `mod_${modId2}`);
    const mod = await env.MODS_KV.get(modKey, { type: "json" });
    if (!mod) {
      const rfcError = createError2(request, 404, "Mod Not Found", "The requested mod was not found");
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 404,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    if (mod.visibility === "private" && mod.authorId !== auth?.userId) {
      const rfcError = createError2(request, 404, "Mod Not Found", "The requested mod was not found");
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 404,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    const versionKey = getCustomerKey(auth?.customerId || null, `version_${versionId}`);
    const version = await env.MODS_KV.get(versionKey, { type: "json" });
    if (!version || version.modId !== modId2) {
      const rfcError = createError2(request, 404, "Version Not Found", "The requested version was not found");
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 404,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    const file = await env.MODS_R2.get(version.r2Key);
    if (!file) {
      const rfcError = createError2(request, 404, "File Not Found", "The requested file was not found in storage");
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 404,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    const fileData = await file.arrayBuffer();
    const currentHash = await calculateFileHash(fileData);
    const isValid = currentHash.toLowerCase() === version.sha256.toLowerCase();
    const verificationResult = {
      verified: isValid,
      modId: version.modId,
      versionId: version.versionId,
      version: version.version,
      fileName: version.fileName,
      fileSize: version.fileSize,
      expectedHash: formatStrixunHash(version.sha256),
      actualHash: formatStrixunHash(currentHash),
      verifiedAt: (/* @__PURE__ */ new Date()).toISOString(),
      strixunVerified: isValid
      // Strixun verification marker
    };
    const corsHeaders = createCORSHeaders(request, {
      allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
    });
    return new Response(JSON.stringify(verificationResult, null, 2), {
      status: isValid ? 200 : 400,
      headers: {
        "Content-Type": "application/json",
        ...Object.fromEntries(corsHeaders.entries())
      }
    });
  } catch (error) {
    console.error("Verify version error:", error);
    const rfcError = createError2(
      request,
      500,
      "Failed to Verify Version",
      env.ENVIRONMENT === "development" ? error.message : "An error occurred while verifying the version"
    );
    const corsHeaders = createCORSHeaders(request, {
      allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
    });
    return new Response(JSON.stringify(rfcError), {
      status: 500,
      headers: {
        "Content-Type": "application/problem+json",
        ...Object.fromEntries(corsHeaders.entries())
      }
    });
  }
}
var init_verify = __esm({
  "handlers/versions/verify.ts"() {
    "use strict";
    init_enhanced2();
    init_errors2();
    init_customer();
    init_hash();
    __name(handleVerifyVersion, "handleVerifyVersion");
  }
});

// handlers/versions/badge.ts
var badge_exports = {};
__export(badge_exports, {
  handleBadge: () => handleBadge
});
function generateBadge(verified, hash2, style = "flat") {
  const status = verified ? "verified" : "unverified";
  const color = verified ? "#4caf50" : "#f44336";
  const textColor = "#fff";
  const label = "Strixun";
  const message = verified ? "Verified" : "Unverified";
  const labelWidth = label.length * 6 + 10;
  const messageWidth = message.length * 6 + 10;
  const totalWidth = labelWidth + messageWidth;
  const height = 20;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}">`;
  if (style === "flat-square") {
    svg += `<rect width="${totalWidth}" height="${height}" fill="#555"/>`;
    svg += `<rect x="${labelWidth}" width="${messageWidth}" height="${height}" fill="${color}"/>`;
  } else if (style === "plastic") {
    svg += `<linearGradient id="bg" x2="0" y2="100%">`;
    svg += `<stop offset="0" stop-color="#bbb" stop-opacity=".1"/>`;
    svg += `<stop offset="1" stop-opacity=".1"/>`;
    svg += `</linearGradient>`;
    svg += `<rect width="${totalWidth}" height="${height}" fill="#555"/>`;
    svg += `<rect x="${labelWidth}" width="${messageWidth}" height="${height}" fill="${color}"/>`;
    svg += `<rect width="${totalWidth}" height="${height}" fill="url(#bg)"/>`;
  } else {
    svg += `<rect width="${totalWidth}" height="${height}" rx="3" fill="#555"/>`;
    svg += `<rect x="${labelWidth}" width="${messageWidth}" height="${height}" rx="3" fill="${color}"/>`;
  }
  svg += `<g fill="${textColor}" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">`;
  svg += `<text x="${labelWidth / 2}" y="14">${label}</text>`;
  svg += `<text x="${labelWidth + messageWidth / 2}" y="14">${message}</text>`;
  svg += `</g>`;
  svg += `</svg>`;
  return svg;
}
async function handleBadge(request, env, modId2, versionId, auth) {
  try {
    let mod = null;
    const globalModKey = `mod_${modId2}`;
    mod = await env.MODS_KV.get(globalModKey, { type: "json" });
    if (!mod && auth?.customerId) {
      const customerModKey = getCustomerKey(auth.customerId, `mod_${modId2}`);
      mod = await env.MODS_KV.get(customerModKey, { type: "json" });
    }
    if (!mod) {
      return new Response("Mod not found", { status: 404 });
    }
    const { isSuperAdminEmail: isSuperAdminEmail2 } = await Promise.resolve().then(() => (init_admin(), admin_exports));
    const isAdmin = auth?.email ? await isSuperAdminEmail2(auth.email, env) : false;
    if (!isAdmin) {
      if (mod.visibility !== "public") {
        if (mod.authorId !== auth?.userId) {
          return new Response("Mod not found", { status: 404 });
        }
      }
      if (mod.status !== "published") {
        if (mod.authorId !== auth?.userId) {
          return new Response("Mod not found", { status: 404 });
        }
      }
    } else {
      if (mod.visibility === "private" && mod.authorId !== auth?.userId) {
        return new Response("Mod not found", { status: 404 });
      }
    }
    let version = null;
    const globalVersionKey = `version_${versionId}`;
    version = await env.MODS_KV.get(globalVersionKey, { type: "json" });
    if (!version && auth?.customerId) {
      const customerVersionKey = getCustomerKey(auth.customerId, `version_${versionId}`);
      version = await env.MODS_KV.get(customerVersionKey, { type: "json" });
    }
    if (!version || version.modId !== modId2) {
      return new Response("Version not found", { status: 404 });
    }
    const url = new URL(request.url);
    const style = url.searchParams.get("style") || "flat";
    const verified = !!version.sha256;
    const hash2 = version.sha256 || "unknown";
    const badge = generateBadge(verified, hash2, style);
    const corsHeaders = createCORSHeaders(request, {
      allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
    });
    return new Response(badge, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=3600",
        ...Object.fromEntries(corsHeaders.entries())
      }
    });
  } catch (error) {
    console.error("Badge generation error:", error);
    return new Response("Badge generation failed", { status: 500 });
  }
}
var init_badge = __esm({
  "handlers/versions/badge.ts"() {
    "use strict";
    init_enhanced2();
    init_errors2();
    init_customer();
    init_hash();
    __name(generateBadge, "generateBadge");
    __name(handleBadge, "handleBadge");
  }
});

// handlers/admin/list.ts
var list_exports = {};
__export(list_exports, {
  handleListAllMods: () => handleListAllMods
});
async function handleListAllMods(request, env, auth) {
  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const pageSize = Math.min(parseInt(url.searchParams.get("pageSize") || "20", 10), 100);
    const status = url.searchParams.get("status");
    const category = url.searchParams.get("category");
    const search = url.searchParams.get("search");
    const allModIds = /* @__PURE__ */ new Set();
    const globalListKey = "mods_list_public";
    const globalListData = await env.MODS_KV.get(globalListKey, { type: "json" });
    if (globalListData) {
      globalListData.forEach((id) => allModIds.add(id));
    }
    if (auth.customerId) {
      const customerListKey = getCustomerKey(auth.customerId, "mods_list");
      const customerListData = await env.MODS_KV.get(customerListKey, { type: "json" });
      if (customerListData) {
        customerListData.forEach((id) => allModIds.add(id));
      }
    }
    const mods = [];
    for (const modId2 of allModIds) {
      let mod = null;
      const globalModKey = `mod_${modId2}`;
      mod = await env.MODS_KV.get(globalModKey, { type: "json" });
      if (!mod && auth.customerId) {
        const customerModKey = getCustomerKey(auth.customerId, `mod_${modId2}`);
        mod = await env.MODS_KV.get(customerModKey, { type: "json" });
      }
      if (!mod) continue;
      if (status && mod.status !== status) continue;
      if (category && mod.category !== category) continue;
      if (search && !mod.title.toLowerCase().includes(search.toLowerCase()) && !mod.description.toLowerCase().includes(search.toLowerCase()) && !mod.tags.some((tag2) => tag2.toLowerCase().includes(search.toLowerCase()))) {
        continue;
      }
      mods.push(mod);
    }
    mods.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedMods = mods.slice(start, end);
    const response = {
      mods: paginatedMods,
      total: mods.length,
      page,
      pageSize
    };
    const corsHeaders = createCORSHeaders(request, {
      allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
    });
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...Object.fromEntries(corsHeaders.entries())
      }
    });
  } catch (error) {
    console.error("Admin list mods error:", error);
    const rfcError = createError2(
      request,
      500,
      "Failed to List Mods",
      env.ENVIRONMENT === "development" ? error.message : "An error occurred while listing mods"
    );
    const corsHeaders = createCORSHeaders(request, {
      allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
    });
    return new Response(JSON.stringify(rfcError), {
      status: 500,
      headers: {
        "Content-Type": "application/problem+json",
        ...Object.fromEntries(corsHeaders.entries())
      }
    });
  }
}
var init_list = __esm({
  "handlers/admin/list.ts"() {
    "use strict";
    init_enhanced2();
    init_errors2();
    init_customer();
    __name(handleListAllMods, "handleListAllMods");
  }
});

// handlers/admin/triage.ts
var triage_exports = {};
__export(triage_exports, {
  handleAddReviewComment: () => handleAddReviewComment,
  handleUpdateModStatus: () => handleUpdateModStatus
});
async function handleUpdateModStatus(request, env, modId2, auth) {
  try {
    if (!auth.email || !await isSuperAdminEmail(auth.email, env)) {
      const rfcError = createError2(request, 403, "Forbidden", "Admin access required");
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 403,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    let mod = null;
    const customerModKey = getCustomerKey(auth.customerId, `mod_${modId2}`);
    mod = await env.MODS_KV.get(customerModKey, { type: "json" });
    if (!mod) {
      const globalModKey = `mod_${modId2}`;
      mod = await env.MODS_KV.get(globalModKey, { type: "json" });
    }
    if (!mod) {
      const rfcError = createError2(request, 404, "Mod Not Found", "The requested mod was not found");
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 404,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    const updateData = await request.json();
    const newStatus = updateData.status;
    const reason = updateData.reason;
    const validStatuses = ["pending", "approved", "changes_requested", "denied", "draft", "published", "archived"];
    if (!validStatuses.includes(newStatus)) {
      const rfcError = createError2(request, 400, "Invalid Status", `Status must be one of: ${validStatuses.join(", ")}`);
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 400,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    const oldStatus = mod.status;
    mod.status = newStatus;
    mod.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    if (!mod.statusHistory) {
      mod.statusHistory = [];
    }
    const statusEntry = {
      status: newStatus,
      changedBy: auth.userId,
      changedByEmail: auth.email,
      changedAt: (/* @__PURE__ */ new Date()).toISOString(),
      reason
    };
    mod.statusHistory.push(statusEntry);
    const globalListKey = "mods_list_public";
    const globalModsList = await env.MODS_KV.get(globalListKey, { type: "json" });
    if (newStatus === "published" && oldStatus !== "published") {
      if (!globalModsList || !globalModsList.includes(modId2)) {
        const updatedGlobalList = [...globalModsList || [], modId2];
        await env.MODS_KV.put(globalListKey, JSON.stringify(updatedGlobalList));
      }
      const globalModKey = `mod_${modId2}`;
      await env.MODS_KV.put(globalModKey, JSON.stringify(mod));
    } else if (oldStatus === "published" && newStatus !== "published") {
      if (globalModsList && globalModsList.includes(modId2)) {
        const updatedGlobalList = globalModsList.filter((id) => id !== modId2);
        await env.MODS_KV.put(globalListKey, JSON.stringify(updatedGlobalList));
        const globalModKey = `mod_${modId2}`;
        await env.MODS_KV.delete(globalModKey);
      }
    }
    await env.MODS_KV.put(customerModKey, JSON.stringify(mod));
    if (mod.visibility === "public") {
      const globalModKey = `mod_${modId2}`;
      await env.MODS_KV.put(globalModKey, JSON.stringify(mod));
    }
    const corsHeaders = createCORSHeaders(request, {
      allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
    });
    return new Response(JSON.stringify({ mod }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...Object.fromEntries(corsHeaders.entries())
      }
    });
  } catch (error) {
    console.error("Update mod status error:", error);
    const rfcError = createError2(
      request,
      500,
      "Failed to Update Status",
      env.ENVIRONMENT === "development" ? error.message : "An error occurred while updating mod status"
    );
    const corsHeaders = createCORSHeaders(request, {
      allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
    });
    return new Response(JSON.stringify(rfcError), {
      status: 500,
      headers: {
        "Content-Type": "application/problem+json",
        ...Object.fromEntries(corsHeaders.entries())
      }
    });
  }
}
async function handleAddReviewComment(request, env, modId2, auth) {
  try {
    let mod = null;
    const customerModKey = getCustomerKey(auth.customerId, `mod_${modId2}`);
    mod = await env.MODS_KV.get(customerModKey, { type: "json" });
    if (!mod) {
      const globalModKey = `mod_${modId2}`;
      mod = await env.MODS_KV.get(globalModKey, { type: "json" });
    }
    if (!mod) {
      const rfcError = createError2(request, 404, "Mod Not Found", "The requested mod was not found");
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 404,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    const isAdmin = auth.email && await isSuperAdminEmail(auth.email, env);
    const isUploader = mod.authorId === auth.userId;
    if (!isAdmin && !isUploader) {
      const rfcError = createError2(request, 403, "Forbidden", "Only admins and the mod author can add comments");
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 403,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    const commentData = await request.json();
    if (!commentData.content || commentData.content.trim().length === 0) {
      const rfcError = createError2(request, 400, "Invalid Comment", "Comment content is required");
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 400,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    if (!mod.reviewComments) {
      mod.reviewComments = [];
    }
    const comment2 = {
      commentId: `comment_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
      authorId: auth.userId,
      authorEmail: auth.email || "",
      content: commentData.content.trim(),
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      isAdmin: isAdmin || false
    };
    mod.reviewComments.push(comment2);
    mod.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    await env.MODS_KV.put(customerModKey, JSON.stringify(mod));
    if (mod.visibility === "public") {
      const globalModKey = `mod_${modId2}`;
      await env.MODS_KV.put(globalModKey, JSON.stringify(mod));
    }
    const corsHeaders = createCORSHeaders(request, {
      allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
    });
    return new Response(JSON.stringify({ comment: comment2 }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...Object.fromEntries(corsHeaders.entries())
      }
    });
  } catch (error) {
    console.error("Add review comment error:", error);
    const rfcError = createError2(
      request,
      500,
      "Failed to Add Comment",
      env.ENVIRONMENT === "development" ? error.message : "An error occurred while adding comment"
    );
    const corsHeaders = createCORSHeaders(request, {
      allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
    });
    return new Response(JSON.stringify(rfcError), {
      status: 500,
      headers: {
        "Content-Type": "application/problem+json",
        ...Object.fromEntries(corsHeaders.entries())
      }
    });
  }
}
var init_triage = __esm({
  "handlers/admin/triage.ts"() {
    "use strict";
    init_enhanced2();
    init_errors2();
    init_customer();
    init_admin();
    __name(handleUpdateModStatus, "handleUpdateModStatus");
    __name(handleAddReviewComment, "handleAddReviewComment");
  }
});

// handlers/admin/approvals.ts
var approvals_exports = {};
__export(approvals_exports, {
  handleApproveUser: () => handleApproveUser,
  handleListApprovedUsers: () => handleListApprovedUsers,
  handleRevokeUser: () => handleRevokeUser
});
async function handleApproveUser(request, env, userId, auth) {
  try {
    if (!auth.email || !await isSuperAdminEmail(auth.email, env)) {
      const rfcError = createError2(request, 403, "Forbidden", "Admin access required");
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 403,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    const requestData = await request.json().catch(() => ({}));
    const email = requestData.email || "";
    await approveUserUpload(userId, email, env);
    const corsHeaders = createCORSHeaders(request, {
      allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
    });
    return new Response(JSON.stringify({ success: true, userId }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...Object.fromEntries(corsHeaders.entries())
      }
    });
  } catch (error) {
    console.error("Approve user error:", error);
    const rfcError = createError2(
      request,
      500,
      "Failed to Approve User",
      env.ENVIRONMENT === "development" ? error.message : "An error occurred while approving user"
    );
    const corsHeaders = createCORSHeaders(request, {
      allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
    });
    return new Response(JSON.stringify(rfcError), {
      status: 500,
      headers: {
        "Content-Type": "application/problem+json",
        ...Object.fromEntries(corsHeaders.entries())
      }
    });
  }
}
async function handleRevokeUser(request, env, userId, auth) {
  try {
    if (!auth.email || !await isSuperAdminEmail(auth.email, env)) {
      const rfcError = createError2(request, 403, "Forbidden", "Admin access required");
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 403,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    await revokeUserUpload(userId, env);
    const corsHeaders = createCORSHeaders(request, {
      allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
    });
    return new Response(JSON.stringify({ success: true, userId }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...Object.fromEntries(corsHeaders.entries())
      }
    });
  } catch (error) {
    console.error("Revoke user error:", error);
    const rfcError = createError2(
      request,
      500,
      "Failed to Revoke User",
      env.ENVIRONMENT === "development" ? error.message : "An error occurred while revoking user"
    );
    const corsHeaders = createCORSHeaders(request, {
      allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
    });
    return new Response(JSON.stringify(rfcError), {
      status: 500,
      headers: {
        "Content-Type": "application/problem+json",
        ...Object.fromEntries(corsHeaders.entries())
      }
    });
  }
}
async function handleListApprovedUsers(request, env, auth) {
  try {
    if (!auth.email || !await isSuperAdminEmail(auth.email, env)) {
      const rfcError = createError2(request, 403, "Forbidden", "Admin access required");
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 403,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    const approvedUsers = await getApprovedUploaders(env);
    const corsHeaders = createCORSHeaders(request, {
      allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
    });
    return new Response(JSON.stringify({ approvedUsers }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...Object.fromEntries(corsHeaders.entries())
      }
    });
  } catch (error) {
    console.error("List approved users error:", error);
    const rfcError = createError2(
      request,
      500,
      "Failed to List Approved Users",
      env.ENVIRONMENT === "development" ? error.message : "An error occurred while listing approved users"
    );
    const corsHeaders = createCORSHeaders(request, {
      allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
    });
    return new Response(JSON.stringify(rfcError), {
      status: 500,
      headers: {
        "Content-Type": "application/problem+json",
        ...Object.fromEntries(corsHeaders.entries())
      }
    });
  }
}
var init_approvals = __esm({
  "handlers/admin/approvals.ts"() {
    "use strict";
    init_enhanced2();
    init_errors2();
    init_admin();
    __name(handleApproveUser, "handleApproveUser");
    __name(handleRevokeUser, "handleRevokeUser");
    __name(handleListApprovedUsers, "handleListApprovedUsers");
  }
});

// worker.ts
init_enhanced2();
init_errors2();

// router/mod-routes.ts
init_enhanced2();
init_errors2();

// handlers/mods/list.ts
init_enhanced2();
init_errors2();
init_customer();
init_admin();
async function handleListMods(request, env, auth) {
  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const pageSize = Math.min(parseInt(url.searchParams.get("pageSize") || "20", 10), 100);
    const category = url.searchParams.get("category");
    const search = url.searchParams.get("search");
    const authorId = url.searchParams.get("authorId");
    const featured = url.searchParams.get("featured") === "true";
    const visibility = url.searchParams.get("visibility") || "public";
    const isAdmin = auth?.email ? await isSuperAdminEmail(auth.email, env) : false;
    const globalListKey = "mods_list_public";
    const globalListData = await env.MODS_KV.get(globalListKey, { type: "json" });
    const globalModIds = globalListData || [];
    let customerModIds = [];
    if (isAdmin && auth?.customerId) {
      const customerListKey = getCustomerKey(auth.customerId, "mods_list");
      const customerListData = await env.MODS_KV.get(customerListKey, { type: "json" });
      customerModIds = customerListData || [];
    }
    const allModIds = [.../* @__PURE__ */ new Set([...globalModIds, ...customerModIds])];
    const mods = [];
    for (const modId2 of allModIds) {
      let mod = null;
      const globalModKey = `mod_${modId2}`;
      mod = await env.MODS_KV.get(globalModKey, { type: "json" });
      if (!mod && auth?.customerId) {
        const customerModKey = getCustomerKey(auth.customerId, `mod_${modId2}`);
        mod = await env.MODS_KV.get(customerModKey, { type: "json" });
      }
      if (!mod) {
        continue;
      }
      if (!mod) continue;
      if (category && mod.category !== category) continue;
      if (search && !mod.title.toLowerCase().includes(search.toLowerCase()) && !mod.description.toLowerCase().includes(search.toLowerCase()) && !mod.tags.some((tag2) => tag2.toLowerCase().includes(search.toLowerCase()))) {
        continue;
      }
      if (authorId && mod.authorId !== authorId) continue;
      if (featured && !mod.featured) continue;
      const excludedStatuses = ["pending", "denied", "archived", "draft", "changes_requested"];
      if (visibility === "public") {
        const modVisibility = mod.visibility || "public";
        if (modVisibility !== "public") {
          if (mod.authorId !== auth?.userId) {
            continue;
          }
        }
        const modStatus = mod.status || "published";
        if (modStatus !== "published") {
          if (mod.authorId !== auth?.userId) {
            continue;
          }
        }
      } else {
        if (!isAdmin) {
          const modVisibility = mod.visibility || "public";
          if (modVisibility !== "public" && mod.authorId !== auth?.userId) {
            continue;
          }
          const modStatus = mod.status || "published";
          if (modStatus !== "published" && mod.authorId !== auth?.userId) {
            continue;
          }
        } else {
        }
      }
      mods.push(mod);
    }
    mods.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedMods = mods.slice(start, end);
    const response = {
      mods: paginatedMods,
      total: mods.length,
      page,
      pageSize
    };
    const corsHeaders = createCORSHeaders(request, {
      allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
    });
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...Object.fromEntries(corsHeaders.entries())
      }
    });
  } catch (error) {
    console.error("List mods error:", error);
    const rfcError = createError2(
      request,
      500,
      "Failed to List Mods",
      env.ENVIRONMENT === "development" ? error.message : "An error occurred while listing mods"
    );
    const corsHeaders = createCORSHeaders(request, {
      allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
    });
    return new Response(JSON.stringify(rfcError), {
      status: 500,
      headers: {
        "Content-Type": "application/problem+json",
        ...Object.fromEntries(corsHeaders.entries())
      }
    });
  }
}
__name(handleListMods, "handleListMods");

// handlers/mods/detail.ts
init_enhanced2();
init_errors2();
init_customer();
init_slug();
async function handleGetModDetail(request, env, slug, auth) {
  try {
    const { isSuperAdminEmail: isSuperAdminEmail2 } = await Promise.resolve().then(() => (init_admin(), admin_exports));
    const isAdmin = auth?.email ? await isSuperAdminEmail2(auth.email, env) : false;
    let mod = await findModBySlug(slug, env, auth);
    if (!mod) {
      const globalModKey = `mod_${slug}`;
      mod = await env.MODS_KV.get(globalModKey, { type: "json" });
      if (!mod && auth?.customerId) {
        const customerModKey = getCustomerKey(auth.customerId, `mod_${slug}`);
        mod = await env.MODS_KV.get(customerModKey, { type: "json" });
      }
      if (mod && !isAdmin) {
        const modVisibility = mod.visibility || "public";
        const modStatus = mod.status || "published";
        if (modVisibility !== "public" || modStatus !== "published") {
          if (mod.authorId !== auth?.userId) {
            mod = null;
          }
        }
      }
    }
    if (!mod) {
      const rfcError = createError2(
        request,
        404,
        "Mod Not Found",
        "The requested mod was not found"
      );
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 404,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    const modId2 = mod.modId;
    if (!mod) {
      const rfcError = createError2(
        request,
        404,
        "Mod Not Found",
        "The requested mod was not found"
      );
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 404,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    const isAuthor = mod.authorId === auth?.userId;
    if (!isAdmin) {
      const modVisibility = mod.visibility || "public";
      if (modVisibility !== "public") {
        if (mod.authorId !== auth?.userId) {
          const rfcError = createError2(
            request,
            404,
            "Mod Not Found",
            "The requested mod was not found"
          );
          const corsHeaders2 = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
          });
          return new Response(JSON.stringify(rfcError), {
            status: 404,
            headers: {
              "Content-Type": "application/problem+json",
              ...Object.fromEntries(corsHeaders2.entries())
            }
          });
        }
      }
      const modStatus = mod.status || "published";
      if (modStatus !== "published") {
        if (!isAuthor) {
          const rfcError = createError2(
            request,
            404,
            "Mod Not Found",
            "The requested mod was not found"
          );
          const corsHeaders2 = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
          });
          return new Response(JSON.stringify(rfcError), {
            status: 404,
            headers: {
              "Content-Type": "application/problem+json",
              ...Object.fromEntries(corsHeaders2.entries())
            }
          });
        }
      }
    } else {
      if (mod.visibility === "private" && mod.authorId !== auth?.userId) {
        const rfcError = createError2(
          request,
          404,
          "Mod Not Found",
          "The requested mod was not found"
        );
        const corsHeaders2 = createCORSHeaders(request, {
          allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
        });
        return new Response(JSON.stringify(rfcError), {
          status: 404,
          headers: {
            "Content-Type": "application/problem+json",
            ...Object.fromEntries(corsHeaders2.entries())
          }
        });
      }
    }
    let versionIds = [];
    const globalVersionsKey = `mod_${modId2}_versions`;
    const globalVersionsData = await env.MODS_KV.get(globalVersionsKey, { type: "json" });
    if (globalVersionsData) {
      versionIds = globalVersionsData;
    } else if (auth?.customerId) {
      const customerVersionsKey = getCustomerKey(auth.customerId, `mod_${modId2}_versions`);
      const customerVersionsData = await env.MODS_KV.get(customerVersionsKey, { type: "json" });
      versionIds = customerVersionsData || [];
    }
    const versions = [];
    for (const versionId of versionIds) {
      let version = null;
      const globalVersionKey = `version_${versionId}`;
      version = await env.MODS_KV.get(globalVersionKey, { type: "json" });
      if (!version && auth?.customerId) {
        const customerVersionKey = getCustomerKey(auth.customerId, `version_${versionId}`);
        version = await env.MODS_KV.get(customerVersionKey, { type: "json" });
      }
      if (version) {
        versions.push(version);
      }
    }
    versions.sort((a, b) => {
      const aParts = a.version.split(".").map(Number);
      const bParts = b.version.split(".").map(Number);
      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aPart = aParts[i] || 0;
        const bPart = bParts[i] || 0;
        if (aPart !== bPart) {
          return bPart - aPart;
        }
      }
      return 0;
    });
    const response = {
      mod,
      versions
    };
    const corsHeaders = createCORSHeaders(request, {
      allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
    });
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...Object.fromEntries(corsHeaders.entries())
      }
    });
  } catch (error) {
    console.error("Get mod detail error:", error);
    const rfcError = createError2(
      request,
      500,
      "Failed to Get Mod Detail",
      env.ENVIRONMENT === "development" ? error.message : "An error occurred while fetching mod details"
    );
    const corsHeaders = createCORSHeaders(request, {
      allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
    });
    return new Response(JSON.stringify(rfcError), {
      status: 500,
      headers: {
        "Content-Type": "application/problem+json",
        ...Object.fromEntries(corsHeaders.entries())
      }
    });
  }
}
__name(handleGetModDetail, "handleGetModDetail");

// handlers/mods/upload.ts
init_enhanced2();

// ../../src/core/api/index.ts
init_client();
init_enhanced_client();

// ../../src/core/api/factory.ts
init_enhanced_client();

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/shared/utils.js
var is_array = Array.isArray;
var index_of = Array.prototype.indexOf;
var array_from = Array.from;
var object_keys = Object.keys;
var define_property = Object.defineProperty;
var get_descriptor = Object.getOwnPropertyDescriptor;
var object_prototype = Object.prototype;
var array_prototype = Array.prototype;
var get_prototype_of = Object.getPrototypeOf;
var is_extensible = Object.isExtensible;
var noop = /* @__PURE__ */ __name(() => {
}, "noop");
function run_all(arr) {
  for (var i = 0; i < arr.length; i++) {
    arr[i]();
  }
}
__name(run_all, "run_all");
function deferred() {
  var resolve;
  var reject;
  var promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
__name(deferred, "deferred");

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/reactivity/equality.js
function equals(value) {
  return value === this.v;
}
__name(equals, "equals");
function safe_not_equal(a, b) {
  return a != a ? b == b : a !== b || a !== null && typeof a === "object" || typeof a === "function";
}
__name(safe_not_equal, "safe_not_equal");
function safe_equals(value) {
  return !safe_not_equal(value, this.v);
}
__name(safe_equals, "safe_equals");

// ../../node_modules/.pnpm/esm-env@1.2.2/node_modules/esm-env/dev-fallback.js
var node_env = "production";
var dev_fallback_default = node_env && !node_env.toLowerCase().startsWith("prod");

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/constants.js
var DERIVED = 1 << 1;
var EFFECT = 1 << 2;
var RENDER_EFFECT = 1 << 3;
var MANAGED_EFFECT = 1 << 24;
var BLOCK_EFFECT = 1 << 4;
var BRANCH_EFFECT = 1 << 5;
var ROOT_EFFECT = 1 << 6;
var BOUNDARY_EFFECT = 1 << 7;
var CONNECTED = 1 << 9;
var CLEAN = 1 << 10;
var DIRTY = 1 << 11;
var MAYBE_DIRTY = 1 << 12;
var INERT = 1 << 13;
var DESTROYED = 1 << 14;
var EFFECT_RAN = 1 << 15;
var EFFECT_TRANSPARENT = 1 << 16;
var EAGER_EFFECT = 1 << 17;
var HEAD_EFFECT = 1 << 18;
var EFFECT_PRESERVED = 1 << 19;
var USER_EFFECT = 1 << 20;
var EFFECT_OFFSCREEN = 1 << 25;
var WAS_MARKED = 1 << 15;
var REACTION_IS_UPDATING = 1 << 21;
var ASYNC = 1 << 22;
var ERROR_VALUE = 1 << 23;
var STATE_SYMBOL = Symbol("$state");
var LEGACY_PROPS = Symbol("legacy props");
var LOADING_ATTR_SYMBOL = Symbol("");
var PROXY_PATH_SYMBOL = Symbol("proxy path");
var STALE_REACTION = new class StaleReactionError extends Error {
  static {
    __name(this, "StaleReactionError");
  }
  name = "StaleReactionError";
  message = "The reaction that called `getAbortSignal()` was re-run or destroyed";
}();
var COMMENT_NODE = 8;

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/errors.js
function derived_references_self() {
  if (dev_fallback_default) {
    const error = new Error(`derived_references_self
A derived value cannot reference itself recursively
https://svelte.dev/e/derived_references_self`);
    error.name = "Svelte error";
    throw error;
  } else {
    throw new Error(`https://svelte.dev/e/derived_references_self`);
  }
}
__name(derived_references_self, "derived_references_self");
function effect_update_depth_exceeded() {
  if (dev_fallback_default) {
    const error = new Error(`effect_update_depth_exceeded
Maximum update depth exceeded. This typically indicates that an effect reads and writes the same piece of state
https://svelte.dev/e/effect_update_depth_exceeded`);
    error.name = "Svelte error";
    throw error;
  } else {
    throw new Error(`https://svelte.dev/e/effect_update_depth_exceeded`);
  }
}
__name(effect_update_depth_exceeded, "effect_update_depth_exceeded");
function hydration_failed() {
  if (dev_fallback_default) {
    const error = new Error(`hydration_failed
Failed to hydrate the application
https://svelte.dev/e/hydration_failed`);
    error.name = "Svelte error";
    throw error;
  } else {
    throw new Error(`https://svelte.dev/e/hydration_failed`);
  }
}
__name(hydration_failed, "hydration_failed");
function rune_outside_svelte(rune) {
  if (dev_fallback_default) {
    const error = new Error(`rune_outside_svelte
The \`${rune}\` rune is only available inside \`.svelte\` and \`.svelte.js/ts\` files
https://svelte.dev/e/rune_outside_svelte`);
    error.name = "Svelte error";
    throw error;
  } else {
    throw new Error(`https://svelte.dev/e/rune_outside_svelte`);
  }
}
__name(rune_outside_svelte, "rune_outside_svelte");
function state_descriptors_fixed() {
  if (dev_fallback_default) {
    const error = new Error(`state_descriptors_fixed
Property descriptors defined on \`$state\` objects must contain \`value\` and always be \`enumerable\`, \`configurable\` and \`writable\`.
https://svelte.dev/e/state_descriptors_fixed`);
    error.name = "Svelte error";
    throw error;
  } else {
    throw new Error(`https://svelte.dev/e/state_descriptors_fixed`);
  }
}
__name(state_descriptors_fixed, "state_descriptors_fixed");
function state_prototype_fixed() {
  if (dev_fallback_default) {
    const error = new Error(`state_prototype_fixed
Cannot set prototype of \`$state\` object
https://svelte.dev/e/state_prototype_fixed`);
    error.name = "Svelte error";
    throw error;
  } else {
    throw new Error(`https://svelte.dev/e/state_prototype_fixed`);
  }
}
__name(state_prototype_fixed, "state_prototype_fixed");
function state_unsafe_mutation() {
  if (dev_fallback_default) {
    const error = new Error(`state_unsafe_mutation
Updating state inside \`$derived(...)\`, \`$inspect(...)\` or a template expression is forbidden. If the value should not be reactive, declare it without \`$state\`
https://svelte.dev/e/state_unsafe_mutation`);
    error.name = "Svelte error";
    throw error;
  } else {
    throw new Error(`https://svelte.dev/e/state_unsafe_mutation`);
  }
}
__name(state_unsafe_mutation, "state_unsafe_mutation");
function svelte_boundary_reset_onerror() {
  if (dev_fallback_default) {
    const error = new Error(`svelte_boundary_reset_onerror
A \`<svelte:boundary>\` \`reset\` function cannot be called while an error is still being handled
https://svelte.dev/e/svelte_boundary_reset_onerror`);
    error.name = "Svelte error";
    throw error;
  } else {
    throw new Error(`https://svelte.dev/e/svelte_boundary_reset_onerror`);
  }
}
__name(svelte_boundary_reset_onerror, "svelte_boundary_reset_onerror");

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/constants.js
var EACH_INDEX_REACTIVE = 1 << 1;
var EACH_IS_CONTROLLED = 1 << 2;
var EACH_IS_ANIMATED = 1 << 3;
var EACH_ITEM_IMMUTABLE = 1 << 4;
var PROPS_IS_RUNES = 1 << 1;
var PROPS_IS_UPDATED = 1 << 2;
var PROPS_IS_BINDABLE = 1 << 3;
var PROPS_IS_LAZY_INITIAL = 1 << 4;
var TRANSITION_OUT = 1 << 1;
var TRANSITION_GLOBAL = 1 << 2;
var TEMPLATE_USE_IMPORT_NODE = 1 << 1;
var TEMPLATE_USE_SVG = 1 << 2;
var TEMPLATE_USE_MATHML = 1 << 3;
var HYDRATION_START = "[";
var HYDRATION_START_ELSE = "[!";
var HYDRATION_END = "]";
var HYDRATION_ERROR = {};
var ELEMENT_PRESERVE_ATTRIBUTE_CASE = 1 << 1;
var ELEMENT_IS_INPUT = 1 << 2;
var UNINITIALIZED = Symbol();
var FILENAME = Symbol("filename");
var HMR = Symbol("hmr");

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/warnings.js
var bold = "font-weight: bold";
var normal = "font-weight: normal";
function hydration_mismatch(location) {
  if (dev_fallback_default) {
    console.warn(
      `%c[svelte] hydration_mismatch
%c${location ? `Hydration failed because the initial UI does not match what was rendered on the server. The error occurred near ${location}` : "Hydration failed because the initial UI does not match what was rendered on the server"}
https://svelte.dev/e/hydration_mismatch`,
      bold,
      normal
    );
  } else {
    console.warn(`https://svelte.dev/e/hydration_mismatch`);
  }
}
__name(hydration_mismatch, "hydration_mismatch");
function lifecycle_double_unmount() {
  if (dev_fallback_default) {
    console.warn(`%c[svelte] lifecycle_double_unmount
%cTried to unmount a component that was not mounted
https://svelte.dev/e/lifecycle_double_unmount`, bold, normal);
  } else {
    console.warn(`https://svelte.dev/e/lifecycle_double_unmount`);
  }
}
__name(lifecycle_double_unmount, "lifecycle_double_unmount");
function state_proxy_equality_mismatch(operator) {
  if (dev_fallback_default) {
    console.warn(`%c[svelte] state_proxy_equality_mismatch
%cReactive \`$state(...)\` proxies and the values they proxy have different identities. Because of this, comparisons with \`${operator}\` will produce unexpected results
https://svelte.dev/e/state_proxy_equality_mismatch`, bold, normal);
  } else {
    console.warn(`https://svelte.dev/e/state_proxy_equality_mismatch`);
  }
}
__name(state_proxy_equality_mismatch, "state_proxy_equality_mismatch");
function state_proxy_unmount() {
  if (dev_fallback_default) {
    console.warn(`%c[svelte] state_proxy_unmount
%cTried to unmount a state proxy, rather than a component
https://svelte.dev/e/state_proxy_unmount`, bold, normal);
  } else {
    console.warn(`https://svelte.dev/e/state_proxy_unmount`);
  }
}
__name(state_proxy_unmount, "state_proxy_unmount");
function svelte_boundary_reset_noop() {
  if (dev_fallback_default) {
    console.warn(`%c[svelte] svelte_boundary_reset_noop
%cA \`<svelte:boundary>\` \`reset\` function only resets the boundary the first time it is called
https://svelte.dev/e/svelte_boundary_reset_noop`, bold, normal);
  } else {
    console.warn(`https://svelte.dev/e/svelte_boundary_reset_noop`);
  }
}
__name(svelte_boundary_reset_noop, "svelte_boundary_reset_noop");

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/hydration.js
var hydrating = false;
function set_hydrating(value) {
  hydrating = value;
}
__name(set_hydrating, "set_hydrating");
var hydrate_node;
function set_hydrate_node(node) {
  if (node === null) {
    hydration_mismatch();
    throw HYDRATION_ERROR;
  }
  return hydrate_node = node;
}
__name(set_hydrate_node, "set_hydrate_node");
function hydrate_next() {
  return set_hydrate_node(get_next_sibling(hydrate_node));
}
__name(hydrate_next, "hydrate_next");
function next(count = 1) {
  if (hydrating) {
    var i = count;
    var node = hydrate_node;
    while (i--) {
      node = /** @type {TemplateNode} */
      get_next_sibling(node);
    }
    hydrate_node = node;
  }
}
__name(next, "next");
function skip_nodes(remove = true) {
  var depth = 0;
  var node = hydrate_node;
  while (true) {
    if (node.nodeType === COMMENT_NODE) {
      var data = (
        /** @type {Comment} */
        node.data
      );
      if (data === HYDRATION_END) {
        if (depth === 0) return node;
        depth -= 1;
      } else if (data === HYDRATION_START || data === HYDRATION_START_ELSE) {
        depth += 1;
      }
    }
    var next2 = (
      /** @type {TemplateNode} */
      get_next_sibling(node)
    );
    if (remove) node.remove();
    node = next2;
  }
}
__name(skip_nodes, "skip_nodes");

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/flags/index.js
var async_mode_flag = false;
var legacy_mode_flag = false;
var tracing_mode_flag = false;

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dev/tracing.js
var tracing_expressions = null;
function tag(source2, label) {
  source2.label = label;
  tag_proxy(source2.v, label);
  return source2;
}
__name(tag, "tag");
function tag_proxy(value, label) {
  value?.[PROXY_PATH_SYMBOL]?.(label);
  return value;
}
__name(tag_proxy, "tag_proxy");

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/shared/dev.js
function get_error(label) {
  const error = new Error();
  const stack2 = get_stack();
  if (stack2.length === 0) {
    return null;
  }
  stack2.unshift("\n");
  define_property(error, "stack", {
    value: stack2.join("\n")
  });
  define_property(error, "name", {
    value: label
  });
  return (
    /** @type {Error & { stack: string }} */
    error
  );
}
__name(get_error, "get_error");
function get_stack() {
  const limit = Error.stackTraceLimit;
  Error.stackTraceLimit = Infinity;
  const stack2 = new Error().stack;
  Error.stackTraceLimit = limit;
  if (!stack2) return [];
  const lines = stack2.split("\n");
  const new_lines = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const posixified = line.replaceAll("\\", "/");
    if (line.trim() === "Error") {
      continue;
    }
    if (line.includes("validate_each_keys")) {
      return [];
    }
    if (posixified.includes("svelte/src/internal") || posixified.includes("node_modules/.vite")) {
      continue;
    }
    new_lines.push(line);
  }
  return new_lines;
}
__name(get_stack, "get_stack");

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/context.js
var component_context = null;
function set_component_context(context) {
  component_context = context;
}
__name(set_component_context, "set_component_context");
var dev_stack = null;
function set_dev_stack(stack2) {
  dev_stack = stack2;
}
__name(set_dev_stack, "set_dev_stack");
var dev_current_component_function = null;
function set_dev_current_component_function(fn) {
  dev_current_component_function = fn;
}
__name(set_dev_current_component_function, "set_dev_current_component_function");
function push(props, runes = false, fn) {
  component_context = {
    p: component_context,
    i: false,
    c: null,
    e: null,
    s: props,
    x: null,
    l: legacy_mode_flag && !runes ? { s: null, u: null, $: [] } : null
  };
  if (dev_fallback_default) {
    component_context.function = fn;
    dev_current_component_function = fn;
  }
}
__name(push, "push");
function pop(component2) {
  var context = (
    /** @type {ComponentContext} */
    component_context
  );
  var effects = context.e;
  if (effects !== null) {
    context.e = null;
    for (var fn of effects) {
      create_user_effect(fn);
    }
  }
  if (component2 !== void 0) {
    context.x = component2;
  }
  context.i = true;
  component_context = context.p;
  if (dev_fallback_default) {
    dev_current_component_function = component_context?.function ?? null;
  }
  return component2 ?? /** @type {T} */
  {};
}
__name(pop, "pop");
function is_runes() {
  return !legacy_mode_flag || component_context !== null && component_context.l === null;
}
__name(is_runes, "is_runes");

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/task.js
var micro_tasks = [];
function run_micro_tasks() {
  var tasks = micro_tasks;
  micro_tasks = [];
  run_all(tasks);
}
__name(run_micro_tasks, "run_micro_tasks");
function queue_micro_task(fn) {
  if (micro_tasks.length === 0 && !is_flushing_sync) {
    var tasks = micro_tasks;
    queueMicrotask(() => {
      if (tasks === micro_tasks) run_micro_tasks();
    });
  }
  micro_tasks.push(fn);
}
__name(queue_micro_task, "queue_micro_task");
function flush_tasks() {
  while (micro_tasks.length > 0) {
    run_micro_tasks();
  }
}
__name(flush_tasks, "flush_tasks");

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/error-handling.js
var adjustments = /* @__PURE__ */ new WeakMap();
function handle_error(error) {
  var effect2 = active_effect;
  if (effect2 === null) {
    active_reaction.f |= ERROR_VALUE;
    return error;
  }
  if (dev_fallback_default && error instanceof Error && !adjustments.has(error)) {
    adjustments.set(error, get_adjustments(error, effect2));
  }
  if ((effect2.f & EFFECT_RAN) === 0) {
    if ((effect2.f & BOUNDARY_EFFECT) === 0) {
      if (dev_fallback_default && !effect2.parent && error instanceof Error) {
        apply_adjustments(error);
      }
      throw error;
    }
    effect2.b.error(error);
  } else {
    invoke_error_boundary(error, effect2);
  }
}
__name(handle_error, "handle_error");
function invoke_error_boundary(error, effect2) {
  while (effect2 !== null) {
    if ((effect2.f & BOUNDARY_EFFECT) !== 0) {
      try {
        effect2.b.error(error);
        return;
      } catch (e) {
        error = e;
      }
    }
    effect2 = effect2.parent;
  }
  if (dev_fallback_default && error instanceof Error) {
    apply_adjustments(error);
  }
  throw error;
}
__name(invoke_error_boundary, "invoke_error_boundary");
function get_adjustments(error, effect2) {
  const message_descriptor = get_descriptor(error, "message");
  if (message_descriptor && !message_descriptor.configurable) return;
  var indent = is_firefox ? "  " : "	";
  var component_stack = `
${indent}in ${effect2.fn?.name || "<unknown>"}`;
  var context = effect2.ctx;
  while (context !== null) {
    component_stack += `
${indent}in ${context.function?.[FILENAME].split("/").pop()}`;
    context = context.p;
  }
  return {
    message: error.message + `
${component_stack}
`,
    stack: error.stack?.split("\n").filter((line) => !line.includes("svelte/src/internal")).join("\n")
  };
}
__name(get_adjustments, "get_adjustments");
function apply_adjustments(error) {
  const adjusted = adjustments.get(error);
  if (adjusted) {
    define_property(error, "message", {
      value: adjusted.message
    });
    define_property(error, "stack", {
      value: adjusted.stack
    });
  }
}
__name(apply_adjustments, "apply_adjustments");

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/reactivity/batch.js
var batches = /* @__PURE__ */ new Set();
var current_batch = null;
var previous_batch = null;
var batch_values = null;
var queued_root_effects = [];
var last_scheduled_effect = null;
var is_flushing = false;
var is_flushing_sync = false;
var Batch = class _Batch {
  static {
    __name(this, "Batch");
  }
  committed = false;
  /**
   * The current values of any sources that are updated in this batch
   * They keys of this map are identical to `this.#previous`
   * @type {Map<Source, any>}
   */
  current = /* @__PURE__ */ new Map();
  /**
   * The values of any sources that are updated in this batch _before_ those updates took place.
   * They keys of this map are identical to `this.#current`
   * @type {Map<Source, any>}
   */
  previous = /* @__PURE__ */ new Map();
  /**
   * When the batch is committed (and the DOM is updated), we need to remove old branches
   * and append new ones by calling the functions added inside (if/each/key/etc) blocks
   * @type {Set<() => void>}
   */
  #commit_callbacks = /* @__PURE__ */ new Set();
  /**
   * If a fork is discarded, we need to destroy any effects that are no longer needed
   * @type {Set<(batch: Batch) => void>}
   */
  #discard_callbacks = /* @__PURE__ */ new Set();
  /**
   * The number of async effects that are currently in flight
   */
  #pending = 0;
  /**
   * The number of async effects that are currently in flight, _not_ inside a pending boundary
   */
  #blocking_pending = 0;
  /**
   * A deferred that resolves when the batch is committed, used with `settled()`
   * TODO replace with Promise.withResolvers once supported widely enough
   * @type {{ promise: Promise<void>, resolve: (value?: any) => void, reject: (reason: unknown) => void } | null}
   */
  #deferred = null;
  /**
   * Deferred effects (which run after async work has completed) that are DIRTY
   * @type {Set<Effect>}
   */
  #dirty_effects = /* @__PURE__ */ new Set();
  /**
   * Deferred effects that are MAYBE_DIRTY
   * @type {Set<Effect>}
   */
  #maybe_dirty_effects = /* @__PURE__ */ new Set();
  /**
   * A set of branches that still exist, but will be destroyed when this batch
   * is committed — we skip over these during `process`
   * @type {Set<Effect>}
   */
  skipped_effects = /* @__PURE__ */ new Set();
  is_fork = false;
  is_deferred() {
    return this.is_fork || this.#blocking_pending > 0;
  }
  /**
   *
   * @param {Effect[]} root_effects
   */
  process(root_effects) {
    queued_root_effects = [];
    previous_batch = null;
    this.apply();
    var target = {
      parent: null,
      effect: null,
      effects: [],
      render_effects: []
    };
    for (const root of root_effects) {
      this.#traverse_effect_tree(root, target);
    }
    if (!this.is_fork) {
      this.#resolve();
    }
    if (this.is_deferred()) {
      this.#defer_effects(target.effects);
      this.#defer_effects(target.render_effects);
    } else {
      previous_batch = this;
      current_batch = null;
      flush_queued_effects(target.render_effects);
      flush_queued_effects(target.effects);
      previous_batch = null;
      this.#deferred?.resolve();
    }
    batch_values = null;
  }
  /**
   * Traverse the effect tree, executing effects or stashing
   * them for later execution as appropriate
   * @param {Effect} root
   * @param {EffectTarget} target
   */
  #traverse_effect_tree(root, target) {
    root.f ^= CLEAN;
    var effect2 = root.first;
    while (effect2 !== null) {
      var flags2 = effect2.f;
      var is_branch = (flags2 & (BRANCH_EFFECT | ROOT_EFFECT)) !== 0;
      var is_skippable_branch = is_branch && (flags2 & CLEAN) !== 0;
      var skip = is_skippable_branch || (flags2 & INERT) !== 0 || this.skipped_effects.has(effect2);
      if ((effect2.f & BOUNDARY_EFFECT) !== 0 && effect2.b?.is_pending()) {
        target = {
          parent: target,
          effect: effect2,
          effects: [],
          render_effects: []
        };
      }
      if (!skip && effect2.fn !== null) {
        if (is_branch) {
          effect2.f ^= CLEAN;
        } else if ((flags2 & EFFECT) !== 0) {
          target.effects.push(effect2);
        } else if (async_mode_flag && (flags2 & (RENDER_EFFECT | MANAGED_EFFECT)) !== 0) {
          target.render_effects.push(effect2);
        } else if (is_dirty(effect2)) {
          if ((effect2.f & BLOCK_EFFECT) !== 0) this.#dirty_effects.add(effect2);
          update_effect(effect2);
        }
        var child2 = effect2.first;
        if (child2 !== null) {
          effect2 = child2;
          continue;
        }
      }
      var parent = effect2.parent;
      effect2 = effect2.next;
      while (effect2 === null && parent !== null) {
        if (parent === target.effect) {
          this.#defer_effects(target.effects);
          this.#defer_effects(target.render_effects);
          target = /** @type {EffectTarget} */
          target.parent;
        }
        effect2 = parent.next;
        parent = parent.parent;
      }
    }
  }
  /**
   * @param {Effect[]} effects
   */
  #defer_effects(effects) {
    for (const e of effects) {
      if ((e.f & DIRTY) !== 0) {
        this.#dirty_effects.add(e);
      } else if ((e.f & MAYBE_DIRTY) !== 0) {
        this.#maybe_dirty_effects.add(e);
      }
      this.#clear_marked(e.deps);
      set_signal_status(e, CLEAN);
    }
  }
  /**
   * @param {Value[] | null} deps
   */
  #clear_marked(deps) {
    if (deps === null) return;
    for (const dep of deps) {
      if ((dep.f & DERIVED) === 0 || (dep.f & WAS_MARKED) === 0) {
        continue;
      }
      dep.f ^= WAS_MARKED;
      this.#clear_marked(
        /** @type {Derived} */
        dep.deps
      );
    }
  }
  /**
   * Associate a change to a given source with the current
   * batch, noting its previous and current values
   * @param {Source} source
   * @param {any} value
   */
  capture(source2, value) {
    if (!this.previous.has(source2)) {
      this.previous.set(source2, value);
    }
    if ((source2.f & ERROR_VALUE) === 0) {
      this.current.set(source2, source2.v);
      batch_values?.set(source2, source2.v);
    }
  }
  activate() {
    current_batch = this;
    this.apply();
  }
  deactivate() {
    if (current_batch !== this) return;
    current_batch = null;
    batch_values = null;
  }
  flush() {
    this.activate();
    if (queued_root_effects.length > 0) {
      flush_effects();
      if (current_batch !== null && current_batch !== this) {
        return;
      }
    } else if (this.#pending === 0) {
      this.process([]);
    }
    this.deactivate();
  }
  discard() {
    for (const fn of this.#discard_callbacks) fn(this);
    this.#discard_callbacks.clear();
  }
  #resolve() {
    if (this.#blocking_pending === 0) {
      for (const fn of this.#commit_callbacks) fn();
      this.#commit_callbacks.clear();
    }
    if (this.#pending === 0) {
      this.#commit();
    }
  }
  #commit() {
    if (batches.size > 1) {
      this.previous.clear();
      var previous_batch_values = batch_values;
      var is_earlier = true;
      var dummy_target = {
        parent: null,
        effect: null,
        effects: [],
        render_effects: []
      };
      for (const batch of batches) {
        if (batch === this) {
          is_earlier = false;
          continue;
        }
        const sources = [];
        for (const [source2, value] of this.current) {
          if (batch.current.has(source2)) {
            if (is_earlier && value !== batch.current.get(source2)) {
              batch.current.set(source2, value);
            } else {
              continue;
            }
          }
          sources.push(source2);
        }
        if (sources.length === 0) {
          continue;
        }
        const others = [...batch.current.keys()].filter((s) => !this.current.has(s));
        if (others.length > 0) {
          var prev_queued_root_effects = queued_root_effects;
          queued_root_effects = [];
          const marked = /* @__PURE__ */ new Set();
          const checked = /* @__PURE__ */ new Map();
          for (const source2 of sources) {
            mark_effects(source2, others, marked, checked);
          }
          if (queued_root_effects.length > 0) {
            current_batch = batch;
            batch.apply();
            for (const root of queued_root_effects) {
              batch.#traverse_effect_tree(root, dummy_target);
            }
            batch.deactivate();
          }
          queued_root_effects = prev_queued_root_effects;
        }
      }
      current_batch = null;
      batch_values = previous_batch_values;
    }
    this.committed = true;
    batches.delete(this);
  }
  /**
   *
   * @param {boolean} blocking
   */
  increment(blocking) {
    this.#pending += 1;
    if (blocking) this.#blocking_pending += 1;
  }
  /**
   *
   * @param {boolean} blocking
   */
  decrement(blocking) {
    this.#pending -= 1;
    if (blocking) this.#blocking_pending -= 1;
    this.revive();
  }
  revive() {
    for (const e of this.#dirty_effects) {
      this.#maybe_dirty_effects.delete(e);
      set_signal_status(e, DIRTY);
      schedule_effect(e);
    }
    for (const e of this.#maybe_dirty_effects) {
      set_signal_status(e, MAYBE_DIRTY);
      schedule_effect(e);
    }
    this.flush();
  }
  /** @param {() => void} fn */
  oncommit(fn) {
    this.#commit_callbacks.add(fn);
  }
  /** @param {(batch: Batch) => void} fn */
  ondiscard(fn) {
    this.#discard_callbacks.add(fn);
  }
  settled() {
    return (this.#deferred ??= deferred()).promise;
  }
  static ensure() {
    if (current_batch === null) {
      const batch = current_batch = new _Batch();
      batches.add(current_batch);
      if (!is_flushing_sync) {
        _Batch.enqueue(() => {
          if (current_batch !== batch) {
            return;
          }
          batch.flush();
        });
      }
    }
    return current_batch;
  }
  /** @param {() => void} task */
  static enqueue(task) {
    queue_micro_task(task);
  }
  apply() {
    if (!async_mode_flag || !this.is_fork && batches.size === 1) return;
    batch_values = new Map(this.current);
    for (const batch of batches) {
      if (batch === this) continue;
      for (const [source2, previous] of batch.previous) {
        if (!batch_values.has(source2)) {
          batch_values.set(source2, previous);
        }
      }
    }
  }
};
function flushSync(fn) {
  var was_flushing_sync = is_flushing_sync;
  is_flushing_sync = true;
  try {
    var result;
    if (fn) {
      if (current_batch !== null) {
        flush_effects();
      }
      result = fn();
    }
    while (true) {
      flush_tasks();
      if (queued_root_effects.length === 0) {
        current_batch?.flush();
        if (queued_root_effects.length === 0) {
          last_scheduled_effect = null;
          return (
            /** @type {T} */
            result
          );
        }
      }
      flush_effects();
    }
  } finally {
    is_flushing_sync = was_flushing_sync;
  }
}
__name(flushSync, "flushSync");
function flush_effects() {
  var was_updating_effect = is_updating_effect;
  is_flushing = true;
  var source_stacks = dev_fallback_default ? /* @__PURE__ */ new Set() : null;
  try {
    var flush_count = 0;
    set_is_updating_effect(true);
    while (queued_root_effects.length > 0) {
      var batch = Batch.ensure();
      if (flush_count++ > 1e3) {
        if (dev_fallback_default) {
          var updates = /* @__PURE__ */ new Map();
          for (const source2 of batch.current.keys()) {
            for (const [stack2, update2] of source2.updated ?? []) {
              var entry = updates.get(stack2);
              if (!entry) {
                entry = { error: update2.error, count: 0 };
                updates.set(stack2, entry);
              }
              entry.count += update2.count;
            }
          }
          for (const update2 of updates.values()) {
            if (update2.error) {
              console.error(update2.error);
            }
          }
        }
        infinite_loop_guard();
      }
      batch.process(queued_root_effects);
      old_values.clear();
      if (dev_fallback_default) {
        for (const source2 of batch.current.keys()) {
          source_stacks.add(source2);
        }
      }
    }
  } finally {
    is_flushing = false;
    set_is_updating_effect(was_updating_effect);
    last_scheduled_effect = null;
    if (dev_fallback_default) {
      for (
        const source2 of
        /** @type {Set<Source>} */
        source_stacks
      ) {
        source2.updated = null;
      }
    }
  }
}
__name(flush_effects, "flush_effects");
function infinite_loop_guard() {
  try {
    effect_update_depth_exceeded();
  } catch (error) {
    if (dev_fallback_default) {
      define_property(error, "stack", { value: "" });
    }
    invoke_error_boundary(error, last_scheduled_effect);
  }
}
__name(infinite_loop_guard, "infinite_loop_guard");
var eager_block_effects = null;
function flush_queued_effects(effects) {
  var length = effects.length;
  if (length === 0) return;
  var i = 0;
  while (i < length) {
    var effect2 = effects[i++];
    if ((effect2.f & (DESTROYED | INERT)) === 0 && is_dirty(effect2)) {
      eager_block_effects = /* @__PURE__ */ new Set();
      update_effect(effect2);
      if (effect2.deps === null && effect2.first === null && effect2.nodes === null) {
        if (effect2.teardown === null && effect2.ac === null) {
          unlink_effect(effect2);
        } else {
          effect2.fn = null;
        }
      }
      if (eager_block_effects?.size > 0) {
        old_values.clear();
        for (const e of eager_block_effects) {
          if ((e.f & (DESTROYED | INERT)) !== 0) continue;
          const ordered_effects = [e];
          let ancestor = e.parent;
          while (ancestor !== null) {
            if (eager_block_effects.has(ancestor)) {
              eager_block_effects.delete(ancestor);
              ordered_effects.push(ancestor);
            }
            ancestor = ancestor.parent;
          }
          for (let j = ordered_effects.length - 1; j >= 0; j--) {
            const e2 = ordered_effects[j];
            if ((e2.f & (DESTROYED | INERT)) !== 0) continue;
            update_effect(e2);
          }
        }
        eager_block_effects.clear();
      }
    }
  }
  eager_block_effects = null;
}
__name(flush_queued_effects, "flush_queued_effects");
function mark_effects(value, sources, marked, checked) {
  if (marked.has(value)) return;
  marked.add(value);
  if (value.reactions !== null) {
    for (const reaction of value.reactions) {
      const flags2 = reaction.f;
      if ((flags2 & DERIVED) !== 0) {
        mark_effects(
          /** @type {Derived} */
          reaction,
          sources,
          marked,
          checked
        );
      } else if ((flags2 & (ASYNC | BLOCK_EFFECT)) !== 0 && (flags2 & DIRTY) === 0 && depends_on(reaction, sources, checked)) {
        set_signal_status(reaction, DIRTY);
        schedule_effect(
          /** @type {Effect} */
          reaction
        );
      }
    }
  }
}
__name(mark_effects, "mark_effects");
function depends_on(reaction, sources, checked) {
  const depends = checked.get(reaction);
  if (depends !== void 0) return depends;
  if (reaction.deps !== null) {
    for (const dep of reaction.deps) {
      if (sources.includes(dep)) {
        return true;
      }
      if ((dep.f & DERIVED) !== 0 && depends_on(
        /** @type {Derived} */
        dep,
        sources,
        checked
      )) {
        checked.set(
          /** @type {Derived} */
          dep,
          true
        );
        return true;
      }
    }
  }
  checked.set(reaction, false);
  return false;
}
__name(depends_on, "depends_on");
function schedule_effect(signal) {
  var effect2 = last_scheduled_effect = signal;
  while (effect2.parent !== null) {
    effect2 = effect2.parent;
    var flags2 = effect2.f;
    if (is_flushing && effect2 === active_effect && (flags2 & BLOCK_EFFECT) !== 0 && (flags2 & HEAD_EFFECT) === 0) {
      return;
    }
    if ((flags2 & (ROOT_EFFECT | BRANCH_EFFECT)) !== 0) {
      if ((flags2 & CLEAN) === 0) return;
      effect2.f ^= CLEAN;
    }
  }
  queued_root_effects.push(effect2);
}
__name(schedule_effect, "schedule_effect");

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/reactivity/create-subscriber.js
function createSubscriber(start) {
  let subscribers = 0;
  let version = source(0);
  let stop;
  if (dev_fallback_default) {
    tag(version, "createSubscriber version");
  }
  return () => {
    if (effect_tracking()) {
      get(version);
      render_effect(() => {
        if (subscribers === 0) {
          stop = untrack(() => start(() => increment(version)));
        }
        subscribers += 1;
        return () => {
          queue_micro_task(() => {
            subscribers -= 1;
            if (subscribers === 0) {
              stop?.();
              stop = void 0;
              increment(version);
            }
          });
        };
      });
    }
  };
}
__name(createSubscriber, "createSubscriber");

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/blocks/boundary.js
var flags = EFFECT_TRANSPARENT | EFFECT_PRESERVED | BOUNDARY_EFFECT;
function boundary(node, props, children) {
  new Boundary(node, props, children);
}
__name(boundary, "boundary");
var Boundary = class {
  static {
    __name(this, "Boundary");
  }
  /** @type {Boundary | null} */
  parent;
  #pending = false;
  /** @type {TemplateNode} */
  #anchor;
  /** @type {TemplateNode | null} */
  #hydrate_open = hydrating ? hydrate_node : null;
  /** @type {BoundaryProps} */
  #props;
  /** @type {((anchor: Node) => void)} */
  #children;
  /** @type {Effect} */
  #effect;
  /** @type {Effect | null} */
  #main_effect = null;
  /** @type {Effect | null} */
  #pending_effect = null;
  /** @type {Effect | null} */
  #failed_effect = null;
  /** @type {DocumentFragment | null} */
  #offscreen_fragment = null;
  /** @type {TemplateNode | null} */
  #pending_anchor = null;
  #local_pending_count = 0;
  #pending_count = 0;
  #is_creating_fallback = false;
  /**
   * A source containing the number of pending async deriveds/expressions.
   * Only created if `$effect.pending()` is used inside the boundary,
   * otherwise updating the source results in needless `Batch.ensure()`
   * calls followed by no-op flushes
   * @type {Source<number> | null}
   */
  #effect_pending = null;
  #effect_pending_subscriber = createSubscriber(() => {
    this.#effect_pending = source(this.#local_pending_count);
    if (dev_fallback_default) {
      tag(this.#effect_pending, "$effect.pending()");
    }
    return () => {
      this.#effect_pending = null;
    };
  });
  /**
   * @param {TemplateNode} node
   * @param {BoundaryProps} props
   * @param {((anchor: Node) => void)} children
   */
  constructor(node, props, children) {
    this.#anchor = node;
    this.#props = props;
    this.#children = children;
    this.parent = /** @type {Effect} */
    active_effect.b;
    this.#pending = !!this.#props.pending;
    this.#effect = block(() => {
      active_effect.b = this;
      if (hydrating) {
        const comment2 = this.#hydrate_open;
        hydrate_next();
        const server_rendered_pending = (
          /** @type {Comment} */
          comment2.nodeType === COMMENT_NODE && /** @type {Comment} */
          comment2.data === HYDRATION_START_ELSE
        );
        if (server_rendered_pending) {
          this.#hydrate_pending_content();
        } else {
          this.#hydrate_resolved_content();
        }
      } else {
        var anchor = this.#get_anchor();
        try {
          this.#main_effect = branch(() => children(anchor));
        } catch (error) {
          this.error(error);
        }
        if (this.#pending_count > 0) {
          this.#show_pending_snippet();
        } else {
          this.#pending = false;
        }
      }
      return () => {
        this.#pending_anchor?.remove();
      };
    }, flags);
    if (hydrating) {
      this.#anchor = hydrate_node;
    }
  }
  #hydrate_resolved_content() {
    try {
      this.#main_effect = branch(() => this.#children(this.#anchor));
    } catch (error) {
      this.error(error);
    }
    this.#pending = false;
  }
  #hydrate_pending_content() {
    const pending2 = this.#props.pending;
    if (!pending2) {
      return;
    }
    this.#pending_effect = branch(() => pending2(this.#anchor));
    Batch.enqueue(() => {
      var anchor = this.#get_anchor();
      this.#main_effect = this.#run(() => {
        Batch.ensure();
        return branch(() => this.#children(anchor));
      });
      if (this.#pending_count > 0) {
        this.#show_pending_snippet();
      } else {
        pause_effect(
          /** @type {Effect} */
          this.#pending_effect,
          () => {
            this.#pending_effect = null;
          }
        );
        this.#pending = false;
      }
    });
  }
  #get_anchor() {
    var anchor = this.#anchor;
    if (this.#pending) {
      this.#pending_anchor = create_text();
      this.#anchor.before(this.#pending_anchor);
      anchor = this.#pending_anchor;
    }
    return anchor;
  }
  /**
   * Returns `true` if the effect exists inside a boundary whose pending snippet is shown
   * @returns {boolean}
   */
  is_pending() {
    return this.#pending || !!this.parent && this.parent.is_pending();
  }
  has_pending_snippet() {
    return !!this.#props.pending;
  }
  /**
   * @param {() => Effect | null} fn
   */
  #run(fn) {
    var previous_effect = active_effect;
    var previous_reaction = active_reaction;
    var previous_ctx = component_context;
    set_active_effect(this.#effect);
    set_active_reaction(this.#effect);
    set_component_context(this.#effect.ctx);
    try {
      return fn();
    } catch (e) {
      handle_error(e);
      return null;
    } finally {
      set_active_effect(previous_effect);
      set_active_reaction(previous_reaction);
      set_component_context(previous_ctx);
    }
  }
  #show_pending_snippet() {
    const pending2 = (
      /** @type {(anchor: Node) => void} */
      this.#props.pending
    );
    if (this.#main_effect !== null) {
      this.#offscreen_fragment = document.createDocumentFragment();
      this.#offscreen_fragment.append(
        /** @type {TemplateNode} */
        this.#pending_anchor
      );
      move_effect(this.#main_effect, this.#offscreen_fragment);
    }
    if (this.#pending_effect === null) {
      this.#pending_effect = branch(() => pending2(this.#anchor));
    }
  }
  /**
   * Updates the pending count associated with the currently visible pending snippet,
   * if any, such that we can replace the snippet with content once work is done
   * @param {1 | -1} d
   */
  #update_pending_count(d) {
    if (!this.has_pending_snippet()) {
      if (this.parent) {
        this.parent.#update_pending_count(d);
      }
      return;
    }
    this.#pending_count += d;
    if (this.#pending_count === 0) {
      this.#pending = false;
      if (this.#pending_effect) {
        pause_effect(this.#pending_effect, () => {
          this.#pending_effect = null;
        });
      }
      if (this.#offscreen_fragment) {
        this.#anchor.before(this.#offscreen_fragment);
        this.#offscreen_fragment = null;
      }
    }
  }
  /**
   * Update the source that powers `$effect.pending()` inside this boundary,
   * and controls when the current `pending` snippet (if any) is removed.
   * Do not call from inside the class
   * @param {1 | -1} d
   */
  update_pending_count(d) {
    this.#update_pending_count(d);
    this.#local_pending_count += d;
    if (this.#effect_pending) {
      internal_set(this.#effect_pending, this.#local_pending_count);
    }
  }
  get_effect_pending() {
    this.#effect_pending_subscriber();
    return get(
      /** @type {Source<number>} */
      this.#effect_pending
    );
  }
  /** @param {unknown} error */
  error(error) {
    var onerror = this.#props.onerror;
    let failed = this.#props.failed;
    if (this.#is_creating_fallback || !onerror && !failed) {
      throw error;
    }
    if (this.#main_effect) {
      destroy_effect(this.#main_effect);
      this.#main_effect = null;
    }
    if (this.#pending_effect) {
      destroy_effect(this.#pending_effect);
      this.#pending_effect = null;
    }
    if (this.#failed_effect) {
      destroy_effect(this.#failed_effect);
      this.#failed_effect = null;
    }
    if (hydrating) {
      set_hydrate_node(
        /** @type {TemplateNode} */
        this.#hydrate_open
      );
      next();
      set_hydrate_node(skip_nodes());
    }
    var did_reset = false;
    var calling_on_error = false;
    const reset2 = /* @__PURE__ */ __name(() => {
      if (did_reset) {
        svelte_boundary_reset_noop();
        return;
      }
      did_reset = true;
      if (calling_on_error) {
        svelte_boundary_reset_onerror();
      }
      Batch.ensure();
      this.#local_pending_count = 0;
      if (this.#failed_effect !== null) {
        pause_effect(this.#failed_effect, () => {
          this.#failed_effect = null;
        });
      }
      this.#pending = this.has_pending_snippet();
      this.#main_effect = this.#run(() => {
        this.#is_creating_fallback = false;
        return branch(() => this.#children(this.#anchor));
      });
      if (this.#pending_count > 0) {
        this.#show_pending_snippet();
      } else {
        this.#pending = false;
      }
    }, "reset");
    var previous_reaction = active_reaction;
    try {
      set_active_reaction(null);
      calling_on_error = true;
      onerror?.(error, reset2);
      calling_on_error = false;
    } catch (error2) {
      invoke_error_boundary(error2, this.#effect && this.#effect.parent);
    } finally {
      set_active_reaction(previous_reaction);
    }
    if (failed) {
      queue_micro_task(() => {
        this.#failed_effect = this.#run(() => {
          Batch.ensure();
          this.#is_creating_fallback = true;
          try {
            return branch(() => {
              failed(
                this.#anchor,
                () => error,
                () => reset2
              );
            });
          } catch (error2) {
            invoke_error_boundary(
              error2,
              /** @type {Effect} */
              this.#effect.parent
            );
            return null;
          } finally {
            this.#is_creating_fallback = false;
          }
        });
      });
    }
  }
};

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/reactivity/deriveds.js
var recent_async_deriveds = /* @__PURE__ */ new Set();
function destroy_derived_effects(derived3) {
  var effects = derived3.effects;
  if (effects !== null) {
    derived3.effects = null;
    for (var i = 0; i < effects.length; i += 1) {
      destroy_effect(
        /** @type {Effect} */
        effects[i]
      );
    }
  }
}
__name(destroy_derived_effects, "destroy_derived_effects");
var stack = [];
function get_derived_parent_effect(derived3) {
  var parent = derived3.parent;
  while (parent !== null) {
    if ((parent.f & DERIVED) === 0) {
      return (parent.f & DESTROYED) === 0 ? (
        /** @type {Effect} */
        parent
      ) : null;
    }
    parent = parent.parent;
  }
  return null;
}
__name(get_derived_parent_effect, "get_derived_parent_effect");
function execute_derived(derived3) {
  var value;
  var prev_active_effect = active_effect;
  set_active_effect(get_derived_parent_effect(derived3));
  if (dev_fallback_default) {
    let prev_eager_effects = eager_effects;
    set_eager_effects(/* @__PURE__ */ new Set());
    try {
      if (stack.includes(derived3)) {
        derived_references_self();
      }
      stack.push(derived3);
      derived3.f &= ~WAS_MARKED;
      destroy_derived_effects(derived3);
      value = update_reaction(derived3);
    } finally {
      set_active_effect(prev_active_effect);
      set_eager_effects(prev_eager_effects);
      stack.pop();
    }
  } else {
    try {
      derived3.f &= ~WAS_MARKED;
      destroy_derived_effects(derived3);
      value = update_reaction(derived3);
    } finally {
      set_active_effect(prev_active_effect);
    }
  }
  return value;
}
__name(execute_derived, "execute_derived");
function update_derived(derived3) {
  var value = execute_derived(derived3);
  if (!derived3.equals(value)) {
    if (!current_batch?.is_fork) {
      derived3.v = value;
    }
    derived3.wv = increment_write_version();
  }
  if (is_destroying_effect) {
    return;
  }
  if (batch_values !== null) {
    if (effect_tracking() || current_batch?.is_fork) {
      batch_values.set(derived3, value);
    }
  } else {
    var status = (derived3.f & CONNECTED) === 0 ? MAYBE_DIRTY : CLEAN;
    set_signal_status(derived3, status);
  }
}
__name(update_derived, "update_derived");

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/reactivity/sources.js
var eager_effects = /* @__PURE__ */ new Set();
var old_values = /* @__PURE__ */ new Map();
function set_eager_effects(v) {
  eager_effects = v;
}
__name(set_eager_effects, "set_eager_effects");
var eager_effects_deferred = false;
function set_eager_effects_deferred() {
  eager_effects_deferred = true;
}
__name(set_eager_effects_deferred, "set_eager_effects_deferred");
function source(v, stack2) {
  var signal = {
    f: 0,
    // TODO ideally we could skip this altogether, but it causes type errors
    v,
    reactions: null,
    equals,
    rv: 0,
    wv: 0
  };
  if (dev_fallback_default && tracing_mode_flag) {
    signal.created = stack2 ?? get_error("created at");
    signal.updated = null;
    signal.set_during_effect = false;
    signal.trace = null;
  }
  return signal;
}
__name(source, "source");
// @__NO_SIDE_EFFECTS__
function state(v, stack2) {
  const s = source(v, stack2);
  push_reaction_value(s);
  return s;
}
__name(state, "state");
// @__NO_SIDE_EFFECTS__
function mutable_source(initial_value, immutable = false, trackable = true) {
  const s = source(initial_value);
  if (!immutable) {
    s.equals = safe_equals;
  }
  if (legacy_mode_flag && trackable && component_context !== null && component_context.l !== null) {
    (component_context.l.s ??= []).push(s);
  }
  return s;
}
__name(mutable_source, "mutable_source");
function set(source2, value, should_proxy = false) {
  if (active_reaction !== null && // since we are untracking the function inside `$inspect.with` we need to add this check
  // to ensure we error if state is set inside an inspect effect
  (!untracking || (active_reaction.f & EAGER_EFFECT) !== 0) && is_runes() && (active_reaction.f & (DERIVED | BLOCK_EFFECT | ASYNC | EAGER_EFFECT)) !== 0 && !current_sources?.includes(source2)) {
    state_unsafe_mutation();
  }
  let new_value = should_proxy ? proxy(value) : value;
  if (dev_fallback_default) {
    tag_proxy(
      new_value,
      /** @type {string} */
      source2.label
    );
  }
  return internal_set(source2, new_value);
}
__name(set, "set");
function internal_set(source2, value) {
  if (!source2.equals(value)) {
    var old_value = source2.v;
    if (is_destroying_effect) {
      old_values.set(source2, value);
    } else {
      old_values.set(source2, old_value);
    }
    source2.v = value;
    var batch = Batch.ensure();
    batch.capture(source2, old_value);
    if (dev_fallback_default) {
      if (tracing_mode_flag || active_effect !== null) {
        source2.updated ??= /* @__PURE__ */ new Map();
        const count = (source2.updated.get("")?.count ?? 0) + 1;
        source2.updated.set("", { error: (
          /** @type {any} */
          null
        ), count });
        if (tracing_mode_flag || count > 5) {
          const error = get_error("updated at");
          if (error !== null) {
            let entry = source2.updated.get(error.stack);
            if (!entry) {
              entry = { error, count: 0 };
              source2.updated.set(error.stack, entry);
            }
            entry.count++;
          }
        }
      }
      if (active_effect !== null) {
        source2.set_during_effect = true;
      }
    }
    if ((source2.f & DERIVED) !== 0) {
      if ((source2.f & DIRTY) !== 0) {
        execute_derived(
          /** @type {Derived} */
          source2
        );
      }
      set_signal_status(source2, (source2.f & CONNECTED) !== 0 ? CLEAN : MAYBE_DIRTY);
    }
    source2.wv = increment_write_version();
    mark_reactions(source2, DIRTY);
    if (is_runes() && active_effect !== null && (active_effect.f & CLEAN) !== 0 && (active_effect.f & (BRANCH_EFFECT | ROOT_EFFECT)) === 0) {
      if (untracked_writes === null) {
        set_untracked_writes([source2]);
      } else {
        untracked_writes.push(source2);
      }
    }
    if (!batch.is_fork && eager_effects.size > 0 && !eager_effects_deferred) {
      flush_eager_effects();
    }
  }
  return value;
}
__name(internal_set, "internal_set");
function flush_eager_effects() {
  eager_effects_deferred = false;
  var prev_is_updating_effect = is_updating_effect;
  set_is_updating_effect(true);
  const inspects = Array.from(eager_effects);
  try {
    for (const effect2 of inspects) {
      if ((effect2.f & CLEAN) !== 0) {
        set_signal_status(effect2, MAYBE_DIRTY);
      }
      if (is_dirty(effect2)) {
        update_effect(effect2);
      }
    }
  } finally {
    set_is_updating_effect(prev_is_updating_effect);
  }
  eager_effects.clear();
}
__name(flush_eager_effects, "flush_eager_effects");
function increment(source2) {
  set(source2, source2.v + 1);
}
__name(increment, "increment");
function mark_reactions(signal, status) {
  var reactions = signal.reactions;
  if (reactions === null) return;
  var runes = is_runes();
  var length = reactions.length;
  for (var i = 0; i < length; i++) {
    var reaction = reactions[i];
    var flags2 = reaction.f;
    if (!runes && reaction === active_effect) continue;
    if (dev_fallback_default && (flags2 & EAGER_EFFECT) !== 0) {
      eager_effects.add(reaction);
      continue;
    }
    var not_dirty = (flags2 & DIRTY) === 0;
    if (not_dirty) {
      set_signal_status(reaction, status);
    }
    if ((flags2 & DERIVED) !== 0) {
      var derived3 = (
        /** @type {Derived} */
        reaction
      );
      batch_values?.delete(derived3);
      if ((flags2 & WAS_MARKED) === 0) {
        if (flags2 & CONNECTED) {
          reaction.f |= WAS_MARKED;
        }
        mark_reactions(derived3, MAYBE_DIRTY);
      }
    } else if (not_dirty) {
      if ((flags2 & BLOCK_EFFECT) !== 0 && eager_block_effects !== null) {
        eager_block_effects.add(
          /** @type {Effect} */
          reaction
        );
      }
      schedule_effect(
        /** @type {Effect} */
        reaction
      );
    }
  }
}
__name(mark_reactions, "mark_reactions");

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/proxy.js
var regex_is_valid_identifier = /^[a-zA-Z_$][a-zA-Z_$0-9]*$/;
function proxy(value) {
  if (typeof value !== "object" || value === null || STATE_SYMBOL in value) {
    return value;
  }
  const prototype = get_prototype_of(value);
  if (prototype !== object_prototype && prototype !== array_prototype) {
    return value;
  }
  var sources = /* @__PURE__ */ new Map();
  var is_proxied_array = is_array(value);
  var version = state(0);
  var stack2 = dev_fallback_default && tracing_mode_flag ? get_error("created at") : null;
  var parent_version = update_version;
  var with_parent = /* @__PURE__ */ __name((fn) => {
    if (update_version === parent_version) {
      return fn();
    }
    var reaction = active_reaction;
    var version2 = update_version;
    set_active_reaction(null);
    set_update_version(parent_version);
    var result = fn();
    set_active_reaction(reaction);
    set_update_version(version2);
    return result;
  }, "with_parent");
  if (is_proxied_array) {
    sources.set("length", state(
      /** @type {any[]} */
      value.length,
      stack2
    ));
    if (dev_fallback_default) {
      value = /** @type {any} */
      inspectable_array(
        /** @type {any[]} */
        value
      );
    }
  }
  var path = "";
  let updating = false;
  function update_path(new_path) {
    if (updating) return;
    updating = true;
    path = new_path;
    tag(version, `${path} version`);
    for (const [prop2, source2] of sources) {
      tag(source2, get_label(path, prop2));
    }
    updating = false;
  }
  __name(update_path, "update_path");
  return new Proxy(
    /** @type {any} */
    value,
    {
      defineProperty(_, prop2, descriptor) {
        if (!("value" in descriptor) || descriptor.configurable === false || descriptor.enumerable === false || descriptor.writable === false) {
          state_descriptors_fixed();
        }
        var s = sources.get(prop2);
        if (s === void 0) {
          s = with_parent(() => {
            var s2 = state(descriptor.value, stack2);
            sources.set(prop2, s2);
            if (dev_fallback_default && typeof prop2 === "string") {
              tag(s2, get_label(path, prop2));
            }
            return s2;
          });
        } else {
          set(s, descriptor.value, true);
        }
        return true;
      },
      deleteProperty(target, prop2) {
        var s = sources.get(prop2);
        if (s === void 0) {
          if (prop2 in target) {
            const s2 = with_parent(() => state(UNINITIALIZED, stack2));
            sources.set(prop2, s2);
            increment(version);
            if (dev_fallback_default) {
              tag(s2, get_label(path, prop2));
            }
          }
        } else {
          set(s, UNINITIALIZED);
          increment(version);
        }
        return true;
      },
      get(target, prop2, receiver) {
        if (prop2 === STATE_SYMBOL) {
          return value;
        }
        if (dev_fallback_default && prop2 === PROXY_PATH_SYMBOL) {
          return update_path;
        }
        var s = sources.get(prop2);
        var exists = prop2 in target;
        if (s === void 0 && (!exists || get_descriptor(target, prop2)?.writable)) {
          s = with_parent(() => {
            var p = proxy(exists ? target[prop2] : UNINITIALIZED);
            var s2 = state(p, stack2);
            if (dev_fallback_default) {
              tag(s2, get_label(path, prop2));
            }
            return s2;
          });
          sources.set(prop2, s);
        }
        if (s !== void 0) {
          var v = get(s);
          return v === UNINITIALIZED ? void 0 : v;
        }
        return Reflect.get(target, prop2, receiver);
      },
      getOwnPropertyDescriptor(target, prop2) {
        var descriptor = Reflect.getOwnPropertyDescriptor(target, prop2);
        if (descriptor && "value" in descriptor) {
          var s = sources.get(prop2);
          if (s) descriptor.value = get(s);
        } else if (descriptor === void 0) {
          var source2 = sources.get(prop2);
          var value2 = source2?.v;
          if (source2 !== void 0 && value2 !== UNINITIALIZED) {
            return {
              enumerable: true,
              configurable: true,
              value: value2,
              writable: true
            };
          }
        }
        return descriptor;
      },
      has(target, prop2) {
        if (prop2 === STATE_SYMBOL) {
          return true;
        }
        var s = sources.get(prop2);
        var has = s !== void 0 && s.v !== UNINITIALIZED || Reflect.has(target, prop2);
        if (s !== void 0 || active_effect !== null && (!has || get_descriptor(target, prop2)?.writable)) {
          if (s === void 0) {
            s = with_parent(() => {
              var p = has ? proxy(target[prop2]) : UNINITIALIZED;
              var s2 = state(p, stack2);
              if (dev_fallback_default) {
                tag(s2, get_label(path, prop2));
              }
              return s2;
            });
            sources.set(prop2, s);
          }
          var value2 = get(s);
          if (value2 === UNINITIALIZED) {
            return false;
          }
        }
        return has;
      },
      set(target, prop2, value2, receiver) {
        var s = sources.get(prop2);
        var has = prop2 in target;
        if (is_proxied_array && prop2 === "length") {
          for (var i = value2; i < /** @type {Source<number>} */
          s.v; i += 1) {
            var other_s = sources.get(i + "");
            if (other_s !== void 0) {
              set(other_s, UNINITIALIZED);
            } else if (i in target) {
              other_s = with_parent(() => state(UNINITIALIZED, stack2));
              sources.set(i + "", other_s);
              if (dev_fallback_default) {
                tag(other_s, get_label(path, i));
              }
            }
          }
        }
        if (s === void 0) {
          if (!has || get_descriptor(target, prop2)?.writable) {
            s = with_parent(() => state(void 0, stack2));
            if (dev_fallback_default) {
              tag(s, get_label(path, prop2));
            }
            set(s, proxy(value2));
            sources.set(prop2, s);
          }
        } else {
          has = s.v !== UNINITIALIZED;
          var p = with_parent(() => proxy(value2));
          set(s, p);
        }
        var descriptor = Reflect.getOwnPropertyDescriptor(target, prop2);
        if (descriptor?.set) {
          descriptor.set.call(receiver, value2);
        }
        if (!has) {
          if (is_proxied_array && typeof prop2 === "string") {
            var ls = (
              /** @type {Source<number>} */
              sources.get("length")
            );
            var n = Number(prop2);
            if (Number.isInteger(n) && n >= ls.v) {
              set(ls, n + 1);
            }
          }
          increment(version);
        }
        return true;
      },
      ownKeys(target) {
        get(version);
        var own_keys = Reflect.ownKeys(target).filter((key3) => {
          var source3 = sources.get(key3);
          return source3 === void 0 || source3.v !== UNINITIALIZED;
        });
        for (var [key2, source2] of sources) {
          if (source2.v !== UNINITIALIZED && !(key2 in target)) {
            own_keys.push(key2);
          }
        }
        return own_keys;
      },
      setPrototypeOf() {
        state_prototype_fixed();
      }
    }
  );
}
__name(proxy, "proxy");
function get_label(path, prop2) {
  if (typeof prop2 === "symbol") return `${path}[Symbol(${prop2.description ?? ""})]`;
  if (regex_is_valid_identifier.test(prop2)) return `${path}.${prop2}`;
  return /^\d+$/.test(prop2) ? `${path}[${prop2}]` : `${path}['${prop2}']`;
}
__name(get_label, "get_label");
function get_proxied_value(value) {
  try {
    if (value !== null && typeof value === "object" && STATE_SYMBOL in value) {
      return value[STATE_SYMBOL];
    }
  } catch {
  }
  return value;
}
__name(get_proxied_value, "get_proxied_value");
var ARRAY_MUTATING_METHODS = /* @__PURE__ */ new Set([
  "copyWithin",
  "fill",
  "pop",
  "push",
  "reverse",
  "shift",
  "sort",
  "splice",
  "unshift"
]);
function inspectable_array(array) {
  return new Proxy(array, {
    get(target, prop2, receiver) {
      var value = Reflect.get(target, prop2, receiver);
      if (!ARRAY_MUTATING_METHODS.has(
        /** @type {string} */
        prop2
      )) {
        return value;
      }
      return function(...args) {
        set_eager_effects_deferred();
        var result = value.apply(this, args);
        flush_eager_effects();
        return result;
      };
    }
  });
}
__name(inspectable_array, "inspectable_array");

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dev/equality.js
function init_array_prototype_warnings() {
  const array_prototype2 = Array.prototype;
  const cleanup = Array.__svelte_cleanup;
  if (cleanup) {
    cleanup();
  }
  const { indexOf, lastIndexOf, includes } = array_prototype2;
  array_prototype2.indexOf = function(item, from_index) {
    const index2 = indexOf.call(this, item, from_index);
    if (index2 === -1) {
      for (let i = from_index ?? 0; i < this.length; i += 1) {
        if (get_proxied_value(this[i]) === item) {
          state_proxy_equality_mismatch("array.indexOf(...)");
          break;
        }
      }
    }
    return index2;
  };
  array_prototype2.lastIndexOf = function(item, from_index) {
    const index2 = lastIndexOf.call(this, item, from_index ?? this.length - 1);
    if (index2 === -1) {
      for (let i = 0; i <= (from_index ?? this.length - 1); i += 1) {
        if (get_proxied_value(this[i]) === item) {
          state_proxy_equality_mismatch("array.lastIndexOf(...)");
          break;
        }
      }
    }
    return index2;
  };
  array_prototype2.includes = function(item, from_index) {
    const has = includes.call(this, item, from_index);
    if (!has) {
      for (let i = 0; i < this.length; i += 1) {
        if (get_proxied_value(this[i]) === item) {
          state_proxy_equality_mismatch("array.includes(...)");
          break;
        }
      }
    }
    return has;
  };
  Array.__svelte_cleanup = () => {
    array_prototype2.indexOf = indexOf;
    array_prototype2.lastIndexOf = lastIndexOf;
    array_prototype2.includes = includes;
  };
}
__name(init_array_prototype_warnings, "init_array_prototype_warnings");

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/operations.js
var $window;
var $document;
var is_firefox;
var first_child_getter;
var next_sibling_getter;
function init_operations() {
  if ($window !== void 0) {
    return;
  }
  $window = window;
  $document = document;
  is_firefox = /Firefox/.test("Cloudflare-Workers");
  var element_prototype = Element.prototype;
  var node_prototype = Node.prototype;
  var text_prototype = Text.prototype;
  first_child_getter = get_descriptor(node_prototype, "firstChild").get;
  next_sibling_getter = get_descriptor(node_prototype, "nextSibling").get;
  if (is_extensible(element_prototype)) {
    element_prototype.__click = void 0;
    element_prototype.__className = void 0;
    element_prototype.__attributes = null;
    element_prototype.__style = void 0;
    element_prototype.__e = void 0;
  }
  if (is_extensible(text_prototype)) {
    text_prototype.__t = void 0;
  }
  if (dev_fallback_default) {
    element_prototype.__svelte_meta = null;
    init_array_prototype_warnings();
  }
}
__name(init_operations, "init_operations");
function create_text(value = "") {
  return document.createTextNode(value);
}
__name(create_text, "create_text");
// @__NO_SIDE_EFFECTS__
function get_first_child(node) {
  return (
    /** @type {TemplateNode | null} */
    first_child_getter.call(node)
  );
}
__name(get_first_child, "get_first_child");
// @__NO_SIDE_EFFECTS__
function get_next_sibling(node) {
  return (
    /** @type {TemplateNode | null} */
    next_sibling_getter.call(node)
  );
}
__name(get_next_sibling, "get_next_sibling");
function clear_text_content(node) {
  node.textContent = "";
}
__name(clear_text_content, "clear_text_content");

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/elements/bindings/shared.js
function without_reactive_context(fn) {
  var previous_reaction = active_reaction;
  var previous_effect = active_effect;
  set_active_reaction(null);
  set_active_effect(null);
  try {
    return fn();
  } finally {
    set_active_reaction(previous_reaction);
    set_active_effect(previous_effect);
  }
}
__name(without_reactive_context, "without_reactive_context");

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/reactivity/effects.js
function push_effect(effect2, parent_effect) {
  var parent_last = parent_effect.last;
  if (parent_last === null) {
    parent_effect.last = parent_effect.first = effect2;
  } else {
    parent_last.next = effect2;
    effect2.prev = parent_last;
    parent_effect.last = effect2;
  }
}
__name(push_effect, "push_effect");
function create_effect(type, fn, sync) {
  var parent = active_effect;
  if (dev_fallback_default) {
    while (parent !== null && (parent.f & EAGER_EFFECT) !== 0) {
      parent = parent.parent;
    }
  }
  if (parent !== null && (parent.f & INERT) !== 0) {
    type |= INERT;
  }
  var effect2 = {
    ctx: component_context,
    deps: null,
    nodes: null,
    f: type | DIRTY | CONNECTED,
    first: null,
    fn,
    last: null,
    next: null,
    parent,
    b: parent && parent.b,
    prev: null,
    teardown: null,
    wv: 0,
    ac: null
  };
  if (dev_fallback_default) {
    effect2.component_function = dev_current_component_function;
  }
  if (sync) {
    try {
      update_effect(effect2);
      effect2.f |= EFFECT_RAN;
    } catch (e2) {
      destroy_effect(effect2);
      throw e2;
    }
  } else if (fn !== null) {
    schedule_effect(effect2);
  }
  var e = effect2;
  if (sync && e.deps === null && e.teardown === null && e.nodes === null && e.first === e.last && // either `null`, or a singular child
  (e.f & EFFECT_PRESERVED) === 0) {
    e = e.first;
    if ((type & BLOCK_EFFECT) !== 0 && (type & EFFECT_TRANSPARENT) !== 0 && e !== null) {
      e.f |= EFFECT_TRANSPARENT;
    }
  }
  if (e !== null) {
    e.parent = parent;
    if (parent !== null) {
      push_effect(e, parent);
    }
    if (active_reaction !== null && (active_reaction.f & DERIVED) !== 0 && (type & ROOT_EFFECT) === 0) {
      var derived3 = (
        /** @type {Derived} */
        active_reaction
      );
      (derived3.effects ??= []).push(e);
    }
  }
  return effect2;
}
__name(create_effect, "create_effect");
function effect_tracking() {
  return active_reaction !== null && !untracking;
}
__name(effect_tracking, "effect_tracking");
function create_user_effect(fn) {
  return create_effect(EFFECT | USER_EFFECT, fn, false);
}
__name(create_user_effect, "create_user_effect");
function effect_root(fn) {
  Batch.ensure();
  const effect2 = create_effect(ROOT_EFFECT | EFFECT_PRESERVED, fn, true);
  return () => {
    destroy_effect(effect2);
  };
}
__name(effect_root, "effect_root");
function component_root(fn) {
  Batch.ensure();
  const effect2 = create_effect(ROOT_EFFECT | EFFECT_PRESERVED, fn, true);
  return (options = {}) => {
    return new Promise((fulfil) => {
      if (options.outro) {
        pause_effect(effect2, () => {
          destroy_effect(effect2);
          fulfil(void 0);
        });
      } else {
        destroy_effect(effect2);
        fulfil(void 0);
      }
    });
  };
}
__name(component_root, "component_root");
function render_effect(fn, flags2 = 0) {
  return create_effect(RENDER_EFFECT | flags2, fn, true);
}
__name(render_effect, "render_effect");
function block(fn, flags2 = 0) {
  var effect2 = create_effect(BLOCK_EFFECT | flags2, fn, true);
  if (dev_fallback_default) {
    effect2.dev_stack = dev_stack;
  }
  return effect2;
}
__name(block, "block");
function branch(fn) {
  return create_effect(BRANCH_EFFECT | EFFECT_PRESERVED, fn, true);
}
__name(branch, "branch");
function execute_effect_teardown(effect2) {
  var teardown2 = effect2.teardown;
  if (teardown2 !== null) {
    const previously_destroying_effect = is_destroying_effect;
    const previous_reaction = active_reaction;
    set_is_destroying_effect(true);
    set_active_reaction(null);
    try {
      teardown2.call(null);
    } finally {
      set_is_destroying_effect(previously_destroying_effect);
      set_active_reaction(previous_reaction);
    }
  }
}
__name(execute_effect_teardown, "execute_effect_teardown");
function destroy_effect_children(signal, remove_dom = false) {
  var effect2 = signal.first;
  signal.first = signal.last = null;
  while (effect2 !== null) {
    const controller = effect2.ac;
    if (controller !== null) {
      without_reactive_context(() => {
        controller.abort(STALE_REACTION);
      });
    }
    var next2 = effect2.next;
    if ((effect2.f & ROOT_EFFECT) !== 0) {
      effect2.parent = null;
    } else {
      destroy_effect(effect2, remove_dom);
    }
    effect2 = next2;
  }
}
__name(destroy_effect_children, "destroy_effect_children");
function destroy_block_effect_children(signal) {
  var effect2 = signal.first;
  while (effect2 !== null) {
    var next2 = effect2.next;
    if ((effect2.f & BRANCH_EFFECT) === 0) {
      destroy_effect(effect2);
    }
    effect2 = next2;
  }
}
__name(destroy_block_effect_children, "destroy_block_effect_children");
function destroy_effect(effect2, remove_dom = true) {
  var removed = false;
  if ((remove_dom || (effect2.f & HEAD_EFFECT) !== 0) && effect2.nodes !== null && effect2.nodes.end !== null) {
    remove_effect_dom(
      effect2.nodes.start,
      /** @type {TemplateNode} */
      effect2.nodes.end
    );
    removed = true;
  }
  destroy_effect_children(effect2, remove_dom && !removed);
  remove_reactions(effect2, 0);
  set_signal_status(effect2, DESTROYED);
  var transitions = effect2.nodes && effect2.nodes.t;
  if (transitions !== null) {
    for (const transition2 of transitions) {
      transition2.stop();
    }
  }
  execute_effect_teardown(effect2);
  var parent = effect2.parent;
  if (parent !== null && parent.first !== null) {
    unlink_effect(effect2);
  }
  if (dev_fallback_default) {
    effect2.component_function = null;
  }
  effect2.next = effect2.prev = effect2.teardown = effect2.ctx = effect2.deps = effect2.fn = effect2.nodes = effect2.ac = null;
}
__name(destroy_effect, "destroy_effect");
function remove_effect_dom(node, end) {
  while (node !== null) {
    var next2 = node === end ? null : get_next_sibling(node);
    node.remove();
    node = next2;
  }
}
__name(remove_effect_dom, "remove_effect_dom");
function unlink_effect(effect2) {
  var parent = effect2.parent;
  var prev = effect2.prev;
  var next2 = effect2.next;
  if (prev !== null) prev.next = next2;
  if (next2 !== null) next2.prev = prev;
  if (parent !== null) {
    if (parent.first === effect2) parent.first = next2;
    if (parent.last === effect2) parent.last = prev;
  }
}
__name(unlink_effect, "unlink_effect");
function pause_effect(effect2, callback, destroy = true) {
  var transitions = [];
  pause_children(effect2, transitions, true);
  var fn = /* @__PURE__ */ __name(() => {
    if (destroy) destroy_effect(effect2);
    if (callback) callback();
  }, "fn");
  var remaining = transitions.length;
  if (remaining > 0) {
    var check = /* @__PURE__ */ __name(() => --remaining || fn(), "check");
    for (var transition2 of transitions) {
      transition2.out(check);
    }
  } else {
    fn();
  }
}
__name(pause_effect, "pause_effect");
function pause_children(effect2, transitions, local) {
  if ((effect2.f & INERT) !== 0) return;
  effect2.f ^= INERT;
  var t = effect2.nodes && effect2.nodes.t;
  if (t !== null) {
    for (const transition2 of t) {
      if (transition2.is_global || local) {
        transitions.push(transition2);
      }
    }
  }
  var child2 = effect2.first;
  while (child2 !== null) {
    var sibling2 = child2.next;
    var transparent = (child2.f & EFFECT_TRANSPARENT) !== 0 || // If this is a branch effect without a block effect parent,
    // it means the parent block effect was pruned. In that case,
    // transparency information was transferred to the branch effect.
    (child2.f & BRANCH_EFFECT) !== 0 && (effect2.f & BLOCK_EFFECT) !== 0;
    pause_children(child2, transitions, transparent ? local : false);
    child2 = sibling2;
  }
}
__name(pause_children, "pause_children");
function move_effect(effect2, fragment) {
  if (!effect2.nodes) return;
  var node = effect2.nodes.start;
  var end = effect2.nodes.end;
  while (node !== null) {
    var next2 = node === end ? null : get_next_sibling(node);
    fragment.append(node);
    node = next2;
  }
}
__name(move_effect, "move_effect");

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/legacy.js
var captured_signals = null;

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/runtime.js
var is_updating_effect = false;
function set_is_updating_effect(value) {
  is_updating_effect = value;
}
__name(set_is_updating_effect, "set_is_updating_effect");
var is_destroying_effect = false;
function set_is_destroying_effect(value) {
  is_destroying_effect = value;
}
__name(set_is_destroying_effect, "set_is_destroying_effect");
var active_reaction = null;
var untracking = false;
function set_active_reaction(reaction) {
  active_reaction = reaction;
}
__name(set_active_reaction, "set_active_reaction");
var active_effect = null;
function set_active_effect(effect2) {
  active_effect = effect2;
}
__name(set_active_effect, "set_active_effect");
var current_sources = null;
function push_reaction_value(value) {
  if (active_reaction !== null && (!async_mode_flag || (active_reaction.f & DERIVED) !== 0)) {
    if (current_sources === null) {
      current_sources = [value];
    } else {
      current_sources.push(value);
    }
  }
}
__name(push_reaction_value, "push_reaction_value");
var new_deps = null;
var skipped_deps = 0;
var untracked_writes = null;
function set_untracked_writes(value) {
  untracked_writes = value;
}
__name(set_untracked_writes, "set_untracked_writes");
var write_version = 1;
var read_version = 0;
var update_version = read_version;
function set_update_version(value) {
  update_version = value;
}
__name(set_update_version, "set_update_version");
function increment_write_version() {
  return ++write_version;
}
__name(increment_write_version, "increment_write_version");
function is_dirty(reaction) {
  var flags2 = reaction.f;
  if ((flags2 & DIRTY) !== 0) {
    return true;
  }
  if (flags2 & DERIVED) {
    reaction.f &= ~WAS_MARKED;
  }
  if ((flags2 & MAYBE_DIRTY) !== 0) {
    var dependencies = reaction.deps;
    if (dependencies !== null) {
      var length = dependencies.length;
      for (var i = 0; i < length; i++) {
        var dependency = dependencies[i];
        if (is_dirty(
          /** @type {Derived} */
          dependency
        )) {
          update_derived(
            /** @type {Derived} */
            dependency
          );
        }
        if (dependency.wv > reaction.wv) {
          return true;
        }
      }
    }
    if ((flags2 & CONNECTED) !== 0 && // During time traveling we don't want to reset the status so that
    // traversal of the graph in the other batches still happens
    batch_values === null) {
      set_signal_status(reaction, CLEAN);
    }
  }
  return false;
}
__name(is_dirty, "is_dirty");
function schedule_possible_effect_self_invalidation(signal, effect2, root = true) {
  var reactions = signal.reactions;
  if (reactions === null) return;
  if (!async_mode_flag && current_sources?.includes(signal)) {
    return;
  }
  for (var i = 0; i < reactions.length; i++) {
    var reaction = reactions[i];
    if ((reaction.f & DERIVED) !== 0) {
      schedule_possible_effect_self_invalidation(
        /** @type {Derived} */
        reaction,
        effect2,
        false
      );
    } else if (effect2 === reaction) {
      if (root) {
        set_signal_status(reaction, DIRTY);
      } else if ((reaction.f & CLEAN) !== 0) {
        set_signal_status(reaction, MAYBE_DIRTY);
      }
      schedule_effect(
        /** @type {Effect} */
        reaction
      );
    }
  }
}
__name(schedule_possible_effect_self_invalidation, "schedule_possible_effect_self_invalidation");
function update_reaction(reaction) {
  var previous_deps = new_deps;
  var previous_skipped_deps = skipped_deps;
  var previous_untracked_writes = untracked_writes;
  var previous_reaction = active_reaction;
  var previous_sources = current_sources;
  var previous_component_context = component_context;
  var previous_untracking = untracking;
  var previous_update_version = update_version;
  var flags2 = reaction.f;
  new_deps = /** @type {null | Value[]} */
  null;
  skipped_deps = 0;
  untracked_writes = null;
  active_reaction = (flags2 & (BRANCH_EFFECT | ROOT_EFFECT)) === 0 ? reaction : null;
  current_sources = null;
  set_component_context(reaction.ctx);
  untracking = false;
  update_version = ++read_version;
  if (reaction.ac !== null) {
    without_reactive_context(() => {
      reaction.ac.abort(STALE_REACTION);
    });
    reaction.ac = null;
  }
  try {
    reaction.f |= REACTION_IS_UPDATING;
    var fn = (
      /** @type {Function} */
      reaction.fn
    );
    var result = fn();
    var deps = reaction.deps;
    if (new_deps !== null) {
      var i;
      remove_reactions(reaction, skipped_deps);
      if (deps !== null && skipped_deps > 0) {
        deps.length = skipped_deps + new_deps.length;
        for (i = 0; i < new_deps.length; i++) {
          deps[skipped_deps + i] = new_deps[i];
        }
      } else {
        reaction.deps = deps = new_deps;
      }
      if (effect_tracking() && (reaction.f & CONNECTED) !== 0) {
        for (i = skipped_deps; i < deps.length; i++) {
          (deps[i].reactions ??= []).push(reaction);
        }
      }
    } else if (deps !== null && skipped_deps < deps.length) {
      remove_reactions(reaction, skipped_deps);
      deps.length = skipped_deps;
    }
    if (is_runes() && untracked_writes !== null && !untracking && deps !== null && (reaction.f & (DERIVED | MAYBE_DIRTY | DIRTY)) === 0) {
      for (i = 0; i < /** @type {Source[]} */
      untracked_writes.length; i++) {
        schedule_possible_effect_self_invalidation(
          untracked_writes[i],
          /** @type {Effect} */
          reaction
        );
      }
    }
    if (previous_reaction !== null && previous_reaction !== reaction) {
      read_version++;
      if (untracked_writes !== null) {
        if (previous_untracked_writes === null) {
          previous_untracked_writes = untracked_writes;
        } else {
          previous_untracked_writes.push(.../** @type {Source[]} */
          untracked_writes);
        }
      }
    }
    if ((reaction.f & ERROR_VALUE) !== 0) {
      reaction.f ^= ERROR_VALUE;
    }
    return result;
  } catch (error) {
    return handle_error(error);
  } finally {
    reaction.f ^= REACTION_IS_UPDATING;
    new_deps = previous_deps;
    skipped_deps = previous_skipped_deps;
    untracked_writes = previous_untracked_writes;
    active_reaction = previous_reaction;
    current_sources = previous_sources;
    set_component_context(previous_component_context);
    untracking = previous_untracking;
    update_version = previous_update_version;
  }
}
__name(update_reaction, "update_reaction");
function remove_reaction(signal, dependency) {
  let reactions = dependency.reactions;
  if (reactions !== null) {
    var index2 = index_of.call(reactions, signal);
    if (index2 !== -1) {
      var new_length = reactions.length - 1;
      if (new_length === 0) {
        reactions = dependency.reactions = null;
      } else {
        reactions[index2] = reactions[new_length];
        reactions.pop();
      }
    }
  }
  if (reactions === null && (dependency.f & DERIVED) !== 0 && // Destroying a child effect while updating a parent effect can cause a dependency to appear
  // to be unused, when in fact it is used by the currently-updating parent. Checking `new_deps`
  // allows us to skip the expensive work of disconnecting and immediately reconnecting it
  (new_deps === null || !new_deps.includes(dependency))) {
    set_signal_status(dependency, MAYBE_DIRTY);
    if ((dependency.f & CONNECTED) !== 0) {
      dependency.f ^= CONNECTED;
      dependency.f &= ~WAS_MARKED;
    }
    destroy_derived_effects(
      /** @type {Derived} **/
      dependency
    );
    remove_reactions(
      /** @type {Derived} **/
      dependency,
      0
    );
  }
}
__name(remove_reaction, "remove_reaction");
function remove_reactions(signal, start_index) {
  var dependencies = signal.deps;
  if (dependencies === null) return;
  for (var i = start_index; i < dependencies.length; i++) {
    remove_reaction(signal, dependencies[i]);
  }
}
__name(remove_reactions, "remove_reactions");
function update_effect(effect2) {
  var flags2 = effect2.f;
  if ((flags2 & DESTROYED) !== 0) {
    return;
  }
  set_signal_status(effect2, CLEAN);
  var previous_effect = active_effect;
  var was_updating_effect = is_updating_effect;
  active_effect = effect2;
  is_updating_effect = true;
  if (dev_fallback_default) {
    var previous_component_fn = dev_current_component_function;
    set_dev_current_component_function(effect2.component_function);
    var previous_stack = (
      /** @type {any} */
      dev_stack
    );
    set_dev_stack(effect2.dev_stack ?? dev_stack);
  }
  try {
    if ((flags2 & (BLOCK_EFFECT | MANAGED_EFFECT)) !== 0) {
      destroy_block_effect_children(effect2);
    } else {
      destroy_effect_children(effect2);
    }
    execute_effect_teardown(effect2);
    var teardown2 = update_reaction(effect2);
    effect2.teardown = typeof teardown2 === "function" ? teardown2 : null;
    effect2.wv = write_version;
    if (dev_fallback_default && tracing_mode_flag && (effect2.f & DIRTY) !== 0 && effect2.deps !== null) {
      for (var dep of effect2.deps) {
        if (dep.set_during_effect) {
          dep.wv = increment_write_version();
          dep.set_during_effect = false;
        }
      }
    }
  } finally {
    is_updating_effect = was_updating_effect;
    active_effect = previous_effect;
    if (dev_fallback_default) {
      set_dev_current_component_function(previous_component_fn);
      set_dev_stack(previous_stack);
    }
  }
}
__name(update_effect, "update_effect");
function get(signal) {
  var flags2 = signal.f;
  var is_derived = (flags2 & DERIVED) !== 0;
  captured_signals?.add(signal);
  if (active_reaction !== null && !untracking) {
    var destroyed = active_effect !== null && (active_effect.f & DESTROYED) !== 0;
    if (!destroyed && !current_sources?.includes(signal)) {
      var deps = active_reaction.deps;
      if ((active_reaction.f & REACTION_IS_UPDATING) !== 0) {
        if (signal.rv < read_version) {
          signal.rv = read_version;
          if (new_deps === null && deps !== null && deps[skipped_deps] === signal) {
            skipped_deps++;
          } else if (new_deps === null) {
            new_deps = [signal];
          } else if (!new_deps.includes(signal)) {
            new_deps.push(signal);
          }
        }
      } else {
        (active_reaction.deps ??= []).push(signal);
        var reactions = signal.reactions;
        if (reactions === null) {
          signal.reactions = [active_reaction];
        } else if (!reactions.includes(active_reaction)) {
          reactions.push(active_reaction);
        }
      }
    }
  }
  if (dev_fallback_default) {
    recent_async_deriveds.delete(signal);
    if (tracing_mode_flag && !untracking && tracing_expressions !== null && active_reaction !== null && tracing_expressions.reaction === active_reaction) {
      if (signal.trace) {
        signal.trace();
      } else {
        var trace2 = get_error("traced at");
        if (trace2) {
          var entry = tracing_expressions.entries.get(signal);
          if (entry === void 0) {
            entry = { traces: [] };
            tracing_expressions.entries.set(signal, entry);
          }
          var last = entry.traces[entry.traces.length - 1];
          if (trace2.stack !== last?.stack) {
            entry.traces.push(trace2);
          }
        }
      }
    }
  }
  if (is_destroying_effect) {
    if (old_values.has(signal)) {
      return old_values.get(signal);
    }
    if (is_derived) {
      var derived3 = (
        /** @type {Derived} */
        signal
      );
      var value = derived3.v;
      if ((derived3.f & CLEAN) === 0 && derived3.reactions !== null || depends_on_old_values(derived3)) {
        value = execute_derived(derived3);
      }
      old_values.set(derived3, value);
      return value;
    }
  } else if (is_derived && (!batch_values?.has(signal) || current_batch?.is_fork && !effect_tracking())) {
    derived3 = /** @type {Derived} */
    signal;
    if (is_dirty(derived3)) {
      update_derived(derived3);
    }
    if (is_updating_effect && effect_tracking() && (derived3.f & CONNECTED) === 0) {
      reconnect(derived3);
    }
  }
  if (batch_values?.has(signal)) {
    return batch_values.get(signal);
  }
  if ((signal.f & ERROR_VALUE) !== 0) {
    throw signal.v;
  }
  return signal.v;
}
__name(get, "get");
function reconnect(derived3) {
  if (derived3.deps === null) return;
  derived3.f ^= CONNECTED;
  for (const dep of derived3.deps) {
    (dep.reactions ??= []).push(derived3);
    if ((dep.f & DERIVED) !== 0 && (dep.f & CONNECTED) === 0) {
      reconnect(
        /** @type {Derived} */
        dep
      );
    }
  }
}
__name(reconnect, "reconnect");
function depends_on_old_values(derived3) {
  if (derived3.v === UNINITIALIZED) return true;
  if (derived3.deps === null) return false;
  for (const dep of derived3.deps) {
    if (old_values.has(dep)) {
      return true;
    }
    if ((dep.f & DERIVED) !== 0 && depends_on_old_values(
      /** @type {Derived} */
      dep
    )) {
      return true;
    }
  }
  return false;
}
__name(depends_on_old_values, "depends_on_old_values");
function untrack(fn) {
  var previous_untracking = untracking;
  try {
    untracking = true;
    return fn();
  } finally {
    untracking = previous_untracking;
  }
}
__name(untrack, "untrack");
var STATUS_MASK = ~(DIRTY | MAYBE_DIRTY | CLEAN);
function set_signal_status(signal, status) {
  signal.f = signal.f & STATUS_MASK | status;
}
__name(set_signal_status, "set_signal_status");

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/utils.js
var DOM_BOOLEAN_ATTRIBUTES = [
  "allowfullscreen",
  "async",
  "autofocus",
  "autoplay",
  "checked",
  "controls",
  "default",
  "disabled",
  "formnovalidate",
  "indeterminate",
  "inert",
  "ismap",
  "loop",
  "multiple",
  "muted",
  "nomodule",
  "novalidate",
  "open",
  "playsinline",
  "readonly",
  "required",
  "reversed",
  "seamless",
  "selected",
  "webkitdirectory",
  "defer",
  "disablepictureinpicture",
  "disableremoteplayback"
];
var DOM_PROPERTIES = [
  ...DOM_BOOLEAN_ATTRIBUTES,
  "formNoValidate",
  "isMap",
  "noModule",
  "playsInline",
  "readOnly",
  "value",
  "volume",
  "defaultValue",
  "defaultChecked",
  "srcObject",
  "noValidate",
  "allowFullscreen",
  "disablePictureInPicture",
  "disableRemotePlayback"
];
var PASSIVE_EVENTS = ["touchstart", "touchmove"];
function is_passive_event(name) {
  return PASSIVE_EVENTS.includes(name);
}
__name(is_passive_event, "is_passive_event");
var STATE_CREATION_RUNES = (
  /** @type {const} */
  [
    "$state",
    "$state.raw",
    "$derived",
    "$derived.by"
  ]
);
var RUNES = (
  /** @type {const} */
  [
    ...STATE_CREATION_RUNES,
    "$state.eager",
    "$state.snapshot",
    "$props",
    "$props.id",
    "$bindable",
    "$effect",
    "$effect.pre",
    "$effect.tracking",
    "$effect.root",
    "$effect.pending",
    "$inspect",
    "$inspect().with",
    "$inspect.trace",
    "$host"
  ]
);

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/elements/events.js
var all_registered_events = /* @__PURE__ */ new Set();
var root_event_handles = /* @__PURE__ */ new Set();
var last_propagated_event = null;
function handle_event_propagation(event2) {
  var handler_element = this;
  var owner_document = (
    /** @type {Node} */
    handler_element.ownerDocument
  );
  var event_name = event2.type;
  var path = event2.composedPath?.() || [];
  var current_target = (
    /** @type {null | Element} */
    path[0] || event2.target
  );
  last_propagated_event = event2;
  var path_idx = 0;
  var handled_at = last_propagated_event === event2 && event2.__root;
  if (handled_at) {
    var at_idx = path.indexOf(handled_at);
    if (at_idx !== -1 && (handler_element === document || handler_element === /** @type {any} */
    window)) {
      event2.__root = handler_element;
      return;
    }
    var handler_idx = path.indexOf(handler_element);
    if (handler_idx === -1) {
      return;
    }
    if (at_idx <= handler_idx) {
      path_idx = at_idx;
    }
  }
  current_target = /** @type {Element} */
  path[path_idx] || event2.target;
  if (current_target === handler_element) return;
  define_property(event2, "currentTarget", {
    configurable: true,
    get() {
      return current_target || owner_document;
    }
  });
  var previous_reaction = active_reaction;
  var previous_effect = active_effect;
  set_active_reaction(null);
  set_active_effect(null);
  try {
    var throw_error;
    var other_errors = [];
    while (current_target !== null) {
      var parent_element = current_target.assignedSlot || current_target.parentNode || /** @type {any} */
      current_target.host || null;
      try {
        var delegated = current_target["__" + event_name];
        if (delegated != null && (!/** @type {any} */
        current_target.disabled || // DOM could've been updated already by the time this is reached, so we check this as well
        // -> the target could not have been disabled because it emits the event in the first place
        event2.target === current_target)) {
          delegated.call(current_target, event2);
        }
      } catch (error) {
        if (throw_error) {
          other_errors.push(error);
        } else {
          throw_error = error;
        }
      }
      if (event2.cancelBubble || parent_element === handler_element || parent_element === null) {
        break;
      }
      current_target = parent_element;
    }
    if (throw_error) {
      for (let error of other_errors) {
        queueMicrotask(() => {
          throw error;
        });
      }
      throw throw_error;
    }
  } finally {
    event2.__root = handler_element;
    delete event2.currentTarget;
    set_active_reaction(previous_reaction);
    set_active_effect(previous_effect);
  }
}
__name(handle_event_propagation, "handle_event_propagation");

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/template.js
function assign_nodes(start, end) {
  var effect2 = (
    /** @type {Effect} */
    active_effect
  );
  if (effect2.nodes === null) {
    effect2.nodes = { start, end, a: null, t: null };
  }
}
__name(assign_nodes, "assign_nodes");
function append(anchor, dom) {
  if (hydrating) {
    var effect2 = (
      /** @type {Effect & { nodes: EffectNodes }} */
      active_effect
    );
    if ((effect2.f & EFFECT_RAN) === 0 || effect2.nodes.end === null) {
      effect2.nodes.end = hydrate_node;
    }
    hydrate_next();
    return;
  }
  if (anchor === null) {
    return;
  }
  anchor.before(
    /** @type {Node} */
    dom
  );
}
__name(append, "append");

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/render.js
var should_intro = true;
function mount(component2, options) {
  return _mount(component2, options);
}
__name(mount, "mount");
function hydrate(component2, options) {
  init_operations();
  options.intro = options.intro ?? false;
  const target = options.target;
  const was_hydrating = hydrating;
  const previous_hydrate_node = hydrate_node;
  try {
    var anchor = get_first_child(target);
    while (anchor && (anchor.nodeType !== COMMENT_NODE || /** @type {Comment} */
    anchor.data !== HYDRATION_START)) {
      anchor = get_next_sibling(anchor);
    }
    if (!anchor) {
      throw HYDRATION_ERROR;
    }
    set_hydrating(true);
    set_hydrate_node(
      /** @type {Comment} */
      anchor
    );
    const instance = _mount(component2, { ...options, anchor });
    set_hydrating(false);
    return (
      /**  @type {Exports} */
      instance
    );
  } catch (error) {
    if (error instanceof Error && error.message.split("\n").some((line) => line.startsWith("https://svelte.dev/e/"))) {
      throw error;
    }
    if (error !== HYDRATION_ERROR) {
      console.warn("Failed to hydrate: ", error);
    }
    if (options.recover === false) {
      hydration_failed();
    }
    init_operations();
    clear_text_content(target);
    set_hydrating(false);
    return mount(component2, options);
  } finally {
    set_hydrating(was_hydrating);
    set_hydrate_node(previous_hydrate_node);
  }
}
__name(hydrate, "hydrate");
var document_listeners = /* @__PURE__ */ new Map();
function _mount(Component, { target, anchor, props = {}, events, context, intro = true }) {
  init_operations();
  var registered_events = /* @__PURE__ */ new Set();
  var event_handle = /* @__PURE__ */ __name((events2) => {
    for (var i = 0; i < events2.length; i++) {
      var event_name = events2[i];
      if (registered_events.has(event_name)) continue;
      registered_events.add(event_name);
      var passive2 = is_passive_event(event_name);
      target.addEventListener(event_name, handle_event_propagation, { passive: passive2 });
      var n = document_listeners.get(event_name);
      if (n === void 0) {
        document.addEventListener(event_name, handle_event_propagation, { passive: passive2 });
        document_listeners.set(event_name, 1);
      } else {
        document_listeners.set(event_name, n + 1);
      }
    }
  }, "event_handle");
  event_handle(array_from(all_registered_events));
  root_event_handles.add(event_handle);
  var component2 = void 0;
  var unmount2 = component_root(() => {
    var anchor_node = anchor ?? target.appendChild(create_text());
    boundary(
      /** @type {TemplateNode} */
      anchor_node,
      {
        pending: /* @__PURE__ */ __name(() => {
        }, "pending")
      },
      (anchor_node2) => {
        if (context) {
          push({});
          var ctx = (
            /** @type {ComponentContext} */
            component_context
          );
          ctx.c = context;
        }
        if (events) {
          props.$$events = events;
        }
        if (hydrating) {
          assign_nodes(
            /** @type {TemplateNode} */
            anchor_node2,
            null
          );
        }
        should_intro = intro;
        component2 = Component(anchor_node2, props) || {};
        should_intro = true;
        if (hydrating) {
          active_effect.nodes.end = hydrate_node;
          if (hydrate_node === null || hydrate_node.nodeType !== COMMENT_NODE || /** @type {Comment} */
          hydrate_node.data !== HYDRATION_END) {
            hydration_mismatch();
            throw HYDRATION_ERROR;
          }
        }
        if (context) {
          pop();
        }
      }
    );
    return () => {
      for (var event_name of registered_events) {
        target.removeEventListener(event_name, handle_event_propagation);
        var n = (
          /** @type {number} */
          document_listeners.get(event_name)
        );
        if (--n === 0) {
          document.removeEventListener(event_name, handle_event_propagation);
          document_listeners.delete(event_name);
        } else {
          document_listeners.set(event_name, n);
        }
      }
      root_event_handles.delete(event_handle);
      if (anchor_node !== anchor) {
        anchor_node.parentNode?.removeChild(anchor_node);
      }
    };
  });
  mounted_components.set(component2, unmount2);
  return component2;
}
__name(_mount, "_mount");
var mounted_components = /* @__PURE__ */ new WeakMap();
function unmount(component2, options) {
  const fn = mounted_components.get(component2);
  if (fn) {
    mounted_components.delete(component2);
    return fn(options);
  }
  if (dev_fallback_default) {
    if (STATE_SYMBOL in component2) {
      state_proxy_unmount();
    } else {
      lifecycle_double_unmount();
    }
  }
  return Promise.resolve();
}
__name(unmount, "unmount");

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/shared/attributes.js
var whitespace = [..." 	\n\r\f\xA0\v\uFEFF"];

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/elements/attributes.js
var CLASS = Symbol("class");
var STYLE = Symbol("style");
var IS_CUSTOM_ELEMENT = Symbol("is custom element");
var IS_HTML = Symbol("is html");

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/reactivity/store.js
var IS_UNMOUNTED = Symbol();

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/legacy/legacy-client.js
function createClassComponent(options) {
  return new Svelte4Component(options);
}
__name(createClassComponent, "createClassComponent");
var Svelte4Component = class {
  static {
    __name(this, "Svelte4Component");
  }
  /** @type {any} */
  #events;
  /** @type {Record<string, any>} */
  #instance;
  /**
   * @param {ComponentConstructorOptions & {
   *  component: any;
   * }} options
   */
  constructor(options) {
    var sources = /* @__PURE__ */ new Map();
    var add_source = /* @__PURE__ */ __name((key2, value) => {
      var s = mutable_source(value, false, false);
      sources.set(key2, s);
      return s;
    }, "add_source");
    const props = new Proxy(
      { ...options.props || {}, $$events: {} },
      {
        get(target, prop2) {
          return get(sources.get(prop2) ?? add_source(prop2, Reflect.get(target, prop2)));
        },
        has(target, prop2) {
          if (prop2 === LEGACY_PROPS) return true;
          get(sources.get(prop2) ?? add_source(prop2, Reflect.get(target, prop2)));
          return Reflect.has(target, prop2);
        },
        set(target, prop2, value) {
          set(sources.get(prop2) ?? add_source(prop2, value), value);
          return Reflect.set(target, prop2, value);
        }
      }
    );
    this.#instance = (options.hydrate ? hydrate : mount)(options.component, {
      target: options.target,
      anchor: options.anchor,
      props,
      context: options.context,
      intro: options.intro ?? false,
      recover: options.recover
    });
    if (!async_mode_flag && (!options?.props?.$$host || options.sync === false)) {
      flushSync();
    }
    this.#events = props.$$events;
    for (const key2 of Object.keys(this.#instance)) {
      if (key2 === "$set" || key2 === "$destroy" || key2 === "$on") continue;
      define_property(this, key2, {
        get() {
          return this.#instance[key2];
        },
        /** @param {any} value */
        set(value) {
          this.#instance[key2] = value;
        },
        enumerable: true
      });
    }
    this.#instance.$set = /** @param {Record<string, any>} next */
    (next2) => {
      Object.assign(props, next2);
    };
    this.#instance.$destroy = () => {
      unmount(this.#instance);
    };
  }
  /** @param {Record<string, any>} props */
  $set(props) {
    this.#instance.$set(props);
  }
  /**
   * @param {string} event
   * @param {(...args: any[]) => any} callback
   * @returns {any}
   */
  $on(event2, callback) {
    this.#events[event2] = this.#events[event2] || [];
    const cb = /* @__PURE__ */ __name((...args) => callback.call(this, ...args), "cb");
    this.#events[event2].push(cb);
    return () => {
      this.#events[event2] = this.#events[event2].filter(
        /** @param {any} fn */
        (fn) => fn !== cb
      );
    };
  }
  $destroy() {
    this.#instance.$destroy();
  }
};

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/elements/custom-element.js
var SvelteElement;
if (typeof HTMLElement === "function") {
  SvelteElement = class extends HTMLElement {
    static {
      __name(this, "SvelteElement");
    }
    /** The Svelte component constructor */
    $$ctor;
    /** Slots */
    $$s;
    /** @type {any} The Svelte component instance */
    $$c;
    /** Whether or not the custom element is connected */
    $$cn = false;
    /** @type {Record<string, any>} Component props data */
    $$d = {};
    /** `true` if currently in the process of reflecting component props back to attributes */
    $$r = false;
    /** @type {Record<string, CustomElementPropDefinition>} Props definition (name, reflected, type etc) */
    $$p_d = {};
    /** @type {Record<string, EventListenerOrEventListenerObject[]>} Event listeners */
    $$l = {};
    /** @type {Map<EventListenerOrEventListenerObject, Function>} Event listener unsubscribe functions */
    $$l_u = /* @__PURE__ */ new Map();
    /** @type {any} The managed render effect for reflecting attributes */
    $$me;
    /**
     * @param {*} $$componentCtor
     * @param {*} $$slots
     * @param {*} use_shadow_dom
     */
    constructor($$componentCtor, $$slots, use_shadow_dom) {
      super();
      this.$$ctor = $$componentCtor;
      this.$$s = $$slots;
      if (use_shadow_dom) {
        this.attachShadow({ mode: "open" });
      }
    }
    /**
     * @param {string} type
     * @param {EventListenerOrEventListenerObject} listener
     * @param {boolean | AddEventListenerOptions} [options]
     */
    addEventListener(type, listener, options) {
      this.$$l[type] = this.$$l[type] || [];
      this.$$l[type].push(listener);
      if (this.$$c) {
        const unsub = this.$$c.$on(type, listener);
        this.$$l_u.set(listener, unsub);
      }
      super.addEventListener(type, listener, options);
    }
    /**
     * @param {string} type
     * @param {EventListenerOrEventListenerObject} listener
     * @param {boolean | AddEventListenerOptions} [options]
     */
    removeEventListener(type, listener, options) {
      super.removeEventListener(type, listener, options);
      if (this.$$c) {
        const unsub = this.$$l_u.get(listener);
        if (unsub) {
          unsub();
          this.$$l_u.delete(listener);
        }
      }
    }
    async connectedCallback() {
      this.$$cn = true;
      if (!this.$$c) {
        let create_slot = function(name) {
          return (anchor) => {
            const slot2 = document.createElement("slot");
            if (name !== "default") slot2.name = name;
            append(anchor, slot2);
          };
        };
        __name(create_slot, "create_slot");
        await Promise.resolve();
        if (!this.$$cn || this.$$c) {
          return;
        }
        const $$slots = {};
        const existing_slots = get_custom_elements_slots(this);
        for (const name of this.$$s) {
          if (name in existing_slots) {
            if (name === "default" && !this.$$d.children) {
              this.$$d.children = create_slot(name);
              $$slots.default = true;
            } else {
              $$slots[name] = create_slot(name);
            }
          }
        }
        for (const attribute of this.attributes) {
          const name = this.$$g_p(attribute.name);
          if (!(name in this.$$d)) {
            this.$$d[name] = get_custom_element_value(name, attribute.value, this.$$p_d, "toProp");
          }
        }
        for (const key2 in this.$$p_d) {
          if (!(key2 in this.$$d) && this[key2] !== void 0) {
            this.$$d[key2] = this[key2];
            delete this[key2];
          }
        }
        this.$$c = createClassComponent({
          component: this.$$ctor,
          target: this.shadowRoot || this,
          props: {
            ...this.$$d,
            $$slots,
            $$host: this
          }
        });
        this.$$me = effect_root(() => {
          render_effect(() => {
            this.$$r = true;
            for (const key2 of object_keys(this.$$c)) {
              if (!this.$$p_d[key2]?.reflect) continue;
              this.$$d[key2] = this.$$c[key2];
              const attribute_value = get_custom_element_value(
                key2,
                this.$$d[key2],
                this.$$p_d,
                "toAttribute"
              );
              if (attribute_value == null) {
                this.removeAttribute(this.$$p_d[key2].attribute || key2);
              } else {
                this.setAttribute(this.$$p_d[key2].attribute || key2, attribute_value);
              }
            }
            this.$$r = false;
          });
        });
        for (const type in this.$$l) {
          for (const listener of this.$$l[type]) {
            const unsub = this.$$c.$on(type, listener);
            this.$$l_u.set(listener, unsub);
          }
        }
        this.$$l = {};
      }
    }
    // We don't need this when working within Svelte code, but for compatibility of people using this outside of Svelte
    // and setting attributes through setAttribute etc, this is helpful
    /**
     * @param {string} attr
     * @param {string} _oldValue
     * @param {string} newValue
     */
    attributeChangedCallback(attr2, _oldValue, newValue) {
      if (this.$$r) return;
      attr2 = this.$$g_p(attr2);
      this.$$d[attr2] = get_custom_element_value(attr2, newValue, this.$$p_d, "toProp");
      this.$$c?.$set({ [attr2]: this.$$d[attr2] });
    }
    disconnectedCallback() {
      this.$$cn = false;
      Promise.resolve().then(() => {
        if (!this.$$cn && this.$$c) {
          this.$$c.$destroy();
          this.$$me();
          this.$$c = void 0;
        }
      });
    }
    /**
     * @param {string} attribute_name
     */
    $$g_p(attribute_name) {
      return object_keys(this.$$p_d).find(
        (key2) => this.$$p_d[key2].attribute === attribute_name || !this.$$p_d[key2].attribute && key2.toLowerCase() === attribute_name
      ) || attribute_name;
    }
  };
}
function get_custom_element_value(prop2, value, props_definition, transform) {
  const type = props_definition[prop2]?.type;
  value = type === "Boolean" && typeof value !== "boolean" ? value != null : value;
  if (!transform || !props_definition[prop2]) {
    return value;
  } else if (transform === "toAttribute") {
    switch (type) {
      case "Object":
      case "Array":
        return value == null ? null : JSON.stringify(value);
      case "Boolean":
        return value ? "" : null;
      case "Number":
        return value == null ? null : value;
      default:
        return value;
    }
  } else {
    switch (type) {
      case "Object":
      case "Array":
        return value && JSON.parse(value);
      case "Boolean":
        return value;
      // conversion already handled above
      case "Number":
        return value != null ? +value : value;
      default:
        return value;
    }
  }
}
__name(get_custom_element_value, "get_custom_element_value");
function get_custom_elements_slots(element2) {
  const result = {};
  element2.childNodes.forEach((node) => {
    result[
      /** @type {Element} node */
      node.slot || "default"
    ] = true;
  });
  return result;
}
__name(get_custom_elements_slots, "get_custom_elements_slots");

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/index-client.js
if (dev_fallback_default) {
  let throw_rune_error = function(rune) {
    if (!(rune in globalThis)) {
      let value;
      Object.defineProperty(globalThis, rune, {
        configurable: true,
        // eslint-disable-next-line getter-return
        get: /* @__PURE__ */ __name(() => {
          if (value !== void 0) {
            return value;
          }
          rune_outside_svelte(rune);
        }, "get"),
        set: /* @__PURE__ */ __name((v) => {
          value = v;
        }, "set")
      });
    }
  };
  __name(throw_rune_error, "throw_rune_error");
  throw_rune_error("$state");
  throw_rune_error("$effect");
  throw_rune_error("$derived");
  throw_rune_error("$inspect");
  throw_rune_error("$props");
  throw_rune_error("$bindable");
}

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/store/utils.js
function subscribe_to_store(store, run3, invalidate) {
  if (store == null) {
    run3(void 0);
    if (invalidate) invalidate(void 0);
    return noop;
  }
  const unsub = untrack(
    () => store.subscribe(
      run3,
      // @ts-expect-error
      invalidate
    )
  );
  return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
}
__name(subscribe_to_store, "subscribe_to_store");

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/store/shared/index.js
var subscriber_queue = [];
function readable(value, start) {
  return {
    subscribe: writable(value, start).subscribe
  };
}
__name(readable, "readable");
function writable(value, start = noop) {
  let stop = null;
  const subscribers = /* @__PURE__ */ new Set();
  function set2(new_value) {
    if (safe_not_equal(value, new_value)) {
      value = new_value;
      if (stop) {
        const run_queue = !subscriber_queue.length;
        for (const subscriber of subscribers) {
          subscriber[1]();
          subscriber_queue.push(subscriber, value);
        }
        if (run_queue) {
          for (let i = 0; i < subscriber_queue.length; i += 2) {
            subscriber_queue[i][0](subscriber_queue[i + 1]);
          }
          subscriber_queue.length = 0;
        }
      }
    }
  }
  __name(set2, "set");
  function update2(fn) {
    set2(fn(
      /** @type {T} */
      value
    ));
  }
  __name(update2, "update");
  function subscribe(run3, invalidate = noop) {
    const subscriber = [run3, invalidate];
    subscribers.add(subscriber);
    if (subscribers.size === 1) {
      stop = start(set2, update2) || noop;
    }
    run3(
      /** @type {T} */
      value
    );
    return () => {
      subscribers.delete(subscriber);
      if (subscribers.size === 0 && stop) {
        stop();
        stop = null;
      }
    };
  }
  __name(subscribe, "subscribe");
  return { set: set2, update: update2, subscribe };
}
__name(writable, "writable");
function derived2(stores, fn, initial_value) {
  const single = !Array.isArray(stores);
  const stores_array = single ? [stores] : stores;
  if (!stores_array.every(Boolean)) {
    throw new Error("derived() expects stores as input, got a falsy value");
  }
  const auto = fn.length < 2;
  return readable(initial_value, (set2, update2) => {
    let started = false;
    const values = [];
    let pending2 = 0;
    let cleanup = noop;
    const sync = /* @__PURE__ */ __name(() => {
      if (pending2) {
        return;
      }
      cleanup();
      const result = fn(single ? values[0] : values, set2, update2);
      if (auto) {
        set2(result);
      } else {
        cleanup = typeof result === "function" ? result : noop;
      }
    }, "sync");
    const unsubscribers = stores_array.map(
      (store, i) => subscribe_to_store(
        store,
        (value) => {
          values[i] = value;
          pending2 &= ~(1 << i);
          if (started) {
            sync();
          }
        },
        () => {
          pending2 |= 1 << i;
        }
      )
    );
    started = true;
    sync();
    return /* @__PURE__ */ __name(function stop() {
      run_all(unsubscribers);
      cleanup();
      started = false;
    }, "stop");
  });
}
__name(derived2, "derived");

// ../../src/stores/auth.ts
init_encryption();
var isAuthenticated = writable(false);
var user = writable(null);
var token = writable(null);
var csrfToken = writable(null);
var encryptionEnabled = writable(true);
var authCheckComplete = writable(false);
var isTokenExpired = derived2(
  user,
  ($user) => {
    if (!$user) return true;
    return new Date($user.expiresAt) < /* @__PURE__ */ new Date();
  }
);
var authRequired = derived2(
  [encryptionEnabled, isAuthenticated, authCheckComplete],
  ([$encryptionEnabled, $isAuthenticated, $authCheckComplete]) => {
    if (!$authCheckComplete) {
      return true;
    }
    return $encryptionEnabled && !$isAuthenticated;
  }
);

// ../../src/core/api/request/index.ts
init_deduplicator();
init_queue();
init_cancellation();
init_priority();

// ../../src/core/api/resilience/index.ts
init_retry();
init_circuit_breaker();
init_offline();

// ../../src/core/api/cache/index.ts
init_memory();
init_indexeddb();
init_strategies();

// ../../src/core/api/optimistic/index.ts
init_updates();

// ../../src/core/api/index.ts
init_plugins();
init_request_builder();
init_response_handler();
init_middleware();
init_auth();
init_error();
init_transform();

// ../shared/api/index.ts
init_enhanced();

// ../shared/encryption/index.ts
init_jwt_encryption();

// ../shared/encryption/multi-stage-encryption.ts
init_jwt_encryption();

// ../shared/encryption/middleware.ts
init_jwt_encryption();
async function wrapWithEncryption(handlerResponse, auth) {
  if (!handlerResponse.ok) {
    return {
      response: handlerResponse,
      customerId: auth?.customerId || null
    };
  }
  if (!auth?.jwtToken) {
    const headers = new Headers(handlerResponse.headers);
    headers.set("X-Encrypted", "false");
    return {
      response: new Response(handlerResponse.body, {
        status: handlerResponse.status,
        statusText: handlerResponse.statusText,
        headers
      }),
      customerId: null
    };
  }
  try {
    const contentType = handlerResponse.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      const headers2 = new Headers(handlerResponse.headers);
      headers2.set("X-Encrypted", "false");
      return {
        response: new Response(handlerResponse.body, {
          status: handlerResponse.status,
          statusText: handlerResponse.statusText,
          headers: headers2
        }),
        customerId: auth.customerId || null
      };
    }
    const responseData = await handlerResponse.json();
    const encrypted = await encryptWithJWT(responseData, auth.jwtToken);
    const headers = new Headers(handlerResponse.headers);
    headers.set("Content-Type", "application/json");
    headers.set("X-Encrypted", "true");
    return {
      response: new Response(JSON.stringify(encrypted), {
        status: handlerResponse.status,
        statusText: handlerResponse.statusText,
        headers
      }),
      customerId: auth.customerId || null
    };
  } catch (error) {
    console.error("Failed to encrypt response:", error);
    return {
      response: handlerResponse,
      customerId: auth.customerId || null
    };
  }
}
__name(wrapWithEncryption, "wrapWithEncryption");

// ../shared/encryption/route-encryption.ts
init_jwt_encryption();

// handlers/mods/upload.ts
init_errors2();
init_customer();

// utils/auth.ts
function getJWTSecret(env) {
  if (!env.JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is required. Please set it via: wrangler secret put JWT_SECRET");
  }
  return env.JWT_SECRET;
}
__name(getJWTSecret, "getJWTSecret");
async function verifyJWT(token2, secret) {
  try {
    const parts = token2.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;
    const encoder = new TextEncoder();
    const signatureInput = `${headerB64}.${payloadB64}`;
    const keyData = encoder.encode(secret);
    const key2 = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const signature = Uint8Array.from(atob(signatureB64.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
    const isValid = await crypto.subtle.verify("HMAC", key2, signature, encoder.encode(signatureInput));
    if (!isValid) return null;
    const payloadJson = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(payloadJson);
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1e3)) {
      return null;
    }
    return payload;
  } catch (error) {
    console.error("JWT verification error:", error);
    return null;
  }
}
__name(verifyJWT, "verifyJWT");
function isEmailAllowed(email, env) {
  if (!email) return false;
  if (!env.ALLOWED_EMAILS) {
    return true;
  }
  const allowedEmails = env.ALLOWED_EMAILS.split(",").map((e) => e.trim().toLowerCase());
  return allowedEmails.includes(email.toLowerCase());
}
__name(isEmailAllowed, "isEmailAllowed");
async function fetchEmailFromAuthService(token2, env) {
  try {
    const authApiUrl = env.AUTH_API_URL || "https://auth.idling.app";
    const response = await fetch(`${authApiUrl}/auth/me`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token2}`,
        "Content-Type": "application/json"
      }
    });
    if (response.ok) {
      const data = await response.json();
      return data.email;
    }
  } catch (error) {
    console.warn("[Auth] Failed to fetch email from auth service:", error);
  }
  return void 0;
}
__name(fetchEmailFromAuthService, "fetchEmailFromAuthService");
async function authenticateRequest(request, env) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }
    const token2 = authHeader.substring(7);
    const jwtSecret = getJWTSecret(env);
    const payload = await verifyJWT(token2, jwtSecret);
    if (!payload || !payload.sub) {
      return null;
    }
    let email = payload.email;
    if (!email) {
      console.warn("[Auth] Email missing from JWT payload, fetching from auth service...");
      email = await fetchEmailFromAuthService(token2, env);
      if (email) {
        console.log("[Auth] Successfully fetched email from auth service");
      } else {
        console.warn("[Auth] Could not fetch email from auth service - admin checks may fail");
      }
    }
    return {
      userId: payload.sub,
      email,
      customerId: payload.customerId || null,
      jwtToken: token2
      // Include JWT token for encryption
    };
  } catch (error) {
    console.error("Authentication error:", error);
    return null;
  }
}
__name(authenticateRequest, "authenticateRequest");

// handlers/mods/upload.ts
init_admin();
init_hash();
function generateSlug(title) {
  return title.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
}
__name(generateSlug, "generateSlug");
async function slugExists(slug, env, excludeModId) {
  const globalListKey = "mods_list_public";
  const globalModsList = await env.MODS_KV.get(globalListKey, { type: "json" });
  if (globalModsList) {
    for (const modId2 of globalModsList) {
      if (excludeModId && modId2 === excludeModId) continue;
      const globalModKey = `mod_${modId2}`;
      const mod = await env.MODS_KV.get(globalModKey, { type: "json" });
      if (mod && mod.slug === slug) {
        return true;
      }
    }
  }
  return false;
}
__name(slugExists, "slugExists");
async function generateUniqueSlug(title, env, excludeModId) {
  let baseSlug = generateSlug(title);
  if (!baseSlug) {
    baseSlug = "untitled-mod";
  }
  let slug = baseSlug;
  let counter = 1;
  while (await slugExists(slug, env, excludeModId)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
  return slug;
}
__name(generateUniqueSlug, "generateUniqueSlug");
function generateModId() {
  return `mod_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}
__name(generateModId, "generateModId");
function generateVersionId() {
  return `ver_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}
__name(generateVersionId, "generateVersionId");
async function handleUploadMod(request, env, auth) {
  try {
    const hasPermission = await hasUploadPermission(auth.userId, auth.email, env);
    if (!hasPermission) {
      const rfcError = createError2(request, 403, "Upload Permission Required", "You do not have permission to upload mods. Please request approval from an administrator.");
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 403,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    const formData = await request.formData();
    let file = formData.get("file");
    if (!file) {
      const rfcError = createError2(request, 400, "File Required", "File is required for mod upload");
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 400,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    const isEncrypted = file.name.endsWith(".encrypted") || file.type === "application/json";
    let originalFileName = file.name;
    if (!isEncrypted) {
      const rfcError = createError2(request, 400, "File Must Be Encrypted", "Files must be encrypted before upload for security. Please ensure the file is encrypted.");
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 400,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    if (originalFileName.endsWith(".encrypted")) {
      originalFileName = originalFileName.slice(0, -10);
    }
    let encryptedData;
    let encryptedJson;
    try {
      encryptedData = await file.text();
      encryptedJson = JSON.parse(encryptedData);
      if (!encryptedJson || typeof encryptedJson !== "object" || !encryptedJson.encrypted) {
        throw new Error("Invalid encrypted file format");
      }
    } catch (error) {
      console.error("Encrypted file validation error:", error);
      const rfcError = createError2(request, 400, "Invalid Encrypted File", "The uploaded file does not appear to be properly encrypted. Please ensure the file is encrypted before upload.");
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 400,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    const jwtToken = request.headers.get("Authorization")?.replace("Bearer ", "") || "";
    if (!jwtToken) {
      const rfcError = createError2(request, 401, "Authentication Required", "JWT token required for file processing");
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 401,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    let fileHash;
    let fileSize;
    try {
      const decryptedBase64 = await decryptWithJWT(encryptedJson, jwtToken);
      const binaryString = atob(decryptedBase64);
      const fileBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        fileBytes[i] = binaryString.charCodeAt(i);
      }
      fileSize = fileBytes.length;
      fileHash = await calculateFileHash(fileBytes);
    } catch (error) {
      console.error("File decryption error during upload:", error);
      const rfcError = createError2(request, 400, "Decryption Failed", "Failed to decrypt uploaded file. Please ensure you are authenticated and the file was encrypted with your token.");
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 400,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    const metadataJson = formData.get("metadata");
    if (!metadataJson) {
      const rfcError = createError2(request, 400, "Metadata Required", "Metadata is required for mod upload");
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 400,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    const metadata = JSON.parse(metadataJson);
    if (!metadata.title || !metadata.version || !metadata.category) {
      const rfcError = createError2(request, 400, "Validation Error", "Title, version, and category are required");
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 400,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    const modId2 = generateModId();
    const versionId = generateVersionId();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const slug = await generateUniqueSlug(metadata.title, env);
    const fileExtension = originalFileName.split(".").pop() || "zip";
    const r2Key = getCustomerR2Key(auth.customerId, `mods/${modId2}/${versionId}.${fileExtension}`);
    const encryptedFileBytes = new TextEncoder().encode(encryptedData);
    await env.MODS_R2.put(r2Key, encryptedFileBytes, {
      httpMetadata: {
        contentType: "application/json",
        // Stored as encrypted JSON
        cacheControl: "private, no-cache"
        // Don't cache encrypted files
      },
      customMetadata: {
        modId: modId2,
        versionId,
        uploadedBy: auth.userId,
        uploadedAt: now,
        encrypted: "true",
        // Mark as encrypted
        originalFileName,
        originalContentType: "application/zip",
        // Original file type
        sha256: fileHash
        // Hash of decrypted file for verification
      }
    });
    const downloadUrl = env.MODS_PUBLIC_URL ? `${env.MODS_PUBLIC_URL}/${r2Key}` : `https://pub-${env.MODS_R2.id}.r2.dev/${r2Key}`;
    const version = {
      versionId,
      modId: modId2,
      version: metadata.version,
      changelog: metadata.changelog || "",
      fileSize,
      // Use calculated size from decrypted data
      fileName: originalFileName,
      // Use original filename (without .encrypted)
      r2Key,
      downloadUrl,
      sha256: fileHash,
      // Store hash for verification
      createdAt: now,
      downloads: 0,
      gameVersions: metadata.gameVersions || [],
      dependencies: metadata.dependencies || []
    };
    const mod = {
      modId: modId2,
      slug,
      authorId: auth.userId,
      authorEmail: auth.email || "",
      title: metadata.title,
      description: metadata.description || "",
      category: metadata.category,
      tags: metadata.tags || [],
      thumbnailUrl: metadata.thumbnail ? await handleThumbnailUpload(metadata.thumbnail, modId2, env, auth.customerId) : void 0,
      createdAt: now,
      updatedAt: now,
      latestVersion: metadata.version,
      downloadCount: 0,
      visibility: metadata.visibility || "public",
      featured: false,
      customerId: auth.customerId,
      status: "pending",
      // New mods start as pending review
      statusHistory: [{
        status: "pending",
        changedBy: auth.userId,
        changedByEmail: auth.email,
        changedAt: now
      }],
      reviewComments: []
    };
    const modKey = getCustomerKey(auth.customerId, `mod_${modId2}`);
    const versionKey = getCustomerKey(auth.customerId, `version_${versionId}`);
    const versionsListKey = getCustomerKey(auth.customerId, `mod_${modId2}_versions`);
    const modsListKey = getCustomerKey(auth.customerId, "mods_list");
    await env.MODS_KV.put(modKey, JSON.stringify(mod));
    await env.MODS_KV.put(versionKey, JSON.stringify(version));
    const versionsList = await env.MODS_KV.get(versionsListKey, { type: "json" });
    const updatedVersionsList = [...versionsList || [], versionId];
    await env.MODS_KV.put(versionsListKey, JSON.stringify(updatedVersionsList));
    const modsList = await env.MODS_KV.get(modsListKey, { type: "json" });
    const updatedModsList = [...modsList || [], modId2];
    await env.MODS_KV.put(modsListKey, JSON.stringify(updatedModsList));
    const corsHeaders = createCORSHeaders(request, {
      allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
    });
    return new Response(JSON.stringify({
      mod,
      version
    }), {
      status: 201,
      headers: {
        "Content-Type": "application/json",
        ...Object.fromEntries(corsHeaders.entries())
      }
    });
  } catch (error) {
    console.error("Upload mod error:", error);
    const rfcError = createError2(
      request,
      500,
      "Failed to Upload Mod",
      env.ENVIRONMENT === "development" ? error.message : "An error occurred while uploading the mod"
    );
    const corsHeaders = createCORSHeaders(request, {
      allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
    });
    return new Response(JSON.stringify(rfcError), {
      status: 500,
      headers: {
        "Content-Type": "application/problem+json",
        ...Object.fromEntries(corsHeaders.entries())
      }
    });
  }
}
__name(handleUploadMod, "handleUploadMod");
async function handleThumbnailUpload(base64Data, modId2, env, customerId) {
  try {
    const matches = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      throw new Error("Invalid base64 image data");
    }
    const [, imageType, base64Content] = matches;
    const allowedTypes = ["jpeg", "jpg", "png", "gif", "webp"];
    const normalizedType = imageType.toLowerCase();
    if (!allowedTypes.includes(normalizedType)) {
      throw new Error(`Unsupported image type: ${imageType}. Allowed types: ${allowedTypes.join(", ")}`);
    }
    const imageBuffer = Uint8Array.from(atob(base64Content), (c) => c.charCodeAt(0));
    if (imageBuffer.length < 100) {
      throw new Error("Image file is too small or corrupted");
    }
    const isValidImage = (normalizedType === "jpeg" || normalizedType === "jpg") && imageBuffer[0] === 255 && imageBuffer[1] === 216 && imageBuffer[2] === 255 || normalizedType === "png" && imageBuffer[0] === 137 && imageBuffer[1] === 80 && imageBuffer[2] === 78 && imageBuffer[3] === 71 || normalizedType === "gif" && imageBuffer[0] === 71 && imageBuffer[1] === 73 && imageBuffer[2] === 70 && imageBuffer[3] === 56 || normalizedType === "webp" && imageBuffer[0] === 82 && imageBuffer[1] === 73 && imageBuffer[2] === 70 && imageBuffer[3] === 70;
    if (!isValidImage) {
      throw new Error(`Invalid ${imageType} image format - file may be corrupted or not a valid image`);
    }
    const r2Key = getCustomerR2Key(customerId, `thumbnails/${modId2}.${normalizedType}`);
    await env.MODS_R2.put(r2Key, imageBuffer, {
      httpMetadata: {
        contentType: `image/${normalizedType}`,
        cacheControl: "public, max-age=31536000"
      },
      customMetadata: {
        modId: modId2,
        validated: "true"
        // Mark as validated for rendering
      }
    });
    const API_BASE_URL = "https://mods-api.idling.app";
    return `${API_BASE_URL}/mods/${modId2}/thumbnail`;
  } catch (error) {
    console.error("Thumbnail upload error:", error);
    throw error;
  }
}
__name(handleThumbnailUpload, "handleThumbnailUpload");

// handlers/mods/update.ts
init_enhanced2();
init_errors2();
init_customer();
init_slug();
async function handleUpdateMod(request, env, slug, auth) {
  try {
    if (!isEmailAllowed(auth.email, env)) {
      const rfcError = createError2(request, 403, "Forbidden", "Your email address is not authorized to manage mods");
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 403,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    let mod = await findModBySlug(slug, env, auth);
    let modKey;
    if (!mod) {
      modKey = getCustomerKey(auth.customerId, `mod_${slug}`);
      mod = await env.MODS_KV.get(modKey, { type: "json" });
      if (!mod) {
        const globalModKey = `mod_${slug}`;
        mod = await env.MODS_KV.get(globalModKey, { type: "json" });
        if (mod) {
          modKey = getCustomerKey(auth.customerId, `mod_${slug}`);
        }
      } else {
        modKey = getCustomerKey(auth.customerId, `mod_${slug}`);
      }
    } else {
      const modId3 = mod.modId;
      modKey = getCustomerKey(auth.customerId, `mod_${modId3}`);
    }
    if (!mod) {
      const rfcError = createError2(request, 404, "Mod Not Found", "The requested mod was not found");
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 404,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    if (mod.authorId !== auth.userId) {
      const rfcError = createError2(request, 403, "Forbidden", "You do not have permission to update this mod");
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 403,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    const updateData = await request.json();
    const wasPublic = mod.visibility === "public";
    const visibilityChanged = updateData.visibility !== void 0 && updateData.visibility !== mod.visibility;
    const modId2 = mod.modId;
    if (updateData.title !== void 0) {
      mod.title = updateData.title;
      const newSlug = await generateUniqueSlug(updateData.title, env, modId2);
      mod.slug = newSlug;
    }
    if (updateData.description !== void 0) mod.description = updateData.description;
    if (updateData.category !== void 0) mod.category = updateData.category;
    if (updateData.tags !== void 0) mod.tags = updateData.tags;
    if (updateData.visibility !== void 0) mod.visibility = updateData.visibility;
    mod.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    if (updateData.thumbnail) {
      try {
        mod.thumbnailUrl = await handleThumbnailUpload2(updateData.thumbnail, modId2, env, auth.customerId);
      } catch (error) {
        console.error("Thumbnail update error:", error);
      }
    }
    await env.MODS_KV.put(modKey, JSON.stringify(mod));
    if (mod.visibility === "public") {
      const globalModKey = `mod_${modId2}`;
      await env.MODS_KV.put(globalModKey, JSON.stringify(mod));
    }
    if (visibilityChanged) {
      const globalListKey = "mods_list_public";
      const globalModsList = await env.MODS_KV.get(globalListKey, { type: "json" });
      if (mod.visibility === "public" && !wasPublic) {
        const updatedGlobalList = [...globalModsList || [], modId2];
        await env.MODS_KV.put(globalListKey, JSON.stringify(updatedGlobalList));
      } else if (mod.visibility !== "public" && wasPublic) {
        const updatedGlobalList = (globalModsList || []).filter((id) => id !== modId2);
        await env.MODS_KV.put(globalListKey, JSON.stringify(updatedGlobalList));
        const globalModKey = `mod_${modId2}`;
        await env.MODS_KV.delete(globalModKey);
      }
    } else if (mod.visibility === "public") {
      const globalListKey = "mods_list_public";
      const globalModsList = await env.MODS_KV.get(globalListKey, { type: "json" });
      if (!globalModsList || !globalModsList.includes(modId2)) {
        const updatedGlobalList = [...globalModsList || [], modId2];
        await env.MODS_KV.put(globalListKey, JSON.stringify(updatedGlobalList));
      }
    }
    const corsHeaders = createCORSHeaders(request, {
      allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
    });
    return new Response(JSON.stringify({ mod }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...Object.fromEntries(corsHeaders.entries())
      }
    });
  } catch (error) {
    console.error("Update mod error:", error);
    const rfcError = createError2(
      request,
      500,
      "Failed to Update Mod",
      env.ENVIRONMENT === "development" ? error.message : "An error occurred while updating the mod"
    );
    const corsHeaders = createCORSHeaders(request, {
      allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
    });
    return new Response(JSON.stringify(rfcError), {
      status: 500,
      headers: {
        "Content-Type": "application/problem+json",
        ...Object.fromEntries(corsHeaders.entries())
      }
    });
  }
}
__name(handleUpdateMod, "handleUpdateMod");
async function handleThumbnailUpload2(base64Data, modId2, env, customerId) {
  try {
    const matches = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      throw new Error("Invalid base64 image data");
    }
    const [, imageType, base64Content] = matches;
    const allowedTypes = ["jpeg", "jpg", "png", "gif", "webp"];
    const normalizedType = imageType.toLowerCase();
    if (!allowedTypes.includes(normalizedType)) {
      throw new Error(`Unsupported image type: ${imageType}. Allowed types: ${allowedTypes.join(", ")}`);
    }
    const imageBuffer = Uint8Array.from(atob(base64Content), (c) => c.charCodeAt(0));
    if (imageBuffer.length < 100) {
      throw new Error("Image file is too small or corrupted");
    }
    const isValidImage = (normalizedType === "jpeg" || normalizedType === "jpg") && imageBuffer[0] === 255 && imageBuffer[1] === 216 && imageBuffer[2] === 255 || normalizedType === "png" && imageBuffer[0] === 137 && imageBuffer[1] === 80 && imageBuffer[2] === 78 && imageBuffer[3] === 71 || normalizedType === "gif" && imageBuffer[0] === 71 && imageBuffer[1] === 73 && imageBuffer[2] === 70 && imageBuffer[3] === 56 || normalizedType === "webp" && imageBuffer[0] === 82 && imageBuffer[1] === 73 && imageBuffer[2] === 70 && imageBuffer[3] === 70;
    if (!isValidImage) {
      throw new Error(`Invalid ${imageType} image format - file may be corrupted or not a valid image`);
    }
    const r2Key = getCustomerR2Key(customerId, `thumbnails/${modId2}.${normalizedType}`);
    await env.MODS_R2.put(r2Key, imageBuffer, {
      httpMetadata: {
        contentType: `image/${normalizedType}`,
        cacheControl: "public, max-age=31536000"
      },
      customMetadata: {
        modId: modId2,
        validated: "true"
        // Mark as validated for rendering
      }
    });
    const API_BASE_URL = "https://mods-api.idling.app";
    return `${API_BASE_URL}/mods/${modId2}/thumbnail`;
  } catch (error) {
    console.error("Thumbnail upload error:", error);
    throw error;
  }
}
__name(handleThumbnailUpload2, "handleThumbnailUpload");

// handlers/mods/delete.ts
init_enhanced2();
init_errors2();
init_customer();
init_slug();
async function handleDeleteMod(request, env, slug, auth) {
  try {
    if (!isEmailAllowed(auth.email, env)) {
      const rfcError = createError2(request, 403, "Forbidden", "Your email address is not authorized to manage mods");
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 403,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    let mod = await findModBySlug(slug, env, auth);
    let modKey;
    if (!mod) {
      modKey = getCustomerKey(auth.customerId, `mod_${slug}`);
      mod = await env.MODS_KV.get(modKey, { type: "json" });
      if (!mod) {
        const globalModKey2 = `mod_${slug}`;
        mod = await env.MODS_KV.get(globalModKey2, { type: "json" });
        if (mod) {
          modKey = globalModKey2;
        }
      } else {
        modKey = getCustomerKey(auth.customerId, `mod_${slug}`);
      }
    } else {
      modKey = getCustomerKey(auth.customerId, `mod_${mod.modId}`);
    }
    if (!mod) {
      const rfcError = createError2(request, 404, "Mod Not Found", "The requested mod was not found");
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 404,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    if (mod.authorId !== auth.userId) {
      const rfcError = createError2(request, 403, "Forbidden", "You do not have permission to delete this mod");
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 403,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    const modId2 = mod.modId;
    let versionsListKey = getCustomerKey(auth.customerId, `mod_${modId2}_versions`);
    let versionsList = await env.MODS_KV.get(versionsListKey, { type: "json" });
    if (!versionsList) {
      const globalVersionsKey2 = `mod_${modId2}_versions`;
      versionsList = await env.MODS_KV.get(globalVersionsKey2, { type: "json" });
      if (versionsList) {
        versionsListKey = globalVersionsKey2;
      }
    }
    const versionIds = versionsList || [];
    for (const versionId of versionIds) {
      const versionKey = getCustomerKey(auth.customerId, `version_${versionId}`);
      const version = await env.MODS_KV.get(versionKey, { type: "json" });
      if (version) {
        try {
          await env.MODS_R2.delete(version.r2Key);
        } catch (error) {
          console.error(`Failed to delete R2 file ${version.r2Key}:`, error);
        }
        await env.MODS_KV.delete(versionKey);
      }
    }
    if (mod.thumbnailUrl) {
      try {
        const thumbnailKey = getCustomerR2Key(auth.customerId, `thumbnails/${modId2}.png`);
        await env.MODS_R2.delete(thumbnailKey);
      } catch (error) {
        console.error("Failed to delete thumbnail:", error);
      }
    }
    await env.MODS_KV.delete(modKey);
    await env.MODS_KV.delete(versionsListKey);
    const globalModKey = `mod_${modId2}`;
    const globalVersionsKey = `mod_${modId2}_versions`;
    if (modKey !== globalModKey) {
      await env.MODS_KV.delete(globalModKey);
    }
    if (versionsListKey !== globalVersionsKey) {
      await env.MODS_KV.delete(globalVersionsKey);
    }
    const modsListKey = getCustomerKey(auth.customerId, "mods_list");
    const modsList = await env.MODS_KV.get(modsListKey, { type: "json" });
    if (modsList) {
      const updatedList = modsList.filter((id) => id !== modId2);
      await env.MODS_KV.put(modsListKey, JSON.stringify(updatedList));
    }
    if (mod.visibility === "public") {
      const globalListKey = "mods_list_public";
      const globalModsList = await env.MODS_KV.get(globalListKey, { type: "json" });
      if (globalModsList) {
        const updatedGlobalList = globalModsList.filter((id) => id !== modId2);
        await env.MODS_KV.put(globalListKey, JSON.stringify(updatedGlobalList));
      }
    }
    const corsHeaders = createCORSHeaders(request, {
      allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
    });
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...Object.fromEntries(corsHeaders.entries())
      }
    });
  } catch (error) {
    console.error("Delete mod error:", error);
    const rfcError = createError2(
      request,
      500,
      "Failed to Delete Mod",
      env.ENVIRONMENT === "development" ? error.message : "An error occurred while deleting the mod"
    );
    const corsHeaders = createCORSHeaders(request, {
      allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
    });
    return new Response(JSON.stringify(rfcError), {
      status: 500,
      headers: {
        "Content-Type": "application/problem+json",
        ...Object.fromEntries(corsHeaders.entries())
      }
    });
  }
}
__name(handleDeleteMod, "handleDeleteMod");

// handlers/versions/upload.ts
init_enhanced2();
init_errors2();
init_customer();
init_hash();
function generateVersionId2() {
  return `ver_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}
__name(generateVersionId2, "generateVersionId");
async function handleUploadVersion(request, env, modId2, auth) {
  try {
    if (!isEmailAllowed(auth.email, env)) {
      const rfcError = createError2(request, 403, "Forbidden", "Your email address is not authorized to upload mod versions");
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 403,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    const modKey = getCustomerKey(auth.customerId, `mod_${modId2}`);
    const mod = await env.MODS_KV.get(modKey, { type: "json" });
    if (!mod) {
      const rfcError = createError2(request, 404, "Mod Not Found", "The requested mod was not found");
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 404,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    if (mod.authorId !== auth.userId) {
      const rfcError = createError2(request, 403, "Forbidden", "You do not have permission to upload versions for this mod");
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 403,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    const formData = await request.formData();
    let file = formData.get("file");
    if (!file) {
      const rfcError = createError2(request, 400, "File Required", "File is required for version upload");
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 400,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    const isEncrypted = file.name.endsWith(".encrypted") || file.type === "application/json";
    let originalFileName = file.name;
    if (!isEncrypted) {
      const rfcError = createError2(request, 400, "File Must Be Encrypted", "Files must be encrypted before upload for security. Please ensure the file is encrypted.");
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 400,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    if (originalFileName.endsWith(".encrypted")) {
      originalFileName = originalFileName.slice(0, -10);
    }
    let encryptedData;
    let encryptedJson;
    try {
      encryptedData = await file.text();
      encryptedJson = JSON.parse(encryptedData);
      if (!encryptedJson || typeof encryptedJson !== "object" || !encryptedJson.encrypted) {
        throw new Error("Invalid encrypted file format");
      }
    } catch (error) {
      console.error("Encrypted file validation error:", error);
      const rfcError = createError2(request, 400, "Invalid Encrypted File", "The uploaded file does not appear to be properly encrypted. Please ensure the file is encrypted before upload.");
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 400,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    const jwtToken = request.headers.get("Authorization")?.replace("Bearer ", "") || "";
    if (!jwtToken) {
      const rfcError = createError2(request, 401, "Authentication Required", "JWT token required for file processing");
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 401,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    let fileHash;
    let fileSize;
    try {
      const decryptedBase64 = await decryptWithJWT(encryptedJson, jwtToken);
      const binaryString = atob(decryptedBase64);
      const fileBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        fileBytes[i] = binaryString.charCodeAt(i);
      }
      fileSize = fileBytes.length;
      fileHash = await calculateFileHash(fileBytes);
    } catch (error) {
      console.error("File decryption error during upload:", error);
      const rfcError = createError2(request, 400, "Decryption Failed", "Failed to decrypt uploaded file. Please ensure you are authenticated and the file was encrypted with your token.");
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 400,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    const metadataJson = formData.get("metadata");
    if (!metadataJson) {
      const rfcError = createError2(request, 400, "Metadata Required", "Metadata is required for version upload");
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 400,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    const metadata = JSON.parse(metadataJson);
    if (!metadata.version) {
      const rfcError = createError2(request, 400, "Validation Error", "Version is required");
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 400,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    const versionId = generateVersionId2();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const fileExtension = originalFileName.split(".").pop() || "zip";
    const r2Key = getCustomerR2Key(auth.customerId, `mods/${modId2}/${versionId}.${fileExtension}`);
    const encryptedFileBytes = new TextEncoder().encode(encryptedData);
    await env.MODS_R2.put(r2Key, encryptedFileBytes, {
      httpMetadata: {
        contentType: "application/json",
        // Stored as encrypted JSON
        cacheControl: "private, no-cache"
        // Don't cache encrypted files
      },
      customMetadata: {
        modId: modId2,
        versionId,
        uploadedBy: auth.userId,
        uploadedAt: now,
        encrypted: "true",
        // Mark as encrypted
        originalFileName,
        originalContentType: "application/zip",
        // Original file type
        sha256: fileHash
        // Hash of decrypted file for verification
      }
    });
    const downloadUrl = env.MODS_PUBLIC_URL ? `${env.MODS_PUBLIC_URL}/${r2Key}` : `https://pub-${env.MODS_R2.id}.r2.dev/${r2Key}`;
    const version = {
      versionId,
      modId: modId2,
      version: metadata.version,
      changelog: metadata.changelog || "",
      fileSize,
      // Use calculated size from decrypted data
      fileName: originalFileName,
      // Use original filename (without .encrypted)
      r2Key,
      downloadUrl,
      sha256: fileHash,
      // Store hash for verification
      createdAt: now,
      downloads: 0,
      gameVersions: metadata.gameVersions || [],
      dependencies: metadata.dependencies || []
    };
    const versionKey = getCustomerKey(auth.customerId, `version_${versionId}`);
    await env.MODS_KV.put(versionKey, JSON.stringify(version));
    const versionsListKey = getCustomerKey(auth.customerId, `mod_${modId2}_versions`);
    const versionsList = await env.MODS_KV.get(versionsListKey, { type: "json" });
    const updatedVersionsList = [...versionsList || [], versionId];
    await env.MODS_KV.put(versionsListKey, JSON.stringify(updatedVersionsList));
    mod.latestVersion = metadata.version;
    mod.updatedAt = now;
    await env.MODS_KV.put(modKey, JSON.stringify(mod));
    if (mod.visibility === "public") {
      const globalModKey = `mod_${modId2}`;
      const globalVersionKey = `version_${versionId}`;
      const globalVersionsListKey = `mod_${modId2}_versions`;
      await env.MODS_KV.put(globalVersionKey, JSON.stringify(version));
      const globalVersionsList = await env.MODS_KV.get(globalVersionsListKey, { type: "json" });
      const updatedGlobalVersionsList = [...globalVersionsList || [], versionId];
      await env.MODS_KV.put(globalVersionsListKey, JSON.stringify(updatedGlobalVersionsList));
      await env.MODS_KV.put(globalModKey, JSON.stringify(mod));
    }
    const corsHeaders = createCORSHeaders(request, {
      allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
    });
    return new Response(JSON.stringify({ version }), {
      status: 201,
      headers: {
        "Content-Type": "application/json",
        ...Object.fromEntries(corsHeaders.entries())
      }
    });
  } catch (error) {
    console.error("Upload version error:", error);
    const rfcError = createError2(
      request,
      500,
      "Failed to Upload Version",
      env.ENVIRONMENT === "development" ? error.message : "An error occurred while uploading the version"
    );
    const corsHeaders = createCORSHeaders(request, {
      allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
    });
    return new Response(JSON.stringify(rfcError), {
      status: 500,
      headers: {
        "Content-Type": "application/problem+json",
        ...Object.fromEntries(corsHeaders.entries())
      }
    });
  }
}
__name(handleUploadVersion, "handleUploadVersion");

// handlers/versions/download.ts
init_enhanced2();
init_errors2();
init_customer();
init_hash();
init_slug();
async function handleDownloadVersion(request, env, modIdOrSlug, versionId, auth) {
  try {
    let mod = null;
    const cleanModId = modIdOrSlug.startsWith("mod_") ? modIdOrSlug.substring(4) : modIdOrSlug;
    if (auth?.customerId) {
      const customerModKey = getCustomerKey(auth.customerId, `mod_${cleanModId}`);
      mod = await env.MODS_KV.get(customerModKey, { type: "json" });
    }
    if (!mod) {
      const globalModKey = `mod_${cleanModId}`;
      mod = await env.MODS_KV.get(globalModKey, { type: "json" });
    }
    if (!mod) {
      mod = await findModBySlug(modIdOrSlug, env, auth);
    }
    if (!mod && modIdOrSlug.startsWith("mod_")) {
      if (auth?.customerId) {
        const customerModKey = getCustomerKey(auth.customerId, modIdOrSlug);
        mod = await env.MODS_KV.get(customerModKey, { type: "json" });
      }
      if (!mod) {
        mod = await env.MODS_KV.get(modIdOrSlug, { type: "json" });
      }
    }
    if (!mod) {
      const rfcError = createError2(request, 404, "Mod Not Found", "The requested mod was not found");
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 404,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    const modVisibility = mod.visibility || "public";
    if (modVisibility === "private" && mod.authorId !== auth?.userId) {
      const rfcError = createError2(request, 404, "Mod Not Found", "The requested mod was not found");
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 404,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    const { isSuperAdminEmail: isSuperAdminEmail2 } = await Promise.resolve().then(() => (init_admin(), admin_exports));
    const isAdmin = auth?.email ? await isSuperAdminEmail2(auth.email, env) : false;
    const isAuthor = mod.authorId === auth?.userId;
    const modStatus = mod.status || "published";
    if (modStatus !== "published") {
      if (!isAuthor && !isAdmin) {
        const rfcError = createError2(request, 404, "Mod Not Found", "The requested mod was not found");
        const corsHeaders2 = createCORSHeaders(request, {
          allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
        });
        return new Response(JSON.stringify(rfcError), {
          status: 404,
          headers: {
            "Content-Type": "application/problem+json",
            ...Object.fromEntries(corsHeaders2.entries())
          }
        });
      }
    }
    let version = null;
    if (auth?.customerId) {
      const customerVersionKey = getCustomerKey(auth.customerId, `version_${versionId}`);
      version = await env.MODS_KV.get(customerVersionKey, { type: "json" });
    }
    if (!version) {
      const globalVersionKey = `version_${versionId}`;
      version = await env.MODS_KV.get(globalVersionKey, { type: "json" });
    }
    const versionModId = version.modId;
    const modModId = mod.modId;
    if (!version || versionModId !== modModId && versionModId !== cleanModId && versionModId !== modIdOrSlug) {
      const rfcError = createError2(request, 404, "Version Not Found", "The requested version was not found");
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 404,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    version.downloads += 1;
    mod.downloadCount += 1;
    if (auth?.customerId) {
      const customerVersionKey = getCustomerKey(auth.customerId, `version_${versionId}`);
      await env.MODS_KV.put(customerVersionKey, JSON.stringify(version));
    }
    if (mod.visibility === "public") {
      const globalVersionKey = `version_${versionId}`;
      await env.MODS_KV.put(globalVersionKey, JSON.stringify(version));
    }
    if (auth?.customerId) {
      const customerModKey = getCustomerKey(auth.customerId, `mod_${modId}`);
      await env.MODS_KV.put(customerModKey, JSON.stringify(mod));
    }
    if (mod.visibility === "public") {
      const globalModKey = `mod_${modId}`;
      await env.MODS_KV.put(globalModKey, JSON.stringify(mod));
    }
    const encryptedFile = await env.MODS_R2.get(version.r2Key);
    if (!encryptedFile) {
      const rfcError = createError2(request, 404, "File Not Found", "The requested file was not found in storage");
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 404,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    const isEncrypted = encryptedFile.customMetadata?.encrypted === "true";
    let decryptedFileBytes;
    let originalContentType;
    if (isEncrypted) {
      try {
        const encryptedData = await encryptedFile.text();
        const encryptedJson = JSON.parse(encryptedData);
        const jwtToken = request.headers.get("Authorization")?.replace("Bearer ", "") || "";
        if (!jwtToken) {
          const rfcError = createError2(request, 401, "Authentication Required", "JWT token required to decrypt and download files");
          const corsHeaders2 = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
          });
          return new Response(JSON.stringify(rfcError), {
            status: 401,
            headers: {
              "Content-Type": "application/problem+json",
              ...Object.fromEntries(corsHeaders2.entries())
            }
          });
        }
        const decryptedBase64 = await decryptWithJWT(encryptedJson, jwtToken);
        const binaryString = atob(decryptedBase64);
        decryptedFileBytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          decryptedFileBytes[i] = binaryString.charCodeAt(i);
        }
        originalContentType = encryptedFile.customMetadata?.originalContentType || "application/zip";
      } catch (error) {
        console.error("File decryption error during download:", error);
        const rfcError = createError2(request, 500, "Decryption Failed", "Failed to decrypt file. Please ensure you are authenticated.");
        const corsHeaders2 = createCORSHeaders(request, {
          allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
        });
        return new Response(JSON.stringify(rfcError), {
          status: 500,
          headers: {
            "Content-Type": "application/problem+json",
            ...Object.fromEntries(corsHeaders2.entries())
          }
        });
      }
    } else {
      const arrayBuffer = await encryptedFile.arrayBuffer();
      decryptedFileBytes = new Uint8Array(arrayBuffer);
      originalContentType = encryptedFile.httpMetadata?.contentType || "application/octet-stream";
    }
    const corsHeaders = createCORSHeaders(request, {
      allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
    });
    const headers = new Headers(Object.fromEntries(corsHeaders.entries()));
    headers.set("Content-Type", originalContentType);
    headers.set("Content-Disposition", `attachment; filename="${version.fileName}"`);
    headers.set("Content-Length", decryptedFileBytes.length.toString());
    headers.set("Cache-Control", "public, max-age=31536000");
    if (version.sha256) {
      const strixunHash = formatStrixunHash(version.sha256);
      headers.set("X-Strixun-File-Hash", strixunHash);
      headers.set("X-Strixun-SHA256", version.sha256);
    }
    return new Response(decryptedFileBytes, {
      status: 200,
      headers
    });
  } catch (error) {
    console.error("Download version error:", error);
    const rfcError = createError2(
      request,
      500,
      "Failed to Download Version",
      env.ENVIRONMENT === "development" ? error.message : "An error occurred while downloading the version"
    );
    const corsHeaders = createCORSHeaders(request, {
      allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
    });
    return new Response(JSON.stringify(rfcError), {
      status: 500,
      headers: {
        "Content-Type": "application/problem+json",
        ...Object.fromEntries(corsHeaders.entries())
      }
    });
  }
}
__name(handleDownloadVersion, "handleDownloadVersion");

// handlers/mods/thumbnail.ts
init_enhanced2();
init_errors2();
init_customer();
async function handleThumbnail(request, env, modId2, auth) {
  try {
    let mod = null;
    const globalModKey = `mod_${modId2}`;
    mod = await env.MODS_KV.get(globalModKey, { type: "json" });
    if (!mod && auth?.customerId) {
      const customerModKey = getCustomerKey(auth.customerId, `mod_${modId2}`);
      mod = await env.MODS_KV.get(customerModKey, { type: "json" });
    }
    if (!mod) {
      const rfcError = createError2(request, 404, "Mod Not Found", "The requested mod was not found");
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 404,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    const { isSuperAdminEmail: isSuperAdminEmail2 } = await Promise.resolve().then(() => (init_admin(), admin_exports));
    const isAdmin = auth?.email ? await isSuperAdminEmail2(auth.email, env) : false;
    if (!isAdmin) {
      if (mod.visibility !== "public") {
        if (mod.authorId !== auth?.userId) {
          const rfcError = createError2(request, 404, "Mod Not Found", "The requested mod was not found");
          const corsHeaders2 = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
          });
          return new Response(JSON.stringify(rfcError), {
            status: 404,
            headers: {
              "Content-Type": "application/problem+json",
              ...Object.fromEntries(corsHeaders2.entries())
            }
          });
        }
      }
      if (mod.status !== "published") {
        if (mod.authorId !== auth?.userId) {
          const rfcError = createError2(request, 404, "Mod Not Found", "The requested mod was not found");
          const corsHeaders2 = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
          });
          return new Response(JSON.stringify(rfcError), {
            status: 404,
            headers: {
              "Content-Type": "application/problem+json",
              ...Object.fromEntries(corsHeaders2.entries())
            }
          });
        }
      }
    } else {
      if (mod.visibility === "private" && mod.authorId !== auth?.userId) {
        const rfcError = createError2(request, 404, "Mod Not Found", "The requested mod was not found");
        const corsHeaders2 = createCORSHeaders(request, {
          allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
        });
        return new Response(JSON.stringify(rfcError), {
          status: 404,
          headers: {
            "Content-Type": "application/problem+json",
            ...Object.fromEntries(corsHeaders2.entries())
          }
        });
      }
    }
    if (!mod.thumbnailUrl) {
      const rfcError = createError2(request, 404, "Thumbnail Not Found", "This mod does not have a thumbnail");
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 404,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    let r2Key;
    try {
      const url = new URL(mod.thumbnailUrl);
      if (url.hostname.includes("mods-api.idling.app")) {
        const customerId = mod.customerId || auth?.customerId || null;
        const extensions = ["png", "jpg", "jpeg", "webp", "gif"];
        for (const ext of extensions) {
          r2Key = getCustomerR2Key(customerId, `thumbnails/${modId2}.${ext}`);
          const testFile = await env.MODS_R2.get(r2Key);
          if (testFile) {
            break;
          }
        }
        if (!r2Key || !await env.MODS_R2.get(r2Key)) {
          r2Key = getCustomerR2Key(customerId, `thumbnails/${modId2}.png`);
        }
      } else {
        r2Key = url.pathname.startsWith("/") ? url.pathname.substring(1) : url.pathname;
      }
    } catch {
      const customerId = mod.customerId || auth?.customerId || null;
      r2Key = getCustomerR2Key(customerId, `thumbnails/${modId2}.png`);
    }
    const thumbnail = await env.MODS_R2.get(r2Key);
    if (!thumbnail) {
      const rfcError = createError2(request, 404, "Thumbnail Not Found", "Thumbnail file not found in storage");
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 404,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    const corsHeaders = createCORSHeaders(request, {
      allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
    });
    const headers = new Headers(Object.fromEntries(corsHeaders.entries()));
    headers.set("Content-Type", thumbnail.httpMetadata?.contentType || "image/png");
    headers.set("Cache-Control", "public, max-age=31536000");
    headers.set("Content-Length", thumbnail.size.toString());
    return new Response(thumbnail.body, {
      status: 200,
      headers
    });
  } catch (error) {
    console.error("Thumbnail error:", error);
    const rfcError = createError2(
      request,
      500,
      "Failed to Load Thumbnail",
      env.ENVIRONMENT === "development" ? error.message : "An error occurred while loading the thumbnail"
    );
    const corsHeaders = createCORSHeaders(request, {
      allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
    });
    return new Response(JSON.stringify(rfcError), {
      status: 500,
      headers: {
        "Content-Type": "application/problem+json",
        ...Object.fromEntries(corsHeaders.entries())
      }
    });
  }
}
__name(handleThumbnail, "handleThumbnail");

// handlers/mods/og-image.ts
init_enhanced2();
init_errors2();
init_slug();
function getCategoryDisplayName(category) {
  const categoryMap = {
    script: "Script",
    overlay: "Overlay",
    theme: "Theme",
    asset: "Asset",
    plugin: "Plugin",
    other: "Other"
  };
  return categoryMap[category] || category;
}
__name(getCategoryDisplayName, "getCategoryDisplayName");
function truncateText(text2, maxLength) {
  if (text2.length <= maxLength) return text2;
  return text2.substring(0, maxLength - 3) + "...";
}
__name(truncateText, "truncateText");
function escapeXml(text2) {
  return text2.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
__name(escapeXml, "escapeXml");
function generateOGImage(mod, thumbnailUrl) {
  const categoryDisplay = escapeXml(getCategoryDisplayName(mod.category));
  const title = escapeXml(truncateText(mod.title, 50));
  const description = escapeXml(truncateText(mod.description.replace(/\n/g, " ").replace(/\*\*/g, "").replace(/\*/g, ""), 120));
  const authorEmail = escapeXml(truncateText(mod.authorEmail, 30));
  const bgColor = "#1a1a1a";
  const borderColor = "#d4af37";
  const textColor = "#f9f9f9";
  const textSecondary = "#b0b0b0";
  const accentColor = "#d4af37";
  const width = 1200;
  const height = 630;
  const borderWidth = 8;
  const padding = 40;
  const thumbnailSize = 280;
  const thumbnailX = padding;
  const thumbnailY = (height - thumbnailSize) / 2;
  const hasThumbnail = !!thumbnailUrl;
  const thumbnailImage = hasThumbnail ? `<image href="${thumbnailUrl}" x="${thumbnailX}" y="${thumbnailY}" width="${thumbnailSize}" height="${thumbnailSize}" preserveAspectRatio="xMidYMid slice" clip-path="url(#thumbnail-clip)"/>` : `<rect x="${thumbnailX}" y="${thumbnailY}" width="${thumbnailSize}" height="${thumbnailSize}" fill="#252525" rx="8"/>
           <text x="${thumbnailX + thumbnailSize / 2}" y="${thumbnailY + thumbnailSize / 2}" text-anchor="middle" dominant-baseline="middle" fill="${textSecondary}" font-size="48" font-weight="600">${categoryDisplay}</text>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="thumbnail-clip">
      <rect x="${thumbnailX}" y="${thumbnailY}" width="${thumbnailSize}" height="${thumbnailSize}" rx="8"/>
    </clipPath>
    <linearGradient id="border-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${borderColor};stop-opacity:1" />
      <stop offset="100%" style="stop-color:#b8941f;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Dark background -->
  <rect width="${width}" height="${height}" fill="${bgColor}"/>
  
  <!-- Gold border -->
  <rect x="${borderWidth / 2}" y="${borderWidth / 2}" width="${width - borderWidth}" height="${height - borderWidth}" fill="none" stroke="url(#border-gradient)" stroke-width="${borderWidth}" rx="12"/>
  
  <!-- Thumbnail area with border -->
  <rect x="${thumbnailX - 4}" y="${thumbnailY - 4}" width="${thumbnailSize + 8}" height="${thumbnailSize + 8}" fill="none" stroke="${borderColor}" stroke-width="3" rx="12"/>
  ${thumbnailImage}
  
  <!-- Content area -->
  <g transform="translate(${thumbnailX + thumbnailSize + padding}, ${padding})">
    <!-- Category badge -->
    <rect x="0" y="0" width="120" height="36" fill="${accentColor}" rx="18"/>
    <text x="60" y="24" text-anchor="middle" dominant-baseline="middle" fill="${bgColor}" font-size="16" font-weight="700" font-family="system-ui, -apple-system, sans-serif">${categoryDisplay}</text>
    
    <!-- Title -->
    <text x="0" y="80" fill="${textColor}" font-size="56" font-weight="700" font-family="system-ui, -apple-system, sans-serif">${title}</text>
    
    <!-- Description -->
    <text x="0" y="160" fill="${textSecondary}" font-size="28" font-weight="400" font-family="system-ui, -apple-system, sans-serif">
      <tspan x="0" dy="0">${description}</tspan>
    </text>
    
    <!-- Metadata row -->
    <g transform="translate(0, 280)">
      <!-- Author -->
      <circle cx="12" cy="12" r="8" fill="${accentColor}"/>
      <text x="28" y="16" fill="${textSecondary}" font-size="20" font-weight="500" font-family="system-ui, -apple-system, sans-serif">${authorEmail}</text>
      
      <!-- Downloads -->
      <g transform="translate(320, 0)">
        <text x="0" y="16" fill="${textSecondary}" font-size="20" font-weight="500" font-family="system-ui, -apple-system, sans-serif">\u{1F4E5} ${mod.downloadCount.toLocaleString()} downloads</text>
      </g>
      
      <!-- Version -->
      <g transform="translate(600, 0)">
        <text x="0" y="16" fill="${textSecondary}" font-size="20" font-weight="500" font-family="system-ui, -apple-system, sans-serif">v${mod.latestVersion}</text>
      </g>
    </g>
    
    <!-- Branding -->
    <g transform="translate(0, 380)">
      <text x="0" y="0" fill="${textSecondary}" font-size="18" font-weight="600" font-family="system-ui, -apple-system, sans-serif">Strixun Stream Suite</text>
      <line x1="0" y1="8" x2="200" y2="8" stroke="${accentColor}" stroke-width="2"/>
    </g>
  </g>
</svg>`.replace(/\n\s+/g, "\n").trim();
}
__name(generateOGImage, "generateOGImage");
async function handleOGImage(request, env, slug, auth) {
  try {
    const mod = await findModBySlug(slug, env, auth);
    if (!mod) {
      const rfcError = createError2(request, 404, "Mod Not Found", "The requested mod was not found");
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 404,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    if (mod.visibility === "private" && mod.authorId !== auth?.userId) {
      const rfcError = createError2(request, 404, "Mod Not Found", "The requested mod was not found");
      const corsHeaders2 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 404,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders2.entries())
        }
      });
    }
    const ogImageSvg = generateOGImage(mod, mod.thumbnailUrl);
    const corsHeaders = createCORSHeaders(request, {
      allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
    });
    const headers = new Headers(Object.fromEntries(corsHeaders.entries()));
    headers.set("Content-Type", "image/svg+xml");
    headers.set("Cache-Control", "public, max-age=3600");
    return new Response(ogImageSvg, {
      status: 200,
      headers
    });
  } catch (error) {
    console.error("OG image error:", error);
    const rfcError = createError2(
      request,
      500,
      "Failed to Generate OG Image",
      env.ENVIRONMENT === "development" ? error.message : "An error occurred while generating the preview image"
    );
    const corsHeaders = createCORSHeaders(request, {
      allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
    });
    return new Response(JSON.stringify(rfcError), {
      status: 500,
      headers: {
        "Content-Type": "application/problem+json",
        ...Object.fromEntries(corsHeaders.entries())
      }
    });
  }
}
__name(handleOGImage, "handleOGImage");

// router/mod-routes.ts
async function handleModRoutes(request, path, env) {
  if (!path.startsWith("/mods")) {
    return null;
  }
  const auth = await authenticateRequest(request, env);
  try {
    const pathSegments = path.split("/").filter(Boolean);
    if (pathSegments.length === 1 && pathSegments[0] === "mods" && request.method === "GET") {
      const response = await handleListMods(request, env, auth);
      return await wrapWithEncryption(response, auth || void 0);
    }
    if (pathSegments.length === 1 && pathSegments[0] === "mods" && request.method === "POST") {
      if (!auth) {
        const rfcError2 = createError2(request, 401, "Unauthorized", "Authentication required to upload mods");
        const corsHeaders2 = createCORSHeaders(request, {
          allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
        });
        return {
          response: new Response(JSON.stringify(rfcError2), {
            status: 401,
            headers: {
              "Content-Type": "application/problem+json",
              ...Object.fromEntries(corsHeaders2.entries())
            }
          }),
          customerId: null
        };
      }
      const response = await handleUploadMod(request, env, auth);
      return await wrapWithEncryption(response, auth);
    }
    if (pathSegments.length === 3 && pathSegments[0] === "mods" && pathSegments[1] === "permissions" && pathSegments[2] === "me" && request.method === "GET") {
      if (!auth) {
        const rfcError2 = createError2(request, 401, "Unauthorized", "Authentication required");
        const corsHeaders2 = createCORSHeaders(request, {
          allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
        });
        return {
          response: new Response(JSON.stringify(rfcError2), {
            status: 401,
            headers: {
              "Content-Type": "application/problem+json",
              ...Object.fromEntries(corsHeaders2.entries())
            }
          }),
          customerId: null
        };
      }
      const { handleGetUserPermissions: handleGetUserPermissions2 } = await Promise.resolve().then(() => (init_permissions(), permissions_exports));
      const response = await handleGetUserPermissions2(request, env, auth);
      return await wrapWithEncryption(response, auth);
    }
    if (pathSegments.length === 3 && pathSegments[0] === "mods" && pathSegments[2] === "review" && request.method === "GET") {
      const slug = pathSegments[1];
      const { handleGetModReview: handleGetModReview2 } = await Promise.resolve().then(() => (init_review(), review_exports));
      const response = await handleGetModReview2(request, env, slug, auth);
      return await wrapWithEncryption(response, auth || void 0);
    }
    if (pathSegments.length === 2 && pathSegments[0] === "mods" && request.method === "GET") {
      const slug = pathSegments[1];
      const response = await handleGetModDetail(request, env, slug, auth);
      return await wrapWithEncryption(response, auth || void 0);
    }
    if (pathSegments.length === 2 && pathSegments[0] === "mods" && request.method === "PATCH") {
      if (!auth) {
        const rfcError2 = createError2(request, 401, "Unauthorized", "Authentication required");
        const corsHeaders2 = createCORSHeaders(request, {
          allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
        });
        return {
          response: new Response(JSON.stringify(rfcError2), {
            status: 401,
            headers: {
              "Content-Type": "application/problem+json",
              ...Object.fromEntries(corsHeaders2.entries())
            }
          }),
          customerId: null
        };
      }
      const slug = pathSegments[1];
      const response = await handleUpdateMod(request, env, slug, auth);
      return await wrapWithEncryption(response, auth);
    }
    if (pathSegments.length === 2 && pathSegments[0] === "mods" && request.method === "DELETE") {
      if (!auth) {
        const rfcError2 = createError2(request, 401, "Unauthorized", "Authentication required");
        const corsHeaders2 = createCORSHeaders(request, {
          allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
        });
        return {
          response: new Response(JSON.stringify(rfcError2), {
            status: 401,
            headers: {
              "Content-Type": "application/problem+json",
              ...Object.fromEntries(corsHeaders2.entries())
            }
          }),
          customerId: null
        };
      }
      const slug = pathSegments[1];
      const response = await handleDeleteMod(request, env, slug, auth);
      return await wrapWithEncryption(response, auth);
    }
    if (pathSegments.length === 3 && pathSegments[0] === "mods" && pathSegments[2] === "ratings" && request.method === "GET") {
      const modId2 = pathSegments[1];
      const { handleGetModRatings: handleGetModRatings2 } = await Promise.resolve().then(() => (init_ratings(), ratings_exports));
      const response = await handleGetModRatings2(request, env, modId2, auth);
      return await wrapWithEncryption(response, auth || void 0);
    }
    if (pathSegments.length === 3 && pathSegments[0] === "mods" && pathSegments[2] === "ratings" && request.method === "POST") {
      if (!auth) {
        const rfcError2 = createError2(request, 401, "Unauthorized", "Authentication required to submit ratings");
        const corsHeaders2 = createCORSHeaders(request, {
          allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
        });
        return {
          response: new Response(JSON.stringify(rfcError2), {
            status: 401,
            headers: {
              "Content-Type": "application/problem+json",
              ...Object.fromEntries(corsHeaders2.entries())
            }
          }),
          customerId: null
        };
      }
      const modId2 = pathSegments[1];
      const { handleSubmitModRating: handleSubmitModRating2 } = await Promise.resolve().then(() => (init_ratings(), ratings_exports));
      const response = await handleSubmitModRating2(request, env, modId2, auth);
      return await wrapWithEncryption(response, auth);
    }
    if (pathSegments.length === 3 && pathSegments[0] === "mods" && pathSegments[2] === "versions" && request.method === "POST") {
      if (!auth) {
        const rfcError2 = createError2(request, 401, "Unauthorized", "Authentication required");
        const corsHeaders2 = createCORSHeaders(request, {
          allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
        });
        return {
          response: new Response(JSON.stringify(rfcError2), {
            status: 401,
            headers: {
              "Content-Type": "application/problem+json",
              ...Object.fromEntries(corsHeaders2.entries())
            }
          }),
          customerId: null
        };
      }
      const modId2 = pathSegments[1];
      const response = await handleUploadVersion(request, env, modId2, auth);
      return await wrapWithEncryption(response, auth);
    }
    if (pathSegments.length === 3 && pathSegments[0] === "mods" && pathSegments[2] === "thumbnail" && request.method === "GET") {
      const modId2 = pathSegments[1];
      const response = await handleThumbnail(request, env, modId2, auth);
      return { response, customerId: auth?.customerId || null };
    }
    if (pathSegments.length === 3 && pathSegments[0] === "mods" && pathSegments[2] === "og-image" && request.method === "GET") {
      const slug = pathSegments[1];
      const response = await handleOGImage(request, env, slug, auth);
      return { response, customerId: auth?.customerId || null };
    }
    if (pathSegments.length === 5 && pathSegments[0] === "mods" && pathSegments[2] === "versions" && pathSegments[4] === "download" && request.method === "GET") {
      const modId2 = pathSegments[1];
      const versionId = pathSegments[3];
      const response = await handleDownloadVersion(request, env, modId2, versionId, auth);
      return { response, customerId: auth?.customerId || null };
    }
    if (pathSegments.length === 5 && pathSegments[0] === "mods" && pathSegments[2] === "versions" && pathSegments[4] === "verify" && request.method === "GET") {
      const modId2 = pathSegments[1];
      const versionId = pathSegments[3];
      const { handleVerifyVersion: handleVerifyVersion2 } = await Promise.resolve().then(() => (init_verify(), verify_exports));
      const response = await handleVerifyVersion2(request, env, modId2, versionId, auth);
      return await wrapWithEncryption(response, auth || void 0);
    }
    if (pathSegments.length === 5 && pathSegments[0] === "mods" && pathSegments[2] === "versions" && pathSegments[4] === "badge" && request.method === "GET") {
      const modId2 = pathSegments[1];
      const versionId = pathSegments[3];
      const { handleBadge: handleBadge2 } = await Promise.resolve().then(() => (init_badge(), badge_exports));
      const response = await handleBadge2(request, env, modId2, versionId, auth);
      return { response, customerId: auth?.customerId || null };
    }
    const rfcError = createError2(request, 404, "Endpoint Not Found", "The requested mod endpoint was not found");
    const corsHeaders = createCORSHeaders(request, {
      allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
    });
    return {
      response: new Response(JSON.stringify(rfcError), {
        status: 404,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders.entries())
        }
      }),
      customerId: auth?.customerId || null
    };
  } catch (error) {
    console.error("Mod route handler error:", error);
    const rfcError = createError2(
      request,
      500,
      "Internal Server Error",
      env.ENVIRONMENT === "development" ? error.message : "An internal server error occurred"
    );
    const corsHeaders = createCORSHeaders(request, {
      allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
    });
    return {
      response: new Response(JSON.stringify(rfcError), {
        status: 500,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders.entries())
        }
      }),
      customerId: auth?.customerId || null
    };
  }
}
__name(handleModRoutes, "handleModRoutes");

// router/admin-routes.ts
init_enhanced2();
init_errors2();
init_admin();
async function handleAdminRoutes(request, path, env) {
  try {
    const auth = await authenticateRequest(request, env);
    if (!auth) {
      const rfcError = createError2(request, 401, "Unauthorized", "Authentication required");
      const corsHeaders = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return {
        response: new Response(JSON.stringify(rfcError), {
          status: 401,
          headers: {
            "Content-Type": "application/problem+json",
            ...Object.fromEntries(corsHeaders.entries())
          }
        }),
        customerId: null
      };
    }
    if (!auth.email || !await isSuperAdminEmail(auth.email, env)) {
      const rfcError = createError2(request, 403, "Forbidden", "Admin access required");
      const corsHeaders = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return {
        response: new Response(JSON.stringify(rfcError), {
          status: 403,
          headers: {
            "Content-Type": "application/problem+json",
            ...Object.fromEntries(corsHeaders.entries())
          }
        }),
        customerId: auth.customerId || null
      };
    }
    const pathSegments = path.split("/").filter(Boolean);
    if (pathSegments.length === 2 && pathSegments[0] === "admin" && pathSegments[1] === "mods" && request.method === "GET") {
      const { handleListAllMods: handleListAllMods2 } = await Promise.resolve().then(() => (init_list(), list_exports));
      const response = await handleListAllMods2(request, env, auth);
      return await wrapWithEncryption(response, auth);
    }
    if (pathSegments.length === 4 && pathSegments[0] === "admin" && pathSegments[1] === "mods" && pathSegments[3] === "status" && request.method === "POST") {
      const modId2 = pathSegments[2];
      const { handleUpdateModStatus: handleUpdateModStatus2 } = await Promise.resolve().then(() => (init_triage(), triage_exports));
      const response = await handleUpdateModStatus2(request, env, modId2, auth);
      return await wrapWithEncryption(response, auth);
    }
    if (pathSegments.length === 4 && pathSegments[0] === "admin" && pathSegments[1] === "mods" && pathSegments[3] === "comments" && request.method === "POST") {
      const modId2 = pathSegments[2];
      const { handleAddReviewComment: handleAddReviewComment2 } = await Promise.resolve().then(() => (init_triage(), triage_exports));
      const response = await handleAddReviewComment2(request, env, modId2, auth);
      return await wrapWithEncryption(response, auth);
    }
    if (pathSegments.length === 2 && pathSegments[0] === "admin" && pathSegments[1] === "approvals" && request.method === "GET") {
      const { handleListApprovedUsers: handleListApprovedUsers2 } = await Promise.resolve().then(() => (init_approvals(), approvals_exports));
      const response = await handleListApprovedUsers2(request, env, auth);
      return await wrapWithEncryption(response, auth);
    }
    if (pathSegments.length === 3 && pathSegments[0] === "admin" && pathSegments[1] === "approvals" && request.method === "POST") {
      const userId = pathSegments[2];
      const { handleApproveUser: handleApproveUser2 } = await Promise.resolve().then(() => (init_approvals(), approvals_exports));
      const response = await handleApproveUser2(request, env, userId, auth);
      return await wrapWithEncryption(response, auth);
    }
    if (pathSegments.length === 3 && pathSegments[0] === "admin" && pathSegments[1] === "approvals" && request.method === "DELETE") {
      const userId = pathSegments[2];
      const { handleRevokeUser: handleRevokeUser2 } = await Promise.resolve().then(() => (init_approvals(), approvals_exports));
      const response = await handleRevokeUser2(request, env, userId, auth);
      return await wrapWithEncryption(response, auth);
    }
    return null;
  } catch (error) {
    console.error("Admin routes error:", error);
    const rfcError = createError2(request, 500, "Internal Server Error", "An error occurred while processing the admin request");
    const corsHeaders = createCORSHeaders(request, {
      allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
    });
    return {
      response: new Response(JSON.stringify(rfcError), {
        status: 500,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders.entries())
        }
      }),
      customerId: null
    };
  }
}
__name(handleAdminRoutes, "handleAdminRoutes");

// worker.ts
function parseRoutes(env) {
  if (!env.ROUTES) {
    return [];
  }
  try {
    let routesJson = env.ROUTES.trim();
    if (routesJson.includes("=") && !routesJson.includes('":')) {
      routesJson = routesJson.replace(/\{\s*(\w+)\s*=\s*"([^"]+)"/g, '{"$1": "$2"').replace(/,\s*(\w+)\s*=\s*"([^"]+)"/g, ', "$1": "$2"').replace(/\{\s*(\w+)\s*=\s*(\w+)/g, '{"$1": "$2"').replace(/,\s*(\w+)\s*=\s*(\w+)/g, ', "$1": "$2"');
    }
    const parsed = JSON.parse(routesJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Failed to parse ROUTES environment variable:", error);
    return [];
  }
}
__name(parseRoutes, "parseRoutes");
function getCorsHeaders(env, request) {
  const origin = request.headers.get("Origin");
  const allowedOrigins = env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || [];
  const isProduction = env.ENVIRONMENT === "production";
  const isLocalhost = origin && (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:"));
  let effectiveOrigins = allowedOrigins.length > 0 ? allowedOrigins : ["*"];
  if (!isProduction && isLocalhost && !allowedOrigins.includes("*") && !allowedOrigins.some((o) => {
    if (o === "*") return true;
    if (o.endsWith("*")) {
      const prefix = o.slice(0, -1);
      return origin && origin.startsWith(prefix);
    }
    return origin === o;
  })) {
    effectiveOrigins = ["*"];
  }
  const corsHeaders = createCORSHeaders(request, {
    allowedOrigins: effectiveOrigins
  });
  const headers = {};
  corsHeaders.forEach((value, key2) => {
    headers[key2] = value;
  });
  if (!headers["Access-Control-Allow-Origin"] && origin) {
    if (!isProduction && isLocalhost) {
      headers["Access-Control-Allow-Origin"] = origin;
    } else if (effectiveOrigins.includes("*")) {
      headers["Access-Control-Allow-Origin"] = "*";
    }
  }
  return headers;
}
__name(getCorsHeaders, "getCorsHeaders");
async function handleHealth(env, request) {
  const routes = parseRoutes(env);
  return new Response(JSON.stringify({
    status: "ok",
    message: "Mods API is running",
    service: "strixun-mods-api",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    environment: env.ENVIRONMENT || "development",
    routes: routes.length > 0 ? routes : void 0
  }), {
    headers: {
      "Content-Type": "application/json",
      ...getCorsHeaders(env, request)
    }
  });
}
__name(handleHealth, "handleHealth");
async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  try {
    if (path === "/health" || path === "/") {
      return await handleHealth(env, request);
    }
    if (path.startsWith("/admin")) {
      const adminResult = await handleAdminRoutes(request, path, env);
      if (adminResult) {
        return adminResult.response;
      }
    }
    const modResult = await handleModRoutes(request, path, env);
    if (modResult) {
      return modResult.response;
    }
    const rfcError = createError2(request, 404, "Not Found", "The requested endpoint was not found");
    return new Response(JSON.stringify(rfcError), {
      status: 404,
      headers: {
        "Content-Type": "application/problem+json",
        ...getCorsHeaders(env, request)
      }
    });
  } catch (error) {
    console.error("Request handler error:", error);
    if (error.status && error.type) {
      return new Response(JSON.stringify(error), {
        status: error.status,
        headers: {
          "Content-Type": "application/problem+json",
          ...getCorsHeaders(env, request)
        }
      });
    }
    if (error.message && error.message.includes("JWT_SECRET")) {
      const rfcError2 = createError2(
        request,
        500,
        "Server Configuration Error",
        "JWT_SECRET environment variable is required. Please contact the administrator."
      );
      return new Response(JSON.stringify(rfcError2), {
        status: 500,
        headers: {
          "Content-Type": "application/problem+json",
          ...getCorsHeaders(env, request)
        }
      });
    }
    const rfcError = createError2(
      request,
      500,
      "Internal Server Error",
      env.ENVIRONMENT === "development" ? error.message : "An internal server error occurred"
    );
    return new Response(JSON.stringify(rfcError), {
      status: 500,
      headers: {
        "Content-Type": "application/problem+json",
        ...getCorsHeaders(env, request)
      }
    });
  }
}
__name(handleRequest, "handleRequest");
var worker_default = {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(env, request)
      });
    }
    return handleRequest(request, env, ctx);
  }
};
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
