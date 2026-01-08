/**
 * Twitch Account Attachment Handlers
 * 
 * Handles attaching/detaching Twitch accounts to OTP-authenticated customers
 * 
 * @module handlers/customer/twitch
 */

import { getCorsHeaders } from '../../utils/cors.js';
import { getCustomerKey } from '../../services/customer.js';
import { verifyJWT, getJWTSecret, hashEmail } from '../../utils/crypto.js';

interface CloudflareEnv {
  OTP_AUTH_KV: KVNamespace;
  TWITCH_CLIENT_ID?: string;
  [key: string]: any;
}

interface AuthResult {
  authenticated: boolean;
  status?: number;
  error?: string;
  customerId?: string;
  email?: string;
}

interface TwitchTokenInfo {
  twitchCustomerId: string;
  twitchUsername: string;
  displayName: string;
  email?: string;
  scopes: string[];
  expiresIn?: number;
}

interface TwitchAccount {
  twitchCustomerId: string;
  twitchUsername: string;
  displayName: string;
  email?: string;
  accessToken: string;
  scopes: string[];
  expiresAt: string | null;
  attachedAt: string;
}


/**
 * Verify JWT token and extract customer info
 */
async function authenticateRequest(
  request: Request,
  env: CloudflareEnv
): Promise<AuthResult> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authenticated: false, status: 401, error: 'Authorization header required' };
  }

  // CRITICAL: Trim token to ensure it matches the token used for encryption
  const token = authHeader.substring(7).trim();
  const jwtSecret = getJWTSecret(env);
  const payload = await verifyJWT(token, jwtSecret);

  if (!payload) {
    return { authenticated: false, status: 401, error: 'Invalid or expired token' };
  }

  return {
    authenticated: true,
    customerId: (payload as any).customerId || (payload as any).sub,
    email: (payload as any).email,
  };
}

/**
 * Encrypt sensitive data (Twitch tokens)
 */
async function encryptToken(
  token: string,
  userToken: string,
  env: CloudflareEnv
): Promise<string> {
  const keyHash = await hashEmail(userToken);
  
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const keyData = encoder.encode(keyHash.substring(0, 32));
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt sensitive data (Twitch tokens)
 */
async function decryptToken(
  encryptedData: string,
  userToken: string,
  env: CloudflareEnv
): Promise<string> {
  try {
    const keyHash = await hashEmail(userToken);
    
    const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    
    const encoder = new TextEncoder();
    const keyData = encoder.encode(keyHash.substring(0, 32));
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );
    
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    throw new Error('Failed to decrypt token');
  }
}

/**
 * Validate Twitch access token with Twitch API
 */
async function validateTwitchToken(
  accessToken: string,
  clientId: string
): Promise<TwitchTokenInfo | null> {
  try {
    const validateResponse = await fetch('https://id.twitch.tv/oauth2/validate', {
      headers: {
        'Authorization': `OAuth ${accessToken}`,
      },
    });

    if (!validateResponse.ok) {
      return null;
    }

    const validateData = await validateResponse.json() as { scopes?: string[]; expires_in?: number };

    const userResponse = await fetch('https://api.twitch.tv/helix/users', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Client-Id': clientId,
      },
    });

    if (!userResponse.ok) {
      return null;
    }

    const userData = await userResponse.json() as {
      data?: Array<{
        id: string;
        login: string;
        display_name: string;
        email?: string;
      }>;
    };

    if (!userData.data || userData.data.length === 0) {
      return null;
    }

    return {
      twitchUserId: userData.data[0].id,
      twitchUsername: userData.data[0].login,
      displayName: userData.data[0].display_name,
      email: userData.data[0].email,
      scopes: validateData.scopes || [],
      expiresIn: validateData.expires_in,
    };
  } catch (error) {
    console.error('[Twitch] Token validation failed:', error);
    return null;
  }
}

/**
 * Attach Twitch account to customer
 * POST /customer/twitch/attach
 */
