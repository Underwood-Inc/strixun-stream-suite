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
var MiddlewarePipeline;
var init_middleware = __esm({
  "../../src/core/api/middleware/index.ts"() {
    "use strict";
    MiddlewarePipeline = class {
      constructor() {
        this.middlewares = [];
      }
      static {
        __name(this, "MiddlewarePipeline");
      }
      /**
       * Add middleware to the pipeline
       */
      use(middleware) {
        this.middlewares.push(middleware);
        return this;
      }
      /**
       * Remove middleware from the pipeline
       */
      remove(middleware) {
        const index2 = this.middlewares.indexOf(middleware);
        if (index2 > -1) {
          this.middlewares.splice(index2, 1);
        }
        return this;
      }
      /**
       * Clear all middlewares
       */
      clear() {
        this.middlewares = [];
        return this;
      }
      /**
       * Execute middleware pipeline
       */
      async execute(request, finalHandler) {
        let index2 = 0;
        const next2 = /* @__PURE__ */ __name(async (req) => {
          if (index2 >= this.middlewares.length) {
            return finalHandler(req);
          }
          const middleware = this.middlewares[index2++];
          return middleware(req, next2);
        }, "next");
        return next2(request);
      }
      /**
       * Get all middlewares
       */
      getMiddlewares() {
        return [...this.middlewares];
      }
    };
  }
});

// ../../src/core/api/middleware/auth.ts
function createAuthMiddleware(config) {
  return async (request, next2) => {
    if (request.metadata?.auth === false) {
      return next2(request);
    }
    if (config.tokenGetter) {
      const token2 = await config.tokenGetter();
      if (token2) {
        if (!request.headers) {
          request.headers = {};
        }
        request.headers["Authorization"] = `Bearer ${token2}`;
      }
    }
    if (["POST", "PUT", "DELETE", "PATCH"].includes(request.method)) {
      if (config.csrfTokenGetter) {
        const csrfToken2 = await config.csrfTokenGetter();
        if (csrfToken2) {
          if (!request.headers) {
            request.headers = {};
          }
          request.headers["X-CSRF-Token"] = csrfToken2;
        }
      }
    }
    try {
      const response = await next2(request);
      if (response.status === 401 && config.onTokenExpired) {
        await config.onTokenExpired();
        if (config.tokenGetter) {
          const newToken = await config.tokenGetter();
          if (newToken) {
            if (!request.headers) {
              request.headers = {};
            }
            request.headers["Authorization"] = `Bearer ${newToken}`;
            return next2(request);
          }
        }
      }
      return response;
    } catch (error) {
      if (error && typeof error === "object" && "status" in error && error.status === 401) {
        if (config.onTokenExpired) {
          await config.onTokenExpired();
          if (config.tokenGetter) {
            const newToken = await config.tokenGetter();
            if (newToken) {
              if (!request.headers) {
                request.headers = {};
              }
              request.headers["Authorization"] = `Bearer ${newToken}`;
              try {
                return await next2(request);
              } catch (retryError) {
                throw retryError;
              }
            }
          }
        }
      }
      throw error;
    }
  };
}
var init_auth = __esm({
  "../../src/core/api/middleware/auth.ts"() {
    "use strict";
    __name(createAuthMiddleware, "createAuthMiddleware");
  }
});

// ../../src/core/api/utils/response-handler.ts
async function handleResponse(request, response) {
  let data;
  const contentType = response.headers.get("content-type");
  try {
    if (contentType?.includes("application/json")) {
      data = await response.json();
    } else if (contentType?.includes("text/")) {
      data = await response.text();
    } else {
      data = await response.arrayBuffer();
    }
  } catch (error) {
    throw createError(
      request,
      response.status,
      response.statusText,
      "Failed to parse response",
      error
    );
  }
  const apiResponse = {
    data,
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
    request,
    timestamp: Date.now()
  };
  return apiResponse;
}
async function handleErrorResponse(request, response) {
  let errorData;
  const contentType = response.headers.get("content-type");
  try {
    if (contentType?.includes("application/json")) {
      errorData = await response.json();
    } else {
      errorData = await response.text();
    }
  } catch {
    errorData = null;
  }
  const error = createError(
    request,
    response.status,
    response.statusText,
    typeof errorData === "object" && errorData !== null && "error" in errorData ? String(errorData.error) : String(errorData || response.statusText),
    errorData
  );
  error.retryable = isRetryableError(response.status);
  if (response.status === 429) {
    const retryAfter = response.headers.get("Retry-After");
    if (retryAfter) {
      error.retryAfter = parseInt(retryAfter, 10) * 1e3;
    }
  }
  return error;
}
function createError(request, status, statusText, message, data) {
  const error = new Error(message || statusText || "API request failed");
  error.status = status;
  error.statusText = statusText;
  error.data = data;
  error.request = request;
  error.name = "APIError";
  return error;
}
function isRetryableError(status) {
  if (!status) return false;
  return status === 408 || // Request Timeout
  status === 429 || // Too Many Requests
  status === 500 || // Internal Server Error
  status === 502 || // Bad Gateway
  status === 503 || // Service Unavailable
  status === 504;
}
function isSuccessResponse(status) {
  return status >= 200 && status < 300;
}
function extractErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (typeof error === "object" && error !== null) {
    if ("message" in error && typeof error.message === "string") {
      return error.message;
    }
    if ("error" in error && typeof error.error === "string") {
      return error.error;
    }
  }
  return "Unknown error";
}
var init_response_handler = __esm({
  "../../src/core/api/utils/response-handler.ts"() {
    "use strict";
    __name(handleResponse, "handleResponse");
    __name(handleErrorResponse, "handleErrorResponse");
    __name(createError, "createError");
    __name(isRetryableError, "isRetryableError");
    __name(isSuccessResponse, "isSuccessResponse");
    __name(extractErrorMessage, "extractErrorMessage");
  }
});

// ../../src/core/api/middleware/error.ts
function createErrorMiddleware(config = {}) {
  return async (request, next2) => {
    try {
      return await next2(request);
    } catch (error) {
      let apiError;
      if (error && typeof error === "object" && "status" in error) {
        apiError = error;
      } else {
        apiError = createError(
          request,
          void 0,
          void 0,
          extractErrorMessage(error),
          error
        );
      }
      if (config.transformError) {
        apiError = config.transformError(apiError);
      }
      if (config.handler) {
        const result = await config.handler(apiError, request);
        if (result) {
          return result;
        }
      }
      throw apiError;
    }
  };
}
var init_error = __esm({
  "../../src/core/api/middleware/error.ts"() {
    "use strict";
    init_response_handler();
    __name(createErrorMiddleware, "createErrorMiddleware");
  }
});

// ../../src/core/api/middleware/transform.ts
function createTransformMiddleware(config) {
  return async (request, next2) => {
    let transformedRequest = request;
    if (config.transformRequest) {
      transformedRequest = await config.transformRequest(request);
    }
    const response = await next2(transformedRequest);
    if (config.transformResponse) {
      return config.transformResponse(response);
    }
    return response;
  };
}
function defaultRequestTransformer(request) {
  if (request.body && typeof request.body === "object") {
    if (!request.headers) {
      request.headers = {};
    }
    if (!request.headers["Content-Type"]) {
      request.headers["Content-Type"] = "application/json";
    }
  }
  return request;
}
function defaultResponseTransformer(response) {
  return response;
}
var init_transform = __esm({
  "../../src/core/api/middleware/transform.ts"() {
    "use strict";
    __name(createTransformMiddleware, "createTransformMiddleware");
    __name(defaultRequestTransformer, "defaultRequestTransformer");
    __name(defaultResponseTransformer, "defaultResponseTransformer");
  }
});

// ../../src/core/api/utils/request-builder.ts
function createRequest() {
  return new RequestBuilder();
}
var RequestBuilder;
var init_request_builder = __esm({
  "../../src/core/api/utils/request-builder.ts"() {
    "use strict";
    RequestBuilder = class {
      static {
        __name(this, "RequestBuilder");
      }
      constructor() {
        this.request = {
          id: this.generateRequestId(),
          headers: {},
          metadata: {}
        };
      }
      /**
       * Set HTTP method
       */
      method(method) {
        this.request.method = method;
        return this;
      }
      /**
       * Set URL path
       */
      path(path) {
        this.request.path = path;
        return this;
      }
      /**
       * Set full URL
       */
      url(url) {
        this.request.url = url;
        return this;
      }
      /**
       * Set query parameters
       */
      params(params) {
        this.request.params = { ...this.request.params, ...params };
        return this;
      }
      /**
       * Set request body
       */
      body(body) {
        this.request.body = body;
        return this;
      }
      /**
       * Set header
       */
      header(key2, value) {
        if (!this.request.headers) {
          this.request.headers = {};
        }
        this.request.headers[key2] = value;
        return this;
      }
      /**
       * Set multiple headers
       */
      headers(headers) {
        if (!this.request.headers) {
          this.request.headers = {};
        }
        Object.assign(this.request.headers, headers);
        return this;
      }
      /**
       * Set AbortSignal for cancellation
       */
      signal(signal) {
        this.request.signal = signal;
        return this;
      }
      /**
       * Set request priority
       */
      priority(priority) {
        this.request.priority = priority;
        return this;
      }
      /**
       * Set cache configuration
       */
      cache(cache) {
        this.request.cache = cache;
        return this;
      }
      /**
       * Set retry configuration
       */
      retry(retry) {
        this.request.retry = retry;
        return this;
      }
      /**
       * Set timeout
       */
      timeout(timeout) {
        this.request.timeout = timeout;
        return this;
      }
      /**
       * Set metadata
       */
      metadata(key2, value) {
        if (!this.request.metadata) {
          this.request.metadata = {};
        }
        this.request.metadata[key2] = value;
        return this;
      }
      /**
       * Build the final request
       */
      build() {
        if (!this.request.method) {
          throw new Error("Request method is required");
        }
        if (!this.request.url && !this.request.path) {
          throw new Error("Request URL or path is required");
        }
        if (this.request.path && !this.request.url) {
          const url = new URL(this.request.path, "https://api.example.com");
          if (this.request.params) {
            Object.entries(this.request.params).forEach(([key2, value]) => {
              if (value !== void 0 && value !== null) {
                url.searchParams.set(key2, String(value));
              }
            });
          }
          this.request.url = url.pathname + url.search;
        }
        return this.request;
      }
      /**
       * Generate unique request ID
       */
      generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      }
    };
    __name(createRequest, "createRequest");
  }
});

// ../../src/core/services/encryption.ts
function isHTTPS() {
  if (typeof window === "undefined") {
    return false;
  }
  return window.location.protocol === "https:" || window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
}
function enforceHTTPS(url) {
  if (url.includes("localhost") || url.includes("127.0.0.1")) {
    return url;
  }
  if (url.startsWith("http://")) {
    console.warn("[Encryption] \u26A0\uFE0F HTTP request blocked, upgrading to HTTPS:", url);
    return url.replace("http://", "https://");
  }
  return url;
}
async function secureFetch(url, options = {}) {
  const secureUrl = enforceHTTPS(url);
  if (!isHTTPS() && !secureUrl.includes("localhost") && !secureUrl.includes("127.0.0.1")) {
    console.warn(
      "[Encryption] \u26A0\uFE0F Non-HTTPS connection detected. Some features may not work."
    );
  }
  return fetch(secureUrl, options);
}
var init_encryption = __esm({
  "../../src/core/services/encryption.ts"() {
    "use strict";
    __name(isHTTPS, "isHTTPS");
    __name(enforceHTTPS, "enforceHTTPS");
    __name(secureFetch, "secureFetch");
  }
});

// ../../src/core/api/client.ts
var APIClient;
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
    APIClient = class {
      static {
        __name(this, "APIClient");
      }
      constructor(config = {}) {
        this.baseURL = config.baseURL || "";
        this.config = {
          baseURL: this.baseURL,
          defaultHeaders: config.defaultHeaders || {},
          timeout: config.timeout || 3e4,
          retry: config.retry || {
            maxAttempts: 3,
            backoff: "exponential",
            initialDelay: 1e3,
            maxDelay: 1e4,
            retryableErrors: [408, 429, 500, 502, 503, 504]
          },
          cache: {
            enabled: config.cache?.enabled ?? true,
            defaultStrategy: config.cache?.defaultStrategy || "network-first",
            defaultTTL: config.cache?.defaultTTL || 5 * 60 * 1e3
          },
          offline: {
            enabled: config.offline?.enabled ?? false,
            queueSize: config.offline?.queueSize || 100,
            syncOnReconnect: config.offline?.syncOnReconnect ?? true,
            retryOnReconnect: config.offline?.retryOnReconnect ?? true
          },
          auth: config.auth || {},
          errorHandler: config.errorHandler || (async () => {
          }),
          plugins: config.plugins || []
        };
        this.middlewarePipeline = new MiddlewarePipeline();
        this.setupDefaultMiddlewares();
        this.setupPlugins();
      }
      /**
       * Setup default middlewares
       */
      setupDefaultMiddlewares() {
        this.use(
          createTransformMiddleware({
            transformRequest: defaultRequestTransformer
          })
        );
        if (this.config.auth.tokenGetter || this.config.auth.csrfTokenGetter) {
          this.use(
            createAuthMiddleware({
              tokenGetter: this.config.auth.tokenGetter,
              csrfTokenGetter: this.config.auth.csrfTokenGetter,
              onTokenExpired: this.config.auth.onTokenExpired,
              baseURL: this.baseURL
            })
          );
        }
        this.use(
          createErrorMiddleware({
            handler: this.config.errorHandler
          })
        );
      }
      /**
       * Setup plugins
       */
      setupPlugins() {
        for (const plugin of this.config.plugins) {
          if (plugin.setup) {
            plugin.setup(this);
          }
          if (plugin.middleware) {
            this.use(plugin.middleware);
          }
        }
      }
      /**
       * Add middleware to pipeline
       */
      use(middleware) {
        this.middlewarePipeline.use(middleware);
        return this;
      }
      /**
       * Remove middleware from pipeline
       */
      removeMiddleware(middleware) {
        this.middlewarePipeline.remove(middleware);
        return this;
      }
      /**
       * Create request builder
       */
      request() {
        return new RequestBuilder();
      }
      /**
       * Make API request
       */
      async requestRaw(request) {
        const url = this.buildURL(request.url || request.path);
        console.log("[APIClient] requestRaw called:", { method: request.method, path: request.path, url, baseURL: this.baseURL });
        const headers = new Headers({
          ...this.config.defaultHeaders,
          ...request.headers
        });
        let body;
        if (request.body) {
          if (typeof request.body === "string") {
            body = request.body;
          } else {
            body = JSON.stringify(request.body);
          }
        }
        const fetchOptions = {
          method: request.method,
          headers,
          body,
          signal: request.signal
        };
        return this.middlewarePipeline.execute(request, async (req) => {
          let timeoutId;
          let abortController;
          if (req.timeout || this.config.timeout) {
            abortController = new AbortController();
            const timeout = req.timeout || this.config.timeout;
            timeoutId = setTimeout(() => {
              abortController?.abort();
            }, timeout);
            if (req.signal) {
              req.signal.addEventListener("abort", () => {
                abortController?.abort();
              });
            }
          }
          try {
            console.log("[APIClient] Making fetch request to:", url, "with options:", { method: fetchOptions.method, headers: Object.fromEntries(new Headers(fetchOptions.headers).entries()) });
            const response = await secureFetch(url, {
              ...fetchOptions,
              signal: abortController?.signal || req.signal
            });
            console.log("[APIClient] Fetch response received:", { status: response.status, statusText: response.statusText, ok: response.ok });
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
            if (isSuccessResponse(response.status)) {
              return handleResponse(req, response);
            } else {
              throw await handleErrorResponse(req, response);
            }
          } catch (error) {
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
            if (error instanceof Error && error.name === "AbortError") {
              const apiError = new Error("Request timeout");
              apiError.status = 408;
              throw apiError;
            }
            throw error;
          }
        });
      }
      /**
       * Make GET request
       */
      async get(path, params, options) {
        return this.requestRaw({
          id: this.generateRequestId(),
          method: "GET",
          path,
          url: this.buildURL(path, params),
          params,
          ...options
        });
      }
      /**
       * Make POST request
       */
      async post(path, body, options) {
        return this.requestRaw({
          id: this.generateRequestId(),
          method: "POST",
          path,
          url: this.buildURL(path),
          body,
          ...options
        });
      }
      /**
       * Make PUT request
       */
      async put(path, body, options) {
        return this.requestRaw({
          id: this.generateRequestId(),
          method: "PUT",
          path,
          url: this.buildURL(path),
          body,
          ...options
        });
      }
      /**
       * Make DELETE request
       */
      async delete(path, options) {
        return this.requestRaw({
          id: this.generateRequestId(),
          method: "DELETE",
          path,
          url: this.buildURL(path),
          ...options
        });
      }
      /**
       * Make PATCH request
       */
      async patch(path, body, options) {
        return this.requestRaw({
          id: this.generateRequestId(),
          method: "PATCH",
          path,
          url: this.buildURL(path),
          body,
          ...options
        });
      }
      /**
       * Build full URL from path and params
       */
      buildURL(path, params) {
        if (path.startsWith("http://") || path.startsWith("https://")) {
          const url2 = new URL(path);
          if (params) {
            Object.entries(params).forEach(([key2, value]) => {
              if (value !== void 0 && value !== null) {
                url2.searchParams.set(key2, String(value));
              }
            });
          }
          return url2.toString();
        }
        const base = this.baseURL.endsWith("/") ? this.baseURL.slice(0, -1) : this.baseURL;
        const cleanPath = path.startsWith("/") ? path : `/${path}`;
        const fullPath = base + cleanPath;
        const url = base.startsWith("http://") || base.startsWith("https://") ? new URL(fullPath) : typeof window !== "undefined" ? new URL(fullPath, window.location.origin) : new URL(fullPath, "https://localhost");
        if (params) {
          Object.entries(params).forEach(([key2, value]) => {
            if (value !== void 0 && value !== null) {
              url.searchParams.set(key2, String(value));
            }
          });
        }
        if (!this.baseURL) {
          return url.pathname + url.search;
        }
        return url.toString();
      }
      /**
       * Generate unique request ID
       */
      generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      }
      /**
       * Update configuration
       */
      configure(config) {
        Object.assign(this.config, config);
        return this;
      }
      /**
       * Get current configuration
       */
      getConfig() {
        return { ...this.config };
      }
    };
  }
});

// ../../src/core/api/request/deduplicator.ts
var RequestDeduplicator;
var init_deduplicator = __esm({
  "../../src/core/api/request/deduplicator.ts"() {
    "use strict";
    RequestDeduplicator = class {
      constructor(maxAge = 5e3) {
        this.pendingRequests = /* @__PURE__ */ new Map();
        this.maxAge = maxAge;
      }
      static {
        __name(this, "RequestDeduplicator");
      }
      /**
       * Generate cache key for request
       */
      getKey(request) {
        const parts = [
          request.method,
          request.path || request.url,
          JSON.stringify(request.params || {})
        ];
        if (request.body && ["POST", "PUT", "PATCH"].includes(request.method)) {
          const bodyStr = typeof request.body === "string" ? request.body : JSON.stringify(request.body);
          parts.push(this.hashString(bodyStr));
        }
        return parts.join("|");
      }
      /**
       * Simple string hash function
       */
      hashString(str) {
        let hash2 = 0;
        for (let i = 0; i < str.length; i++) {
          const char = str.charCodeAt(i);
          hash2 = (hash2 << 5) - hash2 + char;
          hash2 = hash2 & hash2;
        }
        return Math.abs(hash2).toString(36);
      }
      /**
       * Check if request is pending and return existing promise
       */
      getPending(key2) {
        const pending2 = this.pendingRequests.get(key2);
        if (!pending2) {
          return null;
        }
        if (Date.now() - pending2.timestamp > this.maxAge) {
          this.pendingRequests.delete(key2);
          return null;
        }
        return pending2.promise;
      }
      /**
       * Register pending request
       */
      register(key2, request, promise) {
        this.pendingRequests.set(key2, {
          request,
          promise,
          timestamp: Date.now()
        });
        promise.finally(() => {
          this.pendingRequests.delete(key2);
        }).catch(() => {
        });
      }
      /**
       * Deduplicate request - return existing promise if available, otherwise execute
       */
      async deduplicate(request, executor) {
        const key2 = this.getKey(request);
        const pending2 = this.getPending(key2);
        if (pending2) {
          return pending2;
        }
        const promise = executor();
        this.register(key2, request, promise);
        return promise;
      }
      /**
       * Clear all pending requests
       */
      clear() {
        this.pendingRequests.clear();
      }
      /**
       * Get number of pending requests
       */
      getPendingCount() {
        return this.pendingRequests.size;
      }
    };
  }
});

// ../../src/core/api/request/priority.ts
function comparePriority(a, b) {
  return PRIORITY_ORDER[a] - PRIORITY_ORDER[b];
}
function getDefaultPriority() {
  return "normal";
}
function isHigherPriority(a, b) {
  return PRIORITY_ORDER[a] < PRIORITY_ORDER[b];
}
var PRIORITY_ORDER;
var init_priority = __esm({
  "../../src/core/api/request/priority.ts"() {
    "use strict";
    PRIORITY_ORDER = {
      critical: 0,
      high: 1,
      normal: 2,
      low: 3
    };
    __name(comparePriority, "comparePriority");
    __name(getDefaultPriority, "getDefaultPriority");
    __name(isHigherPriority, "isHigherPriority");
  }
});

// ../../src/core/api/request/queue.ts
var RequestQueue;
var init_queue = __esm({
  "../../src/core/api/request/queue.ts"() {
    "use strict";
    init_priority();
    RequestQueue = class {
      constructor(config = {}) {
        this.queue = [];
        this.running = /* @__PURE__ */ new Set();
        this.processing = false;
        this.config = {
          maxConcurrent: config.maxConcurrent || 6,
          defaultPriority: config.defaultPriority || "normal",
          maxQueueSize: config.maxQueueSize || 100
        };
      }
      static {
        __name(this, "RequestQueue");
      }
      /**
       * Enqueue request
       */
      enqueue(request, executor) {
        return new Promise((resolve, reject) => {
          if (this.queue.length >= this.config.maxQueueSize) {
            reject(new Error("Request queue is full"));
            return;
          }
          const priority = request.priority || this.config.defaultPriority;
          const queuedRequest = {
            request,
            resolve,
            reject,
            priority,
            timestamp: Date.now(),
            executor
            // Store executor for later execution
          };
          this.insertByPriority(queuedRequest);
          this.process();
        });
      }
      /**
       * Insert request in priority order
       */
      insertByPriority(queuedRequest) {
        const priority = queuedRequest.priority;
        let insertIndex = this.queue.length;
        for (let i = 0; i < this.queue.length; i++) {
          if (comparePriority(priority, this.queue[i].priority) < 0) {
            insertIndex = i;
            break;
          }
        }
        this.queue.splice(insertIndex, 0, queuedRequest);
      }
      /**
       * Process queue
       */
      async process() {
        if (this.processing) {
          return;
        }
        this.processing = true;
        while (this.queue.length > 0 && this.running.size < this.config.maxConcurrent) {
          const queuedRequest = this.queue.shift();
          if (!queuedRequest) {
            break;
          }
          this.executeRequest(queuedRequest);
        }
        this.processing = false;
      }
      /**
       * Execute queued request
       */
      async executeRequest(queuedRequest) {
        const requestId = queuedRequest.request.id;
        this.running.add(requestId);
        try {
          const executor = queuedRequest.executor;
          if (!executor) {
            throw new Error("No executor provided for queued request");
          }
          const response = await executor();
          queuedRequest.resolve(response);
        } catch (error) {
          queuedRequest.reject(error);
        } finally {
          this.running.delete(requestId);
          this.process();
        }
      }
      /**
       * Execute request with executor
       */
      async execute(queuedRequest, executor) {
        const requestId = queuedRequest.request.id;
        this.running.add(requestId);
        try {
          const response = await executor();
          queuedRequest.resolve(response);
        } catch (error) {
          queuedRequest.reject(error);
        } finally {
          this.running.delete(requestId);
          this.process();
        }
      }
      /**
       * Get queue size
       */
      getQueueSize() {
        return this.queue.length;
      }
      /**
       * Get running count
       */
      getRunningCount() {
        return this.running.size;
      }
      /**
       * Clear queue
       */
      clear() {
        for (const queuedRequest of this.queue) {
          queuedRequest.reject(new Error("Queue cleared"));
        }
        this.queue = [];
      }
      /**
       * Check if queue has space
       */
      hasSpace() {
        return this.queue.length < this.config.maxQueueSize;
      }
      /**
       * Check if can process more requests
       */
      canProcess() {
        return this.running.size < this.config.maxConcurrent;
      }
    };
  }
});

// ../../src/core/api/request/cancellation.ts
var CancellationManager;
var init_cancellation = __esm({
  "../../src/core/api/request/cancellation.ts"() {
    "use strict";
    CancellationManager = class {
      constructor() {
        this.controllers = /* @__PURE__ */ new Map();
      }
      static {
        __name(this, "CancellationManager");
      }
      /**
       * Create or get AbortController for request
       */
      getController(requestId) {
        let controller = this.controllers.get(requestId);
        if (!controller) {
          controller = new AbortController();
          this.controllers.set(requestId, controller);
        }
        return controller;
      }
      /**
       * Cancel request
       */
      cancel(requestId) {
        const controller = this.controllers.get(requestId);
        if (controller) {
          controller.abort();
          this.controllers.delete(requestId);
          return true;
        }
        return false;
      }
      /**
       * Cancel all requests
       */
      cancelAll() {
        for (const [_requestId, controller] of this.controllers) {
          controller.abort();
        }
        this.controllers.clear();
      }
      /**
       * Clean up controller (called when request completes)
       */
      cleanup(requestId) {
        this.controllers.delete(requestId);
      }
      /**
       * Check if request is cancelled
       */
      isCancelled(requestId) {
        const controller = this.controllers.get(requestId);
        return controller?.signal.aborted ?? false;
      }
      /**
       * Get signal for request
       */
      getSignal(requestId) {
        return this.controllers.get(requestId)?.signal;
      }
    };
  }
});

// ../../src/core/api/resilience/retry.ts
var RetryManager;
var init_retry = __esm({
  "../../src/core/api/resilience/retry.ts"() {
    "use strict";
    init_response_handler();
    RetryManager = class {
      static {
        __name(this, "RetryManager");
      }
      constructor(config = {}) {
        this.config = {
          maxAttempts: config.maxAttempts || 3,
          backoff: config.backoff || "exponential",
          initialDelay: config.initialDelay || 1e3,
          maxDelay: config.maxDelay || 1e4,
          retryableErrors: config.retryableErrors || [408, 429, 500, 502, 503, 504],
          retryable: config.retryable || ((error) => {
            if (error.status) {
              return config.retryableErrors?.includes(error.status) ?? false;
            }
            return isRetryableError(error.status);
          })
        };
      }
      /**
       * Calculate delay for retry attempt
       */
      calculateDelay(attempt, retryAfter) {
        if (retryAfter) {
          return Math.min(retryAfter, this.config.maxDelay);
        }
        let delay;
        switch (this.config.backoff) {
          case "exponential":
            delay = this.config.initialDelay * Math.pow(2, attempt - 1);
            break;
          case "linear":
            delay = this.config.initialDelay * attempt;
            break;
          case "fixed":
            delay = this.config.initialDelay;
            break;
          default:
            delay = this.config.initialDelay;
        }
        return Math.min(delay, this.config.maxDelay);
      }
      /**
       * Check if error is retryable
       */
      isRetryable(error) {
        return this.config.retryable(error);
      }
      /**
       * Execute request with retry logic
       */
      async execute(_request, executor) {
        const state2 = {
          attempt: 0
        };
        let lastError;
        while (state2.attempt < this.config.maxAttempts) {
          state2.attempt++;
          try {
            const response = await executor();
            return response;
          } catch (error) {
            lastError = error;
            if (!this.isRetryable(lastError)) {
              throw lastError;
            }
            if (state2.attempt >= this.config.maxAttempts) {
              throw lastError;
            }
            const delay = this.calculateDelay(state2.attempt, lastError.retryAfter);
            state2.lastError = lastError;
            state2.nextRetryAt = Date.now() + delay;
            await this.delay(delay);
          }
        }
        throw lastError || new Error("Request failed after retries");
      }
      /**
       * Delay helper
       */
      delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
      }
      /**
       * Update configuration
       */
      configure(config) {
        Object.assign(this.config, config);
      }
      /**
       * Get current configuration
       */
      getConfig() {
        return { ...this.config };
      }
    };
  }
});

// ../../src/core/api/resilience/circuit-breaker.ts
var CircuitBreaker;
var init_circuit_breaker = __esm({
  "../../src/core/api/resilience/circuit-breaker.ts"() {
    "use strict";
    CircuitBreaker = class {
      constructor(config = {}) {
        this.successCount = 0;
        this.config = {
          failureThreshold: config.failureThreshold || 5,
          resetTimeout: config.resetTimeout || 6e4,
          // 1 minute
          monitoringPeriod: config.monitoringPeriod || 6e4
          // 1 minute
        };
        this.state = {
          state: "closed",
          failures: 0
        };
      }
      static {
        __name(this, "CircuitBreaker");
      }
      /**
       * Execute function with circuit breaker protection
       */
      async execute(fn, _key) {
        if (this.state.state === "open") {
          if (this.shouldAttemptReset()) {
            this.state.state = "half-open";
            this.successCount = 0;
          } else {
            throw new Error("Circuit breaker is open");
          }
        }
        try {
          const result = await fn();
          this.onSuccess();
          return result;
        } catch (error) {
          this.onFailure();
          throw error;
        }
      }
      /**
       * Handle successful request
       */
      onSuccess() {
        if (this.state.state === "half-open") {
          this.successCount++;
          if (this.successCount >= 2) {
            this.state.state = "closed";
            this.state.failures = 0;
            this.state.lastFailureTime = void 0;
            this.state.nextAttemptTime = void 0;
          }
        } else {
          this.state.failures = 0;
        }
      }
      /**
       * Handle failed request
       */
      onFailure() {
        this.state.failures++;
        this.state.lastFailureTime = Date.now();
        if (this.state.state === "half-open") {
          this.state.state = "open";
          this.state.nextAttemptTime = Date.now() + this.config.resetTimeout;
        } else if (this.state.failures >= this.config.failureThreshold) {
          this.state.state = "open";
          this.state.nextAttemptTime = Date.now() + this.config.resetTimeout;
        }
      }
      /**
       * Check if we should attempt to reset
       */
      shouldAttemptReset() {
        if (!this.state.nextAttemptTime) {
          return true;
        }
        return Date.now() >= this.state.nextAttemptTime;
      }
      /**
       * Get current state
       */
      getState() {
        return { ...this.state };
      }
      /**
       * Manually reset circuit breaker
       */
      reset() {
        this.state = {
          state: "closed",
          failures: 0
        };
        this.successCount = 0;
      }
      /**
       * Manually open circuit breaker
       */
      open() {
        this.state.state = "open";
        this.state.nextAttemptTime = Date.now() + this.config.resetTimeout;
      }
      /**
       * Check if circuit is open
       */
      isOpen() {
        return this.state.state === "open";
      }
      /**
       * Check if circuit is half-open
       */
      isHalfOpen() {
        return this.state.state === "half-open";
      }
      /**
       * Check if circuit is closed
       */
      isClosed() {
        return this.state.state === "closed";
      }
    };
  }
});

