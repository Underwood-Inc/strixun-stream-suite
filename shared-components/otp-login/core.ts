/**
 * OTP Login Component - Core Logic
 * 
 * Framework-agnostic email OTP authentication component
 * Can be used with any framework or vanilla JavaScript
 */

export interface OtpLoginConfig {
  /** OTP Auth API base URL */
  apiUrl: string;
  /** Callback when login succeeds */
  onSuccess: (data: LoginSuccessData) => void;
  /** Callback when login fails */
  onError?: (error: string) => void;
  /** Optional: Custom API endpoints */
  endpoints?: {
    requestOtp?: string;
    verifyOtp?: string;
  };
  /** Optional: Custom headers to include in requests */
  customHeaders?: Record<string, string>;
}

export interface LoginSuccessData {
  /** User ID (OIDC sub claim or userId) */
  userId?: string;
  /** User email */
  email: string;
  /** Display name (anonymized) */
  displayName?: string | null;
  /** Access token */
  token: string;
  /** Token expiration timestamp */
  expiresAt?: number;
  /** Full response data */
  data?: any;
}

export interface RateLimitDetails {
  reason?: string;
  emailLimit?: {
    current: number;
    max: number;
    resetAt: string;
  };
  ipLimit?: {
    current: number;
    max: number;
    resetAt: string;
  };
  quotaLimit?: {
    daily?: {
      current: number;
      max: number;
    };
    monthly?: {
      current: number;
      max: number;
    };
  };
  failedAttempts?: number;
}

export interface OtpLoginState {
  step: 'email' | 'otp';
  email: string;
  otp: string;
  loading: boolean;
  error: string | null;
  errorCode?: string; // Error code for mapping
  errorDetails?: RateLimitDetails; // Detailed rate limit info
  countdown: number;
  rateLimitResetAt: string | null; // ISO timestamp when rate limit resets
  rateLimitCountdown: number; // Seconds until rate limit resets
}

export class OtpLoginCore {
  private config: OtpLoginConfig;
  private state: OtpLoginState;
  private countdownInterval: ReturnType<typeof setInterval> | null = null;
  private rateLimitCountdownInterval: ReturnType<typeof setInterval> | null = null;
  private stateListeners: Array<(state: OtpLoginState) => void> = [];

