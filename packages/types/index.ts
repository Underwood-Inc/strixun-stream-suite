/**
 * Shared Type Definitions for All Services
 * 
 * Centralized type registry for OTP Auth, URL Shortener, and Chat Signaling
 */

// Cloudflare Workers types
export interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}

interface TypeDef {
  typeName: string;
  required: string[];
  optional: string[];
  metrics?: Record<string, {
    required: boolean;
    compute: (data: any, context?: any) => any;
  }>;
}

/**
 * Simple type registry
 */
class TypeRegistry {
  private types: Map<string, TypeDef>;

  constructor() {
    this.types = new Map();
  }

  register(name: string, typeDef: TypeDef): void {
    this.types.set(name, typeDef);
  }

  get(name: string): TypeDef | undefined {
    return this.types.get(name);
  }

  buildFilterConfig(options: { alwaysInclude?: string[]; defaultInclude?: string[] } = {}) {
    return {
      alwaysInclude: options.alwaysInclude || [],
      defaultInclude: options.defaultInclude || [],
    };
  }
}

let typeRegistry: TypeRegistry | null = null;

function getTypeRegistry(): TypeRegistry {
  if (!typeRegistry) {
    typeRegistry = new TypeRegistry();
  }
  return typeRegistry;
}

/**
 * Initialize all service type definitions
 */
export function initializeServiceTypes(): TypeRegistry {
  const registry = getTypeRegistry();

  // ============ OTP Auth Service Types ============
  
  registry.register('otp-request', {
    typeName: 'OTPRequestResponse',
    required: ['id', 'customerId', 'success', 'message'],
    optional: ['expiresAt', 'retryAfter'],
    metrics: {},
  });

  registry.register('otp-verify', {
    typeName: 'OTPVerifyResponse',
    required: ['id', 'customerId', 'success', 'access_token', 'userId'],
    optional: ['token_type', 'expires_in', 'refresh_token'],
    metrics: {
      tokenExpiryDate: {
        required: false,
        compute: (data: any) => {
          if (data.expires_in) {
            return new Date(Date.now() + data.expires_in * 1000).toISOString();
          }
          return null;
        },
      },
    },
  });

  registry.register('customer', {
    typeName: 'CustomerResponse',
    required: ['id', 'customerId', 'name', 'email', 'companyName', 'plan', 'status'],
    optional: ['createdAt', 'updatedAt', 'config', 'features'],
    metrics: {
      isActive: {
        required: false,
        compute: (data: any) => data.status === 'active',
      },
      isPremium: {
        required: false,
        compute: (data: any) => ['premium', 'enterprise'].includes(data.plan),
      },
    },
  });

  registry.register('api-key', {
    typeName: 'APIKeyResponse',
    required: ['id', 'customerId', 'keyId', 'name', 'createdAt'],
    optional: ['lastUsed', 'expiresAt', 'permissions'],
    metrics: {},
  });

  registry.register('signup', {
    typeName: 'SignupResponse',
    required: ['id', 'customerId', 'success', 'message'],
    optional: ['apiKey', 'keyId', 'access_token', 'userId', 'customer'],
    metrics: {},
  });

  // ============ URL Shortener Types ============

  registry.register('short-url', {
    typeName: 'ShortURLResponse',
    required: ['id', 'customerId', 'shortCode', 'originalUrl', 'createdAt'],
    optional: ['expiresAt', 'clicks', 'title', 'description', 'tags'],
    metrics: {
      isExpired: {
        required: false,
        compute: (data: any) => {
          if (!data.expiresAt) return false;
          return new Date(data.expiresAt) < new Date();
        },
      },
      clickRate: {
        required: false,
        compute: (data: any) => {
          // Calculate clicks per day since creation
          if (!data.clicks || !data.createdAt) return 0;
          const daysSinceCreation = (Date.now() - new Date(data.createdAt).getTime()) / (1000 * 60 * 60 * 24);
          return daysSinceCreation > 0 ? data.clicks / daysSinceCreation : data.clicks;
        },
      },
    },
  });

  registry.register('url-stats', {
    typeName: 'URLStatsResponse',
    required: ['id', 'customerId', 'shortCode', 'totalClicks'],
    optional: ['clicksByDay', 'clicksByCountry', 'referrers', 'lastClicked'],
    metrics: {},
  });

  // ============ Chat Signaling Types ============

  registry.register('signaling-offer', {
    typeName: 'SignalingOfferResponse',
    required: ['id', 'customerId', 'type', 'offer'],
    optional: ['roomId', 'from', 'to', 'timestamp'],
    metrics: {},
  });

  registry.register('signaling-answer', {
    typeName: 'SignalingAnswerResponse',
    required: ['id', 'customerId', 'type', 'answer'],
    optional: ['roomId', 'from', 'to', 'timestamp'],
    metrics: {},
  });

  registry.register('signaling-ice', {
    typeName: 'SignalingICEResponse',
    required: ['id', 'customerId', 'type', 'candidate'],
    optional: ['roomId', 'from', 'to', 'timestamp'],
    metrics: {},
  });

  registry.register('room', {
    typeName: 'RoomResponse',
    required: ['id', 'customerId', 'roomId', 'createdAt'],
    optional: ['participants', 'maxParticipants', 'isActive', 'metadata'],
    metrics: {
      participantCount: {
        required: false,
        compute: (data: any) => data.participants?.length || 0,
      },
      isFull: {
        required: false,
        compute: (data: any) => {
          const count = data.participants?.length || 0;
          return data.maxParticipants ? count >= data.maxParticipants : false;
        },
      },
    },
  });

  // ============ Error Types ============

  registry.register('error', {
    typeName: 'ErrorResponse',
    required: ['id', 'customerId', 'type', 'title', 'status', 'detail'],
    optional: ['instance', 'error_code', 'error_info', 'retry_after', 'rate_limit_details'],
    metrics: {},
  });

  return registry;
}

/**
 * Get filter config for all services
 */
export function getServiceFilterConfig() {
  const registry = getTypeRegistry();
  
  return registry.buildFilterConfig({
    alwaysInclude: ['id', 'customerId'],
    defaultInclude: ['success', 'message'],
  });
}

// Export getTypeRegistry for use in other files
export { getTypeRegistry };

