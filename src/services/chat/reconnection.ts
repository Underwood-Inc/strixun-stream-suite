/**
 * Reconnection Service
 * 
 * Composable, agnostic service for handling WebRTC reconnection with exponential backoff.
 * Manages connection state recovery and automatic retry logic.
 * 
 * @module services/chat/reconnection
 */

export interface ReconnectionConfig {
  /**
   * Initial retry delay (ms)
   * @default 1000
   */
  initialDelay?: number;
  
  /**
   * Maximum retry delay (ms)
   * @default 30000
   */
  maxDelay?: number;
  
  /**
   * Maximum number of retry attempts
   * @default 10
   */
  maxAttempts?: number;
  
  /**
   * Backoff multiplier
   * @default 2
   */
  backoffMultiplier?: number;
  
  /**
   * Callback to attempt reconnection
   */
  onReconnect: () => Promise<void>;
  
  /**
   * Callback when reconnection succeeds
   */
  onReconnectSuccess?: () => void;
  
  /**
   * Callback when reconnection fails permanently
   */
  onReconnectFailure?: (error: Error) => void;
  
  /**
   * Callback to restore room state
   */
  onRestoreState?: () => Promise<void>;
}

export interface ReconnectionState {
  /**
   * Current retry attempt
   */
  attempt: number;
  
  /**
   * Current delay (ms)
   */
  delay: number;
  
  /**
   * Whether reconnection is in progress
   */
  isReconnecting: boolean;
  
  /**
   * Last error encountered
   */
  lastError: Error | null;
}

/**
 * Reconnection Service
 * 
 * Handles automatic reconnection with exponential backoff
 */
export class ReconnectionService {
  private config: ReconnectionConfig;
  private state: ReconnectionState;
  private retryTimer: number | null = null;

  constructor(config: ReconnectionConfig) {
    this.config = {
      initialDelay: 1000,
      maxDelay: 30000,
      maxAttempts: 10,
      backoffMultiplier: 2,
      ...config,
    };

    this.state = {
      attempt: 0,
      delay: this.config.initialDelay!,
      isReconnecting: false,
      lastError: null,
    };
  }

  /**
   * Start reconnection process
   */
  async start(): Promise<void> {
    if (this.state.isReconnecting) {
      return; // Already reconnecting
    }

    this.state.isReconnecting = true;
    this.state.attempt = 0;
    this.state.delay = this.config.initialDelay!;

    await this.attemptReconnect();
  }

  /**
   * Stop reconnection process
   */
  stop(): void {
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    this.state.isReconnecting = false;
    this.state.attempt = 0;
  }

  /**
   * Reset reconnection state (after successful connection)
   */
  reset(): void {
    this.stop();
    this.state.delay = this.config.initialDelay!;
    this.state.lastError = null;
  }

  /**
   * Attempt reconnection
   */
  private async attemptReconnect(): Promise<void> {
    if (!this.state.isReconnecting) {
      return;
    }

    // Check if we've exceeded max attempts
    if (this.state.attempt >= this.config.maxAttempts!) {
      this.state.isReconnecting = false;
      const error = new Error(
        `Reconnection failed after ${this.state.attempt} attempts`
      );
      this.config.onReconnectFailure?.(error);
      return;
    }

    this.state.attempt++;

    try {
      // Restore room state if needed
      if (this.config.onRestoreState) {
        await this.config.onRestoreState();
      }

      // Attempt reconnection
      await this.config.onReconnect();

      // Success!
      this.state.isReconnecting = false;
      this.state.attempt = 0;
      this.state.delay = this.config.initialDelay!;
      this.config.onReconnectSuccess?.();
    } catch (error) {
      this.state.lastError = error instanceof Error ? error : new Error('Reconnection failed');

      // Calculate next delay with exponential backoff
      this.state.delay = Math.min(
        this.state.delay * this.config.backoffMultiplier!,
        this.config.maxDelay!
      );

      // Schedule next retry
      this.retryTimer = window.setTimeout(() => {
        this.retryTimer = null;
        this.attemptReconnect();
      }, this.state.delay);
    }
  }

  /**
   * Get current reconnection state
   */
  getState(): Readonly<ReconnectionState> {
    return { ...this.state };
  }

  /**
   * Check if currently reconnecting
   */
  isReconnecting(): boolean {
    return this.state.isReconnecting;
  }
}

