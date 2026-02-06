/**
 * TypeScript Types for OTP Auth API
 * 
 * CRITICAL: We ONLY have Customer entities - NO "customer" entity exists
 */

// Re-export types from Access Service (single source of truth)
export type { RoleDefinition, PermissionDefinition } from '@strixun/access-service';

export interface Customer {
  customerId: string;
  email: string;
  displayName?: string | null;
  name?: string;
  status: 'active' | 'suspended' | 'pending';
  plan: string;
  createdAt: string;
  config?: CustomerConfig;
}

export interface CustomerConfig {
  allowedOrigins?: string[];
  rateLimits?: RateLimits;
  emailProvider?: string;
}

export interface RateLimits {
  otpRequestsPerDay?: number;
  otpRequestsPerMonth?: number;
  maxCustomers?: number;
}

export interface ApiKey {
  keyId: string;
  name: string;
  apiKey?: any; // Double-encrypted data (not displayed in UI - for security)
  createdAt: string;
  lastUsed: string | null;
  status: 'active' | 'revoked';
  /** Allowed origins for CORS when using this API key */
  allowedOrigins?: string[];
}

export interface ApiKeyResponse {
  apiKey: string;
  keyId: string;
}

export interface AuditLog {
  eventType: string;
  timestamp: string;
  [key: string]: unknown;
}

export interface AuditLogsResponse {
  success: boolean;
  period: {
    start: string;
    end: string;
  };
  total: number;
  events: AuditLog[];
}

export interface Analytics {
  today?: {
    otpRequests: number;
    otpVerifications: number;
    successfulLogins: number;
    failedAttempts: number;
    emailsSent: number;
    successRate: number;
  };
  period?: {
    start: string;
    end: string;
    otpRequests: number;
    otpVerifications: number;
    successfulLogins: number;
    failedAttempts: number;
    successRate: number;
  };
}

export interface RealtimeAnalytics {
  activeCustomers?: number;
  requestsPerMinute?: number;
}

export interface ErrorAnalytics {
  total: number;
  byCategory?: Record<string, number>;
  byEndpoint?: Record<string, number>;
  errors?: Array<{
    category: string;
    message: string;
    endpoint: string;
    timestamp: string;
  }>;
}

/**
 * Individual test step result
 */
export interface TestStep {
  step: number;
  name: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  message: string;
  duration?: number;
}

/**
 * API Key verification response
 * Returned when testing an API key to show its status and available services
 */
export interface ApiKeyVerifyResponse {
  success: boolean;
  valid: boolean;
  keyId?: string;
  name?: string;
  status?: 'active' | 'inactive' | 'revoked';
  customerId?: string;
  customerStatus?: string;
  customerPlan?: string;
  createdAt?: string;
  lastUsed?: string | null;
  ssoConfig?: {
    isolationMode: string;
    globalSsoEnabled: boolean;
  };
  services: {
    name: string;
    endpoint: string;
    available: boolean;
  }[];
  rateLimits?: {
    requestsPerHour: number;
    requestsPerDay: number;
  };
  error?: string;
  testedAt: string;
  /** Step-by-step test results */
  testSteps?: TestStep[];
  /** Summary of what was tested */
  testSummary?: string;
}
