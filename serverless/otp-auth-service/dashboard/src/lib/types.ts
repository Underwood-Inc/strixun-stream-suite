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
  displayName?: string; // Randomly generated display name - use this instead of email in UI
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

export interface EncryptedApiKeyData {
  doubleEncrypted: boolean;
  encrypted: boolean;
  algorithm: string;
  iv: string;
  salt: string;
  tokenHash: string;
  data: string;
  timestamp: string;
}

export interface ApiKey {
  keyId: string;
  name: string;
  createdAt: string;
  lastUsed: string | null;
  status: 'active' | 'revoked' | 'rotated';
  apiKey?: string | EncryptedApiKeyData | null; // Can be plain text (on reveal), double-encrypted, or null
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

export interface DailyBreakdown {
  date: string;
  otpRequests: number;
  otpVerifications: number;
  successfulLogins: number;
  failedAttempts: number;
  emailsSent: number;
}

export interface Analytics {
  success?: boolean;
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
  metrics?: {
    otpRequests: number;
    otpVerifications: number;
    successRate: number;
    emailsSent: number;
    uniqueUsers: number;
    newUsers: number;
  };
  dailyBreakdown?: DailyBreakdown[];
}

export interface RealtimeAnalytics {
  success?: boolean;
  activeUsers?: number;
  requestsPerMinute?: number;
  currentHour?: {
    otpRequests: number;
    otpVerifications: number;
    activeUsers: number;
  };
  last24Hours?: {
    otpRequests: number;
    otpVerifications: number;
  };
  responseTimeMetrics?: Record<string, {
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  }>;
  errorRate?: number;
  lastUpdated?: string;
}

export interface ErrorAnalytics {
  success?: boolean;
  total: number;
  byCategory?: Record<string, number>;
  byEndpoint?: Record<string, number>;
  errors?: Array<{
    category: string;
    message: string;
    endpoint: string;
    timestamp: string;
  }>;
  period?: {
    start: string;
    end: string;
  };
  recentErrors?: Array<{
    category: string;
    message: string;
    endpoint: string;
    timestamp: string;
  }>;
}