// ../../src/core/api/resilience/offline.ts
var OfflineQueue;
var init_offline = __esm({
  "../../src/core/api/resilience/offline.ts"() {
    "use strict";
    OfflineQueue = class {
      constructor(config = { enabled: false }) {
        this.queue = [];
        this.isOnline = true;
        this.syncListeners = [];
        this.config = {
          enabled: config.enabled ?? false,
          queueSize: config.queueSize || 100,
          syncOnReconnect: config.syncOnReconnect ?? true,
          retryOnReconnect: config.retryOnReconnect ?? true
        };
        if (typeof window !== "undefined") {
          window.addEventListener("online", this.handleOnline.bind(this));
          window.addEventListener("offline", this.handleOffline.bind(this));
          this.isOnline = navigator.onLine;
        }
      }
      static {
        __name(this, "OfflineQueue");
      }
      /**
       * Handle online event
       */
      handleOnline() {
        this.isOnline = true;
        if (this.config.syncOnReconnect) {
          this.sync();
        }
      }
      /**
       * Handle offline event
       */
      handleOffline() {
        this.isOnline = false;
      }
      /**
       * Check if currently online
       */
      isCurrentlyOnline() {
        return this.isOnline;
      }
      /**
       * Queue request for later execution
       */
      enqueue(request, executor) {
        return new Promise((resolve, reject) => {
          if (this.queue.length >= this.config.queueSize) {
            reject(new Error("Offline queue is full"));
            return;
          }
          const entry = {
            request,
            timestamp: Date.now(),
            retries: 0
          };
          this.queue.push(entry);
          entry.executor = executor;
          entry.resolve = resolve;
          entry.reject = reject;
          if (this.isOnline && this.config.retryOnReconnect) {
            this.processQueue();
          }
        });
      }
      /**
       * Process queued requests
       */
      async processQueue() {
        if (!this.isOnline || this.queue.length === 0) {
          return;
        }
        const entries = [...this.queue];
        this.queue = [];
        for (const entry of entries) {
          const executor = entry.executor;
          const resolve = entry.resolve;
          const reject = entry.reject;
          if (!executor) {
            continue;
          }
          try {
            const response = await executor();
            resolve(response);
          } catch (error) {
            entry.retries++;
            if (entry.retries < 3) {
              this.queue.push(entry);
            } else {
              reject(error);
            }
          }
        }
        this.syncListeners.forEach((listener) => listener());
      }
      /**
       * Sync queue (process all pending requests)
       */
      async sync() {
        await this.processQueue();
      }
      /**
       * Get queue size
       */
      getQueueSize() {
        return this.queue.length;
      }
      /**
       * Clear queue
       */
      clear() {
        for (const entry of this.queue) {
          const reject = entry.reject;
          if (reject) {
            reject(new Error("Offline queue cleared"));
          }
        }
        this.queue = [];
      }
      /**
       * Add sync listener
       */
      onSync(listener) {
        this.syncListeners.push(listener);
        return () => {
          const index2 = this.syncListeners.indexOf(listener);
          if (index2 > -1) {
            this.syncListeners.splice(index2, 1);
          }
        };
      }
      /**
       * Check if queue is enabled
       */
      isEnabled() {
        return this.config.enabled;
      }
    };
  }
});

// ../../src/core/api/cache/memory.ts
var MemoryCache;
var init_memory = __esm({
  "../../src/core/api/cache/memory.ts"() {
    "use strict";
    MemoryCache = class {
      constructor(maxSize = 1e3) {
        this.cache = /* @__PURE__ */ new Map();
        this.maxSize = maxSize;
      }
      static {
        __name(this, "MemoryCache");
      }
      /**
       * Get entry from cache
       */
      get(key2) {
        const entry = this.cache.get(key2);
        if (!entry) {
          return null;
        }
        const now = Date.now();
        if (now - entry.timestamp > entry.maxAge) {
          this.cache.delete(key2);
          return null;
        }
        if (now - entry.timestamp > entry.ttl) {
          return { ...entry, data: entry.data };
        }
        return { ...entry, data: entry.data };
      }
      /**
       * Set entry in cache
       */
      set(key2, data, config) {
        if (this.cache.size >= this.maxSize) {
          this.evictOldest();
        }
        const entry = {
          data,
          timestamp: Date.now(),
          ttl: config.ttl || 5 * 60 * 1e3,
          // Default 5 minutes
          maxAge: config.maxAge || 10 * 60 * 1e3,
          // Default 10 minutes
          tags: config.tags
        };
        this.cache.set(key2, entry);
      }
      /**
       * Delete entry from cache
       */
      delete(key2) {
        return this.cache.delete(key2);
      }
      /**
       * Clear all entries
       */
      clear() {
        this.cache.clear();
      }
      /**
       * Invalidate by tags
       */
      invalidateByTags(tags) {
        let count = 0;
        for (const [key2, entry] of this.cache) {
          if (entry.tags && entry.tags.some((tag2) => tags.includes(tag2))) {
            this.cache.delete(key2);
            count++;
          }
        }
        return count;
      }
      /**
       * Evict oldest entry
       */
      evictOldest() {
        let oldestKey = null;
        let oldestTime = Infinity;
        for (const [key2, entry] of this.cache) {
          if (entry.timestamp < oldestTime) {
            oldestTime = entry.timestamp;
            oldestKey = key2;
          }
        }
        if (oldestKey) {
          this.cache.delete(oldestKey);
        }
      }
      /**
       * Get cache size
       */
      size() {
        return this.cache.size;
      }
      /**
       * Check if key exists
       */
      has(key2) {
        return this.cache.has(key2);
      }
      /**
       * Get all keys
       */
      keys() {
        return Array.from(this.cache.keys());
      }
    };
  }
});

// ../../src/core/api/cache/indexeddb.ts
var DB_NAME, DB_VERSION, STORE_NAME, IndexedDBCache;
var init_indexeddb = __esm({
  "../../src/core/api/cache/indexeddb.ts"() {
    "use strict";
    DB_NAME = "strixun_api_cache";
    DB_VERSION = 1;
    STORE_NAME = "cache";
    IndexedDBCache = class {
      constructor() {
        this.db = null;
        this.initPromise = null;
        this.init();
      }
      static {
        __name(this, "IndexedDBCache");
      }
      /**
       * Initialize IndexedDB
       */
      async init() {
        if (this.initPromise) {
          return this.initPromise;
        }
        this.initPromise = new Promise((resolve, reject) => {
          if (typeof window === "undefined" || !window.indexedDB) {
            resolve();
            return;
          }
          const request = indexedDB.open(DB_NAME, DB_VERSION);
          request.onerror = () => {
            reject(new Error("Failed to open IndexedDB"));
          };
          request.onsuccess = () => {
            this.db = request.result;
            resolve();
          };
          request.onupgradeneeded = (event2) => {
            const db = event2.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
              db.createObjectStore(STORE_NAME);
            }
          };
        });
        return this.initPromise;
      }
      /**
       * Get entry from cache
       */
      async get(key2) {
        await this.init();
        if (!this.db) {
          return null;
        }
        return new Promise((resolve, reject) => {
          const transaction = this.db.transaction([STORE_NAME], "readonly");
          const store = transaction.objectStore(STORE_NAME);
          const request = store.get(key2);
          request.onerror = () => {
            reject(new Error("Failed to get from IndexedDB"));
          };
          request.onsuccess = () => {
            const entry = request.result;
            if (!entry) {
              resolve(null);
              return;
            }
            const now = Date.now();
            if (now - entry.timestamp > entry.maxAge) {
              this.delete(key2);
              resolve(null);
              return;
            }
            resolve(entry);
          };
        });
      }
      /**
       * Set entry in cache
       */
      async set(key2, data, config) {
        await this.init();
        if (!this.db) {
          return;
        }
        const entry = {
          data,
          timestamp: Date.now(),
          ttl: config.ttl || 5 * 60 * 1e3,
          maxAge: config.maxAge || 10 * 60 * 1e3,
          tags: config.tags
        };
        return new Promise((resolve, reject) => {
          const transaction = this.db.transaction([STORE_NAME], "readwrite");
          const store = transaction.objectStore(STORE_NAME);
          const request = store.put(entry, key2);
          request.onerror = () => {
            reject(new Error("Failed to set in IndexedDB"));
          };
          request.onsuccess = () => {
            resolve();
          };
        });
      }
      /**
       * Delete entry from cache
       */
      async delete(key2) {
        await this.init();
        if (!this.db) {
          return false;
        }
        return new Promise((resolve, reject) => {
          const transaction = this.db.transaction([STORE_NAME], "readwrite");
          const store = transaction.objectStore(STORE_NAME);
          const request = store.delete(key2);
          request.onerror = () => {
            reject(new Error("Failed to delete from IndexedDB"));
          };
          request.onsuccess = () => {
            resolve(true);
          };
        });
      }
      /**
       * Clear all entries
       */
      async clear() {
        await this.init();
        if (!this.db) {
          return;
        }
        return new Promise((resolve, reject) => {
          const transaction = this.db.transaction([STORE_NAME], "readwrite");
          const store = transaction.objectStore(STORE_NAME);
          const request = store.clear();
          request.onerror = () => {
            reject(new Error("Failed to clear IndexedDB"));
          };
          request.onsuccess = () => {
            resolve();
          };
        });
      }
      /**
       * Invalidate by tags (requires iterating all entries)
       */
      async invalidateByTags(tags) {
        await this.init();
        if (!this.db) {
          return 0;
        }
        return new Promise((resolve, reject) => {
          const transaction = this.db.transaction([STORE_NAME], "readwrite");
          const store = transaction.objectStore(STORE_NAME);
          const request = store.openCursor();
          let count = 0;
          request.onerror = () => {
            reject(new Error("Failed to invalidate by tags"));
          };
          request.onsuccess = (event2) => {
            const cursor = event2.target.result;
            if (cursor) {
              const entry = cursor.value;
              if (entry.tags && entry.tags.some((tag2) => tags.includes(tag2))) {
                cursor.delete();
                count++;
              }
              cursor.continue();
            } else {
              resolve(count);
            }
          };
        });
      }
    };
  }
});

// ../../src/core/api/cache/strategies.ts
var CacheManager;
var init_strategies = __esm({
  "../../src/core/api/cache/strategies.ts"() {
    "use strict";
    init_memory();
    init_indexeddb();
    CacheManager = class {
      static {
        __name(this, "CacheManager");
      }
      constructor(enabled = true) {
        this.enabled = enabled;
        this.memoryCache = new MemoryCache();
        this.indexedDBCache = new IndexedDBCache();
      }
      /**
       * Generate cache key from request
       */
      getCacheKey(request, config) {
        if (config?.key) {
          return config.key;
        }
        const parts = [
          request.method,
          request.path || request.url,
          JSON.stringify(request.params || {})
        ];
        return parts.join("|");
      }
      /**
       * Get from cache
       */
      async get(request, config) {
        if (!this.enabled || !config) {
          return null;
        }
        const key2 = this.getCacheKey(request, config);
        const memoryEntry = this.memoryCache.get(key2);
        if (memoryEntry) {
          return { ...memoryEntry.data, cached: true };
        }
        const dbEntry = await this.indexedDBCache.get(key2);
        if (dbEntry) {
          this.memoryCache.set(key2, dbEntry.data, config);
          return { ...dbEntry.data, cached: true };
        }
        return null;
      }
      /**
       * Set in cache
       */
      async set(request, response, config) {
        if (!this.enabled || !config) {
          return;
        }
        const key2 = this.getCacheKey(request, config);
        this.memoryCache.set(key2, response, config);
        await this.indexedDBCache.set(key2, response, config);
      }
      /**
       * Invalidate cache
       */
      async invalidate(request, config) {
        const key2 = this.getCacheKey(request, config);
        this.memoryCache.delete(key2);
        await this.indexedDBCache.delete(key2);
      }
      /**
       * Invalidate by tags
       */
      async invalidateByTags(tags) {
        const memoryCount = this.memoryCache.invalidateByTags(tags);
        const dbCount = await this.indexedDBCache.invalidateByTags(tags);
        return memoryCount + dbCount;
      }
      /**
       * Clear all cache
       */
      async clear() {
        this.memoryCache.clear();
        await this.indexedDBCache.clear();
      }
      /**
       * Execute with cache strategy
       */
      async execute(request, executor, config) {
        if (!this.enabled || !config) {
          return executor();
        }
        const strategy = config.strategy || "network-first";
        const cached = await this.get(request, config);
        switch (strategy) {
          case "cache-first":
            if (cached) {
              return cached;
            }
            const response1 = await executor();
            await this.set(request, response1, config);
            return response1;
          case "network-first":
            try {
              const response2 = await executor();
              await this.set(request, response2, config);
              return response2;
            } catch (error) {
              if (cached) {
                return cached;
              }
              throw error;
            }
          case "stale-while-revalidate":
            if (cached) {
              executor().then((response) => this.set(request, response, config)).catch(() => {
              });
              return cached;
            }
            const response3 = await executor();
            await this.set(request, response3, config);
            return response3;
          case "cache-only":
            if (cached) {
              return cached;
            }
            throw new Error("Cache miss and cache-only strategy");
          case "network-only":
            const response4 = await executor();
            await this.set(request, response4, config);
            return response4;
          default:
            return executor();
        }
      }
    };
  }
});

// ../../src/core/api/optimistic/updates.ts
var OptimisticUpdateManager;
var init_updates = __esm({
  "../../src/core/api/optimistic/updates.ts"() {
    "use strict";
    OptimisticUpdateManager = class {
      static {
        __name(this, "OptimisticUpdateManager");
      }
      /**
       * Execute request with optimistic update
       */
      async execute(_request, executor, config) {
        try {
          const response = await executor();
          if (config.onSuccess) {
            await config.onSuccess(response);
          }
          return response;
        } catch (error) {
          if (config.rollback) {
            await config.rollback(error);
          }
          throw error;
        }
      }
      /**
       * Create optimistic update config
       */
      createConfig(data, options) {
        return {
          data,
          rollback: options?.rollback,
          onSuccess: options?.onSuccess
        };
      }
    };
  }
});

// ../../src/core/api/plugins/logging.ts
function createLoggingPlugin(config = {}) {
  const {
    enabled = true,
    logRequests = true,
    logResponses = true,
    logErrors = true
  } = config;
  const middleware = /* @__PURE__ */ __name(async (request, next2) => {
    if (!enabled) {
      return next2(request);
    }
    const startTime = Date.now();
    if (logRequests) {
      console.log(`[API] ${request.method} ${request.path || request.url}`, {
        params: request.params,
        body: request.body,
        headers: request.headers
      });
    }
    try {
      const response = await next2(request);
      const duration = Date.now() - startTime;
      if (logResponses) {
        console.log(`[API] ${request.method} ${request.path || request.url} ${response.status} (${duration}ms)`, {
          data: response.data,
          cached: response.cached
        });
      }
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      if (logErrors) {
        console.error(`[API] ${request.method} ${request.path || request.url} ERROR (${duration}ms)`, error);
      }
      throw error;
    }
  }, "middleware");
  return {
    name: "logging",
    version: "1.0.0",
    middleware
  };
}
var init_logging = __esm({
  "../../src/core/api/plugins/logging.ts"() {
    "use strict";
    __name(createLoggingPlugin, "createLoggingPlugin");
  }
});

// ../../src/core/api/plugins/metrics.ts
function createMetricsPlugin(config = {}) {
  const { enabled = true, onMetric } = config;
  const middleware = /* @__PURE__ */ __name(async (request, next2) => {
    if (!enabled) {
      return next2(request);
    }
    const startTime = Date.now();
    const startMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
    try {
      const response = await next2(request);
      const duration = Date.now() - startTime;
      const endMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
      const memoryDelta = endMemory - startMemory;
      if (onMetric) {
        onMetric({
          name: "api.request.duration",
          value: duration,
          tags: {
            method: request.method,
            path: request.path || request.url || "",
            status: String(response.status)
          },
          timestamp: Date.now()
        });
        onMetric({
          name: "api.request.memory",
          value: memoryDelta,
          tags: {
            method: request.method,
            path: request.path || request.url || ""
          },
          timestamp: Date.now()
        });
      }
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      if (onMetric) {
        onMetric({
          name: "api.request.error",
          value: duration,
          tags: {
            method: request.method,
            path: request.path || request.url || "",
            error: error instanceof Error ? error.message : "Unknown"
          },
          timestamp: Date.now()
        });
      }
      throw error;
    }
  }, "middleware");
  return {
    name: "metrics",
    version: "1.0.0",
    middleware
  };
}
var init_metrics = __esm({
  "../../src/core/api/plugins/metrics.ts"() {
    "use strict";
    __name(createMetricsPlugin, "createMetricsPlugin");
  }
});

// ../../src/core/api/plugins/analytics.ts
function createAnalyticsPlugin(config = {}) {
  const { enabled = true, trackEvent } = config;
  const middleware = /* @__PURE__ */ __name(async (request, next2) => {
    if (!enabled || !trackEvent) {
      return next2(request);
    }
    const startTime = Date.now();
    try {
      const response = await next2(request);
      const duration = Date.now() - startTime;
      trackEvent("api_request", {
        method: request.method,
        path: request.path || request.url,
        status: response.status,
        duration,
        cached: response.cached
      });
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      trackEvent("api_request_error", {
        method: request.method,
        path: request.path || request.url,
        error: error instanceof Error ? error.message : "Unknown",
        duration
      });
      throw error;
    }
  }, "middleware");
  return {
    name: "analytics",
    version: "1.0.0",
    middleware
  };
}
var init_analytics = __esm({
  "../../src/core/api/plugins/analytics.ts"() {
    "use strict";
    __name(createAnalyticsPlugin, "createAnalyticsPlugin");
  }
});

// ../../src/core/api/plugins/index.ts
var PluginManager;
var init_plugins = __esm({
  "../../src/core/api/plugins/index.ts"() {
    "use strict";
    init_logging();
    init_metrics();
    init_analytics();
    PluginManager = class {
      constructor() {
        this.plugins = /* @__PURE__ */ new Map();
      }
      static {
        __name(this, "PluginManager");
      }
      /**
       * Register plugin
       */
      register(plugin) {
        if (this.plugins.has(plugin.name)) {
          console.warn(`Plugin ${plugin.name} is already registered`);
          return;
        }
        this.plugins.set(plugin.name, plugin);
      }
      /**
       * Unregister plugin
       */
      unregister(name) {
        const plugin = this.plugins.get(name);
        if (plugin?.teardown) {
          plugin.teardown();
        }
        this.plugins.delete(name);
      }
      /**
       * Setup all plugins
       */
      setup(client) {
        for (const plugin of this.plugins.values()) {
          if (plugin.setup) {
            plugin.setup(client);
          }
        }
      }
      /**
       * Teardown all plugins
       */
      teardown() {
        for (const plugin of this.plugins.values()) {
          if (plugin.teardown) {
            plugin.teardown();
          }
        }
      }
      /**
       * Get plugin
       */
      get(name) {
        return this.plugins.get(name);
      }
      /**
       * Get all plugins
       */
      getAll() {
        return Array.from(this.plugins.values());
      }
    };
  }
});

// ../../src/core/api/enhanced-client.ts
var EnhancedAPIClient;
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
    EnhancedAPIClient = class extends APIClient {
      static {
        __name(this, "EnhancedAPIClient");
      }
      constructor(config = {}) {
        super(config);
        this.deduplicator = new RequestDeduplicator();
        this.queue = new RequestQueue({
          maxConcurrent: 6,
          defaultPriority: "normal"
        });
        this.cancellationManager = new CancellationManager();
        this.retryManager = new RetryManager(config.retry);
        this.circuitBreaker = new CircuitBreaker({
          failureThreshold: 5,
          resetTimeout: 6e4
        });
        this.offlineQueue = new OfflineQueue(config.offline);
        this.cacheManager = new CacheManager(config.cache?.enabled ?? true);
        this.optimisticManager = new OptimisticUpdateManager();
        if (config.plugins === void 0 || config.plugins.length === 0) {
          this.use(createLoggingPlugin({ enabled: true }).middleware);
          this.use(createMetricsPlugin({ enabled: true }).middleware);
        }
      }
      /**
       * Make request with all features integrated
       */
      async requestRaw(request) {
        console.log("[EnhancedAPIClient] requestRaw called:", { method: request.method, path: request.path, url: request.url });
        const controller = this.cancellationManager.getController(request.id);
        request.signal = request.signal || controller.signal;
        if (request.cache) {
          console.log("[EnhancedAPIClient] Checking cache...");
          const cached = await this.cacheManager.get(request, request.cache);
          if (cached) {
            console.log("[EnhancedAPIClient] Cache hit, returning cached response");
            return cached;
          }
          console.log("[EnhancedAPIClient] Cache miss");
        }
        console.log("[EnhancedAPIClient] Starting request pipeline...");
        try {
          return this.deduplicator.deduplicate(request, async () => {
            console.log("[EnhancedAPIClient] Deduplicator passed, enqueueing...");
            return this.queue.enqueue(request, async () => {
              console.log("[EnhancedAPIClient] Queue passed, executing circuit breaker...");
              return this.circuitBreaker.execute(async () => {
                console.log("[EnhancedAPIClient] Circuit breaker passed, executing retry manager...");
                return this.retryManager.execute(request, async () => {
                  if (this.offlineQueue.isEnabled() && !this.offlineQueue.isCurrentlyOnline()) {
                    console.log("[EnhancedAPIClient] Offline, queuing request...");
                    return this.offlineQueue.enqueue(request, async () => {
                      return super.requestRaw(request);
                    });
                  }
                  console.log("[EnhancedAPIClient] Executing actual request...");
                  const response = await super.requestRaw(request);
                  console.log("[EnhancedAPIClient] Request completed, status:", response.status);
                  if (request.cache) {
                    await this.cacheManager.set(request, response, request.cache);
                  }
                  this.cancellationManager.cleanup(request.id);
                  return response;
                });
              });
            });
          });
        } catch (error) {
          console.error("[EnhancedAPIClient] Error in request pipeline:", error);
          throw error;
        }
      }
      /**
       * Make GET request with caching
       */
      async getCached(path, params, cacheConfig, options) {
        const cache = cacheConfig ? {
          strategy: cacheConfig.defaultStrategy || "stale-while-revalidate",
          ttl: cacheConfig.defaultTTL || 5 * 60 * 1e3,
          maxAge: (cacheConfig.defaultTTL || 5 * 60 * 1e3) * 2
        } : {
          strategy: "stale-while-revalidate",
          ttl: 5 * 60 * 1e3,
          maxAge: 10 * 60 * 1e3
        };
        return this.get(path, params, {
          ...options,
          cache
        });
      }
      /**
       * Make request with optimistic update
       */
      async requestOptimistic(request, config) {
        return this.optimisticManager.execute(request, async () => {
          return this.requestRaw(request);
        }, config);
      }
      /**
       * Cancel request
       */
      cancel(requestId) {
        return this.cancellationManager.cancel(requestId);
      }
      /**
       * Cancel all requests
       */
      cancelAll() {
        this.cancellationManager.cancelAll();
      }
      /**
       * Invalidate cache
       */
      async invalidateCache(path, params) {
        const request = {
          id: this.generateRequestId(),
          method: "GET",
          url: path,
          path,
          params
        };
        await this.cacheManager.invalidate(request);
      }
      /**
       * Invalidate cache by tags
       */
      async invalidateCacheByTags(tags) {
        return this.cacheManager.invalidateByTags(tags);
      }
      /**
       * Clear all cache
       */
      async clearCache() {
        await this.cacheManager.clear();
      }
      /**
       * Get cache statistics
       */
      getCacheStats() {
        return {
          memorySize: this.cacheManager.memoryCache.size(),
          queueSize: this.queue.getQueueSize(),
          runningCount: this.queue.getRunningCount()
        };
      }
      /**
       * Generate request ID (override to use cancellation manager)
       */
      generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      }
    };
  }
});

