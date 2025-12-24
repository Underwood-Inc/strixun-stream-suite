/**
 * TypeScript Types for OTP Auth API
 */

export interface User {
  sub: string;
  email: string;
  email_verified: boolean;
  iss?: string;
  aud?: string;
}

export interface Customer {
  customerId: string;
  email: string;
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
  maxUsers?: number;
}

export interface ApiKey {
  keyId: string;
  name: string;
  createdAt: string;
  lastUsed: string | null;
  status: 'active' | 'revoked';
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
  activeUsers?: number;
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