export async function handleAttachTwitchAccount(
  request: Request,
  env: CloudflareEnv
): Promise<Response> {
  try {
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status || 401,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json() as {
      accessToken?: string;
      twitchUserId?: string;
      twitchUsername?: string;
      state?: string;
    };
    const { accessToken, twitchUserId, twitchUsername, state } = body;

    if (!accessToken) {
      return new Response(JSON.stringify({ 
        error: 'accessToken is required',
        detail: 'Twitch OAuth access token is required'
      }), {
        status: 400,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    const twitchClientId = env.TWITCH_CLIENT_ID;
    if (!twitchClientId) {
      return new Response(JSON.stringify({ 
        error: 'Twitch Client ID not configured',
        detail: 'Server configuration error'
      }), {
        status: 500,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    const twitchInfo = await validateTwitchToken(accessToken, twitchClientId);
    if (!twitchInfo) {
      return new Response(JSON.stringify({ 
        error: 'Invalid Twitch access token',
        detail: 'The provided token is invalid or expired'
      }), {
        status: 400,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    const finalTwitchUserId = twitchUserId || twitchInfo.twitchUserId;
    const finalTwitchUsername = twitchUsername || twitchInfo.twitchUsername;

    // CRITICAL: Trim token to ensure it matches the token used for encryption
    const authToken = request.headers.get('Authorization')?.substring(7).trim() || '';
    const encryptedToken = await encryptToken(accessToken, authToken, env);

    const emailHash = await hashEmail(auth.email!);
    const userKey = getCustomerKey(auth.customerId || null, `user_${emailHash}`);
    const user = await env.OTP_AUTH_KV.get(userKey, { type: 'json' }) as CustomerSession | null;

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    const twitchAccount: TwitchAccount = {
      twitchUserId: finalTwitchUserId,
      twitchUsername: finalTwitchUsername,
      displayName: twitchInfo.displayName,
      email: twitchInfo.email,
      accessToken: encryptedToken,
      scopes: twitchInfo.scopes,
      expiresAt: twitchInfo.expiresIn 
        ? new Date(Date.now() + twitchInfo.expiresIn * 1000).toISOString()
        : null,
      attachedAt: new Date().toISOString(),
    };

    user.twitchAccount = twitchAccount;
    await env.OTP_AUTH_KV.put(userKey, JSON.stringify(user), { expirationTtl: 31536000 });
    
    // Update userId -> customerId index (customerId shouldn't change, but ensure it's up to date)
    const { updateUserIndex } = await import('../../utils/user-index.js');
    await updateUserIndex(user.userId, user.customerId || auth.customerId || null, env);

    const twitchKey = getCustomerKey(auth.customerId || null, `twitch_${finalTwitchUserId}`);
    await env.OTP_AUTH_KV.put(twitchKey, JSON.stringify({
      userId: auth.userId,
      email: auth.email,
      twitchAccount,
    }), { expirationTtl: 31536000 });

    return new Response(JSON.stringify({
      success: true,
      account: {
        twitchUserId: finalTwitchUserId,
        twitchUsername: finalTwitchUsername,
        displayName: twitchInfo.displayName,
        attachedAt: twitchAccount.attachedAt,
      },
      message: 'Twitch account attached successfully',
    }), {
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to attach Twitch account',
      message: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Get attached Twitch account
 * GET /customer/twitch
 */
export async function handleGetTwitchAccount(
  request: Request,
  env: CloudflareEnv
): Promise<Response> {
  try {
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status || 401,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    const emailHash = await hashEmail(auth.email!);
    const userKey = getCustomerKey(auth.customerId || null, `user_${emailHash}`);
    const user = await env.OTP_AUTH_KV.get(userKey, { type: 'json' }) as CustomerSession | null;

    if (!user || !user.twitchAccount) {
      return new Response(JSON.stringify({ error: 'Twitch account not attached' }), {
        status: 404,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      account: {
        twitchUserId: user.twitchAccount.twitchUserId,
        twitchUsername: user.twitchAccount.twitchUsername,
        displayName: user.twitchAccount.displayName,
        attachedAt: user.twitchAccount.attachedAt,
        scopes: user.twitchAccount.scopes,
      },
    }), {
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to get Twitch account',
      message: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Detach Twitch account from customer
 * DELETE /customer/twitch/detach
 */
export async function handleDetachTwitchAccount(
  request: Request,
  env: CloudflareEnv
): Promise<Response> {
  try {
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status || 401,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    const emailHash = await hashEmail(auth.email!);
    const userKey = getCustomerKey(auth.customerId || null, `user_${emailHash}`);
    const user = await env.OTP_AUTH_KV.get(userKey, { type: 'json' }) as CustomerSession | null;

    if (!user || !user.twitchAccount) {
      return new Response(JSON.stringify({ error: 'Twitch account not attached' }), {
        status: 404,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    const twitchUserId = user.twitchAccount.twitchUserId;
    delete user.twitchAccount;
    await env.OTP_AUTH_KV.put(userKey, JSON.stringify(user), { expirationTtl: 31536000 });
    
    // Update userId -> customerId index (customerId shouldn't change, but ensure it's up to date)
    const { updateUserIndex } = await import('../../utils/user-index.js');
    await updateUserIndex(user.userId, user.customerId || auth.customerId || null, env);

    const twitchKey = getCustomerKey(auth.customerId || null, `twitch_${twitchUserId}`);
    await env.OTP_AUTH_KV.delete(twitchKey);

    return new Response(JSON.stringify({
      success: true,
      message: 'Twitch account detached successfully',
    }), {
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to detach Twitch account',
      message: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  }
}