// ../shared/encryption/jwt-encryption.ts
var jwt_encryption_exports = {};
__export(jwt_encryption_exports, {
  decryptWithJWT: () => decryptWithJWT,
  encryptWithJWT: () => encryptWithJWT
});
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
function createE2EEncryptionMiddleware(config) {
  return async (request, next2) => {
    if (!config.enabled) {
      return await next2(request);
    }
    const token2 = await config.tokenGetter();
    if (!token2) {
      return await next2(request);
    }
    const response = await next2(request);
    const shouldEncrypt = config.encryptCondition ? config.encryptCondition(request, response) : true;
    if (!shouldEncrypt || response.status >= 400) {
      return response;
    }
    try {
      const contentType = response.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        return response;
      }
      const data = response.data;
      const { encryptWithJWT: encryptWithJWT2 } = await Promise.resolve().then(() => (init_jwt_encryption(), jwt_encryption_exports));
      const encrypted = await encryptWithJWT2(data, token2);
      const headers = new Headers(response.headers);
      headers.set("Content-Type", "application/json");
      headers.set("X-Encrypted", "true");
      return {
        ...response,
        data: encrypted,
        headers
      };
    } catch (error) {
      console.error("E2E encryption failed:", error);
      return response;
    }
  };
}
var init_jwt_encryption2 = __esm({
  "../../src/core/api/enhanced/encryption/jwt-encryption.ts"() {
    "use strict";
    init_jwt_encryption();
    __name(createE2EEncryptionMiddleware, "createE2EEncryptionMiddleware");
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
function parseFilteringParams(request) {
  const url = new URL(request.url || `http://localhost${request.path}`);
  const params = {};
  const includeParam = url.searchParams.get("include");
  if (includeParam) {
    params.include = includeParam.split(",").map((s) => s.trim());
  }
  const excludeParam = url.searchParams.get("exclude");
  if (excludeParam) {
    params.exclude = excludeParam.split(",").map((s) => s.trim());
  }
  const tagsParam = url.searchParams.get("tags");
  if (tagsParam) {
    params.tags = tagsParam.split(",").map((s) => s.trim());
  }
  return params;
}
function getTagFields(tag2, config) {
  return config.tags[tag2] || [];
}
function filterObject(obj, includePaths, excludePaths) {
  if (!obj || typeof obj !== "object") {
    return obj;
  }
  const result = {};
  const includeSet = new Set(includePaths);
  const excludeSet = new Set(excludePaths);
  for (const key2 in obj) {
    if (excludeSet.has(key2)) {
      continue;
    }
    if (includePaths.length === 0 || includeSet.has(key2)) {
      result[key2] = obj[key2];
    }
  }
  return result;
}
function getTypeDefinition(request, config) {
  const path = request.path || new URL(request.url || "").pathname;
  for (const [typeName, typeDef] of config.typeDefinitions.entries()) {
    if (path.includes(typeName.toLowerCase()) || path.includes(typeName)) {
      return typeDef;
    }
  }
  return null;
}
function applyFiltering(data, params, config, typeDef) {
  const alwaysInclude = config.rootConfig.alwaysInclude;
  const defaultInclude = config.rootConfig.defaultInclude || [];
  let includePaths = [...alwaysInclude];
  if (!params.include || params.include.length === 0) {
    includePaths.push(...defaultInclude);
  } else {
    includePaths.push(...params.include);
  }
  if (params.tags) {
    for (const tag2 of params.tags) {
      const tagFields = getTagFields(tag2, config);
      includePaths.push(...tagFields);
    }
  }
  if (typeDef) {
    includePaths.push(...typeDef.required);
    if (params.include) {
      for (const field of params.include) {
        if (typeDef.optional.includes(field)) {
          includePaths.push(field);
        }
      }
    }
  }
  includePaths = [...new Set(includePaths)];
  const excludePaths = params.exclude || [];
  return filterObject(data, includePaths, excludePaths);
}
function createResponseFilterMiddleware(config) {
  return async (request, next2) => {
    const response = await next2(request);
    if (response.status >= 400) {
      return response;
    }
    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return response;
    }
    try {
      const data = response.data;
      const params = parseFilteringParams(request);
      const typeDef = getTypeDefinition(request, config);
      const filteredData = applyFiltering(data, params, config, typeDef || void 0);
      return {
        ...response,
        data: filteredData
      };
    } catch (error) {
      console.error("Response filtering failed:", error);
      return response;
    }
  };
}
var init_response_filter = __esm({
  "../../src/core/api/enhanced/filtering/response-filter.ts"() {
    "use strict";
    __name(parseFilteringParams, "parseFilteringParams");
    __name(getTagFields, "getTagFields");
    __name(filterObject, "filterObject");
    __name(getTypeDefinition, "getTypeDefinition");
    __name(applyFiltering, "applyFiltering");
    __name(createResponseFilterMiddleware, "createResponseFilterMiddleware");
  }
});

// ../../src/core/api/enhanced/filtering/tag-system.ts
function registerTag(config, tag2, fieldPaths) {
  config.tags[tag2] = fieldPaths;
}
function getTagFields2(tags, config) {
  const fields = [];
  for (const tag2 of tags) {
    const tagFields = config.tags[tag2] || [];
    fields.push(...tagFields);
  }
  return [...new Set(fields)];
}
function initializeCommonTags(config) {
  for (const [tag2, fields] of Object.entries(COMMON_TAGS)) {
    registerTag(config, tag2, fields);
  }
}
var COMMON_TAGS;
var init_tag_system = __esm({
  "../../src/core/api/enhanced/filtering/tag-system.ts"() {
    "use strict";
    __name(registerTag, "registerTag");
    __name(getTagFields2, "getTagFields");
    COMMON_TAGS = {
      summary: ["id", "name", "title", "status"],
      detailed: ["*"],
      // All fields
      minimal: ["id"],
      public: ["id", "name", "title"],
      // Public-facing fields
      admin: ["*"]
      // All fields including sensitive
    };
    __name(initializeCommonTags, "initializeCommonTags");
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
function formatErrorAsRFC7807(request, error) {
  const status = error.status || 500;
  const title = getErrorTitle(status);
  const detail = error.message || "An error occurred";
  return createRFC7807Error(
    request,
    status,
    title,
    detail,
    {
      ...error.data && typeof error.data === "object" && error.data !== null ? error.data : {},
      retry_after: error.retryAfter,
      retryable: error.retryable
    }
  );
}
function getErrorTitle(status) {
  const titles = {
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    409: "Conflict",
    429: "Too Many Requests",
    500: "Internal Server Error",
    502: "Bad Gateway",
    503: "Service Unavailable",
    504: "Gateway Timeout"
  };
  return titles[status] || "Error";
}
function createRFC7807Response(request, error, headers) {
  const rfc7807Error = "type" in error ? error : formatErrorAsRFC7807(request, error);
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Content-Type", "application/problem+json");
  if (rfc7807Error.retry_after) {
    responseHeaders.set("Retry-After", rfc7807Error.retry_after.toString());
  }
  return new Response(
    JSON.stringify(rfc7807Error),
    {
      status: rfc7807Error.status,
      headers: responseHeaders
    }
  );
}
var init_rfc7807 = __esm({
  "../../src/core/api/enhanced/errors/rfc7807.ts"() {
    "use strict";
    __name(createRFC7807Error, "createRFC7807Error");
    __name(getErrorType, "getErrorType");
    __name(formatErrorAsRFC7807, "formatErrorAsRFC7807");
    __name(getErrorTitle, "getErrorTitle");
    __name(createRFC7807Response, "createRFC7807Response");
  }
});

// ../../shared-components/error-mapping/error-legend.ts
function getErrorInfo(code) {
  return ERROR_LEGEND[code] || {
    code,
    title: "Error",
    description: "An error occurred.",
    details: "An unexpected error occurred. Please try again.",
    suggestion: "If the problem persists, contact support."
  };
}
var ERROR_LEGEND;
var init_error_legend = __esm({
  "../../shared-components/error-mapping/error-legend.ts"() {
    "use strict";
    ERROR_LEGEND = {
      // Rate Limit Errors
      "rate_limit_exceeded": {
        code: "rate_limit_exceeded",
        title: "Rate Limit Exceeded",
        description: "Too many requests from your email address.",
        details: "You have exceeded the maximum number of OTP requests allowed per hour for this email address.",
        suggestion: "Please wait before requesting another OTP code."
      },
      "email_rate_limit_exceeded": {
        code: "email_rate_limit_exceeded",
        title: "Email Rate Limit Exceeded",
        description: "Too many OTP requests from this email address.",
        details: "You have exceeded the hourly limit for OTP requests from this email. The limit is dynamically adjusted based on your usage patterns.",
        suggestion: "Wait for the rate limit to reset before requesting another OTP."
      },
      "ip_rate_limit_exceeded": {
        code: "ip_rate_limit_exceeded",
        title: "IP Address Rate Limit Exceeded",
        description: "Too many requests from your IP address.",
        details: "Your IP address has exceeded the maximum number of requests allowed per hour. This limit applies to all requests from your network.",
        suggestion: "Wait for the rate limit to reset, or try from a different network if you need immediate access."
      },
      "daily_quota_exceeded": {
        code: "daily_quota_exceeded",
        title: "Daily Quota Exceeded",
        description: "You have reached your daily request limit.",
        details: "Your account has exceeded the maximum number of OTP requests allowed per day. This is a hard limit based on your plan.",
        suggestion: "Wait until tomorrow, or upgrade your plan for higher limits."
      },
      "monthly_quota_exceeded": {
        code: "monthly_quota_exceeded",
        title: "Monthly Quota Exceeded",
        description: "You have reached your monthly request limit.",
        details: "Your account has exceeded the maximum number of OTP requests allowed per month. This is a hard limit based on your plan.",
        suggestion: "Wait until next month, or upgrade your plan for higher limits."
      },
      "rate_limit_error": {
        code: "rate_limit_error",
        title: "Rate Limit System Error",
        description: "An error occurred while checking rate limits.",
        details: "The rate limiting system encountered an error. For security, the request was denied.",
        suggestion: "Please try again in a few moments. If the problem persists, contact support."
      },
      // Quota Errors
      "customer_not_found": {
        code: "customer_not_found",
        title: "Account Not Found",
        description: "Your customer account could not be found.",
        details: "The system could not locate your customer account. This may happen if your account was recently created or if there was a system error.",
        suggestion: "Try signing up again or contact support if the problem persists."
      },
      "max_users_exceeded": {
        code: "max_users_exceeded",
        title: "Maximum Users Exceeded",
        description: "Your account has reached the maximum number of users.",
        details: "Your plan has a limit on the number of users that can be created. You have reached this limit.",
        suggestion: "Upgrade your plan to support more users, or remove inactive users."
      },
      // OTP Verification Errors
      "invalid_otp": {
        code: "invalid_otp",
        title: "Invalid OTP Code",
        description: "The OTP code you entered is incorrect.",
        details: "The verification code does not match the one sent to your email, or it has expired.",
        suggestion: "Check your email for the correct code, or request a new one if it has expired."
      },
      "otp_expired": {
        code: "otp_expired",
        title: "OTP Code Expired",
        description: "The OTP code has expired.",
        details: "OTP codes are valid for 10 minutes. Your code has expired and can no longer be used.",
        suggestion: "Request a new OTP code to continue."
      },
      "otp_already_used": {
        code: "otp_already_used",
        title: "OTP Code Already Used",
        description: "This OTP code has already been used.",
        details: "Each OTP code can only be used once for security. This code was already used to verify your email.",
        suggestion: "Request a new OTP code if you need to verify again."
      },
      "max_attempts_exceeded": {
        code: "max_attempts_exceeded",
        title: "Maximum Attempts Exceeded",
        description: "Too many failed verification attempts.",
        details: "You have exceeded the maximum number of failed OTP verification attempts (5 attempts). This is a security measure to prevent brute force attacks.",
        suggestion: "Request a new OTP code to continue."
      },
      // Email Errors
      "email_send_failed": {
        code: "email_send_failed",
        title: "Email Send Failed",
        description: "Failed to send the OTP email.",
        details: "The system was unable to send the OTP code to your email address. This may be due to an invalid email address or a temporary email service issue.",
        suggestion: "Verify your email address is correct and try again. If the problem persists, contact support."
      },
      "invalid_email": {
        code: "invalid_email",
        title: "Invalid Email Address",
        description: "The email address format is invalid.",
        details: "The email address you provided does not match the required format.",
        suggestion: "Please enter a valid email address."
      },
      // Authentication Errors
      "authentication_required": {
        code: "authentication_required",
        title: "Authentication Required",
        description: "You must be authenticated to access this resource.",
        details: "Your session has expired or you are not logged in.",
        suggestion: "Please log in again to continue."
      },
      "token_expired": {
        code: "token_expired",
        title: "Token Expired",
        description: "Your authentication token has expired.",
        details: "JWT tokens are valid for 7 hours. Your token has expired and you need to log in again.",
        suggestion: "Please log in again to continue."
      },
      "invalid_token": {
        code: "invalid_token",
        title: "Invalid Token",
        description: "Your authentication token is invalid.",
        details: "The token provided is malformed or has been revoked.",
        suggestion: "Please log in again to get a new token."
      },
      // Network/System Errors
      "network_error": {
        code: "network_error",
        title: "Network Error",
        description: "A network error occurred.",
        details: "The request could not be completed due to a network issue. This may be due to connectivity problems or server unavailability.",
        suggestion: "Check your internet connection and try again."
      },
      "server_error": {
        code: "server_error",
        title: "Server Error",
        description: "An internal server error occurred.",
        details: "The server encountered an unexpected error while processing your request.",
        suggestion: "Please try again in a few moments. If the problem persists, contact support."
      },
      "service_unavailable": {
        code: "service_unavailable",
        title: "Service Unavailable",
        description: "The service is temporarily unavailable.",
        details: "The service is currently undergoing maintenance or is experiencing high load.",
        suggestion: "Please try again in a few moments."
      }
    };
    __name(getErrorInfo, "getErrorInfo");
  }
});

// ../../src/core/api/enhanced/errors/legend-integration.ts
function enhanceErrorWithLegend(error, request) {
  const errorCode = "code" in error ? error.code : error.status?.toString() || "500";
  const errorInfo = getErrorInfo(errorCode);
  if ("type" in error) {
    const rfc7807Error = error;
    return {
      ...rfc7807Error,
      title: errorInfo.title || rfc7807Error.title,
      detail: errorInfo.description || rfc7807Error.detail,
      error_code: errorCode,
      error_info: {
        details: errorInfo.details,
        suggestion: errorInfo.suggestion
      }
    };
  }
  const apiError = error;
  return {
    type: `https://tools.ietf.org/html/rfc7231#section-6.6.1`,
    title: errorInfo.title,
    status: apiError.status || 500,
    detail: errorInfo.description || apiError.message || "An error occurred",
    instance: request.url || request.path,
    error_code: errorCode,
    error_info: {
      details: errorInfo.details,
      suggestion: errorInfo.suggestion
    },
    ...apiError.data && typeof apiError.data === "object" && apiError.data !== null ? apiError.data : {}
  };
}
function createErrorLegendMiddleware(useErrorLegend = true) {
  return async (request, next2) => {
    try {
      return await next2(request);
    } catch (error) {
      if (!useErrorLegend) {
        throw error;
      }
      const enhancedError = enhanceErrorWithLegend(error, request);
      throw enhancedError;
    }
  };
}
var init_legend_integration = __esm({
  "../../src/core/api/enhanced/errors/legend-integration.ts"() {
    "use strict";
    init_error_legend();
    __name(enhanceErrorWithLegend, "enhanceErrorWithLegend");
    __name(createErrorLegendMiddleware, "createErrorLegendMiddleware");
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
function detectPlatform() {
  if (typeof caches !== "undefined" && typeof WebSocketPair !== "undefined") {
    return "cloudflare-worker";
  }
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    return "browser";
  }
  if (typeof process !== "undefined" && process.versions && process.versions.node) {
    return "node";
  }
  return "browser";
}
function isCloudflareWorker() {
  return detectPlatform() === "cloudflare-worker";
}
function isBrowser() {
  return detectPlatform() === "browser";
}
function isNode() {
  return detectPlatform() === "node";
}
function getStorageAdapter(env) {
  if (isCloudflareWorker() && env?.CACHE_KV) {
    return "kv";
  }
  if (isBrowser()) {
    return "indexeddb";
  }
  return "memory";
}
var init_platform = __esm({
  "../../src/core/api/enhanced/workers/platform.ts"() {
    "use strict";
    __name(detectPlatform, "detectPlatform");
    __name(isCloudflareWorker, "isCloudflareWorker");
    __name(isBrowser, "isBrowser");
    __name(isNode, "isNode");
    __name(getStorageAdapter, "getStorageAdapter");
  }
});

// ../../src/core/api/enhanced/workers/kv-cache.ts
function createKVCache(context, options) {
  if (!context.env?.CACHE_KV) {
    return null;
  }
  return new KVCache({
    namespace: context.env.CACHE_KV,
    ...options
  });
}
var KVCache;
var init_kv_cache = __esm({
  "../../src/core/api/enhanced/workers/kv-cache.ts"() {
    "use strict";
    KVCache = class {
      static {
        __name(this, "KVCache");
      }
      constructor(options) {
        this.namespace = options.namespace;
        this.defaultTTL = options.defaultTTL || 3600;
        this.keyPrefix = options.keyPrefix || "api:cache:";
      }
      /**
       * Get value from cache
       */
      async get(key2) {
        try {
          const value = await this.namespace.get(this.prefixKey(key2), { type: "json" });
          return value;
        } catch (error) {
          console.error("KV cache get error:", error);
          return null;
        }
      }
      /**
       * Set value in cache
       */
      async set(key2, value, ttl) {
        try {
          const ttlSeconds = ttl || this.defaultTTL;
          await this.namespace.put(
            this.prefixKey(key2),
            JSON.stringify(value),
            { expirationTtl: ttlSeconds }
          );
        } catch (error) {
          console.error("KV cache set error:", error);
        }
      }
      /**
       * Delete value from cache
       */
      async delete(key2) {
        try {
          await this.namespace.delete(this.prefixKey(key2));
        } catch (error) {
          console.error("KV cache delete error:", error);
        }
      }
      /**
       * Check if key exists
       */
      async has(key2) {
        const value = await this.get(key2);
        return value !== null;
      }
      /**
       * Clear all cache entries (by prefix)
       * 
       * Note: KV doesn't support listing keys, so this is a no-op
       * In practice, you'd need to track keys separately or use a different strategy
       */
      async clear() {
        console.warn("KV cache clear() is not supported - KV does not support listing keys");
      }
      /**
       * Get cache statistics
       */
      async getStats() {
        return { size: 0 };
      }
      /**
       * Prefix cache key
       */
      prefixKey(key2) {
        return `${this.keyPrefix}${key2}`;
      }
    };
    __name(createKVCache, "createKVCache");
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
function handleCORSPreflight(request, options = {}) {
  if (request.method !== "OPTIONS") {
    return null;
  }
  const headers = createCORSHeaders(request, options);
  return new Response(null, {
    status: 204,
    headers
  });
}
function createCORSMiddleware(options = {}) {
  return async (request, next2) => {
    const preflightResponse = handleCORSPreflight(request, options);
    if (preflightResponse) {
      return preflightResponse;
    }
    const response = await next2(request);
    const corsHeaders = createCORSHeaders(request, options);
    const newHeaders = new Headers(response.headers);
    for (const [key2, value] of corsHeaders.entries()) {
      newHeaders.set(key2, value);
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  };
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
    __name(handleCORSPreflight, "handleCORSPreflight");
    __name(createCORSMiddleware, "createCORSMiddleware");
  }
});

// ../../src/core/api/enhanced/workers/adapter.ts
function createWorkerAdapter(config = {}) {
  return new WorkerAdapter(config);
}
function createWorkerHandler(handler, adapterConfig) {
  const adapter = createWorkerAdapter(adapterConfig);
  return async (event2) => {
    return adapter.handleFetch(event2, async (request, env) => {
      const ctx = {
        waitUntil: /* @__PURE__ */ __name(() => {
        }, "waitUntil"),
        passThroughOnException: /* @__PURE__ */ __name(() => {
        }, "passThroughOnException"),
        props: {}
      };
      return handler(request, env, ctx);
    });
  };
}
var WorkerAdapter;
var init_adapter = __esm({
  "../../src/core/api/enhanced/workers/adapter.ts"() {
    "use strict";
    init_platform();
    init_cors();
    init_kv_cache();
    WorkerAdapter = class {
      constructor(config = {}) {
        this.kvCache = null;
        this.config = config;
        if (config.env?.CACHE_KV) {
          this.kvCache = createKVCache(
            { request: {}, env: config.env },
            { keyPrefix: "enhanced-api:" }
          );
        }
      }
      static {
        __name(this, "WorkerAdapter");
      }
      /**
       * Get KV cache instance
       */
      getCache() {
        return this.kvCache;
      }
      /**
       * Get environment
       */
      getEnv() {
        return this.config.env;
      }
      /**
       * Check if running in Worker
       */
      isWorker() {
        return isCloudflareWorker();
      }
      /**
       * Get platform
       */
      getPlatform() {
        return detectPlatform();
      }
      /**
       * Create CORS middleware
       */
      createCORS(options) {
        return createCORSMiddleware(options || {});
      }
      /**
       * Enhance request context with Worker-specific data
       */
      enhanceContext(context) {
        return {
          ...context,
          env: this.config.env
        };
      }
      /**
       * Handle Worker fetch event
       */
      async handleFetch(event2, handler) {
        const request = event2.request;
        const env = this.config.env || {};
        if (this.config.cors) {
          const corsMiddleware = this.createCORS();
          return corsMiddleware(request, async (req) => {
            return await handler(req, env);
          });
        }
        return await handler(request, env);
      }
    };
    __name(createWorkerAdapter, "createWorkerAdapter");
    __name(createWorkerHandler, "createWorkerHandler");
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
function generateId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
function createEnhancedAPIClient(config = {}) {
  return new EnhancedAPIClientV2(config);
}
function getEnhancedAPIClient() {
  if (!defaultEnhancedClient) {
    defaultEnhancedClient = createEnhancedAPIClient();
  }
  return defaultEnhancedClient;
}
function setEnhancedAPIClient(client) {
  defaultEnhancedClient = client;
}
function resetEnhancedAPIClient() {
  defaultEnhancedClient = null;
}
var EnhancedAPIClientV2, defaultEnhancedClient;
var init_client2 = __esm({
  "../../src/core/api/enhanced/client.ts"() {
    "use strict";
    init_enhanced_client();
    init_encryption2();
    init_filtering();
    init_errors();
    init_workers();
    EnhancedAPIClientV2 = class extends EnhancedAPIClient {
      constructor(config = {}) {
        const baseConfig = {
          baseURL: config.baseURL,
          defaultHeaders: config.defaultHeaders,
          timeout: config.timeout,
          retry: config.retry,
          cache: config.cache,
          ...config
          // Spread any other base config
        };
        super(baseConfig);
        this.workerAdapter = null;
        this.enhancedConfig = config;
        if (config.worker?.env) {
          this.workerAdapter = createWorkerAdapter(config.worker);
        }
        this.requestContext = {
          request: {},
          env: config.worker?.env
        };
        this.setupEnhancedMiddlewares();
      }
      static {
        __name(this, "EnhancedAPIClientV2");
      }
      /**
       * Setup enhanced middlewares
       */
      setupEnhancedMiddlewares() {
        if (this.enhancedConfig.errorHandling?.useErrorLegend) {
          this.use(
            createErrorLegendMiddleware(
              this.enhancedConfig.errorHandling.useErrorLegend
            )
          );
        }
        if (this.enhancedConfig.encryption?.enabled) {
          this.use(
            createE2EEncryptionMiddleware(this.enhancedConfig.encryption)
          );
        }
        if (this.enhancedConfig.filtering) {
          this.use(
            createResponseFilterMiddleware(this.enhancedConfig.filtering)
          );
        }
      }
      /**
       * Make request with enhanced features
       */
      async requestRaw(request) {
        this.requestContext.request = request;
        if (this.workerAdapter) {
          this.requestContext = this.workerAdapter.enhanceContext(this.requestContext);
        }
        return super.requestRaw(request);
      }
      /**
       * Make request with type definition
       */
      async requestTyped(request, _typeDef) {
        this.requestContext.request = request;
        if (this.workerAdapter) {
          this.requestContext = this.workerAdapter.enhanceContext(this.requestContext);
        }
        const response = await super.requestRaw(request);
        if (response.status < 400 && response.data) {
          const data = response.data;
          const rootConfig = {
            id: data.id || this.requestContext.user?.id || generateId(),
            customerId: data.customerId || this.requestContext.user?.customerId || ""
          };
          const enhancedData = {
            ...rootConfig,
            ...data
          };
          return {
            ...response,
            data: enhancedData
          };
        }
        return response;
      }
      /**
       * Set user context (for root config and encryption)
       */
      setUser(user2) {
        this.requestContext.user = user2;
        return this;
      }
      /**
       * Get user context
       */
      getUser() {
        return this.requestContext.user;
      }
      /**
       * Get Worker adapter
       */
      getWorkerAdapter() {
        return this.workerAdapter;
      }
      /**
       * Get request context
       */
      getRequestContext() {
        return { ...this.requestContext };
      }
      /**
       * Update configuration
       */
      configureEnhanced(config) {
        Object.assign(this.enhancedConfig, config);
        if (config.encryption || config.filtering || config.errorHandling) {
          this.setupEnhancedMiddlewares();
        }
        return this;
      }
      /**
       * Get enhanced configuration
       */
      getEnhancedConfig() {
        return { ...this.enhancedConfig };
      }
    };
    __name(generateId, "generateId");
    __name(createEnhancedAPIClient, "createEnhancedAPIClient");
    defaultEnhancedClient = null;
    __name(getEnhancedAPIClient, "getEnhancedAPIClient");
    __name(setEnhancedAPIClient, "setEnhancedAPIClient");
    __name(resetEnhancedAPIClient, "resetEnhancedAPIClient");
  }
});

// ../../src/core/api/enhanced/building/metric-computer.ts
async function computeMetric(metricDef, data, context) {
  if (metricDef.cache) {
    const cacheKey = metricDef.cache.key(data);
    const cached = await getCachedMetric(cacheKey, context);
    if (cached !== null) {
      return cached;
    }
  }
  const value = await metricDef.compute(data, context);
  if (metricDef.cache && value !== void 0 && value !== null) {
    const cacheKey = metricDef.cache.key(data);
    await setCachedMetric(cacheKey, value, metricDef.cache.ttl, context);
  }
  return value;
}
async function computeMetrics(metrics, data, context, requestedMetrics) {
  const results = {};
  const metricsToCompute = requestedMetrics ? requestedMetrics.filter((name) => name in metrics) : Object.keys(metrics);
  for (const metricName of metricsToCompute) {
    const metricDef = metrics[metricName];
    if (!metricDef.required && requestedMetrics && !requestedMetrics.includes(metricName)) {
      continue;
    }
    try {
      results[metricName] = await computeMetric(metricDef, data, context);
    } catch (error) {
      console.error(`Failed to compute metric ${metricName}:`, error);
    }
  }
  return results;
}
async function getCachedMetric(cacheKey, context) {
  if (!context.env?.CACHE_KV) {
    return null;
  }
  try {
    const cached = await context.env.CACHE_KV.get(cacheKey, { type: "json" });
    if (cached) {
      return cached;
    }
  } catch (error) {
    console.error("Cache read error:", error);
  }
  return null;
}
async function setCachedMetric(cacheKey, value, ttl, context) {
  if (!context.env?.CACHE_KV) {
    return;
  }
  try {
    await context.env.CACHE_KV.put(
      cacheKey,
      JSON.stringify(value),
      { expirationTtl: ttl }
    );
  } catch (error) {
    console.error("Cache write error:", error);
  }
}
async function clearCachedMetric(cacheKey, context) {
  if (!context.env?.CACHE_KV) {
    return;
  }
  try {
    await context.env.CACHE_KV.delete(cacheKey);
  } catch (error) {
    console.error("Cache delete error:", error);
  }
}
function generateMetricCacheKey(metricName, dataId, additionalContext) {
  const parts = ["metric", metricName, dataId];
  if (additionalContext) {
    const contextStr = Object.entries(additionalContext).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}:${v}`).join("|");
    parts.push(contextStr);
  }
  return parts.join(":");
}
var init_metric_computer = __esm({
  "../../src/core/api/enhanced/building/metric-computer.ts"() {
    "use strict";
    __name(computeMetric, "computeMetric");
    __name(computeMetrics, "computeMetrics");
    __name(getCachedMetric, "getCachedMetric");
    __name(setCachedMetric, "setCachedMetric");
    __name(clearCachedMetric, "clearCachedMetric");
    __name(generateMetricCacheKey, "generateMetricCacheKey");
  }
});

// ../../src/core/api/enhanced/building/response-builder.ts
function buildResponse(data, context, typeDef, options = {}) {
  const rootConfig = {
    id: data.id || context.user?.id || generateId2(),
    customerId: data.customerId || context.user?.customerId || ""
  };
  const responseData = {
    ...rootConfig,
    ...data
  };
  const included = [...Object.keys(rootConfig)];
  const excluded = [];
  const computed = [];
  if (typeDef) {
    for (const field of typeDef.required) {
      if (!(field in responseData)) {
        responseData[field] = void 0;
      }
      if (!included.includes(field)) {
        included.push(field);
      }
    }
    if (options.include) {
      for (const field of options.include) {
        if (typeDef.optional.includes(field) && field in data) {
          responseData[field] = data[field];
          if (!included.includes(field)) {
            included.push(field);
          }
        }
      }
    }
    if (options.exclude) {
      for (const field of options.exclude) {
        if (field in responseData && !typeDef.required.includes(field)) {
          delete responseData[field];
          excluded.push(field);
          const index2 = included.indexOf(field);
          if (index2 > -1) {
            included.splice(index2, 1);
          }
        }
      }
    }
    if (options.computeMetrics && typeDef.metrics) {
      for (const metricName of options.computeMetrics) {
        const metricDef = typeDef.metrics[metricName];
        if (metricDef) {
          try {
            const metricValue = computeMetric(metricDef, data, context);
            responseData[metricName] = metricValue;
            computed.push(metricName);
            if (!included.includes(metricName)) {
              included.push(metricName);
            }
          } catch (error) {
            console.error(`Failed to compute metric ${metricName}:`, error);
          }
        }
      }
    }
  }
  return {
    data: responseData,
    included,
    excluded,
    computed
  };
}
function generateId2() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
function validateResponse(response, typeDef) {
  const errors = [];
  if (!response.id) {
    errors.push("Missing required root field: id");
  }
  if (!response.customerId) {
    errors.push("Missing required root field: customerId");
  }
  for (const field of typeDef.required) {
    if (!(field in response) || response[field] === void 0) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  return {
    valid: errors.length === 0,
    errors
  };
}
function createResponseBuilderMiddleware(typeDef, getContext2) {
  return async (request, next2) => {
    const context = getContext2 ? getContext2(request) : {
      request,
      env: void 0
    };
    const response = await next2(request);
    if (!response.ok) {
      return response;
    }
    const contentType = response.headers?.get("content-type");
    if (!contentType?.includes("application/json")) {
      return response;
    }
    try {
      const data = await response.json();
      const url = new URL(request.url || `http://localhost${request.path}`);
      const options = {
        include: url.searchParams.get("include")?.split(",").map((s) => s.trim()),
        exclude: url.searchParams.get("exclude")?.split(",").map((s) => s.trim()),
        tags: url.searchParams.get("tags")?.split(",").map((s) => s.trim()),
        computeMetrics: url.searchParams.get("metrics")?.split(",").map((s) => s.trim())
      };
      const built = buildResponse(data, context, typeDef, options);
      const headers = new Headers(response.headers);
      headers.set("Content-Type", "application/json");
      if (built.computed.length > 0) {
        headers.set("X-Computed-Metrics", built.computed.join(","));
      }
      return {
        ...response,
        data: built.data,
        headers
      };
    } catch (error) {
      console.error("Response building failed:", error);
      return response;
    }
  };
}
var init_response_builder = __esm({
  "../../src/core/api/enhanced/building/response-builder.ts"() {
    "use strict";
    init_metric_computer();
    __name(buildResponse, "buildResponse");
    __name(generateId2, "generateId");
    __name(validateResponse, "validateResponse");
    __name(createResponseBuilderMiddleware, "createResponseBuilderMiddleware");
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
function createEnhancedHandler(handler, options = {}) {
  return async (request, env, _ctx) => {
    try {
      const adapter = new WorkerAdapter({
        env,
        cors: options.cors ?? true
      });
      const context = {
        request: requestToAPIRequest(request),
        env,
        adapter
      };
      if (options.requireAuth) {
        const user2 = await extractUserFromRequest(request, env);
        if (!user2) {
          return createRFC7807Response(
            context.request,
            {
              status: 401,
              message: "Unauthorized"
            },
            new Headers()
          );
        }
        context.user = user2;
      }
      const data = await handler(request, context);
      const built = buildResponse(
        data,
        context,
        options.typeDef,
        {
          include: parseFilteringParams(context.request).include,
          exclude: parseFilteringParams(context.request).exclude,
          tags: parseFilteringParams(context.request).tags
        }
      );
      let filteredData = built.data;
      if (options.filterConfig) {
        const params = parseFilteringParams(context.request);
        filteredData = applyFiltering(
          filteredData,
          params,
          options.filterConfig,
          options.typeDef
        );
      }
      const headers = new Headers();
      headers.set("Content-Type", "application/json");
      if (options.cors && adapter) {
      }
      let responseData = filteredData;
      let responseHeaders = headers;
      if (context.user) {
        const authHeader = request.headers.get("Authorization");
        const token2 = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;
        if (token2 && token2.length >= 10) {
          try {
            const encrypted = await encryptWithJWT(responseData, token2);
            responseData = encrypted;
            responseHeaders.set("X-Encrypted", "true");
          } catch (error) {
            console.error("Failed to encrypt response:", error);
          }
        }
      }
      return new Response(JSON.stringify(responseData), {
        status: 200,
        headers: responseHeaders
      });
    } catch (error) {
      const apiRequest = requestToAPIRequest(request);
      const apiError = error.status ? error : {
        status: 500,
        message: error.message || "Internal Server Error"
      };
      return createRFC7807Response(apiRequest, apiError, new Headers());
    }
  };
}
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
async function extractUserFromRequest(request, _env) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token2 = authHeader.substring(7);
  try {
    const parts = token2.split(".");
    if (parts.length !== 3) {
      return null;
    }
    const payload = JSON.parse(atob(parts[1]));
    return {
      id: payload.sub || payload.userId || "",
      customerId: payload.customerId || payload.aud || "",
      email: payload.email || ""
    };
  } catch (error) {
    return null;
  }
}
function createGetHandler(handler, options = {}) {
  return createEnhancedHandler(handler, options);
}
function createPostHandler(handler, options = {}) {
  return createEnhancedHandler(handler, options);
}
var init_handler = __esm({
  "../../src/core/api/enhanced/workers/handler.ts"() {
    "use strict";
    init_response_builder();
    init_errors();
    init_filtering();
    init_adapter();
    init_encryption2();
    __name(createEnhancedHandler, "createEnhancedHandler");
    __name(requestToAPIRequest, "requestToAPIRequest");
    __name(extractUserFromRequest, "extractUserFromRequest");
    __name(createGetHandler, "createGetHandler");
    __name(createPostHandler, "createPostHandler");
  }
});

// ../../src/core/api/enhanced/registry/type-registry.ts
function getTypeRegistry() {
  return TypeRegistry.getInstance();
}
function registerType(name, definition) {
  return getTypeRegistry().register(name, definition);
}
function getType(name) {
  return getTypeRegistry().get(name);
}
var TypeRegistry;
var init_type_registry = __esm({
  "../../src/core/api/enhanced/registry/type-registry.ts"() {
    "use strict";
    TypeRegistry = class _TypeRegistry {
      constructor() {
        this.definitions = /* @__PURE__ */ new Map();
        this.filterConfig = null;
      }
      static {
        __name(this, "TypeRegistry");
      }
      /**
       * Get singleton instance
       */
      static getInstance() {
        if (!_TypeRegistry.instance) {
          _TypeRegistry.instance = new _TypeRegistry();
        }
        return _TypeRegistry.instance;
      }
      /**
       * Register a type definition
       */
      register(name, definition) {
        this.definitions.set(name, definition);
        return this;
      }
      /**
       * Register multiple type definitions
       */
      registerMany(definitions) {
        for (const [name, def] of Object.entries(definitions)) {
          this.register(name, def);
        }
        return this;
      }
      /**
       * Get type definition
       */
      get(name) {
        return this.definitions.get(name);
      }
      /**
       * Check if type is registered
       */
      has(name) {
        return this.definitions.has(name);
      }
      /**
       * Get all registered types
       */
      getAll() {
        return new Map(this.definitions);
      }
      /**
       * Clear all type definitions
       */
      clear() {
        this.definitions.clear();
        return this;
      }
      /**
       * Set filter config
       */
      setFilterConfig(config) {
        this.filterConfig = config;
        return this;
      }
      /**
       * Get filter config
       */
      getFilterConfig() {
        return this.filterConfig;
      }
      /**
       * Build filter config from registered types
       */
      buildFilterConfig(rootConfig) {
        return {
          rootConfigType: {},
          // Type reference
          rootConfig,
          typeDefinitions: this.definitions,
          tags: this.filterConfig?.tags || {}
        };
      }
    };
    __name(getTypeRegistry, "getTypeRegistry");
    __name(registerType, "registerType");
    __name(getType, "getType");
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
function composeServerMiddlewares(...middlewares) {
  return async (request, context, next2) => {
    let index2 = 0;
    const dispatch = /* @__PURE__ */ __name(async () => {
      if (index2 >= middlewares.length) {
        return next2();
      }
      const middleware = middlewares[index2++];
      return middleware(request, context, dispatch);
    }, "dispatch");
    return dispatch();
  };
}
function createServerMiddleware(middleware) {
  return async (request, _context, next2) => {
    void _context;
    const apiRequest = {
      id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      method: request.method,
      url: request.url,
      path: new URL(request.url).pathname,
      headers: Object.fromEntries(request.headers.entries())
    };
    const response = await middleware(apiRequest, async (_req) => {
      const nextResponse = await next2();
      return {
        data: await nextResponse.json(),
        status: nextResponse.status,
        statusText: nextResponse.statusText,
        headers: nextResponse.headers,
        request: apiRequest,
        timestamp: Date.now()
      };
    });
    return new Response(
      JSON.stringify(response.data),
      {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      }
    );
  };
}
function withMiddleware(handler, ...middlewares) {
  const composed = composeServerMiddlewares(...middlewares);
  return async (request, context) => {
    return composed(request, context, async () => {
      return handler(request, context);
    });
  };
}
var init_compose = __esm({
  "../../src/core/api/enhanced/middleware/compose.ts"() {
    "use strict";
    __name(composeServerMiddlewares, "composeServerMiddlewares");
    __name(createServerMiddleware, "createServerMiddleware");
    __name(withMiddleware, "withMiddleware");
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

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/shared/utils.js
function run_all(arr) {
  for (var i = 0; i < arr.length; i++) {
    arr[i]();
  }
}
function deferred() {
  var resolve;
  var reject;
  var promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
var is_array, index_of, array_from, object_keys, define_property, get_descriptor, object_prototype, array_prototype, get_prototype_of, is_extensible, noop;
var init_utils = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/shared/utils.js"() {
    is_array = Array.isArray;
    index_of = Array.prototype.indexOf;
    array_from = Array.from;
    object_keys = Object.keys;
    define_property = Object.defineProperty;
    get_descriptor = Object.getOwnPropertyDescriptor;
    object_prototype = Object.prototype;
    array_prototype = Array.prototype;
    get_prototype_of = Object.getPrototypeOf;
    is_extensible = Object.isExtensible;
    noop = /* @__PURE__ */ __name(() => {
    }, "noop");
    __name(run_all, "run_all");
    __name(deferred, "deferred");
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/reactivity/equality.js
function equals(value) {
  return value === this.v;
}
function safe_not_equal(a, b) {
  return a != a ? b == b : a !== b || a !== null && typeof a === "object" || typeof a === "function";
}
function safe_equals(value) {
  return !safe_not_equal(value, this.v);
}
var init_equality = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/reactivity/equality.js"() {
    __name(equals, "equals");
    __name(safe_not_equal, "safe_not_equal");
    __name(safe_equals, "safe_equals");
  }
});

// ../../node_modules/.pnpm/esm-env@1.2.2/node_modules/esm-env/true.js
var init_true = __esm({
  "../../node_modules/.pnpm/esm-env@1.2.2/node_modules/esm-env/true.js"() {
  }
});

// ../../node_modules/.pnpm/esm-env@1.2.2/node_modules/esm-env/dev-fallback.js
var node_env, dev_fallback_default;
var init_dev_fallback = __esm({
  "../../node_modules/.pnpm/esm-env@1.2.2/node_modules/esm-env/dev-fallback.js"() {
    node_env = "production";
    dev_fallback_default = node_env && !node_env.toLowerCase().startsWith("prod");
  }
});

// ../../node_modules/.pnpm/esm-env@1.2.2/node_modules/esm-env/false.js
var init_false = __esm({
  "../../node_modules/.pnpm/esm-env@1.2.2/node_modules/esm-env/false.js"() {
  }
});

// ../../node_modules/.pnpm/esm-env@1.2.2/node_modules/esm-env/index.js
var init_esm_env = __esm({
  "../../node_modules/.pnpm/esm-env@1.2.2/node_modules/esm-env/index.js"() {
    init_true();
    init_dev_fallback();
    init_false();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/constants.js
var DERIVED, EFFECT, RENDER_EFFECT, MANAGED_EFFECT, BLOCK_EFFECT, BRANCH_EFFECT, ROOT_EFFECT, BOUNDARY_EFFECT, CONNECTED, CLEAN, DIRTY, MAYBE_DIRTY, INERT, DESTROYED, EFFECT_RAN, EFFECT_TRANSPARENT, EAGER_EFFECT, HEAD_EFFECT, EFFECT_PRESERVED, USER_EFFECT, EFFECT_OFFSCREEN, WAS_MARKED, REACTION_IS_UPDATING, ASYNC, ERROR_VALUE, STATE_SYMBOL, LEGACY_PROPS, LOADING_ATTR_SYMBOL, PROXY_PATH_SYMBOL, STALE_REACTION, COMMENT_NODE;
var init_constants = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/constants.js"() {
    DERIVED = 1 << 1;
    EFFECT = 1 << 2;
    RENDER_EFFECT = 1 << 3;
    MANAGED_EFFECT = 1 << 24;
    BLOCK_EFFECT = 1 << 4;
    BRANCH_EFFECT = 1 << 5;
    ROOT_EFFECT = 1 << 6;
    BOUNDARY_EFFECT = 1 << 7;
    CONNECTED = 1 << 9;
    CLEAN = 1 << 10;
    DIRTY = 1 << 11;
    MAYBE_DIRTY = 1 << 12;
    INERT = 1 << 13;
    DESTROYED = 1 << 14;
    EFFECT_RAN = 1 << 15;
    EFFECT_TRANSPARENT = 1 << 16;
    EAGER_EFFECT = 1 << 17;
    HEAD_EFFECT = 1 << 18;
    EFFECT_PRESERVED = 1 << 19;
    USER_EFFECT = 1 << 20;
    EFFECT_OFFSCREEN = 1 << 25;
    WAS_MARKED = 1 << 15;
    REACTION_IS_UPDATING = 1 << 21;
    ASYNC = 1 << 22;
    ERROR_VALUE = 1 << 23;
    STATE_SYMBOL = Symbol("$state");
    LEGACY_PROPS = Symbol("legacy props");
    LOADING_ATTR_SYMBOL = Symbol("");
    PROXY_PATH_SYMBOL = Symbol("proxy path");
    STALE_REACTION = new class StaleReactionError extends Error {
      static {
        __name(this, "StaleReactionError");
      }
      name = "StaleReactionError";
      message = "The reaction that called `getAbortSignal()` was re-run or destroyed";
    }();
    COMMENT_NODE = 8;
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/shared/errors.js
var init_errors2 = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/shared/errors.js"() {
    init_esm_env();
  }
});

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
var init_errors3 = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/errors.js"() {
    init_esm_env();
    init_errors2();
    __name(derived_references_self, "derived_references_self");
    __name(effect_update_depth_exceeded, "effect_update_depth_exceeded");
    __name(hydration_failed, "hydration_failed");
    __name(rune_outside_svelte, "rune_outside_svelte");
    __name(state_descriptors_fixed, "state_descriptors_fixed");
    __name(state_prototype_fixed, "state_prototype_fixed");
    __name(state_unsafe_mutation, "state_unsafe_mutation");
    __name(svelte_boundary_reset_onerror, "svelte_boundary_reset_onerror");
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/constants.js
var EACH_INDEX_REACTIVE, EACH_IS_CONTROLLED, EACH_IS_ANIMATED, EACH_ITEM_IMMUTABLE, PROPS_IS_RUNES, PROPS_IS_UPDATED, PROPS_IS_BINDABLE, PROPS_IS_LAZY_INITIAL, TRANSITION_OUT, TRANSITION_GLOBAL, TEMPLATE_USE_IMPORT_NODE, TEMPLATE_USE_SVG, TEMPLATE_USE_MATHML, HYDRATION_START, HYDRATION_START_ELSE, HYDRATION_END, HYDRATION_ERROR, ELEMENT_PRESERVE_ATTRIBUTE_CASE, ELEMENT_IS_INPUT, UNINITIALIZED, FILENAME, HMR;
var init_constants2 = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/constants.js"() {
    EACH_INDEX_REACTIVE = 1 << 1;
    EACH_IS_CONTROLLED = 1 << 2;
    EACH_IS_ANIMATED = 1 << 3;
    EACH_ITEM_IMMUTABLE = 1 << 4;
    PROPS_IS_RUNES = 1 << 1;
    PROPS_IS_UPDATED = 1 << 2;
    PROPS_IS_BINDABLE = 1 << 3;
    PROPS_IS_LAZY_INITIAL = 1 << 4;
    TRANSITION_OUT = 1 << 1;
    TRANSITION_GLOBAL = 1 << 2;
    TEMPLATE_USE_IMPORT_NODE = 1 << 1;
    TEMPLATE_USE_SVG = 1 << 2;
    TEMPLATE_USE_MATHML = 1 << 3;
    HYDRATION_START = "[";
    HYDRATION_START_ELSE = "[!";
    HYDRATION_END = "]";
    HYDRATION_ERROR = {};
    ELEMENT_PRESERVE_ATTRIBUTE_CASE = 1 << 1;
    ELEMENT_IS_INPUT = 1 << 2;
    UNINITIALIZED = Symbol();
    FILENAME = Symbol("filename");
    HMR = Symbol("hmr");
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/warnings.js
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
function lifecycle_double_unmount() {
  if (dev_fallback_default) {
    console.warn(`%c[svelte] lifecycle_double_unmount
%cTried to unmount a component that was not mounted
https://svelte.dev/e/lifecycle_double_unmount`, bold, normal);
  } else {
    console.warn(`https://svelte.dev/e/lifecycle_double_unmount`);
  }
}
function state_proxy_equality_mismatch(operator) {
  if (dev_fallback_default) {
    console.warn(`%c[svelte] state_proxy_equality_mismatch
%cReactive \`$state(...)\` proxies and the values they proxy have different identities. Because of this, comparisons with \`${operator}\` will produce unexpected results
https://svelte.dev/e/state_proxy_equality_mismatch`, bold, normal);
  } else {
    console.warn(`https://svelte.dev/e/state_proxy_equality_mismatch`);
  }
}
function state_proxy_unmount() {
  if (dev_fallback_default) {
    console.warn(`%c[svelte] state_proxy_unmount
%cTried to unmount a state proxy, rather than a component
https://svelte.dev/e/state_proxy_unmount`, bold, normal);
  } else {
    console.warn(`https://svelte.dev/e/state_proxy_unmount`);
  }
}
function svelte_boundary_reset_noop() {
  if (dev_fallback_default) {
    console.warn(`%c[svelte] svelte_boundary_reset_noop
%cA \`<svelte:boundary>\` \`reset\` function only resets the boundary the first time it is called
https://svelte.dev/e/svelte_boundary_reset_noop`, bold, normal);
  } else {
    console.warn(`https://svelte.dev/e/svelte_boundary_reset_noop`);
  }
}
var bold, normal;
var init_warnings = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/warnings.js"() {
    init_esm_env();
    bold = "font-weight: bold";
    normal = "font-weight: normal";
    __name(hydration_mismatch, "hydration_mismatch");
    __name(lifecycle_double_unmount, "lifecycle_double_unmount");
    __name(state_proxy_equality_mismatch, "state_proxy_equality_mismatch");
    __name(state_proxy_unmount, "state_proxy_unmount");
    __name(svelte_boundary_reset_noop, "svelte_boundary_reset_noop");
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/hydration.js
function set_hydrating(value) {
  hydrating = value;
}
function set_hydrate_node(node) {
  if (node === null) {
    hydration_mismatch();
    throw HYDRATION_ERROR;
  }
  return hydrate_node = node;
}
function hydrate_next() {
  return set_hydrate_node(get_next_sibling(hydrate_node));
}
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
var hydrating, hydrate_node;
var init_hydration = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/hydration.js"() {
    init_constants();
    init_constants2();
    init_warnings();
    init_operations();
    hydrating = false;
    __name(set_hydrating, "set_hydrating");
    __name(set_hydrate_node, "set_hydrate_node");
    __name(hydrate_next, "hydrate_next");
    __name(next, "next");
    __name(skip_nodes, "skip_nodes");
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/flags/index.js
var async_mode_flag, legacy_mode_flag, tracing_mode_flag;
var init_flags = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/flags/index.js"() {
    async_mode_flag = false;
    legacy_mode_flag = false;
    tracing_mode_flag = false;
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/shared/warnings.js
var init_warnings2 = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/shared/warnings.js"() {
    init_esm_env();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/shared/clone.js
var init_clone = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/shared/clone.js"() {
    init_esm_env();
    init_warnings2();
    init_utils();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dev/tracing.js
function tag(source2, label) {
  source2.label = label;
  tag_proxy(source2.v, label);
  return source2;
}
function tag_proxy(value, label) {
  value?.[PROXY_PATH_SYMBOL]?.(label);
  return value;
}
var tracing_expressions;
var init_tracing = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dev/tracing.js"() {
    init_constants2();
    init_clone();
    init_constants();
    init_effects();
    init_runtime();
    tracing_expressions = null;
    __name(tag, "tag");
    __name(tag_proxy, "tag_proxy");
  }
});

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
var init_dev = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/shared/dev.js"() {
    init_utils();
    __name(get_error, "get_error");
    __name(get_stack, "get_stack");
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/context.js
function set_component_context(context) {
  component_context = context;
}
function set_dev_stack(stack2) {
  dev_stack = stack2;
}
function set_dev_current_component_function(fn) {
  dev_current_component_function = fn;
}
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
function is_runes() {
  return !legacy_mode_flag || component_context !== null && component_context.l === null;
}
var component_context, dev_stack, dev_current_component_function;
var init_context = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/context.js"() {
    init_esm_env();
    init_errors3();
    init_runtime();
    init_effects();
    init_flags();
    init_constants2();
    init_constants();
    component_context = null;
    __name(set_component_context, "set_component_context");
    dev_stack = null;
    __name(set_dev_stack, "set_dev_stack");
    dev_current_component_function = null;
    __name(set_dev_current_component_function, "set_dev_current_component_function");
    __name(push, "push");
    __name(pop, "pop");
    __name(is_runes, "is_runes");
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/task.js
function run_micro_tasks() {
  var tasks = micro_tasks;
  micro_tasks = [];
  run_all(tasks);
}
function queue_micro_task(fn) {
  if (micro_tasks.length === 0 && !is_flushing_sync) {
    var tasks = micro_tasks;
    queueMicrotask(() => {
      if (tasks === micro_tasks) run_micro_tasks();
    });
  }
  micro_tasks.push(fn);
}
function flush_tasks() {
  while (micro_tasks.length > 0) {
    run_micro_tasks();
  }
}
var micro_tasks;
var init_task = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/task.js"() {
    init_utils();
    init_batch();
    micro_tasks = [];
    __name(run_micro_tasks, "run_micro_tasks");
    __name(queue_micro_task, "queue_micro_task");
    __name(flush_tasks, "flush_tasks");
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/error-handling.js
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
var adjustments;
var init_error_handling = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/error-handling.js"() {
    init_esm_env();
    init_constants2();
    init_operations();
    init_constants();
    init_utils();
    init_runtime();
    adjustments = /* @__PURE__ */ new WeakMap();
    __name(handle_error, "handle_error");
    __name(invoke_error_boundary, "invoke_error_boundary");
    __name(get_adjustments, "get_adjustments");
    __name(apply_adjustments, "apply_adjustments");
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/reactivity/batch.js
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
var batches, current_batch, previous_batch, batch_values, queued_root_effects, last_scheduled_effect, is_flushing, is_flushing_sync, Batch, eager_block_effects;
var init_batch = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/reactivity/batch.js"() {
    init_constants();
    init_flags();
    init_utils();
    init_runtime();
    init_errors3();
    init_task();
    init_esm_env();
    init_error_handling();
    init_sources();
    init_effects();
    batches = /* @__PURE__ */ new Set();
    current_batch = null;
    previous_batch = null;
    batch_values = null;
    queued_root_effects = [];
    last_scheduled_effect = null;
    is_flushing = false;
    is_flushing_sync = false;
    Batch = class _Batch {
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
    __name(flushSync, "flushSync");
    __name(flush_effects, "flush_effects");
    __name(infinite_loop_guard, "infinite_loop_guard");
    eager_block_effects = null;
    __name(flush_queued_effects, "flush_queued_effects");
    __name(mark_effects, "mark_effects");
    __name(depends_on, "depends_on");
    __name(schedule_effect, "schedule_effect");
  }
});

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
var init_create_subscriber = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/reactivity/create-subscriber.js"() {
    init_runtime();
    init_effects();
    init_sources();
    init_tracing();
    init_esm_env();
    init_task();
    __name(createSubscriber, "createSubscriber");
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/blocks/boundary.js
function boundary(node, props, children) {
  new Boundary(node, props, children);
}
var flags, Boundary;
var init_boundary = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/blocks/boundary.js"() {
    init_constants();
    init_constants2();
    init_context();
    init_error_handling();
    init_effects();
    init_runtime();
    init_hydration();
    init_task();
    init_errors3();
    init_warnings();
    init_esm_env();
    init_batch();
    init_sources();
    init_tracing();
    init_create_subscriber();
    init_operations();
    flags = EFFECT_TRANSPARENT | EFFECT_PRESERVED | BOUNDARY_EFFECT;
    __name(boundary, "boundary");
    Boundary = class {
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
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/reactivity/async.js
var init_async = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/reactivity/async.js"() {
    init_constants();
    init_esm_env();
    init_context();
    init_boundary();
    init_error_handling();
    init_runtime();
    init_batch();
    init_deriveds();
    init_effects();
    init_hydration();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/reactivity/deriveds.js
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
var recent_async_deriveds, stack;
var init_deriveds = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/reactivity/deriveds.js"() {
    init_esm_env();
    init_constants();
    init_runtime();
    init_equality();
    init_errors3();
    init_warnings();
    init_effects();
    init_sources();
    init_dev();
    init_flags();
    init_boundary();
    init_context();
    init_constants2();
    init_batch();
    init_async();
    init_utils();
    recent_async_deriveds = /* @__PURE__ */ new Set();
    __name(destroy_derived_effects, "destroy_derived_effects");
    stack = [];
    __name(get_derived_parent_effect, "get_derived_parent_effect");
    __name(execute_derived, "execute_derived");
    __name(update_derived, "update_derived");
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/reactivity/sources.js
function set_eager_effects(v) {
  eager_effects = v;
}
function set_eager_effects_deferred() {
  eager_effects_deferred = true;
}
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
// @__NO_SIDE_EFFECTS__
function state(v, stack2) {
  const s = source(v, stack2);
  push_reaction_value(s);
  return s;
}
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
function increment(source2) {
  set(source2, source2.v + 1);
}
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
var eager_effects, old_values, eager_effects_deferred;
var init_sources = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/reactivity/sources.js"() {
    init_esm_env();
    init_runtime();
    init_equality();
    init_constants();
    init_errors3();
    init_flags();
    init_tracing();
    init_dev();
    init_context();
    init_batch();
    init_proxy();
    init_deriveds();
    eager_effects = /* @__PURE__ */ new Set();
    old_values = /* @__PURE__ */ new Map();
    __name(set_eager_effects, "set_eager_effects");
    eager_effects_deferred = false;
    __name(set_eager_effects_deferred, "set_eager_effects_deferred");
    __name(source, "source");
    __name(state, "state");
    __name(mutable_source, "mutable_source");
    __name(set, "set");
    __name(internal_set, "internal_set");
    __name(flush_eager_effects, "flush_eager_effects");
    __name(increment, "increment");
    __name(mark_reactions, "mark_reactions");
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/proxy.js
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
function get_label(path, prop2) {
  if (typeof prop2 === "symbol") return `${path}[Symbol(${prop2.description ?? ""})]`;
  if (regex_is_valid_identifier.test(prop2)) return `${path}.${prop2}`;
  return /^\d+$/.test(prop2) ? `${path}[${prop2}]` : `${path}['${prop2}']`;
}
function get_proxied_value(value) {
  try {
    if (value !== null && typeof value === "object" && STATE_SYMBOL in value) {
      return value[STATE_SYMBOL];
    }
  } catch {
  }
  return value;
}
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
var regex_is_valid_identifier, ARRAY_MUTATING_METHODS;
var init_proxy = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/proxy.js"() {
    init_esm_env();
    init_runtime();
    init_utils();
    init_sources();
    init_constants();
    init_constants2();
    init_errors3();
    init_tracing();
    init_dev();
    init_flags();
    regex_is_valid_identifier = /^[a-zA-Z_$][a-zA-Z_$0-9]*$/;
    __name(proxy, "proxy");
    __name(get_label, "get_label");
    __name(get_proxied_value, "get_proxied_value");
    ARRAY_MUTATING_METHODS = /* @__PURE__ */ new Set([
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
    __name(inspectable_array, "inspectable_array");
  }
});

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
var init_equality2 = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dev/equality.js"() {
    init_warnings();
    init_proxy();
    __name(init_array_prototype_warnings, "init_array_prototype_warnings");
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/operations.js
function init_operations2() {
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
function create_text(value = "") {
  return document.createTextNode(value);
}
// @__NO_SIDE_EFFECTS__
function get_first_child(node) {
  return (
    /** @type {TemplateNode | null} */
    first_child_getter.call(node)
  );
}
// @__NO_SIDE_EFFECTS__
function get_next_sibling(node) {
  return (
    /** @type {TemplateNode | null} */
    next_sibling_getter.call(node)
  );
}
function clear_text_content(node) {
  node.textContent = "";
}
var $window, $document, is_firefox, first_child_getter, next_sibling_getter;
var init_operations = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/operations.js"() {
    init_hydration();
    init_esm_env();
    init_equality2();
    init_utils();
    init_runtime();
    init_flags();
    init_constants();
    init_batch();
    __name(init_operations2, "init_operations");
    __name(create_text, "create_text");
    __name(get_first_child, "get_first_child");
    __name(get_next_sibling, "get_next_sibling");
    __name(clear_text_content, "clear_text_content");
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/elements/misc.js
var init_misc = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/elements/misc.js"() {
    init_hydration();
    init_operations();
    init_task();
  }
});

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
var init_shared = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/elements/bindings/shared.js"() {
    init_effects();
    init_runtime();
    init_misc();
    __name(without_reactive_context, "without_reactive_context");
  }
});

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
function effect_tracking() {
  return active_reaction !== null && !untracking;
}
function create_user_effect(fn) {
  return create_effect(EFFECT | USER_EFFECT, fn, false);
}
function effect_root(fn) {
  Batch.ensure();
  const effect2 = create_effect(ROOT_EFFECT | EFFECT_PRESERVED, fn, true);
  return () => {
    destroy_effect(effect2);
  };
}
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
function render_effect(fn, flags2 = 0) {
  return create_effect(RENDER_EFFECT | flags2, fn, true);
}
function block(fn, flags2 = 0) {
  var effect2 = create_effect(BLOCK_EFFECT | flags2, fn, true);
  if (dev_fallback_default) {
    effect2.dev_stack = dev_stack;
  }
  return effect2;
}
function branch(fn) {
  return create_effect(BRANCH_EFFECT | EFFECT_PRESERVED, fn, true);
}
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
function remove_effect_dom(node, end) {
  while (node !== null) {
    var next2 = node === end ? null : get_next_sibling(node);
    node.remove();
    node = next2;
  }
}
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
var init_effects = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/reactivity/effects.js"() {
    init_runtime();
    init_constants();
    init_errors3();
    init_esm_env();
    init_utils();
    init_operations();
    init_context();
    init_batch();
    init_async();
    init_shared();
    __name(push_effect, "push_effect");
    __name(create_effect, "create_effect");
    __name(effect_tracking, "effect_tracking");
    __name(create_user_effect, "create_user_effect");
    __name(effect_root, "effect_root");
    __name(component_root, "component_root");
    __name(render_effect, "render_effect");
    __name(block, "block");
    __name(branch, "branch");
    __name(execute_effect_teardown, "execute_effect_teardown");
    __name(destroy_effect_children, "destroy_effect_children");
    __name(destroy_block_effect_children, "destroy_block_effect_children");
    __name(destroy_effect, "destroy_effect");
    __name(remove_effect_dom, "remove_effect_dom");
    __name(unlink_effect, "unlink_effect");
    __name(pause_effect, "pause_effect");
    __name(pause_children, "pause_children");
    __name(move_effect, "move_effect");
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/legacy.js
var captured_signals;
var init_legacy = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/legacy.js"() {
    init_sources();
    init_runtime();
    captured_signals = null;
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/runtime.js
function set_is_updating_effect(value) {
  is_updating_effect = value;
}
function set_is_destroying_effect(value) {
  is_destroying_effect = value;
}
function set_active_reaction(reaction) {
  active_reaction = reaction;
}
function set_active_effect(effect2) {
  active_effect = effect2;
}
function push_reaction_value(value) {
  if (active_reaction !== null && (!async_mode_flag || (active_reaction.f & DERIVED) !== 0)) {
    if (current_sources === null) {
      current_sources = [value];
    } else {
      current_sources.push(value);
    }
  }
}
function set_untracked_writes(value) {
  untracked_writes = value;
}
function set_update_version(value) {
  update_version = value;
}
function increment_write_version() {
  return ++write_version;
}
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
function remove_reactions(signal, start_index) {
  var dependencies = signal.deps;
  if (dependencies === null) return;
  for (var i = start_index; i < dependencies.length; i++) {
    remove_reaction(signal, dependencies[i]);
  }
}
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
function untrack(fn) {
  var previous_untracking = untracking;
  try {
    untracking = true;
    return fn();
  } finally {
    untracking = previous_untracking;
  }
}
function set_signal_status(signal, status) {
  signal.f = signal.f & STATUS_MASK | status;
}
var is_updating_effect, is_destroying_effect, active_reaction, untracking, active_effect, current_sources, new_deps, skipped_deps, untracked_writes, write_version, read_version, update_version, STATUS_MASK;
var init_runtime = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/runtime.js"() {
    init_esm_env();
    init_utils();
    init_effects();
    init_constants();
    init_sources();
    init_deriveds();
    init_flags();
    init_tracing();
    init_dev();
    init_context();
    init_warnings();
    init_batch();
    init_error_handling();
    init_constants2();
    init_legacy();
    init_shared();
    is_updating_effect = false;
    __name(set_is_updating_effect, "set_is_updating_effect");
    is_destroying_effect = false;
    __name(set_is_destroying_effect, "set_is_destroying_effect");
    active_reaction = null;
    untracking = false;
    __name(set_active_reaction, "set_active_reaction");
    active_effect = null;
    __name(set_active_effect, "set_active_effect");
    current_sources = null;
    __name(push_reaction_value, "push_reaction_value");
    new_deps = null;
    skipped_deps = 0;
    untracked_writes = null;
    __name(set_untracked_writes, "set_untracked_writes");
    write_version = 1;
    read_version = 0;
    update_version = read_version;
    __name(set_update_version, "set_update_version");
    __name(increment_write_version, "increment_write_version");
    __name(is_dirty, "is_dirty");
    __name(schedule_possible_effect_self_invalidation, "schedule_possible_effect_self_invalidation");
    __name(update_reaction, "update_reaction");
    __name(remove_reaction, "remove_reaction");
    __name(remove_reactions, "remove_reactions");
    __name(update_effect, "update_effect");
    __name(get, "get");
    __name(reconnect, "reconnect");
    __name(depends_on_old_values, "depends_on_old_values");
    __name(untrack, "untrack");
    STATUS_MASK = ~(DIRTY | MAYBE_DIRTY | CLEAN);
    __name(set_signal_status, "set_signal_status");
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/attachments/index.js
var init_attachments = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/attachments/index.js"() {
    init_client3();
    init_constants2();
    init_index_client();
    init_effects();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/utils.js
function is_passive_event(name) {
  return PASSIVE_EVENTS.includes(name);
}
var DOM_BOOLEAN_ATTRIBUTES, DOM_PROPERTIES, PASSIVE_EVENTS, STATE_CREATION_RUNES, RUNES;
var init_utils2 = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/utils.js"() {
    DOM_BOOLEAN_ATTRIBUTES = [
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
    DOM_PROPERTIES = [
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
    PASSIVE_EVENTS = ["touchstart", "touchmove"];
    __name(is_passive_event, "is_passive_event");
    STATE_CREATION_RUNES = /** @type {const} */
    [
      "$state",
      "$state.raw",
      "$derived",
      "$derived.by"
    ];
    RUNES = /** @type {const} */
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
    ];
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dev/assign.js
var init_assign = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dev/assign.js"() {
    init_utils2();
    init_runtime();
    init_warnings();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dev/css.js
var init_css = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dev/css.js"() {
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dev/elements.js
var init_elements = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dev/elements.js"() {
    init_constants();
    init_constants2();
    init_hydration();
    init_context();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/elements/events.js
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
var all_registered_events, root_event_handles, last_propagated_event;
var init_events = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/elements/events.js"() {
    init_effects();
    init_utils();
    init_hydration();
    init_task();
    init_constants2();
    init_warnings();
    init_runtime();
    init_shared();
    all_registered_events = /* @__PURE__ */ new Set();
    root_event_handles = /* @__PURE__ */ new Set();
    last_propagated_event = null;
    __name(handle_event_propagation, "handle_event_propagation");
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/reconciler.js
var init_reconciler = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/reconciler.js"() {
  }
});

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
var init_template = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/template.js"() {
    init_hydration();
    init_operations();
    init_reconciler();
    init_runtime();
    init_constants2();
    init_constants();
    __name(assign_nodes, "assign_nodes");
    __name(append, "append");
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/render.js
function mount(component2, options) {
  return _mount(component2, options);
}
function hydrate(component2, options) {
  init_operations2();
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
    init_operations2();
    clear_text_content(target);
    set_hydrating(false);
    return mount(component2, options);
  } finally {
    set_hydrating(was_hydrating);
    set_hydrate_node(previous_hydrate_node);
  }
}
function _mount(Component, { target, anchor, props = {}, events, context, intro = true }) {
  init_operations2();
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
var should_intro, document_listeners, mounted_components;
var init_render = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/render.js"() {
    init_esm_env();
    init_operations();
    init_constants2();
    init_runtime();
    init_context();
    init_effects();
    init_hydration();
    init_utils();
    init_events();
    init_warnings();
    init_errors3();
    init_template();
    init_utils2();
    init_constants();
    init_boundary();
    should_intro = true;
    __name(mount, "mount");
    __name(hydrate, "hydrate");
    document_listeners = /* @__PURE__ */ new Map();
    __name(_mount, "_mount");
    mounted_components = /* @__PURE__ */ new WeakMap();
    __name(unmount, "unmount");
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dev/hmr.js
var init_hmr = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dev/hmr.js"() {
    init_constants2();
    init_constants();
    init_hydration();
    init_effects();
    init_sources();
    init_render();
    init_runtime();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dev/ownership.js
var init_ownership = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dev/ownership.js"() {
    init_utils();
    init_constants();
    init_constants2();
    init_context();
    init_warnings();
    init_utils2();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dev/legacy.js
var init_legacy2 = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dev/legacy.js"() {
    init_errors3();
    init_context();
    init_constants2();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dev/inspect.js
var init_inspect = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dev/inspect.js"() {
    init_constants2();
    init_clone();
    init_effects();
    init_runtime();
    init_dev();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/blocks/async.js
var init_async2 = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/blocks/async.js"() {
    init_async();
    init_batch();
    init_runtime();
    init_hydration();
    init_boundary();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dev/validation.js
var init_validation = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dev/validation.js"() {
    init_errors3();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/blocks/branches.js
var init_branches = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/blocks/branches.js"() {
    init_batch();
    init_effects();
    init_hydration();
    init_operations();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/blocks/await.js
var init_await = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/blocks/await.js"() {
    init_utils();
    init_effects();
    init_sources();
    init_hydration();
    init_task();
    init_constants2();
    init_context();
    init_batch();
    init_branches();
    init_async();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/blocks/if.js
var init_if = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/blocks/if.js"() {
    init_constants();
    init_hydration();
    init_effects();
    init_constants2();
    init_branches();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/blocks/key.js
var init_key = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/blocks/key.js"() {
    init_context();
    init_effects();
    init_hydration();
    init_branches();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/blocks/css-props.js
var init_css_props = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/blocks/css-props.js"() {
    init_effects();
    init_hydration();
    init_operations();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/blocks/each.js
var init_each = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/blocks/each.js"() {
    init_constants2();
    init_hydration();
    init_operations();
    init_effects();
    init_sources();
    init_utils();
    init_constants();
    init_task();
    init_runtime();
    init_esm_env();
    init_deriveds();
    init_batch();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/blocks/html.js
var init_html = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/blocks/html.js"() {
    init_constants2();
    init_effects();
    init_hydration();
    init_reconciler();
    init_template();
    init_warnings();
    init_utils2();
    init_esm_env();
    init_context();
    init_operations();
    init_runtime();
    init_constants();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/blocks/slot.js
var init_slot = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/blocks/slot.js"() {
    init_hydration();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/shared/validate.js
var init_validate = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/shared/validate.js"() {
    init_utils2();
    init_warnings2();
    init_errors2();
    init_errors2();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/blocks/snippet.js
var init_snippet = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/blocks/snippet.js"() {
    init_constants();
    init_effects();
    init_context();
    init_hydration();
    init_reconciler();
    init_template();
    init_warnings();
    init_errors3();
    init_esm_env();
    init_operations();
    init_validate();
    init_branches();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/blocks/svelte-component.js
var init_svelte_component = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/blocks/svelte-component.js"() {
    init_constants();
    init_effects();
    init_hydration();
    init_branches();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/timing.js
var init_timing = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/timing.js"() {
    init_utils();
    init_esm_env();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/loop.js
var init_loop = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/loop.js"() {
    init_timing();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/elements/transitions.js
var init_transitions = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/elements/transitions.js"() {
    init_utils();
    init_effects();
    init_runtime();
    init_loop();
    init_render();
    init_constants2();
    init_constants();
    init_task();
    init_shared();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/blocks/svelte-element.js
var init_svelte_element = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/blocks/svelte-element.js"() {
    init_constants2();
    init_hydration();
    init_operations();
    init_effects();
    init_render();
    init_runtime();
    init_context();
    init_esm_env();
    init_constants();
    init_template();
    init_utils2();
    init_branches();
    init_transitions();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/blocks/svelte-head.js
var init_svelte_head = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/blocks/svelte-head.js"() {
    init_hydration();
    init_operations();
    init_effects();
    init_constants();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/css.js
var init_css2 = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/css.js"() {
    init_esm_env();
    init_css();
    init_effects();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/elements/actions.js
var init_actions = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/elements/actions.js"() {
    init_effects();
    init_equality();
    init_runtime();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/elements/attachments.js
var init_attachments2 = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/elements/attachments.js"() {
    init_effects();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/escaping.js
var init_escaping = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/escaping.js"() {
  }
});

// ../../node_modules/.pnpm/clsx@2.1.1/node_modules/clsx/dist/clsx.mjs
var init_clsx = __esm({
  "../../node_modules/.pnpm/clsx@2.1.1/node_modules/clsx/dist/clsx.mjs"() {
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/shared/attributes.js
var whitespace;
var init_attributes = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/shared/attributes.js"() {
    init_escaping();
    init_clsx();
    whitespace = [..." 	\n\r\f\xA0\v\uFEFF"];
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/elements/class.js
var init_class = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/elements/class.js"() {
    init_attributes();
    init_hydration();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/elements/style.js
var init_style = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/elements/style.js"() {
    init_attributes();
    init_hydration();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/elements/bindings/select.js
var init_select = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/elements/bindings/select.js"() {
    init_effects();
    init_shared();
    init_proxy();
    init_utils();
    init_warnings();
    init_batch();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/elements/attributes.js
var CLASS, STYLE, IS_CUSTOM_ELEMENT, IS_HTML;
var init_attributes2 = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/elements/attributes.js"() {
    init_esm_env();
    init_hydration();
    init_utils();
    init_events();
    init_misc();
    init_warnings();
    init_constants();
    init_task();
    init_utils2();
    init_runtime();
    init_attachments2();
    init_attributes();
    init_class();
    init_style();
    init_constants2();
    init_effects();
    init_select();
    init_async();
    CLASS = Symbol("class");
    STYLE = Symbol("style");
    IS_CUSTOM_ELEMENT = Symbol("is custom element");
    IS_HTML = Symbol("is html");
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/elements/bindings/document.js
var init_document = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/elements/bindings/document.js"() {
    init_shared();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/elements/bindings/input.js
var init_input = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/elements/bindings/input.js"() {
    init_esm_env();
    init_effects();
    init_shared();
    init_errors3();
    init_proxy();
    init_task();
    init_hydration();
    init_runtime();
    init_context();
    init_batch();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/elements/bindings/media.js
var init_media = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/elements/bindings/media.js"() {
    init_effects();
    init_shared();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/elements/bindings/navigator.js
var init_navigator = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/elements/bindings/navigator.js"() {
    init_shared();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/elements/bindings/props.js
var init_props = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/elements/bindings/props.js"() {
    init_effects();
    init_utils();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/elements/bindings/size.js
var init_size = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/elements/bindings/size.js"() {
    init_effects();
    init_runtime();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/elements/bindings/this.js
var init_this = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/elements/bindings/this.js"() {
    init_constants();
    init_effects();
    init_runtime();
    init_task();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/elements/bindings/universal.js
var init_universal = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/elements/bindings/universal.js"() {
    init_effects();
    init_shared();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/elements/bindings/window.js
var init_window = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/elements/bindings/window.js"() {
    init_effects();
    init_shared();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/legacy/event-modifiers.js
var init_event_modifiers = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/legacy/event-modifiers.js"() {
    init_utils();
    init_effects();
    init_events();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/legacy/lifecycle.js
var init_lifecycle = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/legacy/lifecycle.js"() {
    init_utils();
    init_context();
    init_deriveds();
    init_effects();
    init_runtime();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/legacy/misc.js
var init_misc2 = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/legacy/misc.js"() {
    init_sources();
    init_runtime();
    init_utils();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/reactivity/store.js
var IS_UNMOUNTED;
var init_store = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/reactivity/store.js"() {
    init_utils3();
    init_shared2();
    init_utils();
    init_runtime();
    init_effects();
    init_sources();
    init_esm_env();
    IS_UNMOUNTED = Symbol();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/reactivity/props.js
var init_props2 = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/reactivity/props.js"() {
    init_esm_env();
    init_constants2();
    init_utils();
    init_sources();
    init_deriveds();
    init_runtime();
    init_errors3();
    init_constants();
    init_proxy();
    init_store();
    init_flags();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/validate.js
var init_validate2 = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/validate.js"() {
    init_context();
    init_utils();
    init_errors3();
    init_constants2();
    init_effects();
    init_warnings();
    init_store();
    init_async();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/legacy/legacy-client.js
function createClassComponent(options) {
  return new Svelte4Component(options);
}
var Svelte4Component;
var init_legacy_client = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/legacy/legacy-client.js"() {
    init_constants();
    init_effects();
    init_sources();
    init_render();
    init_runtime();
    init_batch();
    init_utils();
    init_errors3();
    init_warnings();
    init_esm_env();
    init_constants2();
    init_context();
    init_flags();
    init_event_modifiers();
    __name(createClassComponent, "createClassComponent");
    Svelte4Component = class {
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
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/elements/custom-element.js
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
var SvelteElement;
var init_custom_element = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dom/elements/custom-element.js"() {
    init_legacy_client();
    init_effects();
    init_template();
    init_utils();
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
    __name(get_custom_element_value, "get_custom_element_value");
    __name(get_custom_elements_slots, "get_custom_elements_slots");
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dev/console-log.js
var init_console_log = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/dev/console-log.js"() {
    init_constants();
    init_clone();
    init_warnings();
    init_runtime();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/index.js
var init_client3 = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/index.js"() {
    init_attachments();
    init_constants2();
    init_context();
    init_assign();
    init_css();
    init_elements();
    init_hmr();
    init_ownership();
    init_legacy2();
    init_tracing();
    init_inspect();
    init_async2();
    init_validation();
    init_await();
    init_if();
    init_key();
    init_css_props();
    init_each();
    init_html();
    init_slot();
    init_snippet();
    init_svelte_component();
    init_svelte_element();
    init_svelte_head();
    init_css2();
    init_actions();
    init_attachments2();
    init_attributes2();
    init_class();
    init_events();
    init_misc();
    init_style();
    init_transitions();
    init_document();
    init_input();
    init_media();
    init_navigator();
    init_props();
    init_select();
    init_size();
    init_this();
    init_universal();
    init_window();
    init_hydration();
    init_event_modifiers();
    init_lifecycle();
    init_misc2();
    init_template();
    init_async();
    init_batch();
    init_deriveds();
    init_effects();
    init_sources();
    init_props2();
    init_store();
    init_boundary();
    init_legacy();
    init_render();
    init_runtime();
    init_validate2();
    init_timing();
    init_proxy();
    init_custom_element();
    init_operations();
    init_attributes();
    init_clone();
    init_utils();
    init_validate();
    init_equality2();
    init_console_log();
    init_error_handling();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/hydratable.js
var init_hydratable = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/internal/client/hydratable.js"() {
    init_flags();
    init_hydration();
    init_warnings();
    init_errors3();
    init_esm_env();
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/index-client.js
var init_index_client = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/index-client.js"() {
    init_runtime();
    init_utils();
    init_client3();
    init_errors3();
    init_flags();
    init_context();
    init_esm_env();
    init_batch();
    init_context();
    init_hydratable();
    init_render();
    init_runtime();
    init_snippet();
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
  }
});

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
var init_utils3 = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/store/utils.js"() {
    init_index_client();
    init_utils();
    __name(subscribe_to_store, "subscribe_to_store");
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/store/shared/index.js
function readable(value, start) {
  return {
    subscribe: writable(value, start).subscribe
  };
}
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
function get2(store) {
  let value;
  subscribe_to_store(store, (_) => value = _)();
  return value;
}
var subscriber_queue;
var init_shared2 = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/store/shared/index.js"() {
    init_utils();
    init_equality();
    init_utils3();
    subscriber_queue = [];
    __name(readable, "readable");
    __name(writable, "writable");
    __name(derived2, "derived");
    __name(get2, "get");
  }
});

