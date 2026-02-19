/**
 * Enhanced API Framework - OTP Auth Service Integration Example
 * 
 * Example of how to integrate the enhanced API framework with OTP Auth Service
 */

import type { TypeDefinition, ResponseFilterConfig } from '../types';
import { registerType, getTypeRegistry } from '../registry';
import { createEnhancedHandler } from '../workers/handler';
import { createE2EEncryptionMiddleware } from '../encryption';
import { createResponseFilterMiddleware } from '../filtering';
import { createErrorLegendMiddleware } from '../errors';

// ============ Type Definitions ============

/**
 * OTP Request Response Type
 */
export interface OTPRequestResponse {
  success: boolean;
  message: string;
  expiresAt: string;
}

/**
 * OTP Verify Response Type
 */
export interface OTPVerifyResponse {
  success: boolean;
  access_token: string;
  token_type: string;
  expires_in: number;
  customerId: string;
}

/**
 * Customer Response Type
 */
export interface CustomerResponse {
  customerId: string;
  name: string;
  companyName: string;
  plan: string;
  status: string;
  createdAt: string;
  config?: {
    rateLimits?: {
      otpRequestsPerHour?: number;
      otpRequestsPerDay?: number;
    };
  };
}

// ============ Type Definitions ============

const otpRequestTypeDef: TypeDefinition = {
  typeName: 'OTPRequestResponse',
  required: ['id', 'customerId', 'success', 'message'],
  optional: ['expiresAt'],
  metrics: {},
};

const otpVerifyTypeDef: TypeDefinition = {
  typeName: 'OTPVerifyResponse',
  required: ['id', 'customerId', 'success', 'access_token', 'userId', 'email'],
  optional: ['token_type', 'expires_in'],
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
};

const customerTypeDef: TypeDefinition = {
  typeName: 'CustomerResponse',
  required: ['id', 'customerId', 'name', 'email', 'companyName', 'plan', 'status'],
  optional: ['createdAt', 'config'],
  metrics: {
    isActive: {
      required: false,
      compute: (data: any) => data.status === 'active',
    },
    isPremium: {
      required: false,
      compute: (data: any) => data.plan === 'premium' || data.plan === 'enterprise',
    },
  },
};

// ============ Register Types ============

export function registerOTPAuthTypes(): void {
  const registry = getTypeRegistry();
  
  registry
    .register('otp-request', otpRequestTypeDef)
    .register('otp-verify', otpVerifyTypeDef)
    .register('customer', customerTypeDef);
}

// ============ Filter Config ============

export function createOTPAuthFilterConfig(): ResponseFilterConfig {
  const registry = getTypeRegistry();
  
  return registry.buildFilterConfig({
    alwaysInclude: ['id', 'customerId'],
    defaultInclude: ['success', 'message'],
  });
}

// ============ Example Handlers ============

/**
 * Example: OTP Request Handler
 */
export const handleOTPRequest = createEnhancedHandler<OTPRequestResponse>(
  async (request, context) => {
    // Your OTP request logic here
    const body = await request.json();
    const email = body.email;

    // Simulate OTP request
    return {
      success: true,
      message: 'OTP sent successfully',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };
  },
  {
    typeDef: otpRequestTypeDef,
    requireAuth: false,
    cors: true,
  }
);

/**
 * Example: OTP Verify Handler
 */
export const handleOTPVerify = createEnhancedHandler<OTPVerifyResponse>(
  async (request, context) => {
    // Your OTP verify logic here
    const body = await request.json();
    const email = body.email;
    const otp = body.otp;

    // Simulate OTP verification
    return {
      success: true,
      access_token: 'jwt-token-here',
      token_type: 'Bearer',
      expires_in: 25200,
      userId: 'user-123',
      email: email,
      customerId: context.customer?.customerId || 'customer-123',
    };
  },
  {
    typeDef: otpVerifyTypeDef,
    requireAuth: false,
    cors: true,
  }
);

/**
 * Example: Get Customer Handler
 */
export const handleGetCustomer = createEnhancedHandler<CustomerResponse>(
  async (request, context) => {
    // Your get customer logic here
    const customerId = context.customer?.customerId || '';

    // Simulate customer fetch
    return {
      customerId,
      name: 'John Doe',
      email: 'john@example.com',
      companyName: 'Example Corp',
      plan: 'free',
      status: 'active',
      createdAt: new Date().toISOString(),
    };
  },
  {
    typeDef: customerTypeDef,
    requireAuth: true,
    cors: true,
  }
);

// ============ Cloudflare Worker Export ============

/**
 * Example Cloudflare Worker using enhanced API framework
 */
export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    // Register types
    registerOTPAuthTypes();

    // Route requests
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/auth/request-otp' && request.method === 'POST') {
      return handleOTPRequest(request, env, ctx);
    }

    if (path === '/auth/verify-otp' && request.method === 'POST') {
      return handleOTPVerify(request, env, ctx);
    }

    if (path.startsWith('/customer') && request.method === 'GET') {
      return handleGetCustomer(request, env, ctx);
    }

    // 404
    return new Response('Not Found', { status: 404 });
  },
};

