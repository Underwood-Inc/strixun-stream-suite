/**
 * OTP Login Component - Core Logic
 * 
 * Framework-agnostic email OTP authentication component
 * Can be used with any framework or vanilla JavaScript
 * 
 * CRITICAL: All OTP requests (email and OTP code) are encrypted in transit
 * using service key encryption for maximum security.
 */

// Import OTP configuration
import { OTP_LENGTH } from '../../shared-config/otp-config.js';

// Import types
import type {
  OtpLoginConfig,
  OtpLoginState,
} from './types.js';

// Import modules
import { requestOtp } from './otp-request.js';
import { verifyOtp } from './otp-verify.js';
import {
  stopCountdown,
  stopRateLimitCountdown,
  type CountdownManager,
} from './countdown.js';
import { formatCountdown as formatCountdownUtil, formatRateLimitCountdown as formatRateLimitCountdownUtil } from './utils.js';

export type {
  OtpLoginConfig,
  OtpLoginState,
  LoginSuccessData,
  RateLimitDetails,
} from './types.js';

export class OtpLoginCore implements CountdownManager {
  private config: OtpLoginConfig;
  private state: OtpLoginState;
  public countdownInterval: ReturnType<typeof setInterval> | null = null;
  public rateLimitCountdownInterval: ReturnType<typeof setInterval> | null = null;
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
   * Get current state
   * Implements CountdownManager interface
   */
  getState(): OtpLoginState {
    return { ...this.state };
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
   * Update state and notify listeners
   * Made accessible for CountdownManager interface
   */
  setState(updates: Partial<OtpLoginState>): void {
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
    // Only allow digits, max OTP_LENGTH characters
    const cleanOtp = otp.replace(/\D/g, '').slice(0, OTP_LENGTH);
    this.setState({ otp: cleanOtp });
  }

  /**
   * Request OTP code
   * CRITICAL: Email is encrypted in transit using service key encryption
   */
  async requestOtp(): Promise<void> {
    await requestOtp({
      config: this.config,
      state: this.state,
      setState: (updates) => this.setState(updates),
      countdownManager: this,
    });
  }

  /**
   * Verify OTP code
   */
  async verifyOtp(): Promise<void> {
    await verifyOtp({
      config: this.config,
      state: this.state,
      setState: (updates) => this.setState(updates),
      countdownManager: this,
    });
  }

  /**
   * Go back to email step
   */
  goBack(): void {
    stopCountdown(this);
    this.setState({
      step: 'email',
      otp: '',
      error: null,
      countdown: 0,
      rateLimitResetAt: null,
      rateLimitCountdown: 0,
    });
    stopRateLimitCountdown(this);
  }

  /**
   * Reset component state
   */
  reset(): void {
    stopCountdown(this);
    stopRateLimitCountdown(this);
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
   * Cleanup
   */
  destroy(): void {
    stopCountdown(this);
    stopRateLimitCountdown(this);
    this.stateListeners = [];
  }

  /**
   * Format countdown seconds to MM:SS
   */
  static formatCountdown(seconds: number): string {
    return formatCountdownUtil(seconds);
  }

  /**
   * Format rate limit countdown to human-readable string
   */
  static formatRateLimitCountdown(seconds: number): string {
    return formatRateLimitCountdownUtil(seconds);
  }
}