// ../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/store/index-server.js
var init_index_server = __esm({
  "../../node_modules/.pnpm/svelte@5.46.0/node_modules/svelte/src/store/index-server.js"() {
    init_shared2();
    init_shared2();
  }
});

// ../../src/modules/storage.ts
var init_storage = __esm({
  "../../src/modules/storage.ts"() {
    "use strict";
  }
});

// ../../src/stores/auth.ts
function getAuthToken() {
  return get2(token);
}
function getCsrfToken() {
  return get2(csrfToken);
}
var isAuthenticated, user, token, csrfToken, encryptionEnabled, authCheckComplete, isTokenExpired, authRequired;
var init_auth2 = __esm({
  "../../src/stores/auth.ts"() {
    "use strict";
    init_index_server();
    init_encryption();
    init_storage();
    isAuthenticated = writable(false);
    user = writable(null);
    token = writable(null);
    csrfToken = writable(null);
    encryptionEnabled = writable(true);
    authCheckComplete = writable(false);
    isTokenExpired = derived2(
      user,
      ($user) => {
        if (!$user) return true;
        return new Date($user.expiresAt) < /* @__PURE__ */ new Date();
      }
    );
    authRequired = derived2(
      [encryptionEnabled, isAuthenticated, authCheckComplete],
      ([$encryptionEnabled, $isAuthenticated, $authCheckComplete]) => {
        if (!$authCheckComplete) {
          return true;
        }
        return $encryptionEnabled && !$isAuthenticated;
      }
    );
    __name(getAuthToken, "getAuthToken");
    __name(getCsrfToken, "getCsrfToken");
  }
});

