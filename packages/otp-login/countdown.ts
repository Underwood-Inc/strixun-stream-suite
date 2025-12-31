/**
 * Countdown Management
 * 
 * Handles countdown timers for OTP expiration and rate limiting
 */

import type { OtpLoginState } from './types.js';

export interface CountdownManager {
  countdownInterval: ReturnType<typeof setInterval> | null;
  rateLimitCountdownInterval: ReturnType<typeof setInterval> | null;
  getState(): OtpLoginState;
  setState: (updates: Partial<OtpLoginState>) => void;
}

/**
 * Start countdown timer
 */
export function startCountdown(manager: CountdownManager): void {
  stopCountdown(manager);
  manager.countdownInterval = setInterval(() => {
    const state = manager.getState();
    if (state.countdown > 0) {
      manager.setState({ countdown: state.countdown - 1 });
    } else {
      stopCountdown(manager);
    }
  }, 1000);
}

/**
 * Stop countdown timer
 */
export function stopCountdown(manager: CountdownManager): void {
  if (manager.countdownInterval) {
    clearInterval(manager.countdownInterval);
    manager.countdownInterval = null;
  }
}

/**
 * Start rate limit countdown timer
 * Counts down from the server's authoritative retry_after value
 * to avoid clock skew issues between server and client
 */
export function startRateLimitCountdown(manager: CountdownManager): void {
  stopRateLimitCountdown(manager);
  
  const state = manager.getState();
  if (!state.rateLimitResetAt || state.rateLimitCountdown <= 0) {
    return;
  }
  
  manager.rateLimitCountdownInterval = setInterval(() => {
    const currentState = manager.getState();
    const currentCountdown = currentState.rateLimitCountdown;
    
    if (currentCountdown > 1) {
      // Decrement the countdown - don't recalculate from timestamp
      // This preserves the server's authoritative time calculation
      manager.setState({ rateLimitCountdown: currentCountdown - 1 });
    } else {
      // Rate limit expired - clear error and countdown
      manager.setState({ 
        error: null,
        rateLimitResetAt: null,
        rateLimitCountdown: 0,
      });
      stopRateLimitCountdown(manager);
    }
  }, 1000);
}

/**
 * Stop rate limit countdown timer
 */
export function stopRateLimitCountdown(manager: CountdownManager): void {
  if (manager.rateLimitCountdownInterval) {
    clearInterval(manager.rateLimitCountdownInterval);
    manager.rateLimitCountdownInterval = null;
  }
}

