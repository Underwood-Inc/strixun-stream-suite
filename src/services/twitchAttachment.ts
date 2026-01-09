/**
 * Twitch Account Attachment Service
 * 
 * Composable, agnostic service for attaching Twitch accounts to OTP-authenticated users.
 * Handles OAuth flow and secure token storage.
 * 
 * @module services/twitchAttachment
 */

import { authenticatedFetch, getApiUrl } from '../stores/auth';

export interface TwitchAccountData {
  /**
   * Twitch user ID
   */
  twitchUserId: string;
  
  /**
   * Twitch username
   */
  twitchUsername: string;
  
  /**
   * Twitch access token (encrypted before storage)
   */
  accessToken: string;
  
  /**
   * Token expiration timestamp
   */
  expiresAt?: string;
  
  /**
   * Token refresh token (if available, encrypted)
   */
  refreshToken?: string;
  
  /**
   * OAuth scopes granted
   */
  scopes?: string[];
  
  /**
   * When the account was attached
   */
  attachedAt: string;
}

export interface TwitchAttachmentConfig {
  /**
   * API base URL (optional, uses getApiUrl() if not provided)
   */
  apiUrl?: string;
  
  /**
   * Twitch OAuth client ID
   */
  clientId: string;
  
  /**
   * OAuth callback URL
   */
  callbackUrl: string;
}

/**
 * Twitch Account Attachment Service
 * 
 * Handles attaching Twitch accounts to OTP-authenticated users
 */
export class TwitchAttachmentService {
  private config: TwitchAttachmentConfig;

  constructor(config: TwitchAttachmentConfig) {
    this.config = config;
  }

  /**
   * Generate Twitch OAuth URL for account attachment
   * 
   * @param state - Optional state parameter for CSRF protection
   * @returns OAuth URL
   */
  generateOAuthUrl(state?: string): string {
    const { clientId, callbackUrl } = this.config;
    
    const scopes = [
      'chat:read',
      'chat:edit',
      'user:read:follows',
      'moderator:read:followers',
      'user:read:email', // Optional: for email verification
    ].join('+');

    const params = new URLSearchParams({
      response_type: 'token',
      client_id: clientId,
      redirect_uri: callbackUrl,
      scope: scopes,
      force_verify: 'true',
    });

    if (state) {
      params.set('state', state);
    }

    return `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
  }

  /**
   * Attach Twitch account using OAuth token
   * 
   * @param accessToken - Twitch OAuth access token
   * @param state - Optional state parameter for verification
   * @returns Attached Twitch account data
   */
  async attachAccount(accessToken: string, state?: string): Promise<TwitchAccountData> {
    const apiUrl = this.config.apiUrl || getApiUrl();
    if (!apiUrl) {
      throw new Error('API URL not configured');
    }

    // First, validate the token and get user info from Twitch
    const twitchUserInfo = await this.validateTwitchToken(accessToken);
    
    // Then attach to our system
    const response = await authenticatedFetch(`${apiUrl}/customer/twitch/attach`, {
      method: 'POST',
      body: JSON.stringify({
        accessToken,
        twitchUserId: twitchUserInfo.id,
        twitchUsername: twitchUserInfo.login,
        state,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || error.detail || 'Failed to attach Twitch account');
    }

    const data = await response.json();
    return data.account;
  }

  /**
   * Get attached Twitch account for current customer
   * 
   * @returns Twitch account data or null if not attached
   */
  async getAttachedAccount(): Promise<TwitchAccountData | null> {
    const apiUrl = this.config.apiUrl || getApiUrl();
    if (!apiUrl) {
      throw new Error('API URL not configured');
    }

    const response = await authenticatedFetch(`${apiUrl}/customer/twitch`, {
      method: 'GET',
    });

    if (response.status === 404) {
      return null; // No account attached
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || error.detail || 'Failed to get Twitch account');
    }

    const data = await response.json();
    return data.account;
  }

  /**
   * Detach Twitch account from customer
   */
  async detachAccount(): Promise<void> {
    const apiUrl = this.config.apiUrl || getApiUrl();
    if (!apiUrl) {
      throw new Error('API URL not configured');
    }

    const response = await authenticatedFetch(`${apiUrl}/customer/twitch/detach`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || error.detail || 'Failed to detach Twitch account');
    }
  }

  /**
   * Validate Twitch access token and get user info
   * 
   * @param accessToken - Twitch OAuth access token
   * @returns Twitch user information
   */
  private async validateTwitchToken(accessToken: string): Promise<{
    id: string;
    login: string;
    display_name: string;
    email?: string;
  }> {
    const response = await fetch('https://api.twitch.tv/helix/users', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Client-Id': this.config.clientId,
      },
    });

    if (!response.ok) {
      throw new Error('Invalid Twitch access token');
    }

    const data = await response.json();
    if (!data.data || data.data.length === 0) {
      throw new Error('No user data returned from Twitch');
    }

    return data.data[0];
  }
}