// ../../src/core/api/factory.ts
function getApiUrl() {
  if (typeof window !== "undefined" && window.getWorkerApiUrl) {
    return window.getWorkerApiUrl() || "";
  }
  return "";
}
function createAPIClient(config = {}) {
  const apiUrl = getApiUrl();
  const defaultConfig = {
    baseURL: apiUrl,
    timeout: 3e4,
    retry: {
      maxAttempts: 3,
      backoff: "exponential",
      initialDelay: 1e3,
      maxDelay: 1e4,
      retryableErrors: [408, 429, 500, 502, 503, 504]
    },
    cache: {
      enabled: true,
      defaultStrategy: "network-first",
      defaultTTL: 5 * 60 * 1e3
      // 5 minutes
    },
    offline: {
      enabled: true,
      queueSize: 100,
      syncOnReconnect: true,
      retryOnReconnect: true
    },
    auth: {
      tokenGetter: getAuthToken,
      csrfTokenGetter: getCsrfToken,
      onTokenExpired: /* @__PURE__ */ __name(async () => {
        console.warn("[API] Token expired");
      }, "onTokenExpired")
    },
    ...config
  };
  return new EnhancedAPIClient(defaultConfig);
}
function getAPIClient() {
  if (!defaultClient) {
    defaultClient = createAPIClient();
  }
  return defaultClient;
}
function setAPIClient(client) {
  defaultClient = client;
}
function resetAPIClient() {
  defaultClient = null;
}
var defaultClient;
var init_factory = __esm({
  "../../src/core/api/factory.ts"() {
    "use strict";
    init_enhanced_client();
    init_auth2();
    __name(getApiUrl, "getApiUrl");
    __name(createAPIClient, "createAPIClient");
    defaultClient = null;
    __name(getAPIClient, "getAPIClient");
    __name(setAPIClient, "setAPIClient");
    __name(resetAPIClient, "resetAPIClient");
  }
});

// ../../src/core/api/request/index.ts
var init_request = __esm({
  "../../src/core/api/request/index.ts"() {
    "use strict";
    init_deduplicator();
    init_queue();
    init_cancellation();
    init_priority();
  }
});

// ../../src/core/api/resilience/index.ts
var init_resilience = __esm({
  "../../src/core/api/resilience/index.ts"() {
    "use strict";
    init_retry();
    init_circuit_breaker();
    init_offline();
  }
});

// ../../src/core/api/cache/index.ts
var init_cache = __esm({
  "../../src/core/api/cache/index.ts"() {
    "use strict";
    init_memory();
    init_indexeddb();
    init_strategies();
  }
});

// ../../src/core/api/batch/batcher.ts
var RequestBatcher;
var init_batcher = __esm({
  "../../src/core/api/batch/batcher.ts"() {
    "use strict";
    RequestBatcher = class {
      constructor(config = {}) {
        this.queue = [];
        this.timer = null;
        this.processing = false;
        this.config = {
          maxBatchSize: config.maxBatchSize || 10,
          batchDelay: config.batchDelay || 50,
          // 50ms debounce
          shouldBatch: config.shouldBatch || (() => true)
        };
      }
      static {
        __name(this, "RequestBatcher");
      }
      /**
       * Add request to batch
       */
      async batch(request, executor) {
        if (!this.config.shouldBatch(request)) {
          return executor();
        }
        return new Promise((resolve, reject) => {
          let batch = this.queue.find((b) => b.requests.length < this.config.maxBatchSize);
          if (!batch) {
            batch = {
              requests: [],
              resolve: /* @__PURE__ */ __name(() => {
              }, "resolve"),
              reject: /* @__PURE__ */ __name(() => {
              }, "reject")
            };
            this.queue.push(batch);
          }
          batch.requests.push(request);
          batch.executors = batch.executors || [];
          batch.executors.push(executor);
          batch.resolvers = batch.resolvers || [];
          batch.resolvers.push(resolve);
          batch.rejecters = batch.rejecters || [];
          batch.rejecters.push(reject);
          this.scheduleBatch();
        });
      }
      /**
       * Schedule batch processing
       */
      scheduleBatch() {
        if (this.timer) {
          clearTimeout(this.timer);
        }
        this.timer = setTimeout(() => {
          this.processBatches();
        }, this.config.batchDelay);
      }
      /**
       * Process all ready batches
       */
      async processBatches() {
        if (this.processing || this.queue.length === 0) {
          return;
        }
        this.processing = true;
        const batches2 = [...this.queue];
        this.queue = [];
        for (const batch of batches2) {
          await this.processBatch(batch);
        }
        this.processing = false;
      }
      /**
       * Process single batch
       */
      async processBatch(batch) {
        const executors = batch.executors || [];
        const resolvers = batch.resolvers || [];
        const rejecters = batch.rejecters || [];
        try {
          const responses = await Promise.all(executors.map((executor) => executor()));
          responses.forEach((response, index2) => {
            resolvers[index2]?.(response);
          });
        } catch (error) {
          rejecters.forEach((reject) => {
            reject(error);
          });
        }
      }
      /**
       * Clear all batches
       */
      clear() {
        if (this.timer) {
          clearTimeout(this.timer);
          this.timer = null;
        }
        for (const batch of this.queue) {
          const rejecters = batch.rejecters || [];
          rejecters.forEach((reject) => {
            reject(new Error("Batch cleared"));
          });
        }
        this.queue = [];
      }
    };
  }
});

// ../../src/core/api/batch/debouncer.ts
var RequestDebouncer;
var init_debouncer = __esm({
  "../../src/core/api/batch/debouncer.ts"() {
    "use strict";
    RequestDebouncer = class {
      constructor(config = {}) {
        this.timers = /* @__PURE__ */ new Map();
        this.config = {
          delay: config.delay || 300,
          // 300ms default
          shouldDebounce: config.shouldDebounce || (() => true)
        };
      }
      static {
        __name(this, "RequestDebouncer");
      }
      /**
       * Generate debounce key from request
       */
      getKey(request) {
        return `${request.method}:${request.path || request.url}`;
      }
      /**
       * Debounce request
       */
      debounce(request, executor) {
        if (!this.config.shouldDebounce(request)) {
          return executor();
        }
        const key2 = this.getKey(request);
        return new Promise((resolve, reject) => {
          const existingTimer = this.timers.get(key2);
          if (existingTimer) {
            clearTimeout(existingTimer);
          }
          const timer = setTimeout(async () => {
            this.timers.delete(key2);
            try {
              const response = await executor();
              resolve(response);
            } catch (error) {
              reject(error);
            }
          }, this.config.delay);
          this.timers.set(key2, timer);
        });
      }
      /**
       * Cancel debounced request
       */
      cancel(request) {
        const key2 = this.getKey(request);
        const timer = this.timers.get(key2);
        if (timer) {
          clearTimeout(timer);
          this.timers.delete(key2);
          return true;
        }
        return false;
      }
      /**
       * Clear all debounced requests
       */
      clear() {
        for (const timer of this.timers.values()) {
          clearTimeout(timer);
        }
        this.timers.clear();
      }
    };
  }
});

// ../../src/core/api/batch/index.ts
var init_batch2 = __esm({
  "../../src/core/api/batch/index.ts"() {
    "use strict";
    init_batcher();
    init_debouncer();
  }
});

// ../../src/core/api/optimistic/index.ts
var init_optimistic = __esm({
  "../../src/core/api/optimistic/index.ts"() {
    "use strict";
    init_updates();
  }
});

// ../../src/core/api/websocket/client.ts
var WebSocketClient;
var init_client4 = __esm({
  "../../src/core/api/websocket/client.ts"() {
    "use strict";
    WebSocketClient = class {
      constructor(config) {
        this.ws = null;
        this.messageQueue = [];
        this.pendingRequests = /* @__PURE__ */ new Map();
        this.reconnectAttempts = 0;
        this.reconnectTimer = null;
        this.listeners = /* @__PURE__ */ new Map();
        this.requestIdCounter = 0;
        this.config = {
          url: config.url,
          protocols: config.protocols || [],
          reconnectDelay: config.reconnectDelay || 1e3,
          maxReconnectDelay: config.maxReconnectDelay || 3e4,
          reconnectAttempts: config.reconnectAttempts || Infinity,
          queueMessages: config.queueMessages ?? true
        };
        this.connect();
      }
      static {
        __name(this, "WebSocketClient");
      }
      /**
       * Connect to WebSocket
       */
      connect() {
        try {
          this.ws = new WebSocket(this.config.url, this.config.protocols);
          this.setupEventHandlers();
        } catch (error) {
          this.handleReconnect();
        }
      }
      /**
       * Setup WebSocket event handlers
       */
      setupEventHandlers() {
        if (!this.ws) return;
        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          this.flushMessageQueue();
          this.emit("open");
        };
        this.ws.onmessage = (event2) => {
          try {
            const response = JSON.parse(event2.data);
            this.handleMessage(response);
          } catch (error) {
            this.emit("message", event2.data);
          }
        };
        this.ws.onerror = (error) => {
          this.emit("error", error);
        };
        this.ws.onclose = () => {
          this.emit("close");
          this.handleReconnect();
        };
      }
      /**
       * Handle incoming message
       */
      handleMessage(response) {
        if (response.requestId) {
          const pending2 = this.pendingRequests.get(response.requestId);
          if (pending2) {
            clearTimeout(pending2.timeout);
            if (response.error) {
              pending2.reject(new Error(response.error));
            } else {
              pending2.resolve(response);
            }
            this.pendingRequests.delete(response.requestId);
            return;
          }
        }
        if (response.type) {
          this.emit(response.type, response.data);
        } else {
          this.emit("message", response);
        }
      }
      /**
       * Send message
       */
      send(data) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          if (this.config.queueMessages) {
            this.messageQueue.push(data);
          }
          return;
        }
        try {
          this.ws.send(JSON.stringify(data));
        } catch (error) {
          if (this.config.queueMessages) {
            this.messageQueue.push(data);
          }
        }
      }
      /**
       * Send request and wait for response
       */
      async request(type, data, timeout = 5e3) {
        const requestId = `req_${++this.requestIdCounter}`;
        const request = {
          type,
          data,
          requestId
        };
        return new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            this.pendingRequests.delete(requestId);
            reject(new Error("WebSocket request timeout"));
          }, timeout);
          this.pendingRequests.set(requestId, {
            resolve,
            reject,
            timeout: timeoutId
          });
          this.send(request);
        });
      }
      /**
       * Flush message queue
       */
      flushMessageQueue() {
        while (this.messageQueue.length > 0 && this.isConnected()) {
          const message = this.messageQueue.shift();
          if (message) {
            this.send(message);
          }
        }
      }
      /**
       * Handle reconnection
       */
      handleReconnect() {
        if (this.reconnectAttempts >= this.config.reconnectAttempts) {
          return;
        }
        this.reconnectAttempts++;
        const delay = Math.min(
          this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
          this.config.maxReconnectDelay
        );
        this.reconnectTimer = setTimeout(() => {
          this.connect();
        }, delay);
      }
      /**
       * Check if connected
       */
      isConnected() {
        return this.ws?.readyState === WebSocket.OPEN;
      }
      /**
       * Disconnect
       */
      disconnect() {
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        if (this.ws) {
          this.ws.close();
          this.ws = null;
        }
        for (const pending2 of this.pendingRequests.values()) {
          clearTimeout(pending2.timeout);
          pending2.reject(new Error("WebSocket disconnected"));
        }
        this.pendingRequests.clear();
      }
      /**
       * Add event listener
       */
      on(event2, handler) {
        if (!this.listeners.has(event2)) {
          this.listeners.set(event2, []);
        }
        this.listeners.get(event2).push(handler);
        return () => {
          const handlers = this.listeners.get(event2);
          if (handlers) {
            const index2 = handlers.indexOf(handler);
            if (index2 > -1) {
              handlers.splice(index2, 1);
            }
          }
        };
      }
      /**
       * Emit event
       */
      emit(event2, data) {
        const handlers = this.listeners.get(event2);
        if (handlers) {
          handlers.forEach((handler) => handler(data));
        }
      }
    };
  }
});

// ../../src/core/api/websocket/index.ts
var init_websocket = __esm({
  "../../src/core/api/websocket/index.ts"() {
    "use strict";
    init_client4();
  }
});

// ../../src/core/api/index.ts
var init_api = __esm({
  "../../src/core/api/index.ts"() {
    "use strict";
    init_client();
    init_enhanced_client();
    init_factory();
    init_request();
    init_resilience();
    init_cache();
    init_batch2();
    init_optimistic();
    init_websocket();
    init_plugins();
    init_request_builder();
    init_response_handler();
    init_middleware();
    init_auth();
    init_error();
    init_transform();
  }
});

