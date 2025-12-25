/**
 * Typing Indicator Service
 * 
 * Composable, agnostic service for managing typing indicators.
 * Handles debouncing and automatic stop detection.
 * 
 * @module services/chat/typingIndicator
 */

export interface TypingIndicatorConfig {
  /**
   * Debounce delay before sending typing start (ms)
   * @default 500
   */
  startDelay?: number;
  
  /**
   * Auto-stop delay after last keystroke (ms)
   * @default 3000
   */
  stopDelay?: number;
  
  /**
   * Callback to send typing start event
   */
  onTypingStart: (userName: string) => void;
  
  /**
   * Callback to send typing stop event
   */
  onTypingStop: () => void;
}

/**
 * Typing Indicator Service
 * 
 * Manages typing indicator state with debouncing
 */
export class TypingIndicatorService {
  private config: TypingIndicatorConfig;
  private startTimer: number | null = null;
  private stopTimer: number | null = null;
  private isTyping: boolean = false;

  constructor(config: TypingIndicatorConfig) {
    this.config = {
      startDelay: 500,
      stopDelay: 3000,
      ...config,
    };
  }

  /**
   * Handle user input (call on every keystroke)
   * 
   * @param userName - Current user's display name
   */
  handleInput(userName: string): void {
    // Clear stop timer
    if (this.stopTimer !== null) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }

    // If not already typing, start typing after delay
    if (!this.isTyping) {
      if (this.startTimer !== null) {
        clearTimeout(this.startTimer);
      }

      this.startTimer = window.setTimeout(() => {
        this.isTyping = true;
        this.config.onTypingStart(userName);
        this.startTimer = null;
      }, this.config.startDelay);
    }

    // Set stop timer
    this.stopTimer = window.setTimeout(() => {
      this.stopTyping();
    }, this.config.stopDelay);
  }

  /**
   * Stop typing indicator
   */
  stopTyping(): void {
    if (this.startTimer !== null) {
      clearTimeout(this.startTimer);
      this.startTimer = null;
    }

    if (this.stopTimer !== null) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }

    if (this.isTyping) {
      this.isTyping = false;
      this.config.onTypingStop();
    }
  }

  /**
   * Cleanup timers
   */
  cleanup(): void {
    this.stopTyping();
  }
}