  constructor(config: OtpLoginConfig) {
    this.config = config;
    this.state = {
      step: 'email',
      email: '',
      otp: '',
      loading: false,
      error: null,
      countdown: 0,
      rateLimitResetAt: null,
      rateLimitCountdown: 0,
    };
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: OtpLoginState) => void): () => void {
    this.stateListeners.push(listener);
    // Return unsubscribe function
    return () => {
      this.stateListeners = this.stateListeners.filter(l => l !== listener);
    };
  }

  /**
   * Get current state
   */
  getState(): OtpLoginState {
    return { ...this.state };
  }

  /**
   * Update state and notify listeners
   */
  private setState(updates: Partial<OtpLoginState>): void {
    this.state = { ...this.state, ...updates };
    this.stateListeners.forEach(listener => listener(this.state));
  }

  /**
   * Set email
   */
  setEmail(email: string): void {
    this.setState({ email: email.trim().toLowerCase() });
  }

  /**
   * Set OTP
   */
  setOtp(otp: string): void {
    // Only allow digits, max 6 characters
    const cleanOtp = otp.replace(/\D/g, '').slice(0, 6);
    this.setState({ otp: cleanOtp });
  }

  /**
   * Request OTP code
   */
  async requestOtp(): Promise<void> {
    const email = this.state.email.trim().toLowerCase();

    // Validate email
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.setState({ error: 'Please enter a valid email address' });
      return;
    }

    try {
      this.setState({ loading: true, error: null });

      const endpoint = this.config.endpoints?.requestOtp || `${this.config.apiUrl}/auth/request-otp`;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.config.customHeaders) {
        Object.assign(headers, this.config.customHeaders);
      }
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.detail || data.error || 'Failed to send OTP';
        
        // Check if this is a rate limit error (429)
        if (response.status === 429 && data.reset_at) {
          // Use server's authoritative retry_after value if available, otherwise calculate from reset_at
          // The server's retry_after is the source of truth and accounts for server clock time
          const secondsUntilReset = data.retry_after !== undefined 
            ? Math.max(0, Math.ceil(data.retry_after))
            : (() => {
                const resetAt = new Date(data.reset_at);
                const now = new Date();
                return Math.max(0, Math.ceil((resetAt.getTime() - now.getTime()) / 1000));
              })();
          
          this.setState({ 
            error: errorMsg, 
            loading: false,
            errorCode: data.reason || 'rate_limit_exceeded',
            errorDetails: data.rate_limit_details,
            rateLimitResetAt: data.reset_at_iso || data.reset_at,
            rateLimitCountdown: secondsUntilReset,
          });
          
          // Start rate limit countdown
          this.startRateLimitCountdown();
        } else {
          this.setState({ 
            error: errorMsg, 
            loading: false,
            errorCode: data.reason || data.code,
            errorDetails: data.rate_limit_details,
            rateLimitResetAt: null,
            rateLimitCountdown: 0,
          });
          this.stopRateLimitCountdown();
        }
        
        this.config.onError?.(errorMsg);
        return;
      }

      // Success - switch to OTP step
      this.setState({
        step: 'otp',
        loading: false,
        error: null,
        countdown: 600, // 10 minutes
      });

      // Start countdown
      this.startCountdown();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to request OTP';
      this.setState({ error: errorMsg, loading: false });
      this.config.onError?.(errorMsg);
    }
  }

  /**
   * Verify OTP code
   */
  async verifyOtp(): Promise<void> {
    const otp = this.state.otp.trim();

    // Validate OTP
    if (!otp || !/^\d{6}$/.test(otp)) {
      this.setState({ error: 'Please enter a valid 6-digit OTP' });
      return;
    }

    try {
      this.setState({ loading: true, error: null });

      const endpoint = this.config.endpoints?.verifyOtp || `${this.config.apiUrl}/auth/verify-otp`;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.config.customHeaders) {
        Object.assign(headers, this.config.customHeaders);
      }
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email: this.state.email,
          otp,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.detail || data.error || 'Invalid OTP';
        this.setState({ error: errorMsg, loading: false });
        this.config.onError?.(errorMsg);
        return;
      }

      // Success - call onSuccess callback
      const successData: LoginSuccessData = {
        userId: data.userId || data.sub,
        email: data.email || this.state.email,
        displayName: data.displayName || null, // Include display name
        token: data.access_token || data.token,
        expiresAt: data.expiresAt,
        data,
      };

      this.stopCountdown();
      this.setState({ loading: false });
      this.config.onSuccess(successData);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to verify OTP';
      this.setState({ error: errorMsg, loading: false });
      this.config.onError?.(errorMsg);
    }
  }

  /**
   * Go back to email step
   */
  goBack(): void {
    this.stopCountdown();
    this.setState({
      step: 'email',
      otp: '',
      error: null,
      countdown: 0,
      rateLimitResetAt: null,
      rateLimitCountdown: 0,
    });
    this.stopRateLimitCountdown();
  }

  /**
   * Reset component state
   */
  reset(): void {
    this.stopCountdown();
    this.stopRateLimitCountdown();
    this.setState({
      step: 'email',
      email: '',
      otp: '',
      loading: false,
      error: null,
      countdown: 0,
      rateLimitResetAt: null,
      rateLimitCountdown: 0,
    });
  }

  /**
   * Start countdown timer
   */
  private startCountdown(): void {
    this.stopCountdown();
    this.countdownInterval = setInterval(() => {
      if (this.state.countdown > 0) {
        this.setState({ countdown: this.state.countdown - 1 });
      } else {
        this.stopCountdown();
      }
    }, 1000);
  }

  /**
   * Stop countdown timer
   */
  private stopCountdown(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  /**
   * Start rate limit countdown timer
   * Counts down from the server's authoritative retry_after value
   * to avoid clock skew issues between server and client
   */
  private startRateLimitCountdown(): void {
    this.stopRateLimitCountdown();
    
    if (!this.state.rateLimitResetAt || this.state.rateLimitCountdown <= 0) {
      return;
    }
    
    this.rateLimitCountdownInterval = setInterval(() => {
      const currentCountdown = this.state.rateLimitCountdown;
      
      if (currentCountdown > 1) {
        // Decrement the countdown - don't recalculate from timestamp
        // This preserves the server's authoritative time calculation
        this.setState({ rateLimitCountdown: currentCountdown - 1 });
      } else {
        // Rate limit expired - clear error and countdown
        this.setState({ 
          error: null,
          rateLimitResetAt: null,
          rateLimitCountdown: 0,
        });
        this.stopRateLimitCountdown();
      }
    }, 1000);
  }

  /**
   * Stop rate limit countdown timer
   */
  private stopRateLimitCountdown(): void {
    if (this.rateLimitCountdownInterval) {
      clearInterval(this.rateLimitCountdownInterval);
      this.rateLimitCountdownInterval = null;
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.stopCountdown();
    this.stopRateLimitCountdown();
    this.stateListeners = [];
  }

  /**
   * Format countdown seconds to MM:SS
   */
  static formatCountdown(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Format rate limit countdown to human-readable string
   */
  static formatRateLimitCountdown(seconds: number): string {
    if (seconds < 60) {
      return `${seconds} second${seconds !== 1 ? 's' : ''}`;
    } else if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      if (secs > 0) {
        return `${mins} minute${mins !== 1 ? 's' : ''} and ${secs} second${secs !== 1 ? 's' : ''}`;
      }
      return `${mins} minute${mins !== 1 ? 's' : ''}`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      const parts: string[] = [];
      if (hours > 0) {
        parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
      }
      if (mins > 0) {
        parts.push(`${mins} minute${mins !== 1 ? 's' : ''}`);
      }
      if (secs > 0 && hours === 0) {
        parts.push(`${secs} second${secs !== 1 ? 's' : ''}`);
      }
      return parts.join(' and ');
    }
  }
}

