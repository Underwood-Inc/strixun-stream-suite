/**
 * OTP Auth Service - TypeScript/JavaScript SDK
 * 
 * @version 1.0.0
 */

export interface OTPAuthConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface OTPResponse {
  success: boolean;
  message: string;
  expiresIn: number;
  remaining: number;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  userId: string;
  email: string;
  expiresAt: string;
}

export interface UserResponse {
  success: boolean;
  userId: string;
  email: string;
  createdAt: string;
  lastLogin: string;
}

export interface ErrorResponse {
  error: string;
  message?: string;
  details?: string;
}

export class OTPAuth {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: OTPAuthConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://otp-auth-service.workers.dev';
  }

  /**
   * Request OTP code
   */
  async requestOTP(email: string): Promise<OTPResponse> {
    const response = await fetch(`${this.baseUrl}/auth/request-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'X-OTP-API-Key': this.apiKey
      },
      body: JSON.stringify({ email })
    });

    if (!response.ok) {
      const error: ErrorResponse = await response.json();
      throw new Error(error.error || `Request failed: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Verify OTP code and get JWT token
   */
  async verifyOTP(email: string, otp: string): Promise<AuthResponse> {
    const response = await fetch(`${this.baseUrl}/auth/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'X-OTP-API-Key': this.apiKey
      },
      body: JSON.stringify({ email, otp })
    });

    if (!response.ok) {
      const error: ErrorResponse = await response.json();
      throw new Error(error.error || `Verification failed: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Get current user information
   */
  async getMe(token: string): Promise<UserResponse> {
    const response = await fetch(`${this.baseUrl}/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const error: ErrorResponse = await response.json();
      throw new Error(error.error || `Request failed: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Logout and revoke token
   */
  async logout(token: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/auth/logout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const error: ErrorResponse = await response.json();
      throw new Error(error.error || `Logout failed: ${response.status}`);
    }
  }

  /**
   * Refresh JWT token
   */
  async refreshToken(token: string): Promise<AuthResponse> {
    const response = await fetch(`${this.baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token })
    });

    if (!response.ok) {
      const error: ErrorResponse = await response.json();
      throw new Error(error.error || `Refresh failed: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Health check
   */
  async health(): Promise<{ status: string; service: string; version: string }> {
    const response = await fetch(`${this.baseUrl}/health`, {
      method: 'GET'
    });

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }

    return await response.json();
  }
}

// Default export
export default OTPAuth;

