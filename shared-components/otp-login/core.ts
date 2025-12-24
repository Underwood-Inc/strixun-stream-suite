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
}

export interface LoginSuccessData {
  /** User ID (OIDC sub claim or userId) */
  userId?: string;
  /** User email */
  email: string;
  /** Access token */
  token: string;
  /** Token expiration timestamp */
  expiresAt?: number;
  /** Full response data */
  data?: any;
}

export interface OtpLoginState {
  step: 'email' | 'otp';
  email: string;
  otp: string;
  loading: boolean;
  error: string | null;
  countdown: number;
}

export class OtpLoginCore {
  private config: OtpLoginConfig;
  private state: OtpLoginState;
  private countdownInterval: ReturnType<typeof setInterval> | null = null;
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
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.detail || data.error || 'Failed to send OTP';
        this.setState({ error: errorMsg, loading: false });
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
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    });
  }

  /**
   * Reset component state
   */
  reset(): void {
    this.stopCountdown();
    this.setState({
      step: 'email',
      email: '',
      otp: '',
      loading: false,
      error: null,
      countdown: 0,
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
   * Cleanup
   */
  destroy(): void {
    this.stopCountdown();
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
}