// ../shared/encryption/multi-stage-encryption.ts
async function hashKey(key2) {
  const encoder = new TextEncoder();
  const data = encoder.encode(key2);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function deriveKeyFromKey(key2, salt) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key2),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );
  const saltBuffer = new ArrayBuffer(salt.byteLength);
  const saltView = new Uint8Array(saltBuffer);
  saltView.set(salt);
  const saltArray = saltView;
  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltArray,
      iterations: PBKDF2_ITERATIONS2,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: KEY_LENGTH2 },
    false,
    ["encrypt", "decrypt"]
  );
  return derivedKey;
}
function arrayBufferToBase642(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
function base64ToArrayBuffer2(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
async function encryptWithKey(data, key2, keyType) {
  if (keyType === "jwt") {
    const encrypted = await encryptWithJWT(data, key2);
    return {
      encrypted: encrypted.data,
      iv: encrypted.iv,
      salt: encrypted.salt,
      keyHash: encrypted.tokenHash || ""
    };
  } else {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH2));
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH2));
    const derivedKey = await deriveKeyFromKey(key2, salt);
    const keyHash = await hashKey(key2);
    const encoder = new TextEncoder();
    const dataStr = JSON.stringify(data);
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      derivedKey,
      encoder.encode(dataStr)
    );
    return {
      encrypted: arrayBufferToBase642(encrypted),
      iv: arrayBufferToBase642(iv),
      salt: arrayBufferToBase642(salt),
      keyHash
    };
  }
}
async function decryptWithKey(encryptedData, iv, salt, key2, keyType) {
  if (keyType === "jwt") {
    const encrypted = {
      version: 3,
      encrypted: true,
      algorithm: "AES-GCM-256",
      iv,
      salt,
      data: encryptedData
    };
    return await decryptWithJWT(encrypted, key2);
  } else {
    const saltBuffer = base64ToArrayBuffer2(salt);
    const ivBuffer = base64ToArrayBuffer2(iv);
    const encryptedBuffer = base64ToArrayBuffer2(encryptedData);
    const saltArray = new Uint8Array(saltBuffer);
    const ivArray = new Uint8Array(ivBuffer);
    const derivedKey = await deriveKeyFromKey(key2, saltArray);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: ivArray },
      derivedKey,
      encryptedBuffer
    );
    const decoder = new TextDecoder();
    const dataStr = decoder.decode(decrypted);
    return JSON.parse(dataStr);
  }
}
async function encryptMultiStage(data, parties) {
  if (!parties || parties.length < 2) {
    throw new Error("Multi-stage encryption requires at least 2 parties");
  }
  if (parties.length > 10) {
    throw new Error("Multi-stage encryption supports maximum 10 parties for security reasons");
  }
  for (const party of parties) {
    if (!party.key || party.key.length < 10) {
      throw new Error(`Invalid key for party ${party.id}: key must be at least 10 characters`);
    }
    if (!party.id) {
      throw new Error("All parties must have an id");
    }
  }
  const masterKeyBytes = crypto.getRandomValues(new Uint8Array(32));
  const masterKey = arrayBufferToBase642(masterKeyBytes.buffer);
  const dataStr = JSON.stringify(data);
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(dataStr);
  const masterSalt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH2));
  const masterIV = crypto.getRandomValues(new Uint8Array(IV_LENGTH2));
  const masterKeyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(masterKey),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );
  const masterEncryptionKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: masterSalt,
      iterations: PBKDF2_ITERATIONS2,
      hash: "SHA-256"
    },
    masterKeyMaterial,
    { name: "AES-GCM", length: KEY_LENGTH2 },
    false,
    ["encrypt", "decrypt"]
  );
  const encryptedData = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: masterIV },
    masterEncryptionKey,
    dataBytes
  );
  const stages = [];
  for (let i = 0; i < parties.length; i++) {
    const party = parties[i];
    const stageNumber = i + 1;
    const encrypted = await encryptWithKey(masterKey, party.key, party.keyType);
    stages.push({
      stage: stageNumber,
      encrypted: true,
      algorithm: "AES-GCM-256",
      iv: encrypted.iv,
      salt: encrypted.salt,
      keyHash: encrypted.keyHash,
      keyType: party.keyType,
      data: encrypted.encrypted
      // This is the encrypted master key
    });
  }
  const masterInfo = {
    encryptedData: arrayBufferToBase642(encryptedData),
    masterIV: arrayBufferToBase642(masterIV),
    masterSalt: arrayBufferToBase642(masterSalt)
  };
  const masterInfoStr = JSON.stringify(masterInfo);
  const masterInfoB64 = btoa(masterInfoStr);
  return {
    version: 3,
    // Bump version to indicate new order-independent format
    multiEncrypted: true,
    stageCount: parties.length,
    stages,
    // Store encrypted data + master key metadata in a way that's accessible
    // We'll use a special field or encode it
    data: masterInfoB64,
    // Store encrypted data + master IV/salt here
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function decryptMultiStage(encryptedData, parties) {
  if (!encryptedData.multiEncrypted) {
    if (parties.length > 0 && parties[0].keyType === "jwt") {
      return await decryptWithJWT(encryptedData, parties[0].key);
    }
    throw new Error("Data is not multi-encrypted");
  }
  if (parties.length !== encryptedData.stageCount) {
    throw new Error(
      `Decryption requires exactly ${encryptedData.stageCount} parties, but ${parties.length} provided`
    );
  }
  if (encryptedData.version >= 3 && encryptedData.data) {
    const partyMap2 = /* @__PURE__ */ new Map();
    for (const party of parties) {
      let keyHash;
      if (party.keyType === "jwt") {
        const encoder2 = new TextEncoder();
        const data = encoder2.encode(party.key);
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        keyHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
      } else {
        keyHash = await hashKey(party.key);
      }
      partyMap2.set(keyHash, party);
    }
    const verifiedParties = /* @__PURE__ */ new Set();
    let masterKey = null;
    for (const stage of encryptedData.stages) {
      let party = partyMap2.get(stage.keyHash);
      if (!party) {
        const partiesWithMatchingType = parties.filter((p) => p.keyType === stage.keyType);
        if (partiesWithMatchingType.length > 0) {
          throw new Error(
            `Decryption failed - no party provided with key matching stage ${stage.stage}. All parties must provide the correct keys (order does not matter).`
          );
        } else {
          const providedTypes = [...new Set(parties.map((p) => p.keyType))];
          throw new Error(
            `key type mismatch for stage ${stage.stage}. Expected ${stage.keyType}, but provided key types were: ${providedTypes.join(", ")}.`
          );
        }
      }
      if (party.keyType !== stage.keyType) {
        throw new Error(
          `key type mismatch for stage ${stage.stage}. Expected ${stage.keyType}, got ${party.keyType}.`
        );
      }
      try {
        const decryptedMasterKey = await decryptWithKey(
          stage.data,
          stage.iv,
          stage.salt,
          party.key,
          party.keyType
        );
        if (masterKey === null) {
          masterKey = decryptedMasterKey;
        } else if (masterKey !== decryptedMasterKey) {
          throw new Error(
            "Decryption failed - master keys do not match. This indicates corrupted or tampered data."
          );
        }
        verifiedParties.add(stage.keyHash);
      } catch (error) {
        throw new Error(
          `Decryption failed - key for party ${party.id} (stage ${stage.stage}) is incorrect. All parties must provide the correct keys (order does not matter).`
        );
      }
    }
    if (verifiedParties.size !== encryptedData.stageCount) {
      throw new Error(
        `Decryption failed - only ${verifiedParties.size} of ${encryptedData.stageCount} parties verified. All parties must provide the correct keys (order does not matter).`
      );
    }
    if (!masterKey) {
      throw new Error(
        "Decryption failed - could not decrypt master key. All parties must provide the correct keys (order does not matter)."
      );
    }
    const masterInfoStr = atob(encryptedData.data);
    const masterInfo = JSON.parse(masterInfoStr);
    const masterIV = base64ToArrayBuffer2(masterInfo.masterIV);
    const masterSalt = base64ToArrayBuffer2(masterInfo.masterSalt);
    const encryptedDataBuffer = base64ToArrayBuffer2(masterInfo.encryptedData);
    const encoder = new TextEncoder();
    const masterKeyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(masterKey),
      "PBKDF2",
      false,
      ["deriveBits", "deriveKey"]
    );
    const masterEncryptionKey = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: new Uint8Array(masterSalt),
        iterations: PBKDF2_ITERATIONS2,
        hash: "SHA-256"
      },
      masterKeyMaterial,
      { name: "AES-GCM", length: KEY_LENGTH2 },
      false,
      ["encrypt", "decrypt"]
    );
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(masterIV) },
      masterEncryptionKey,
      encryptedDataBuffer
    );
    const decoder = new TextDecoder();
    const dataStr = decoder.decode(decrypted);
    return JSON.parse(dataStr);
  }
  const partyMap = /* @__PURE__ */ new Map();
  for (const party of parties) {
    let keyHash;
    if (party.keyType === "jwt") {
      const encoder = new TextEncoder();
      const data = encoder.encode(party.key);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      keyHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    } else {
      keyHash = await hashKey(party.key);
    }
    partyMap.set(keyHash, party);
  }
  let currentData = encryptedData;
  for (let i = encryptedData.stages.length - 1; i >= 0; i--) {
    const stage = encryptedData.stages[i];
    const party = partyMap.get(stage.keyHash);
    if (!party || party.keyType !== stage.keyType) {
      throw new Error(
        `Decryption failed - no party provided with key matching stage ${stage.stage}. All parties must provide the correct keys.`
      );
    }
    if (i === encryptedData.stages.length - 1) {
      currentData = await decryptWithKey(
        stage.data,
        stage.iv,
        stage.salt,
        party.key,
        party.keyType
      );
    } else {
      const previousStageData = currentData;
      currentData = await decryptWithKey(
        previousStageData.data,
        previousStageData.iv || stage.iv,
        previousStageData.salt || stage.salt,
        party.key,
        party.keyType
      );
    }
  }
  return currentData;
}
async function encryptTwoStage(data, userToken, requestKey) {
  const stage1Data = await encryptWithJWT(data, userToken);
  const stage2Encrypted = await encryptWithKey(
    stage1Data,
    // Encrypt the entire stage1 encrypted data
    requestKey,
    "request-key"
  );
  return {
    version: 1,
    doubleEncrypted: true,
    stage1: {
      encrypted: true,
      algorithm: "AES-GCM-256",
      iv: stage1Data.iv,
      salt: stage1Data.salt,
      tokenHash: stage1Data.tokenHash || "",
      data: stage1Data.data
    },
    stage2: {
      encrypted: true,
      algorithm: "AES-GCM-256",
      iv: stage2Encrypted.iv,
      salt: stage2Encrypted.salt,
      keyHash: stage2Encrypted.keyHash,
      data: stage2Encrypted.encrypted
      // This is the encrypted stage1 data
    },
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function decryptTwoStage(encryptedData, userToken, requestKey) {
  if (!encryptedData.doubleEncrypted) {
    return await decryptWithJWT(encryptedData, userToken);
  }
  const stage1EncryptedData = await decryptWithKey(
    encryptedData.stage2.data,
    encryptedData.stage2.iv,
    encryptedData.stage2.salt,
    requestKey,
    "request-key"
  );
  return await decryptWithJWT(stage1EncryptedData, userToken);
}
function generateRequestKey() {
  const keyBytes = crypto.getRandomValues(new Uint8Array(32));
  return arrayBufferToBase642(keyBytes.buffer);
}
function isMultiEncrypted(data) {
  return typeof data === "object" && data !== null && "multiEncrypted" in data && data.multiEncrypted === true;
}
function isDoubleEncrypted(data) {
  return typeof data === "object" && data !== null && "doubleEncrypted" in data && data.doubleEncrypted === true;
}
var PBKDF2_ITERATIONS2, SALT_LENGTH2, IV_LENGTH2, KEY_LENGTH2;
var init_multi_stage_encryption = __esm({
  "../shared/encryption/multi-stage-encryption.ts"() {
    "use strict";
    init_jwt_encryption();
    PBKDF2_ITERATIONS2 = 1e5;
    SALT_LENGTH2 = 16;
    IV_LENGTH2 = 12;
    KEY_LENGTH2 = 256;
    __name(hashKey, "hashKey");
    __name(deriveKeyFromKey, "deriveKeyFromKey");
    __name(arrayBufferToBase642, "arrayBufferToBase64");
    __name(base64ToArrayBuffer2, "base64ToArrayBuffer");
    __name(encryptWithKey, "encryptWithKey");
    __name(decryptWithKey, "decryptWithKey");
    __name(encryptMultiStage, "encryptMultiStage");
    __name(decryptMultiStage, "decryptMultiStage");
    __name(encryptTwoStage, "encryptTwoStage");
    __name(decryptTwoStage, "decryptTwoStage");
    __name(generateRequestKey, "generateRequestKey");
    __name(isMultiEncrypted, "isMultiEncrypted");
    __name(isDoubleEncrypted, "isDoubleEncrypted");
  }
});

// ../shared/encryption/middleware.ts
function createEncryptionWrapper(handler, options) {
  return async (...args) => {
    const response = await handler(...args);
    let auth;
    for (const arg of args) {
      if (arg && typeof arg === "object" && ("jwtToken" in arg || "customerId" in arg)) {
        auth = arg;
        break;
      }
    }
    const enabled = options?.enabled !== false;
    if (!enabled) {
      return {
        response,
        customerId: auth?.customerId || null
      };
    }
    const shouldEncrypt = options?.shouldEncrypt ? options.shouldEncrypt(response) : response.ok && auth?.jwtToken;
    if (!shouldEncrypt || !auth?.jwtToken) {
      return {
        response,
        customerId: auth?.customerId || null
      };
    }
    try {
      const contentType = response.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        return {
          response,
          customerId: auth.customerId || null
        };
      }
      const responseData = await response.json();
      const encrypted = await encryptWithJWT(responseData, auth.jwtToken);
      const headers = new Headers(response.headers);
      headers.set("Content-Type", "application/json");
      headers.set("X-Encrypted", "true");
      return {
        response: new Response(JSON.stringify(encrypted), {
          status: response.status,
          statusText: response.statusText,
          headers
        }),
        customerId: auth.customerId || null
      };
    } catch (error) {
      console.error("Failed to encrypt response:", error);
      return {
        response,
        customerId: auth.customerId || null
      };
    }
  };
}
async function wrapWithEncryption(handlerResponse, auth) {
  if (!auth?.jwtToken || !handlerResponse.ok) {
    return {
      response: handlerResponse,
      customerId: auth?.customerId || null
    };
  }
  try {
    const contentType = handlerResponse.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return {
        response: handlerResponse,
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
var init_middleware3 = __esm({
  "../shared/encryption/middleware.ts"() {
    "use strict";
    init_jwt_encryption();
    __name(createEncryptionWrapper, "createEncryptionWrapper");
    __name(wrapWithEncryption, "wrapWithEncryption");
  }
});

// ../shared/encryption/route-encryption.ts
async function deriveKeyFromServiceKey(serviceKey, salt) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(serviceKey),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );
  const saltBuffer = new ArrayBuffer(salt.byteLength);
  const saltView = new Uint8Array(saltBuffer);
  saltView.set(salt);
  const saltArray = saltView;
  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltArray,
      iterations: PBKDF2_ITERATIONS3,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: KEY_LENGTH3 },
    false,
    ["encrypt", "decrypt"]
  );
  return derivedKey;
}
async function hashServiceKey(key2) {
  const encoder = new TextEncoder();
  const data = encoder.encode(key2);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
function arrayBufferToBase643(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
async function encryptWithServiceKey(data, serviceKey) {
  if (!serviceKey || serviceKey.length < 32) {
    throw new Error("Valid service key is required for encryption (minimum 32 characters)");
  }
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH3));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH3));
  const key2 = await deriveKeyFromServiceKey(serviceKey, salt);
  const keyHash = await hashServiceKey(serviceKey);
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
    iv: arrayBufferToBase643(iv.buffer),
    salt: arrayBufferToBase643(salt.buffer),
    tokenHash: keyHash,
    // Reuse tokenHash field for service key hash
    data: arrayBufferToBase643(encrypted),
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function base64ToArrayBuffer3(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
async function decryptWithServiceKey(encryptedData, serviceKey) {
  if (!encryptedData || typeof encryptedData !== "object" || !("encrypted" in encryptedData)) {
    return encryptedData;
  }
  const encrypted = encryptedData;
  if (!encrypted.encrypted) {
    return encryptedData;
  }
  if (!serviceKey || serviceKey.length < 32) {
    throw new Error("Valid service key is required for decryption (minimum 32 characters)");
  }
  const salt = base64ToArrayBuffer3(encrypted.salt);
  const iv = base64ToArrayBuffer3(encrypted.iv);
  const encryptedDataBuffer = base64ToArrayBuffer3(encrypted.data);
  if (encrypted.tokenHash) {
    const keyHash = await hashServiceKey(serviceKey);
    if (encrypted.tokenHash !== keyHash) {
      throw new Error(
        "Decryption failed - service key does not match. The service key used for encryption does not match the provided key."
      );
    }
  }
  const key2 = await deriveKeyFromServiceKey(serviceKey, new Uint8Array(salt));
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
      "Decryption failed - incorrect service key or corrupted data. Please verify the service key matches the one used for encryption."
    );
  }
}
function matchesPattern(path, pattern) {
  if (path === pattern) {
    return true;
  }
  const regexPattern = pattern.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*").replace(/\//g, "\\/");
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(path);
}
function findMatchingPolicy(path, policies, request) {
  for (const policy of policies) {
    if (matchesPattern(path, policy.pattern)) {
      if (policy.condition && request) {
        if (!policy.condition(request)) {
          continue;
        }
      }
      return policy;
    }
  }
  return null;
}
async function encryptResponse(data, context, policy) {
  try {
    let encryptedData;
    let strategy;
    switch (policy.strategy) {
      case "jwt":
        if (!context.jwtToken) {
          if (policy.mandatory) {
            throw new Error(`JWT token required for route ${context.path} but not provided`);
          }
          return {
            encrypted: false,
            error: new Error("JWT token required but not available")
          };
        }
        encryptedData = await encryptWithJWT(data, context.jwtToken);
        strategy = "jwt";
        break;
      case "service-key":
        if (!context.serviceKey) {
          if (policy.mandatory) {
            throw new Error(`Service key required for route ${context.path} but not configured`);
          }
          return {
            encrypted: false,
            error: new Error("Service key required but not configured")
          };
        }
        encryptedData = await encryptWithServiceKey(data, context.serviceKey);
        strategy = "service-key";
        break;
      case "conditional-jwt":
        if (context.jwtToken) {
          encryptedData = await encryptWithJWT(data, context.jwtToken);
          strategy = "jwt";
        } else if (context.serviceKey) {
          encryptedData = await encryptWithServiceKey(data, context.serviceKey);
          strategy = "service-key";
        } else {
          if (policy.mandatory) {
            throw new Error(`Encryption required for route ${context.path} but no key available`);
          }
          return {
            encrypted: false,
            error: new Error("No encryption key available (JWT or service key)")
          };
        }
        break;
      case "none":
        return {
          encrypted: false,
          strategy: "none"
        };
      default:
        throw new Error(`Unknown encryption strategy: ${policy.strategy}`);
    }
    return {
      encrypted: true,
      encryptedData,
      strategy
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    if (policy.mandatory) {
      throw err;
    }
    return {
      encrypted: false,
      error: err
    };
  }
}
function extractJWTToken(request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token2 = authHeader.substring(7);
  return token2.length >= 10 ? token2 : null;
}
function getServiceKey(env) {
  return env.SERVICE_ENCRYPTION_KEY || null;
}
function createEncryptionContext(request, env) {
  return {
    jwtToken: extractJWTToken(request),
    serviceKey: getServiceKey(env),
    path: new URL(request.url).pathname,
    method: request.method
  };
}
var PBKDF2_ITERATIONS3, SALT_LENGTH3, IV_LENGTH3, KEY_LENGTH3, DEFAULT_ENCRYPTION_POLICIES;
var init_route_encryption = __esm({
  "../shared/encryption/route-encryption.ts"() {
    "use strict";
    init_jwt_encryption();
    PBKDF2_ITERATIONS3 = 1e5;
    SALT_LENGTH3 = 16;
    IV_LENGTH3 = 12;
    KEY_LENGTH3 = 256;
    __name(deriveKeyFromServiceKey, "deriveKeyFromServiceKey");
    __name(hashServiceKey, "hashServiceKey");
    __name(arrayBufferToBase643, "arrayBufferToBase64");
    __name(encryptWithServiceKey, "encryptWithServiceKey");
    __name(base64ToArrayBuffer3, "base64ToArrayBuffer");
    __name(decryptWithServiceKey, "decryptWithServiceKey");
    __name(matchesPattern, "matchesPattern");
    __name(findMatchingPolicy, "findMatchingPolicy");
    __name(encryptResponse, "encryptResponse");
    DEFAULT_ENCRYPTION_POLICIES = [
      // Root and static assets - don't encrypt (HTML, JS, CSS, etc.)
      {
        pattern: "/",
        strategy: "none"
        // Root path typically serves dashboard HTML
      },
      {
        pattern: "/assets/**",
        strategy: "none"
        // Static assets (JS, CSS, images) don't need encryption
      },
      // Public routes - don't encrypt (clients need to read responses without JWT/service key)
      {
        pattern: "/signup",
        strategy: "none"
        // Don't encrypt - client needs to read success/error messages
      },
      {
        pattern: "/signup/**",
        strategy: "none"
        // Don't encrypt - client needs to read API keys, JWT tokens, customer info
      },
      {
        pattern: "/health",
        strategy: "none"
        // Health checks don't need encryption
      },
      {
        pattern: "/health/**",
        strategy: "none"
      },
      {
        pattern: "/openapi.json",
        strategy: "none"
        // API docs can be public
      },
      {
        pattern: "/track/**",
        strategy: "service-key",
        mandatory: true
      },
      // Auth routes - don't encrypt endpoints that clients need to read before authentication
      {
        pattern: "/auth/request-otp",
        strategy: "none"
        // Don't encrypt - client needs to read success/error, rate limit info
      },
      {
        pattern: "/auth/verify-otp",
        strategy: "none"
        // Don't encrypt - client needs to read the JWT token
      },
      {
        pattern: "/auth/**",
        strategy: "conditional-jwt",
        mandatory: true
      },
      // Protected routes - require JWT
      {
        pattern: "/user/**",
        strategy: "jwt",
        mandatory: true
      },
      {
        pattern: "/game/**",
        strategy: "jwt",
        mandatory: true
      },
      {
        pattern: "/admin/**",
        strategy: "jwt",
        mandatory: true
      },
      // Default catch-all - encrypt with available key
      {
        pattern: "/**",
        strategy: "conditional-jwt",
        mandatory: false
        // Allow fallback for unknown routes
      }
    ];
    __name(extractJWTToken, "extractJWTToken");
    __name(getServiceKey, "getServiceKey");
    __name(createEncryptionContext, "createEncryptionContext");
  }
});

// ../shared/encryption/encryption-middleware.ts
async function applyEncryptionMiddleware(response, request, env, options = {}) {
  const {
    policies = [],
    logErrors = true,
    onEncryptionError
  } = options;
  const allPolicies = [...DEFAULT_ENCRYPTION_POLICIES, ...policies];
  const context = createEncryptionContext(request, env);
  const policy = findMatchingPolicy(context.path, allPolicies, request);
  if (!policy) {
    if (logErrors) {
      console.warn(`No encryption policy found for route: ${context.path}`);
    }
    return response;
  }
  if (policy.strategy === "none") {
    return response;
  }
  if (!response.ok) {
    return response;
  }
  const contentType = response.headers.get("Content-Type");
  if (!contentType || !contentType.includes("application/json")) {
    return response;
  }
  try {
    const responseData = await response.json();
    const result = await encryptResponse(
      responseData,
      context,
      policy
    );
    if (!result.encrypted) {
      if (result.error) {
        if (policy.mandatory) {
          const error = new Error(
            `Mandatory encryption failed for route ${context.path}: ${result.error.message}`
          );
          if (onEncryptionError) {
            onEncryptionError(error, context);
          } else if (logErrors) {
            console.error("Mandatory encryption failed:", error);
          }
          return new Response(
            JSON.stringify({
              error: "Encryption failed",
              code: "ENCRYPTION_ERROR",
              message: "Response could not be encrypted. Please try again."
            }),
            {
              status: 500,
              headers: {
                "Content-Type": "application/json",
                ...Object.fromEntries(response.headers.entries())
              }
            }
          );
        } else {
          if (logErrors) {
            console.warn(`Encryption failed for route ${context.path}:`, result.error);
          }
          return response;
        }
      }
      return response;
    }
    const headers = new Headers(response.headers);
    headers.set("Content-Type", "application/json");
    headers.set("X-Encrypted", "true");
    headers.set("X-Encryption-Strategy", result.strategy || "unknown");
    return new Response(JSON.stringify(result.encryptedData), {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    if (policy.mandatory) {
      if (onEncryptionError) {
        onEncryptionError(err, context);
      } else if (logErrors) {
        console.error("Encryption middleware error:", err);
      }
      return new Response(
        JSON.stringify({
          error: "Encryption failed",
          code: "ENCRYPTION_ERROR",
          message: "Response could not be encrypted. Please try again."
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...Object.fromEntries(response.headers.entries())
          }
        }
      );
    } else {
      if (logErrors) {
        console.warn(`Encryption middleware error for route ${context.path}:`, err);
      }
      return response;
    }
  }
}
function withEncryption(handler, options = {}) {
  return (async (...args) => {
    const request = args[0];
    const env = args[1];
    const response = await handler(...args);
    return await applyEncryptionMiddleware(response, request, env, options);
  });
}
function createServicePolicies(basePolicies, servicePolicies) {
  return [...basePolicies, ...servicePolicies];
}
var init_encryption_middleware = __esm({
  "../shared/encryption/encryption-middleware.ts"() {
    "use strict";
    init_route_encryption();
    __name(applyEncryptionMiddleware, "applyEncryptionMiddleware");
    __name(withEncryption, "withEncryption");
    __name(createServicePolicies, "createServicePolicies");
  }
});

// ../shared/encryption/index.ts
var init_encryption3 = __esm({
  "../shared/encryption/index.ts"() {
    "use strict";
    init_jwt_encryption();
    init_multi_stage_encryption();
    init_middleware3();
    init_route_encryption();
    init_encryption_middleware();
  }
});

// ../shared/api/index.ts
var api_exports = {};
__export(api_exports, {
  APIClient: () => APIClient,
  COMMON_TAGS: () => COMMON_TAGS,
  CacheManager: () => CacheManager,
  CancellationManager: () => CancellationManager,
  CircuitBreaker: () => CircuitBreaker,
  EnhancedAPIClient: () => EnhancedAPIClient,
  EnhancedAPIClientV2: () => EnhancedAPIClientV2,
  IndexedDBCache: () => IndexedDBCache,
  KVCache: () => KVCache,
  MemoryCache: () => MemoryCache,
  MiddlewarePipeline: () => MiddlewarePipeline,
  OfflineQueue: () => OfflineQueue,
  OptimisticUpdateManager: () => OptimisticUpdateManager,
  PluginManager: () => PluginManager,
  RequestBatcher: () => RequestBatcher,
  RequestBuilder: () => RequestBuilder,
  RequestDebouncer: () => RequestDebouncer,
  RequestDeduplicator: () => RequestDeduplicator,
  RequestQueue: () => RequestQueue,
  RetryManager: () => RetryManager,
  TypeRegistry: () => TypeRegistry,
  WebSocketClient: () => WebSocketClient,
  WorkerAdapter: () => WorkerAdapter,
  applyEncryptionMiddleware: () => applyEncryptionMiddleware,
  applyFiltering: () => applyFiltering,
  buildResponse: () => buildResponse,
  clearCachedMetric: () => clearCachedMetric,
  comparePriority: () => comparePriority,
  composeServerMiddlewares: () => composeServerMiddlewares,
  computeMetric: () => computeMetric,
  computeMetrics: () => computeMetrics,
  createAPIClient: () => createAPIClient,
  createAnalyticsPlugin: () => createAnalyticsPlugin,
  createAuthMiddleware: () => createAuthMiddleware,
  createCORSHeaders: () => createCORSHeaders,
  createCORSMiddleware: () => createCORSMiddleware,
  createE2EEncryptionMiddleware: () => createE2EEncryptionMiddleware,
  createEncryptionWrapper: () => createEncryptionWrapper,
  createEnhancedAPIClient: () => createEnhancedAPIClient,
  createEnhancedHandler: () => createEnhancedHandler,
  createError: () => createError,
  createErrorLegendMiddleware: () => createErrorLegendMiddleware,
  createErrorMiddleware: () => createErrorMiddleware,
  createGetHandler: () => createGetHandler,
  createKVCache: () => createKVCache,
  createLoggingPlugin: () => createLoggingPlugin,
  createMetricsPlugin: () => createMetricsPlugin,
  createPostHandler: () => createPostHandler,
  createRFC7807Error: () => createRFC7807Error,
  createRFC7807Response: () => createRFC7807Response,
  createRequest: () => createRequest,
  createResponseBuilderMiddleware: () => createResponseBuilderMiddleware,
  createResponseFilterMiddleware: () => createResponseFilterMiddleware,
  createServerMiddleware: () => createServerMiddleware,
  createServicePolicies: () => createServicePolicies,
  createTransformMiddleware: () => createTransformMiddleware,
  createWorkerAdapter: () => createWorkerAdapter,
  createWorkerHandler: () => createWorkerHandler,
  decryptMultiStage: () => decryptMultiStage,
  decryptTwoStage: () => decryptTwoStage,
  decryptWithJWT: () => decryptWithJWT,
  decryptWithJWTEnhanced: () => decryptWithJWT,
  decryptWithServiceKey: () => decryptWithServiceKey,
  defaultRequestTransformer: () => defaultRequestTransformer,
  defaultResponseTransformer: () => defaultResponseTransformer,
  detectPlatform: () => detectPlatform,
  encryptMultiStage: () => encryptMultiStage,
  encryptTwoStage: () => encryptTwoStage,
  encryptWithJWT: () => encryptWithJWT,
  encryptWithJWTEnhanced: () => encryptWithJWT,
  encryptWithServiceKey: () => encryptWithServiceKey,
  enhanceErrorWithLegend: () => enhanceErrorWithLegend,
  extractErrorMessage: () => extractErrorMessage,
  formatErrorAsRFC7807: () => formatErrorAsRFC7807,
  generateMetricCacheKey: () => generateMetricCacheKey,
  generateRequestKey: () => generateRequestKey,
  getAPIClient: () => getAPIClient,
  getDefaultPriority: () => getDefaultPriority,
  getEnhancedAPIClient: () => getEnhancedAPIClient,
  getStorageAdapter: () => getStorageAdapter,
  getTagFields: () => getTagFields2,
  getType: () => getType,
  getTypeRegistry: () => getTypeRegistry,
  handleCORSPreflight: () => handleCORSPreflight,
  handleErrorResponse: () => handleErrorResponse,
  handleResponse: () => handleResponse,
  initializeCommonTags: () => initializeCommonTags,
  isBrowser: () => isBrowser,
  isCloudflareWorker: () => isCloudflareWorker,
  isDoubleEncrypted: () => isDoubleEncrypted,
  isHigherPriority: () => isHigherPriority,
  isMultiEncrypted: () => isMultiEncrypted,
  isNode: () => isNode,
  isRetryableError: () => isRetryableError,
  isSuccessResponse: () => isSuccessResponse,
  parseFilteringParams: () => parseFilteringParams,
  registerTag: () => registerTag,
  registerType: () => registerType,
  resetAPIClient: () => resetAPIClient,
  resetEnhancedAPIClient: () => resetEnhancedAPIClient,
  setAPIClient: () => setAPIClient,
  setEnhancedAPIClient: () => setEnhancedAPIClient,
  validateResponse: () => validateResponse,
  withEncryption: () => withEncryption,
  withMiddleware: () => withMiddleware,
  wrapWithEncryption: () => wrapWithEncryption
});
var init_api2 = __esm({
  "../shared/api/index.ts"() {
    "use strict";
    init_api();
    init_enhanced();
    init_factory();
    init_encryption3();
  }
});

// ../shared/api/enhanced.ts
init_enhanced();

// utils/errors.js
function requestToAPIRequest2(request) {
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
__name(requestToAPIRequest2, "requestToAPIRequest");
function createError2(request, status, title, detail, additionalFields) {
  const apiRequest = requestToAPIRequest2(request);
  return createRFC7807Error(apiRequest, status, title, detail, additionalFields);
}
__name(createError2, "createError");

// utils/cors.js
function getCorsHeaders2(env, request) {
  const origin = request.headers.get("Origin");
  const allowedOrigins = env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()) : [];
  let allowOrigin = "*";
  if (allowedOrigins.length > 0) {
    const matchedOrigin = allowedOrigins.find((allowed) => {
      if (allowed === "*") return true;
      if (allowed.endsWith("*")) {
        const prefix = allowed.slice(0, -1);
        return origin && origin.startsWith(prefix);
      }
      return origin === allowed;
    });
    allowOrigin = matchedOrigin === "*" ? "*" : matchedOrigin || null;
  }
  return {
    "Access-Control-Allow-Origin": allowOrigin || "null",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, X-CSRF-Token",
    "Access-Control-Allow-Credentials": allowOrigin !== "*" ? "true" : "false",
    "Access-Control-Max-Age": "86400",
    // Security headers
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'"
  };
}
__name(getCorsHeaders2, "getCorsHeaders");

// utils/customer.js
function getCustomerKey(customerId, key2) {
  return customerId ? `cust_${customerId}_${key2}` : key2;
}
__name(getCustomerKey, "getCustomerKey");

// handlers/game/character.js
async function handleGetCharacter(request, env, userId, customerId) {
  try {
    const url = new URL(request.url);
    const characterId = url.searchParams.get("characterId");
    if (!characterId) {
      return new Response(JSON.stringify({
        error: "Bad Request",
        message: "characterId query parameter is required"
      }), {
        status: 400,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const characterKey = getCustomerKey(customerId, `character_${characterId}`);
    const character = await env.GAME_KV.get(characterKey, { type: "json" });
    if (!character) {
      return new Response(JSON.stringify({
        error: "Not Found",
        message: "Character not found"
      }), {
        status: 404,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify({
      success: true,
      character
    }), {
      status: 200,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Get character error:", error);
    return new Response(JSON.stringify({
      error: "Internal server error",
      message: env.ENVIRONMENT === "development" ? error.message : void 0
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleGetCharacter, "handleGetCharacter");
async function handleCreateCharacter(request, env, userId, customerId) {
  try {
    const body = await request.json();
    const { name, appearance } = body;
    if (!name || !appearance) {
      return new Response(JSON.stringify({
        error: "Bad Request",
        message: "name and appearance are required"
      }), {
        status: 400,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const characterId = `char_${userId}_${Date.now()}`;
    const character = {
      id: characterId,
      userId,
      name,
      level: 1,
      experience: 0,
      vitals: {
        healthCurrent: 100,
        healthMax: 100,
        energyCurrent: 50,
        energyMax: 50
      },
      stats: {
        strength: 10,
        dexterity: 10,
        intelligence: 10,
        endurance: 10
      },
      position: {
        x: 0,
        y: 0,
        zone: "starting_area"
      },
      appearance,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      lastActive: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      totalPlayTimeSeconds: 0,
      totalItemsCrafted: 0,
      totalItemsTraded: 0,
      totalCoinsEarned: 0
    };
    const characterKey = getCustomerKey(customerId, `character_${characterId}`);
    await env.GAME_KV.put(characterKey, JSON.stringify(character), {
      expirationTtl: 60 * 60 * 24 * 365
    });
    const charactersKey = getCustomerKey(customerId, `characters_${userId}`);
    const characters = await env.GAME_KV.get(charactersKey, { type: "json" }) || [];
    characters.push(characterId);
    await env.GAME_KV.put(charactersKey, JSON.stringify(characters), {
      expirationTtl: 60 * 60 * 24 * 365
    });
    return new Response(JSON.stringify({
      success: true,
      character
    }), {
      status: 200,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Create character error:", error);
    return new Response(JSON.stringify({
      error: "Internal server error",
      message: env.ENVIRONMENT === "development" ? error.message : void 0
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleCreateCharacter, "handleCreateCharacter");
async function handleUpdateAppearance(request, env, userId, customerId) {
  try {
    const body = await request.json();
    const { characterId, appearance, customTextures } = body;
    if (!characterId || !appearance) {
      return new Response(JSON.stringify({
        error: "Bad Request",
        message: "characterId and appearance are required"
      }), {
        status: 400,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const characterKey = getCustomerKey(customerId, `character_${characterId}`);
    const character = await env.GAME_KV.get(characterKey, { type: "json" });
    if (!character) {
      return new Response(JSON.stringify({
        error: "Not Found",
        message: "Character not found"
      }), {
        status: 404,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    character.appearance = {
      ...character.appearance,
      ...appearance
    };
    if (customTextures) {
      character.appearance.customTextures = customTextures;
      Object.entries(customTextures).forEach(([type, texture]) => {
        if (texture && texture.data) {
          const textureKey = getCustomerKey(customerId, `character_texture_${characterId}_${type}`);
          env.GAME_KV.put(textureKey, JSON.stringify(texture), {
            expirationTtl: 60 * 60 * 24 * 365
          });
        }
      });
    }
    character.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    await env.GAME_KV.put(characterKey, JSON.stringify(character), {
      expirationTtl: 60 * 60 * 24 * 365
    });
    return new Response(JSON.stringify({
      success: true,
      character: {
        id: character.id,
        appearance: character.appearance
      }
    }), {
      status: 200,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Update appearance error:", error);
    return new Response(JSON.stringify({
      error: "Internal server error",
      message: env.ENVIRONMENT === "development" ? error.message : void 0
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleUpdateAppearance, "handleUpdateAppearance");
async function handleGameCharacter(request, env, userId, customerId, action2) {
  if (action2 === "get") {
    return await handleGetCharacter(request, env, userId, customerId);
  } else if (action2 === "create") {
    return await handleCreateCharacter(request, env, userId, customerId);
  } else if (action2 === "update-appearance") {
    return await handleUpdateAppearance(request, env, userId, customerId);
  }
  return new Response(JSON.stringify({
    error: "Bad Request",
    message: "Invalid action"
  }), {
    status: 400,
    headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
  });
}
__name(handleGameCharacter, "handleGameCharacter");

// handlers/game/crafting.js
async function handleStartCrafting(request, env, userId, customerId) {
  try {
    const body = await request.json();
    const { characterId, recipeId, quantity = 1, specialMaterials = [] } = body;
    if (!characterId || !recipeId) {
      return new Response(JSON.stringify({
        error: "Bad Request",
        message: "characterId and recipeId are required"
      }), {
        status: 400,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const sessionId = `craft_${userId}_${Date.now()}`;
    const session = {
      id: sessionId,
      characterId,
      recipeId,
      quantity,
      specialMaterials,
      startedAt: (/* @__PURE__ */ new Date()).toISOString(),
      completesAt: new Date(Date.now() + 2 * 60 * 60 * 1e3).toISOString(),
      // 2 hours
      status: "in_progress",
      progressPercent: 0
    };
    const sessionKey = getCustomerKey(customerId, `crafting_session_${sessionId}`);
    await env.GAME_KV.put(sessionKey, JSON.stringify(session), {
      expirationTtl: 60 * 60 * 24 * 7
      // 7 days
    });
    const sessionsKey = getCustomerKey(customerId, `crafting_sessions_${characterId}`);
    const sessions = await env.GAME_KV.get(sessionsKey, { type: "json" }) || [];
    sessions.push(sessionId);
    await env.GAME_KV.put(sessionsKey, JSON.stringify(sessions), {
      expirationTtl: 60 * 60 * 24 * 365
    });
    return new Response(JSON.stringify({
      success: true,
      session
    }), {
      status: 200,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Start crafting error:", error);
    return new Response(JSON.stringify({
      error: "Internal server error",
      message: env.ENVIRONMENT === "development" ? error.message : void 0
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleStartCrafting, "handleStartCrafting");
async function handleCollectCrafting(request, env, userId, customerId) {
  try {
    const body = await request.json();
    const { sessionId } = body;
    if (!sessionId) {
      return new Response(JSON.stringify({
        error: "Bad Request",
        message: "sessionId is required"
      }), {
        status: 400,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const sessionKey = getCustomerKey(customerId, `crafting_session_${sessionId}`);
    const session = await env.GAME_KV.get(sessionKey, { type: "json" });
    if (!session) {
      return new Response(JSON.stringify({
        error: "Not Found",
        message: "Crafting session not found"
      }), {
        status: 404,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const now = /* @__PURE__ */ new Date();
    const completesAt = new Date(session.completesAt);
    if (now < completesAt) {
      return new Response(JSON.stringify({
        error: "Not Ready",
        message: "Crafting session not yet complete",
        completesAt: session.completesAt
      }), {
        status: 400,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const quality = calculateCraftingQuality(session);
    const modifiers = generateCraftingModifiers(session, quality);
    const items = generateCraftingItems(session, quality, modifiers);
    session.status = "completed";
    session.completedAt = now.toISOString();
    session.resultQuality = quality;
    session.resultModifiers = modifiers;
    await env.GAME_KV.put(sessionKey, JSON.stringify(session), {
      expirationTtl: 60 * 60 * 24 * 7
    });
    return new Response(JSON.stringify({
      success: true,
      items,
      quality,
      modifiers,
      experienceGained: 1e3
      // Would calculate based on recipe
    }), {
      status: 200,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Collect crafting error:", error);
    return new Response(JSON.stringify({
      error: "Internal server error",
      message: env.ENVIRONMENT === "development" ? error.message : void 0
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleCollectCrafting, "handleCollectCrafting");
async function handleGetCraftingSessions(request, env, userId, customerId) {
  try {
    const url = new URL(request.url);
    const characterId = url.searchParams.get("characterId");
    if (!characterId) {
      return new Response(JSON.stringify({
        error: "Bad Request",
        message: "characterId query parameter is required"
      }), {
        status: 400,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const sessionsKey = getCustomerKey(customerId, `crafting_sessions_${characterId}`);
    const sessionIds = await env.GAME_KV.get(sessionsKey, { type: "json" }) || [];
    const sessions = [];
    for (const sessionId of sessionIds) {
      const sessionKey = getCustomerKey(customerId, `crafting_session_${sessionId}`);
      const session = await env.GAME_KV.get(sessionKey, { type: "json" });
      if (session) {
        const now = /* @__PURE__ */ new Date();
        const started = new Date(session.startedAt);
        const completes = new Date(session.completesAt);
        const total = completes - started;
        const elapsed = now - started;
        session.progressPercent = Math.min(100, Math.max(0, elapsed / total * 100));
        sessions.push(session);
      }
    }
    return new Response(JSON.stringify({
      success: true,
      sessions
    }), {
      status: 200,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Get crafting sessions error:", error);
    return new Response(JSON.stringify({
      error: "Internal server error",
      message: env.ENVIRONMENT === "development" ? error.message : void 0
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleGetCraftingSessions, "handleGetCraftingSessions");
function calculateCraftingQuality(session) {
  let quality = 50;
  session.specialMaterials.forEach((material) => {
    if (material.effect === "quality_boost") {
      quality += material.value;
    }
  });
  quality += Math.random() * 20;
  return Math.min(100, Math.max(0, Math.floor(quality)));
}
__name(calculateCraftingQuality, "calculateCraftingQuality");
function generateCraftingModifiers(session, quality) {
  const modifiers = {
    prefixes: [],
    suffixes: []
  };
  if (quality >= 90) {
    modifiers.prefixes.push({ name: "Master", tier: 5 });
    modifiers.suffixes.push({ name: "of Excellence", tier: 5 });
  } else if (quality >= 75) {
    modifiers.prefixes.push({ name: "Superior", tier: 4 });
    modifiers.suffixes.push({ name: "of Quality", tier: 4 });
  } else if (quality >= 60) {
    modifiers.prefixes.push({ name: "Fine", tier: 3 });
  }
  session.specialMaterials.forEach((material) => {
    if (material.effect === "guaranteed_modifier") {
      modifiers.prefixes.push({ name: "Enhanced", tier: 3 });
    }
  });
  return modifiers;
}
__name(generateCraftingModifiers, "generateCraftingModifiers");
function generateCraftingItems(session, quality, modifiers) {
  return [{
    itemTemplateId: `crafted_${session.recipeId}`,
    quantity: session.quantity,
    quality,
    modifiers
  }];
}
__name(generateCraftingItems, "generateCraftingItems");
async function handleGameCrafting(request, env, userId, customerId, action2) {
  if (action2 === "start") {
    return await handleStartCrafting(request, env, userId, customerId);
  } else if (action2 === "collect") {
    return await handleCollectCrafting(request, env, userId, customerId);
  } else if (action2 === "sessions") {
    return await handleGetCraftingSessions(request, env, userId, customerId);
  }
  return new Response(JSON.stringify({
    error: "Bad Request",
    message: "Invalid action"
  }), {
    status: 400,
    headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
  });
}
__name(handleGameCrafting, "handleGameCrafting");

// handlers/game/dungeons.js
async function handleStartDungeon(request, env, userId, customerId) {
  try {
    const body = await request.json();
    const { characterId, dungeonId, difficulty = "normal", instanceType = "solo" } = body;
    if (!characterId || !dungeonId) {
      return new Response(JSON.stringify({
        error: "Bad Request",
        message: "characterId and dungeonId are required"
      }), {
        status: 400,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const instanceId = `dungeon_${userId}_${Date.now()}`;
    const instance = {
      id: instanceId,
      dungeonId,
      characterId,
      difficulty,
      instanceType,
      currentFloor: 1,
      currentRoom: 1,
      completedRooms: [],
      status: "in_progress",
      startedAt: (/* @__PURE__ */ new Date()).toISOString(),
      collectedRewards: {
        experience: 0,
        gold: 0,
        items: [],
        materials: {}
      }
    };
    const instanceKey = getCustomerKey(customerId, `dungeon_instance_${instanceId}`);
    await env.GAME_KV.put(instanceKey, JSON.stringify(instance), {
      expirationTtl: 60 * 60 * 24
      // 24 hours
    });
    const instancesKey = getCustomerKey(customerId, `dungeon_instances_${characterId}`);
    const instances = await env.GAME_KV.get(instancesKey, { type: "json" }) || [];
    instances.push(instanceId);
    await env.GAME_KV.put(instancesKey, JSON.stringify(instances), {
      expirationTtl: 60 * 60 * 24 * 365
    });
    return new Response(JSON.stringify({
      success: true,
      instance
    }), {
      status: 200,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Start dungeon error:", error);
    return new Response(JSON.stringify({
      error: "Internal server error",
      message: env.ENVIRONMENT === "development" ? error.message : void 0
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleStartDungeon, "handleStartDungeon");
async function handleCompleteRoom(request, env, userId, customerId) {
  try {
    const body = await request.json();
    const { instanceId, roomId, result = "victory" } = body;
    if (!instanceId || !roomId) {
      return new Response(JSON.stringify({
        error: "Bad Request",
        message: "instanceId and roomId are required"
      }), {
        status: 400,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const instanceKey = getCustomerKey(customerId, `dungeon_instance_${instanceId}`);
    const instance = await env.GAME_KV.get(instanceKey, { type: "json" });
    if (!instance) {
      return new Response(JSON.stringify({
        error: "Not Found",
        message: "Dungeon instance not found"
      }), {
        status: 404,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    if (result === "victory") {
      if (!instance.completedRooms.includes(roomId)) {
        instance.completedRooms.push(roomId);
      }
      const rewards = generateRoomRewards(instance.difficulty);
      instance.collectedRewards.experience += rewards.experience;
      instance.collectedRewards.gold += rewards.gold;
      instance.collectedRewards.items.push(...rewards.items);
      Object.entries(rewards.materials || {}).forEach(([key2, value]) => {
        instance.collectedRewards.materials[key2] = (instance.collectedRewards.materials[key2] || 0) + value;
      });
      instance.currentRoom += 1;
    }
    await env.GAME_KV.put(instanceKey, JSON.stringify(instance), {
      expirationTtl: 60 * 60 * 24
    });
    return new Response(JSON.stringify({
      success: true,
      instance,
      rewards: result === "victory" ? generateRoomRewards(instance.difficulty) : null
    }), {
      status: 200,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Complete room error:", error);
    return new Response(JSON.stringify({
      error: "Internal server error",
      message: env.ENVIRONMENT === "development" ? error.message : void 0
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleCompleteRoom, "handleCompleteRoom");
async function handleCompleteDungeon(request, env, userId, customerId) {
  try {
    const body = await request.json();
    const { instanceId } = body;
    if (!instanceId) {
      return new Response(JSON.stringify({
        error: "Bad Request",
        message: "instanceId is required"
      }), {
        status: 400,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const instanceKey = getCustomerKey(customerId, `dungeon_instance_${instanceId}`);
    const instance = await env.GAME_KV.get(instanceKey, { type: "json" });
    if (!instance) {
      return new Response(JSON.stringify({
        error: "Not Found",
        message: "Dungeon instance not found"
      }), {
        status: 404,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const completionBonus = getCompletionBonus(instance.difficulty);
    instance.collectedRewards.experience += completionBonus.experience;
    instance.collectedRewards.gold += completionBonus.gold;
    instance.status = "completed";
    instance.completedAt = (/* @__PURE__ */ new Date()).toISOString();
    await env.GAME_KV.put(instanceKey, JSON.stringify(instance), {
      expirationTtl: 60 * 60 * 24 * 7
      // Keep for 7 days
    });
    return new Response(JSON.stringify({
      success: true,
      finalRewards: instance.collectedRewards,
      instance
    }), {
      status: 200,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Complete dungeon error:", error);
    return new Response(JSON.stringify({
      error: "Internal server error",
      message: env.ENVIRONMENT === "development" ? error.message : void 0
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleCompleteDungeon, "handleCompleteDungeon");
async function handleGetDungeonInstances(request, env, userId, customerId) {
  try {
    const url = new URL(request.url);
    const characterId = url.searchParams.get("characterId");
    if (!characterId) {
      return new Response(JSON.stringify({
        error: "Bad Request",
        message: "characterId query parameter is required"
      }), {
        status: 400,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const instancesKey = getCustomerKey(customerId, `dungeon_instances_${characterId}`);
    const instanceIds = await env.GAME_KV.get(instancesKey, { type: "json" }) || [];
    const instances = [];
    for (const instanceId of instanceIds) {
      const instanceKey = getCustomerKey(customerId, `dungeon_instance_${instanceId}`);
      const instance = await env.GAME_KV.get(instanceKey, { type: "json" });
      if (instance && instance.status === "in_progress") {
        instances.push(instance);
      }
    }
    return new Response(JSON.stringify({
      success: true,
      instances
    }), {
      status: 200,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Get dungeon instances error:", error);
    return new Response(JSON.stringify({
      error: "Internal server error",
      message: env.ENVIRONMENT === "development" ? error.message : void 0
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleGetDungeonInstances, "handleGetDungeonInstances");
function generateRoomRewards(difficulty) {
  const multipliers = {
    normal: 1,
    hard: 1.5,
    expert: 2,
    master: 2.5,
    nightmare: 3
  };
  const multiplier = multipliers[difficulty] || 1;
  return {
    experience: Math.floor(1e3 * multiplier),
    gold: Math.floor(500 * multiplier),
    items: [],
    materials: {
      dungeon_scrap: Math.floor(5 * multiplier)
    }
  };
}
__name(generateRoomRewards, "generateRoomRewards");
function getCompletionBonus(difficulty) {
  const bonuses = {
    normal: { experience: 1e4, gold: 5e3 },
    hard: { experience: 15e3, gold: 7500 },
    expert: { experience: 2e4, gold: 1e4 },
    master: { experience: 25e3, gold: 12500 },
    nightmare: { experience: 3e4, gold: 15e3 }
  };
  return bonuses[difficulty] || bonuses.normal;
}
__name(getCompletionBonus, "getCompletionBonus");
async function handleGameDungeons(request, env, userId, customerId, action2) {
  if (action2 === "start") {
    return await handleStartDungeon(request, env, userId, customerId);
  } else if (action2 === "complete-room") {
    return await handleCompleteRoom(request, env, userId, customerId);
  } else if (action2 === "complete") {
    return await handleCompleteDungeon(request, env, userId, customerId);
  } else if (action2 === "instances") {
    return await handleGetDungeonInstances(request, env, userId, customerId);
  }
  return new Response(JSON.stringify({
    error: "Bad Request",
    message: "Invalid action"
  }), {
    status: 400,
    headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
  });
}
__name(handleGameDungeons, "handleGameDungeons");

// handlers/game/idle.js
async function handleGetIdleProgress(request, env, userId, customerId) {
  try {
    const characterKey = getCustomerKey(customerId, `character_${userId}_active`);
    const characterData = await env.GAME_KV.get(characterKey, { type: "json" });
    if (!characterData || !characterData.lastActiveAt) {
      return new Response(JSON.stringify({
        success: true,
        offlineHours: 0,
        rewards: {
          gold: 0,
          experience: 0,
          materials: {}
        }
      }), {
        status: 200,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const lastActive = new Date(characterData.lastActiveAt);
    const now = /* @__PURE__ */ new Date();
    const offlineMs = now - lastActive;
    const offlineHours = Math.min(offlineMs / (1e3 * 60 * 60), 24);
    const activitiesKey = getCustomerKey(customerId, `idle_activities_${userId}`);
    const activities = await env.GAME_KV.get(activitiesKey, { type: "json" }) || [];
    const rewards = calculateIdleRewards(offlineHours, activities, customerId);
    return new Response(JSON.stringify({
      success: true,
      offlineHours,
      cappedHours: offlineHours,
      lastActiveAt: characterData.lastActiveAt,
      activeActivities: activities,
      rewards
    }), {
      status: 200,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Get idle progress error:", error);
    return new Response(JSON.stringify({
      error: "Internal server error",
      message: env.ENVIRONMENT === "development" ? error.message : void 0
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleGetIdleProgress, "handleGetIdleProgress");
async function handleClaimIdleRewards(request, env, userId, customerId) {
  try {
    const body = await request.json();
    const { slotIndex } = body;
    const progressResponse = await handleGetIdleProgress(request, env, userId, customerId);
    const progressData = await progressResponse.json();
    if (!progressData.success) {
      return progressResponse;
    }
    const characterKey = getCustomerKey(customerId, `character_${userId}_active`);
    await env.GAME_KV.put(characterKey, JSON.stringify({
      lastActiveAt: (/* @__PURE__ */ new Date()).toISOString()
    }), {
      expirationTtl: 60 * 60 * 24 * 365
    });
    return new Response(JSON.stringify({
      success: true,
      claimed: progressData.rewards,
      message: "Rewards claimed successfully"
    }), {
      status: 200,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Claim idle rewards error:", error);
    return new Response(JSON.stringify({
      error: "Internal server error",
      message: env.ENVIRONMENT === "development" ? error.message : void 0
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleClaimIdleRewards, "handleClaimIdleRewards");
async function handleStartIdleActivity(request, env, userId, customerId) {
  try {
    const body = await request.json();
    const { activityId, slotIndex } = body;
    if (!activityId) {
      return new Response(JSON.stringify({
        error: "Bad Request",
        message: "activityId is required"
      }), {
        status: 400,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const activitiesKey = getCustomerKey(customerId, `idle_activities_${userId}`);
    const activities = await env.GAME_KV.get(activitiesKey, { type: "json" }) || [];
    const maxSlots = getMaxIdleSlots(customerId);
    if (activities.length >= maxSlots) {
      return new Response(JSON.stringify({
        error: "Limit Reached",
        message: `Maximum ${maxSlots} idle activities allowed`
      }), {
        status: 400,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const activity = {
      id: activityId,
      startedAt: (/* @__PURE__ */ new Date()).toISOString(),
      slotIndex: slotIndex || activities.length
    };
    activities.push(activity);
    await env.GAME_KV.put(activitiesKey, JSON.stringify(activities), {
      expirationTtl: 60 * 60 * 24 * 365
    });
    return new Response(JSON.stringify({
      success: true,
      activity,
      slotIndex: activity.slotIndex
    }), {
      status: 200,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Start idle activity error:", error);
    return new Response(JSON.stringify({
      error: "Internal server error",
      message: env.ENVIRONMENT === "development" ? error.message : void 0
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleStartIdleActivity, "handleStartIdleActivity");
async function handleStopIdleActivity(request, env, userId, customerId) {
  try {
    const body = await request.json();
    const { slotIndex } = body;
    if (slotIndex === void 0) {
      return new Response(JSON.stringify({
        error: "Bad Request",
        message: "slotIndex is required"
      }), {
        status: 400,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const activitiesKey = getCustomerKey(customerId, `idle_activities_${userId}`);
    const activities = await env.GAME_KV.get(activitiesKey, { type: "json" }) || [];
    const activityIndex = activities.findIndex((a) => a.slotIndex === slotIndex);
    if (activityIndex === -1) {
      return new Response(JSON.stringify({
        error: "Not Found",
        message: "Activity not found in slot"
      }), {
        status: 404,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const activity = activities[activityIndex];
    activities.splice(activityIndex, 1);
    await env.GAME_KV.put(activitiesKey, JSON.stringify(activities), {
      expirationTtl: 60 * 60 * 24 * 365
    });
    const startedAt = new Date(activity.startedAt);
    const now = /* @__PURE__ */ new Date();
    const hours = (now - startedAt) / (1e3 * 60 * 60);
    const rewards = calculateActivityRewards(activity.id, hours);
    return new Response(JSON.stringify({
      success: true,
      rewards,
      stoppedAt: now.toISOString()
    }), {
      status: 200,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Stop idle activity error:", error);
    return new Response(JSON.stringify({
      error: "Internal server error",
      message: env.ENVIRONMENT === "development" ? error.message : void 0
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleStopIdleActivity, "handleStopIdleActivity");
function calculateIdleRewards(offlineHours, activities, customerId) {
  const multiplier = getIdleMultiplier(customerId);
  const rewards = {
    gold: 0,
    experience: 0,
    materials: {}
  };
  rewards.gold = Math.floor(20 * offlineHours * multiplier);
  rewards.experience = Math.floor(50 * offlineHours * multiplier);
  activities.forEach((activity) => {
    const activityRewards = calculateActivityRewards(activity.id, offlineHours);
    rewards.gold += activityRewards.gold;
    rewards.experience += activityRewards.experience;
    Object.entries(activityRewards.materials || {}).forEach(([key2, value]) => {
      rewards.materials[key2] = (rewards.materials[key2] || 0) + value;
    });
  });
  return rewards;
}
__name(calculateIdleRewards, "calculateIdleRewards");
function calculateActivityRewards(activityId, hours) {
  const rates = {
    auto_mining: { gold: 10, experience: 30, materials: { iron_ore: 3, copper_ore: 1 } },
    auto_woodcutting: { gold: 8, experience: 25, materials: { wood: 5 } },
    auto_fishing: { gold: 12, experience: 35, materials: { fish: 4 } },
    auto_combat: { gold: 15, experience: 50, materials: { leather: 2 } },
    auto_crafting: { gold: 5, experience: 20, materials: {} }
  };
  const rate = rates[activityId] || rates.auto_mining;
  return {
    gold: Math.floor(rate.gold * hours),
    experience: Math.floor(rate.experience * hours),
    materials: Object.fromEntries(
      Object.entries(rate.materials).map(([key2, value]) => [key2, Math.floor(value * hours)])
    )
  };
}
__name(calculateActivityRewards, "calculateActivityRewards");
function getIdleMultiplier(customerId) {
  return 1;
}
__name(getIdleMultiplier, "getIdleMultiplier");
function getMaxIdleSlots(customerId) {
  return 1;
}
__name(getMaxIdleSlots, "getMaxIdleSlots");
async function handleGameIdle(request, env, userId, customerId, action2) {
  if (action2 === "progress") {
    return await handleGetIdleProgress(request, env, userId, customerId);
  } else if (action2 === "claim") {
    return await handleClaimIdleRewards(request, env, userId, customerId);
  } else if (action2 === "start") {
    return await handleStartIdleActivity(request, env, userId, customerId);
  } else if (action2 === "stop") {
    return await handleStopIdleActivity(request, env, userId, customerId);
  }
  return new Response(JSON.stringify({
    error: "Bad Request",
    message: "Invalid action"
  }), {
    status: 400,
    headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
  });
}
__name(handleGameIdle, "handleGameIdle");

// handlers/game/inventory.js
async function handleGetInventory(request, env, userId, customerId) {
  try {
    const url = new URL(request.url);
    const characterId = url.searchParams.get("characterId");
    if (!characterId) {
      return new Response(JSON.stringify({
        error: "Bad Request",
        message: "characterId query parameter is required"
      }), {
        status: 400,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const inventoryKey = getCustomerKey(customerId, `inventory_${characterId}`);
    const inventory = await env.GAME_KV.get(inventoryKey, { type: "json" }) || {
      characterId,
      maxSlots: 20,
      slots: [],
      usedSlots: 0,
      freeSlots: 20
    };
    const equipmentKey = getCustomerKey(customerId, `equipment_${characterId}`);
    const equipment = await env.GAME_KV.get(equipmentKey, { type: "json" }) || {
      characterId,
      slots: {}
    };
    return new Response(JSON.stringify({
      success: true,
      inventory,
      equipment
    }), {
      status: 200,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Get inventory error:", error);
    return new Response(JSON.stringify({
      error: "Internal server error",
      message: env.ENVIRONMENT === "development" ? error.message : void 0
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleGetInventory, "handleGetInventory");
async function handleAddItem(request, env, userId, customerId) {
  try {
    const body = await request.json();
    const { characterId, item } = body;
    if (!characterId || !item) {
      return new Response(JSON.stringify({
        error: "Bad Request",
        message: "characterId and item are required"
      }), {
        status: 400,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const inventoryKey = getCustomerKey(customerId, `inventory_${characterId}`);
    const inventory = await env.GAME_KV.get(inventoryKey, { type: "json" }) || {
      characterId,
      maxSlots: 20,
      slots: [],
      usedSlots: 0,
      freeSlots: 20
    };
    if (inventory.usedSlots >= inventory.maxSlots) {
      return new Response(JSON.stringify({
        error: "Inventory Full",
        message: "No space in inventory"
      }), {
        status: 400,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const itemId = `item_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const slot2 = {
      slotIndex: inventory.slots.length,
      itemId,
      quantity: item.quantity || 1,
      isEmpty: false
    };
    inventory.slots.push(slot2);
    inventory.usedSlots += 1;
    inventory.freeSlots = inventory.maxSlots - inventory.usedSlots;
    const itemKey = getCustomerKey(customerId, `item_${itemId}`);
    await env.GAME_KV.put(itemKey, JSON.stringify({
      id: itemId,
      ...item,
      ownerCharacterId: characterId,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    }), {
      expirationTtl: 60 * 60 * 24 * 365
    });
    await env.GAME_KV.put(inventoryKey, JSON.stringify(inventory), {
      expirationTtl: 60 * 60 * 24 * 365
    });
    return new Response(JSON.stringify({
      success: true,
      itemId,
      slot: slot2,
      inventory
    }), {
      status: 200,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Add item error:", error);
    return new Response(JSON.stringify({
      error: "Internal server error",
      message: env.ENVIRONMENT === "development" ? error.message : void 0
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleAddItem, "handleAddItem");
async function handleRemoveItem(request, env, userId, customerId) {
  try {
    const url = new URL(request.url);
    const itemId = url.searchParams.get("itemId");
    const characterId = url.searchParams.get("characterId");
    if (!itemId || !characterId) {
      return new Response(JSON.stringify({
        error: "Bad Request",
        message: "itemId and characterId query parameters are required"
      }), {
        status: 400,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const inventoryKey = getCustomerKey(customerId, `inventory_${characterId}`);
    const inventory = await env.GAME_KV.get(inventoryKey, { type: "json" });
    if (!inventory) {
      return new Response(JSON.stringify({
        error: "Not Found",
        message: "Inventory not found"
      }), {
        status: 404,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const slotIndex = inventory.slots.findIndex((slot2) => slot2.itemId === itemId);
    if (slotIndex === -1) {
      return new Response(JSON.stringify({
        error: "Not Found",
        message: "Item not found in inventory"
      }), {
        status: 404,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    inventory.slots[slotIndex] = {
      slotIndex,
      itemId: void 0,
      quantity: 0,
      isEmpty: true
    };
    inventory.usedSlots -= 1;
    inventory.freeSlots = inventory.maxSlots - inventory.usedSlots;
    const itemKey = getCustomerKey(customerId, `item_${itemId}`);
    await env.GAME_KV.delete(itemKey);
    await env.GAME_KV.put(inventoryKey, JSON.stringify(inventory), {
      expirationTtl: 60 * 60 * 24 * 365
    });
    return new Response(JSON.stringify({
      success: true,
      inventory
    }), {
      status: 200,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Remove item error:", error);
    return new Response(JSON.stringify({
      error: "Internal server error",
      message: env.ENVIRONMENT === "development" ? error.message : void 0
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleRemoveItem, "handleRemoveItem");
async function handleEquipItem(request, env, userId, customerId) {
  try {
    const body = await request.json();
    const { characterId, itemId, slot: slot2 } = body;
    if (!characterId || !itemId || !slot2) {
      return new Response(JSON.stringify({
        error: "Bad Request",
        message: "characterId, itemId, and slot are required"
      }), {
        status: 400,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const equipmentKey = getCustomerKey(customerId, `equipment_${characterId}`);
    const equipment = await env.GAME_KV.get(equipmentKey, { type: "json" }) || {
      characterId,
      slots: {}
    };
    const previousItemId = equipment.slots[slot2];
    if (previousItemId) {
    }
    equipment.slots[slot2] = itemId;
    await env.GAME_KV.put(equipmentKey, JSON.stringify(equipment), {
      expirationTtl: 60 * 60 * 24 * 365
    });
    return new Response(JSON.stringify({
      success: true,
      equipment
    }), {
      status: 200,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Equip item error:", error);
    return new Response(JSON.stringify({
      error: "Internal server error",
      message: env.ENVIRONMENT === "development" ? error.message : void 0
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleEquipItem, "handleEquipItem");
async function handleGameInventory(request, env, userId, customerId, action2) {
  if (action2 === "get") {
    return await handleGetInventory(request, env, userId, customerId);
  } else if (action2 === "add") {
    return await handleAddItem(request, env, userId, customerId);
  } else if (action2 === "remove") {
    return await handleRemoveItem(request, env, userId, customerId);
  } else if (action2 === "equip") {
    return await handleEquipItem(request, env, userId, customerId);
  }
  return new Response(JSON.stringify({
    error: "Bad Request",
    message: "Invalid action"
  }), {
    status: 400,
    headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
  });
}
__name(handleGameInventory, "handleGameInventory");

// handlers/game/loot-box.js
async function handleGetLootBoxStatus(request, env, userId, customerId) {
  try {
    const streakKey = getCustomerKey(customerId, `loot_box_streak_${userId}`);
    const streakData = await env.GAME_KV.get(streakKey, { type: "json" }) || {
      currentStreak: 0,
      longestStreak: 0,
      lastClaimedAt: null
    };
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const lastClaimed = streakData.lastClaimedAt ? new Date(streakData.lastClaimedAt).toISOString().split("T")[0] : null;
    const isAvailable = lastClaimed !== today;
    const nextAvailableAt = isAvailable ? (/* @__PURE__ */ new Date()).toISOString() : new Date(Date.now() + 24 * 60 * 60 * 1e3).toISOString();
    let streakBonus = 1;
    if (streakData.currentStreak >= 31) {
      streakBonus = 2;
    } else if (streakData.currentStreak >= 15) {
      streakBonus = 1.5;
    } else if (streakData.currentStreak >= 8) {
      streakBonus = 1.25;
    } else if (streakData.currentStreak >= 4) {
      streakBonus = 1.1;
    }
    return new Response(JSON.stringify({
      success: true,
      available: isAvailable,
      nextAvailableAt,
      streak: {
        current: streakData.currentStreak,
        longest: streakData.longestStreak,
        bonus: streakBonus
      }
    }), {
      status: 200,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Get loot box status error:", error);
    return new Response(JSON.stringify({
      error: "Internal server error",
      message: env.ENVIRONMENT === "development" ? error.message : void 0
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleGetLootBoxStatus, "handleGetLootBoxStatus");
async function handleClaimLootBox(request, env, userId, customerId) {
  try {
    const streakKey = getCustomerKey(customerId, `loot_box_streak_${userId}`);
    const streakData = await env.GAME_KV.get(streakKey, { type: "json" }) || {
      currentStreak: 0,
      longestStreak: 0,
      lastClaimedAt: null
    };
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const lastClaimed = streakData.lastClaimedAt ? new Date(streakData.lastClaimedAt).toISOString().split("T")[0] : null;
    if (lastClaimed === today) {
      return new Response(JSON.stringify({
        error: "Already Claimed",
        message: "Daily loot box already claimed today"
      }), {
        status: 400,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1e3).toISOString().split("T")[0];
    let newStreak = 1;
    if (lastClaimed === yesterday) {
      newStreak = streakData.currentStreak + 1;
    } else if (lastClaimed && lastClaimed !== today && lastClaimed !== yesterday) {
      newStreak = 1;
    }
    const longestStreak = Math.max(newStreak, streakData.longestStreak || 0);
    let streakBonus = 1;
    if (newStreak >= 31) {
      streakBonus = 2;
    } else if (newStreak >= 15) {
      streakBonus = 1.5;
    } else if (newStreak >= 8) {
      streakBonus = 1.25;
    } else if (newStreak >= 4) {
      streakBonus = 1.1;
    }
    const rewards = generateLootBoxRewards(streakBonus);
    await env.GAME_KV.put(streakKey, JSON.stringify({
      currentStreak: newStreak,
      longestStreak,
      lastClaimedAt: (/* @__PURE__ */ new Date()).toISOString()
    }), {
      expirationTtl: 60 * 60 * 24 * 365
      // 1 year
    });
    const claimKey = getCustomerKey(customerId, `loot_box_claim_${userId}_${today}`);
    await env.GAME_KV.put(claimKey, JSON.stringify({
      userId,
      claimedAt: (/* @__PURE__ */ new Date()).toISOString(),
      rewards,
      streak: newStreak,
      streakBonus
    }), {
      expirationTtl: 60 * 60 * 24 * 7
      // 7 days
    });
    return new Response(JSON.stringify({
      success: true,
      rewards,
      streak: {
        current: newStreak,
        longest: longestStreak,
        bonus: streakBonus
      },
      nextAvailableAt: new Date(Date.now() + 24 * 60 * 60 * 1e3).toISOString()
    }), {
      status: 200,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Claim loot box error:", error);
    return new Response(JSON.stringify({
      error: "Internal server error",
      message: env.ENVIRONMENT === "development" ? error.message : void 0
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleClaimLootBox, "handleClaimLootBox");
function generateLootBoxRewards(streakBonus) {
  const roll = Math.random() * 100;
  let rarity = "common";
  if (roll < 0.1) {
    rarity = "unique";
  } else if (roll < 1) {
    rarity = "legendary";
  } else if (roll < 5) {
    rarity = "epic";
  } else if (roll < 15) {
    rarity = "rare";
  } else if (roll < 40) {
    rarity = "uncommon";
  }
  const baseGold = 100;
  const baseExp = 50;
  const baseMaterials = 5;
  const rewards = {
    gold: Math.floor(baseGold * streakBonus),
    experience: Math.floor(baseExp * streakBonus),
    materials: {
      iron_ore: Math.floor(baseMaterials * streakBonus)
    },
    items: []
  };
  if (rarity !== "common") {
    rewards.items.push({
      itemTemplateId: `equipment_${rarity}`,
      quantity: 1,
      rarity
    });
  }
  return rewards;
}
__name(generateLootBoxRewards, "generateLootBoxRewards");
async function handleGameLootBox(request, env, userId, customerId, action2) {
  if (action2 === "claim") {
    return await handleClaimLootBox(request, env, userId, customerId);
  } else if (action2 === "status") {
    return await handleGetLootBoxStatus(request, env, userId, customerId);
  }
  return new Response(JSON.stringify({
    error: "Bad Request",
    message: "Invalid action"
  }), {
    status: 400,
    headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
  });
}
__name(handleGameLootBox, "handleGameLootBox");

// handlers/game/loot.js
async function handleGenerateLoot(request, env, userId, customerId) {
  try {
    const body = await request.json();
    const { lootTableId, options = {} } = body;
    if (!lootTableId) {
      return new Response(JSON.stringify({
        error: "Bad Request",
        message: "lootTableId is required"
      }), {
        status: 400,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const lootTableKey = getCustomerKey(customerId, `loot_table_${lootTableId}`);
    const lootTable = await env.GAME_KV.get(lootTableKey, { type: "json" });
    if (!lootTable) {
      const defaultLootTable = getDefaultLootTable(lootTableId);
      if (!defaultLootTable) {
        return new Response(JSON.stringify({
          error: "Not Found",
          message: "Loot table not found"
        }), {
          status: 404,
          headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
        });
      }
      return generateLootItem(defaultLootTable, options, env, request);
    }
    return generateLootItem(lootTable, options, env, request);
  } catch (error) {
    console.error("Generate loot error:", error);
    return new Response(JSON.stringify({
      error: "Internal server error",
      message: env.ENVIRONMENT === "development" ? error.message : void 0
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleGenerateLoot, "handleGenerateLoot");
async function handleGetLootTables(request, env, userId, customerId) {
  try {
    const lootTables = [
      {
        id: "common",
        name: "Common Loot",
        itemLevel: 1,
        description: "Basic loot table for low-level content"
      },
      {
        id: "rare",
        name: "Rare Loot",
        itemLevel: 25,
        description: "Enhanced loot table with better modifiers"
      },
      {
        id: "epic",
        name: "Epic Loot",
        itemLevel: 50,
        description: "High-tier loot table for end-game content"
      },
      {
        id: "legendary",
        name: "Legendary Loot",
        itemLevel: 75,
        description: "Ultra-rare loot table for challenging content"
      }
    ];
    return new Response(JSON.stringify({
      success: true,
      lootTables
    }), {
      status: 200,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Get loot tables error:", error);
    return new Response(JSON.stringify({
      error: "Internal server error",
      message: env.ENVIRONMENT === "development" ? error.message : void 0
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleGetLootTables, "handleGetLootTables");
async function generateLootItem(lootTable, options, env, request) {
  const rarity = rollRarity(lootTable, options.forcedRarity);
  const modifiers = generateModifiers(lootTable, rarity, options.itemLevel || lootTable.itemLevel);
  const finalStats = calculateFinalStats(lootTable.baseStats || {}, modifiers);
  const fullName = generateItemName(lootTable.name, modifiers.prefixes, modifiers.suffixes);
  const generatedItem = {
    template: {
      id: 0,
      itemCode: `${lootTable.id}_${rarity}`,
      displayName: lootTable.name,
      description: `Generated ${rarity} item`,
      itemType: "equipment",
      rarity,
      baseStats: lootTable.baseStats || {},
      maxStack: 1,
      isTradeable: true,
      isCraftable: false,
      requiredLevel: options.itemLevel || lootTable.itemLevel,
      baseSellPrice: calculateBasePrice(rarity, options.itemLevel || lootTable.itemLevel),
      isActive: true
    },
    baseName: lootTable.name,
    fullName,
    rarity,
    itemLevel: options.itemLevel || lootTable.itemLevel,
    prefixes: modifiers.prefixes,
    suffixes: modifiers.suffixes,
    finalStats,
    colorPalette: getRarityColorPalette(rarity),
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    seed: options.seed
  };
  return new Response(JSON.stringify({
    success: true,
    item: generatedItem
  }), {
    status: 200,
    headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
  });
}
__name(generateLootItem, "generateLootItem");
function rollRarity(lootTable, forcedRarity) {
  if (forcedRarity) return forcedRarity;
  const random = Math.random() * 100;
  let cumulative = 0;
  const rarities = ["common", "uncommon", "rare", "epic", "legendary", "unique"];
  const dropChances = lootTable.dropChances || {
    common: 60,
    uncommon: 25,
    rare: 10,
    epic: 4,
    legendary: 0.9,
    unique: 0.1
  };
  for (const rarity of rarities) {
    cumulative += dropChances[rarity] || 0;
    if (random <= cumulative) {
      return rarity;
    }
  }
  return "common";
}
__name(rollRarity, "rollRarity");
function generateModifiers(lootTable, rarity, itemLevel) {
  const modifierCounts = lootTable.modifierCounts || {
    common: { minPrefixes: 0, maxPrefixes: 0, minSuffixes: 0, maxSuffixes: 0 },
    uncommon: { minPrefixes: 0, maxPrefixes: 1, minSuffixes: 0, maxSuffixes: 1 },
    rare: { minPrefixes: 1, maxPrefixes: 2, minSuffixes: 1, maxSuffixes: 2 },
    epic: { minPrefixes: 2, maxPrefixes: 3, minSuffixes: 2, maxSuffixes: 3 },
    legendary: { minPrefixes: 3, maxPrefixes: 4, minSuffixes: 3, maxSuffixes: 4 },
    unique: { minPrefixes: 4, maxPrefixes: 6, minSuffixes: 4, maxSuffixes: 6 }
  };
  const counts = modifierCounts[rarity] || modifierCounts.common;
  const prefixCount = Math.floor(Math.random() * (counts.maxPrefixes - counts.minPrefixes + 1)) + counts.minPrefixes;
  const suffixCount = Math.floor(Math.random() * (counts.maxSuffixes - counts.minSuffixes + 1)) + counts.minSuffixes;
  const prefixes = generateModifierList("prefix", prefixCount, itemLevel);
  const suffixes = generateModifierList("suffix", suffixCount, itemLevel);
  return { prefixes, suffixes };
}
__name(generateModifiers, "generateModifiers");
function generateModifierList(type, count, itemLevel) {
  const modifiers = [];
  const modifierPools = {
    prefix: [
      { name: "Fiery", tier: 3, stats: { fireDamage: 15, critChance: 5 } },
      { name: "Thunderous", tier: 5, stats: { lightningDamage: 150, attackSpeed: 25 } },
      { name: "Blessed", tier: 4, stats: { healthRegen: 30, experienceBonus: 15 } },
      { name: "Void", tier: 5, stats: { attack: 200, critDamage: 50 } }
    ],
    suffix: [
      { name: "of the Bear", tier: 2, stats: { strength: 20, health: 50 } },
      { name: "of Power", tier: 4, stats: { intelligence: 75, spellDamage: 25 } },
      { name: "of Annihilation", tier: 5, stats: { strength: 100, dexterity: 100, bossDamage: 50 } },
      { name: "of Fortitude", tier: 4, stats: { health: 100, endurance: 50 } }
    ]
  };
  const pool = modifierPools[type] || [];
  for (let i = 0; i < count && i < pool.length; i++) {
    modifiers.push(pool[i]);
  }
  return modifiers;
}
__name(generateModifierList, "generateModifierList");
function calculateFinalStats(baseStats, modifiers) {
  const finalStats = { ...baseStats };
  [...modifiers.prefixes, ...modifiers.suffixes].forEach((modifier) => {
    Object.entries(modifier.stats || {}).forEach(([key2, value]) => {
      finalStats[key2] = (finalStats[key2] || 0) + value;
    });
  });
  return finalStats;
}
__name(calculateFinalStats, "calculateFinalStats");
function generateItemName(baseName, prefixes, suffixes) {
  const parts = [];
  if (prefixes.length > 0) {
    parts.push(prefixes.map((p) => p.name).join(" "));
  }
  parts.push(baseName);
  if (suffixes.length > 0) {
    parts.push(suffixes.map((s) => s.name).join(" "));
  }
  return parts.join(" ");
}
__name(generateItemName, "generateItemName");
function calculateBasePrice(rarity, itemLevel) {
  const multipliers = {
    common: 1,
    uncommon: 2,
    rare: 5,
    epic: 10,
    legendary: 25,
    unique: 50
  };
  return Math.floor(itemLevel * 10 * (multipliers[rarity] || 1));
}
__name(calculateBasePrice, "calculateBasePrice");
function getRarityColorPalette(rarity) {
  const palettes = {
    common: { primary: "#9d9d9d", secondary: "#6b6b6b" },
    uncommon: { primary: "#1eff00", secondary: "#15cc00" },
    rare: { primary: "#0070dd", secondary: "#005ab1", glow: "#3f9fff" },
    epic: { primary: "#a335ee", secondary: "#8229be", glow: "#c05fff" },
    legendary: { primary: "#ff8000", secondary: "#cc6600", glow: "#ffab4f" },
    unique: { primary: "#e6cc80", secondary: "#b8a366", glow: "#fff0b3" }
  };
  return palettes[rarity] || palettes.common;
}
__name(getRarityColorPalette, "getRarityColorPalette");
function getDefaultLootTable(lootTableId) {
  const defaultTables = {
    common: {
      id: "common",
      name: "Common Item",
      itemLevel: 1,
      baseRarity: "common",
      dropChances: {
        common: 60,
        uncommon: 25,
        rare: 10,
        epic: 4,
        legendary: 0.9,
        unique: 0.1
      },
      modifierCounts: {
        common: { minPrefixes: 0, maxPrefixes: 0, minSuffixes: 0, maxSuffixes: 0 },
        uncommon: { minPrefixes: 0, maxPrefixes: 1, minSuffixes: 0, maxSuffixes: 1 },
        rare: { minPrefixes: 1, maxPrefixes: 2, minSuffixes: 1, maxSuffixes: 2 },
        epic: { minPrefixes: 2, maxPrefixes: 3, minSuffixes: 2, maxSuffixes: 3 },
        legendary: { minPrefixes: 3, maxPrefixes: 4, minSuffixes: 3, maxSuffixes: 4 },
        unique: { minPrefixes: 4, maxPrefixes: 6, minSuffixes: 4, maxSuffixes: 6 }
      },
      baseStats: {}
    }
  };
  return defaultTables[lootTableId] || defaultTables.common;
}
__name(getDefaultLootTable, "getDefaultLootTable");
async function handleGameLoot(request, env, userId, customerId, action2) {
  if (action2 === "generate") {
    return await handleGenerateLoot(request, env, userId, customerId);
  } else if (action2 === "tables") {
    return await handleGetLootTables(request, env, userId, customerId);
  }
  return new Response(JSON.stringify({
    error: "Bad Request",
    message: "Invalid action"
  }), {
    status: 400,
    headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
  });
}
__name(handleGameLoot, "handleGameLoot");

// handlers/game/save-state.js
async function handleGameSaveState(request, env, userId, customerId, action2) {
  if (action2 === "save") {
    return await handleSaveGameState(request, env, userId, customerId);
  } else if (action2 === "load") {
    return await handleLoadGameState(request, env, userId, customerId);
  }
  return new Response(JSON.stringify({
    error: "Bad Request",
    message: "Invalid action"
  }), {
    status: 400,
    headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
  });
}
__name(handleGameSaveState, "handleGameSaveState");
async function handleSaveGameState(request, env, userId, customerId) {
  try {
    const body = await request.json();
    const { characterId, saveData, version } = body;
    if (!characterId || !saveData) {
      return new Response(JSON.stringify({
        error: "Bad Request",
        message: "characterId and saveData are required"
      }), {
        status: 400,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const saveKey = getCustomerKey(customerId, `game_save_${userId}_${characterId}`);
    const saveState = {
      userId,
      characterId,
      saveData,
      version: version || "1.0.0",
      savedAt: (/* @__PURE__ */ new Date()).toISOString(),
      customerId
    };
    await env.GAME_KV.put(saveKey, JSON.stringify(saveState), {
      expirationTtl: 60 * 60 * 24 * 365
      // 1 year
    });
    return new Response(JSON.stringify({
      success: true,
      savedAt: saveState.savedAt
    }), {
      status: 200,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Save state error:", error);
    return new Response(JSON.stringify({
      error: "Internal server error",
      message: env.ENVIRONMENT === "development" ? error.message : void 0
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleSaveGameState, "handleSaveGameState");
async function handleLoadGameState(request, env, userId, customerId) {
  try {
    const url = new URL(request.url);
    const characterId = url.searchParams.get("characterId");
    if (!characterId) {
      return new Response(JSON.stringify({
        error: "Bad Request",
        message: "characterId query parameter is required"
      }), {
        status: 400,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    const saveKey = getCustomerKey(customerId, `game_save_${userId}_${characterId}`);
    const saveStateData = await env.GAME_KV.get(saveKey, { type: "json" });
    if (!saveStateData) {
      return new Response(JSON.stringify({
        error: "Not Found",
        message: "No save state found for this character"
      }), {
        status: 404,
        headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify({
      success: true,
      saveState: saveStateData
    }), {
      status: 200,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Load state error:", error);
    return new Response(JSON.stringify({
      error: "Internal server error",
      message: env.ENVIRONMENT === "development" ? error.message : void 0
    }), {
      status: 500,
      headers: { ...getCorsHeaders2(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleLoadGameState, "handleLoadGameState");

// utils/auth.js
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
    return {
      userId: payload.sub,
      email: payload.email,
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

// router/game-routes.js
async function handleGameRoute(handler, request, env, auth) {
  if (!auth) {
    const rfcError = createError2(request, 401, "Unauthorized", "Authentication required. Please provide a valid JWT token.");
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
  const handlerResponse = await handler(request, env, auth.userId, auth.customerId);
  if (auth.jwtToken && handlerResponse.ok) {
    try {
      const { encryptWithJWT: encryptWithJWT2 } = await Promise.resolve().then(() => (init_api2(), api_exports));
      const responseData = await handlerResponse.json();
      const encrypted = await encryptWithJWT2(responseData, auth.jwtToken);
      const headers = new Headers(handlerResponse.headers);
      headers.set("Content-Type", "application/json");
      headers.set("X-Encrypted", "true");
      return {
        response: new Response(JSON.stringify(encrypted), {
          status: handlerResponse.status,
          statusText: handlerResponse.statusText,
          headers
        }),
        customerId: auth.customerId
      };
    } catch (error) {
      console.error("Failed to encrypt response:", error);
      return { response: handlerResponse, customerId: auth.customerId };
    }
  }
  return { response: handlerResponse, customerId: auth.customerId };
}
__name(handleGameRoute, "handleGameRoute");
async function handleGameRoutes(request, path, env) {
  if (!path.startsWith("/game/") && path !== "/") {
    return null;
  }
  const normalizedPath = path === "/" ? "/game/" : path;
  const auth = await authenticateRequest(request, env);
  try {
    if (normalizedPath === "/game/save-state" && request.method === "POST") {
      return await handleGameRoute(
        (req, e, userId, customerId) => handleGameSaveState(req, e, userId, customerId, "save"),
        request,
        env,
        auth
      );
    }
    if (normalizedPath === "/game/save-state" && request.method === "GET") {
      return await handleGameRoute(
        (req, e, userId, customerId) => handleGameSaveState(req, e, userId, customerId, "load"),
        request,
        env,
        auth
      );
    }
    if (normalizedPath === "/game/loot-box/claim" && request.method === "POST") {
      return await handleGameRoute(
        (req, e, userId, customerId) => handleGameLootBox(req, e, userId, customerId, "claim"),
        request,
        env,
        auth
      );
    }
    if (normalizedPath === "/game/loot-box/status" && request.method === "GET") {
      return await handleGameRoute(
        (req, e, userId, customerId) => handleGameLootBox(req, e, userId, customerId, "status"),
        request,
        env,
        auth
      );
    }
    if (normalizedPath === "/game/idle/claim" && request.method === "POST") {
      return await handleGameRoute(
        (req, e, userId, customerId) => handleGameIdle(req, e, userId, customerId, "claim"),
        request,
        env,
        auth
      );
    }
    if (normalizedPath === "/game/idle/progress" && request.method === "GET") {
      return await handleGameRoute(
        (req, e, userId, customerId) => handleGameIdle(req, e, userId, customerId, "progress"),
        request,
        env,
        auth
      );
    }
    if (normalizedPath === "/game/idle/activity/start" && request.method === "POST") {
      return await handleGameRoute(
        (req, e, userId, customerId) => handleGameIdle(req, e, userId, customerId, "start"),
        request,
        env,
        auth
      );
    }
    if (normalizedPath === "/game/idle/activity/stop" && request.method === "POST") {
      return await handleGameRoute(
        (req, e, userId, customerId) => handleGameIdle(req, e, userId, customerId, "stop"),
        request,
        env,
        auth
      );
    }
    if (normalizedPath === "/game/crafting/start" && request.method === "POST") {
      return await handleGameRoute(
        (req, e, userId, customerId) => handleGameCrafting(req, e, userId, customerId, "start"),
        request,
        env,
        auth
      );
    }
    if (normalizedPath === "/game/crafting/collect" && request.method === "POST") {
      return await handleGameRoute(
        (req, e, userId, customerId) => handleGameCrafting(req, e, userId, customerId, "collect"),
        request,
        env,
        auth
      );
    }
    if (normalizedPath === "/game/crafting/sessions" && request.method === "GET") {
      return await handleGameRoute(
        (req, e, userId, customerId) => handleGameCrafting(req, e, userId, customerId, "sessions"),
        request,
        env,
        auth
      );
    }
    if (normalizedPath === "/game/dungeons/start" && request.method === "POST") {
      return await handleGameRoute(
        (req, e, userId, customerId) => handleGameDungeons(req, e, userId, customerId, "start"),
        request,
        env,
        auth
      );
    }
    if (normalizedPath === "/game/dungeons/complete-room" && request.method === "POST") {
      return await handleGameRoute(
        (req, e, userId, customerId) => handleGameDungeons(req, e, userId, customerId, "complete-room"),
        request,
        env,
        auth
      );
    }
    if (normalizedPath === "/game/dungeons/complete" && request.method === "POST") {
      return await handleGameRoute(
        (req, e, userId, customerId) => handleGameDungeons(req, e, userId, customerId, "complete"),
        request,
        env,
        auth
      );
    }
    if (normalizedPath === "/game/dungeons/instances" && request.method === "GET") {
      return await handleGameRoute(
        (req, e, userId, customerId) => handleGameDungeons(req, e, userId, customerId, "instances"),
        request,
        env,
        auth
      );
    }
    if (normalizedPath === "/game/inventory" && request.method === "GET") {
      return await handleGameRoute(
        (req, e, userId, customerId) => handleGameInventory(req, e, userId, customerId, "get"),
        request,
        env,
        auth
      );
    }
    if (normalizedPath === "/game/inventory/item" && request.method === "POST") {
      return await handleGameRoute(
        (req, e, userId, customerId) => handleGameInventory(req, e, userId, customerId, "add"),
        request,
        env,
        auth
      );
    }
    if (normalizedPath === "/game/inventory/item" && request.method === "DELETE") {
      return await handleGameRoute(
        (req, e, userId, customerId) => handleGameInventory(req, e, userId, customerId, "remove"),
        request,
        env,
        auth
      );
    }
    if (normalizedPath === "/game/inventory/equip" && request.method === "POST") {
      return await handleGameRoute(
        (req, e, userId, customerId) => handleGameInventory(req, e, userId, customerId, "equip"),
        request,
        env,
        auth
      );
    }
    if (normalizedPath === "/game/character" && request.method === "GET") {
      return await handleGameRoute(
        (req, e, userId, customerId) => handleGameCharacter(req, e, userId, customerId, "get"),
        request,
        env,
        auth
      );
    }
    if (normalizedPath === "/game/character" && request.method === "POST") {
      return await handleGameRoute(
        (req, e, userId, customerId) => handleGameCharacter(req, e, userId, customerId, "create"),
        request,
        env,
        auth
      );
    }
    if (normalizedPath === "/game/character/appearance" && request.method === "PUT") {
      return await handleGameRoute(
        (req, e, userId, customerId) => handleGameCharacter(req, e, userId, customerId, "update-appearance"),
        request,
        env,
        auth
      );
    }
    if (normalizedPath === "/game/loot/generate" && request.method === "POST") {
      return await handleGameRoute(
        (req, e, userId, customerId) => handleGameLoot(req, e, userId, customerId, "generate"),
        request,
        env,
        auth
      );
    }
    if (normalizedPath === "/game/loot/tables" && request.method === "GET") {
      return await handleGameRoute(
        (req, e, userId, customerId) => handleGameLoot(req, e, userId, customerId, "tables"),
        request,
        env,
        auth
      );
    }
    if (normalizedPath === "/game/" && request.method === "GET") {
      return {
        response: new Response(JSON.stringify({
          status: "ok",
          message: "Game API is running",
          endpoints: 23,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        }), {
          status: 200,
          headers: { ...getCorsHeaders(env, request), "Content-Type": "application/json" }
        }),
        customerId: null
      };
    }
    return {
      response: new Response(JSON.stringify({ error: "Game endpoint not found" }), {
        status: 404,
        headers: { ...getCorsHeaders(env, request), "Content-Type": "application/json" }
      }),
      customerId: auth?.customerId || null
    };
  } catch (error) {
    console.error("Game route handler error:", error);
    return {
      response: new Response(JSON.stringify({
        error: "Internal server error",
        message: env.ENVIRONMENT === "development" ? error.message : void 0
      }), {
        status: 500,
        headers: { ...getCorsHeaders(env, request), "Content-Type": "application/json" }
      }),
      customerId: auth?.customerId || null
    };
  }
}
__name(handleGameRoutes, "handleGameRoutes");

// worker.ts
async function handleHealth(env, request) {
  const corsHeaders = createCORSHeaders(request, {
    allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
  });
  return new Response(JSON.stringify({
    status: "ok",
    message: "Game API is running",
    service: "strixun-game-api",
    endpoints: 23,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  }), {
    headers: {
      "Content-Type": "application/json",
      ...Object.fromEntries(corsHeaders.entries())
    }
  });
}
__name(handleHealth, "handleHealth");
var worker_default = {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      const corsHeaders = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(null, { headers: Object.fromEntries(corsHeaders.entries()) });
    }
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (path === "/health" || path === "/") {
        return await handleHealth(env, request);
      }
      const gameResult = await handleGameRoutes(request, path, env);
      if (gameResult) {
        return gameResult.response;
      }
      const rfcError = createError2(request, 404, "Not Found", "The requested endpoint was not found");
      const corsHeaders404 = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
      });
      return new Response(JSON.stringify(rfcError), {
        status: 404,
        headers: {
          "Content-Type": "application/problem+json",
          ...Object.fromEntries(corsHeaders404.entries())
        }
      });
    } catch (error) {
      console.error("Request handler error:", error);
      if (error.message && error.message.includes("JWT_SECRET")) {
        const rfcError2 = createError2(
          request,
          500,
          "Server Configuration Error",
          "JWT_SECRET environment variable is required. Please contact the administrator."
        );
        const corsHeaders2 = createCORSHeaders(request, {
          allowedOrigins: env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]
        });
        return new Response(JSON.stringify(rfcError2), {
          status: 500,
          headers: {
            "Content-Type": "application/problem+json",
            ...Object.fromEntries(corsHeaders2.entries())
          }
        });
      }
      const rfcError = createError2(
        request,
        500,
        "Internal Server Error",
        env.ENVIRONMENT === "development" ? error.message : "An internal server error occurred"
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
};
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
