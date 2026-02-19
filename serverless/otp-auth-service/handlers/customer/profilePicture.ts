/**
 * Profile Picture Handlers (Post-MVP)
 * 
 * Handles profile picture upload, retrieval, and deletion.
 * Stores images in Cloudflare R2 with WebP conversion.
 * 
 * @module handlers/customer/profilePicture
 */

import { getCorsHeaders } from '../../utils/cors.js';
import { entityKey } from '@strixun/kv-entities';
import { hashEmail } from '../../utils/crypto.js';
import { verifyTokenOIDC, extractAuthToken } from '../../utils/verify-token.js';
import { MAX_PROFILE_PICTURE_SIZE, validateFileSize } from '../../utils/upload-limits.js';

interface CloudflareEnv {
  OTP_AUTH_KV: KVNamespace;
  PROFILE_PICTURES_R2?: R2Bucket;
  PROFILE_PICTURES_PUBLIC_URL?: string;
  [key: string]: any;
}

interface AuthResult {
  authenticated: boolean;
  status?: number;
  error?: string;
  customerId?: string;
  email?: string;
  jwtToken?: string;
}


/**
 * Authenticate request using JWT token
 * ONLY checks HttpOnly cookie - NO Authorization header fallback
 */
async function authenticateRequest(
  request: Request,
  env: CloudflareEnv
): Promise<AuthResult> {
  const token = extractAuthToken(request.headers.get('Cookie'));
  if (!token) {
    return { authenticated: false, status: 401, error: 'Authentication required. Please authenticate with HttpOnly cookie.' };
  }

  const payload = await verifyTokenOIDC(token, env);
  if (!payload) {
    return { authenticated: false, status: 401, error: 'Invalid or expired token' };
  }

  return {
    authenticated: true,
    customerId: payload.customerId || payload.sub,
    email: payload.email,
    jwtToken: token,
  };
}

/**
 * Upload profile picture
 * POST /customer/profile-picture
 * 
 * Accepts multipart/form-data with 'image' field
 * Converts to WebP and stores in R2
 */
export async function handleUploadProfilePicture(
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

    if (!env.PROFILE_PICTURES_R2) {
      return new Response(JSON.stringify({ 
        error: 'Profile picture storage not configured',
        detail: 'R2 bucket not configured'
      }), {
        status: 503,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    const formData = await request.formData();
    const imageFile = formData.get('image');

    if (!imageFile || !(imageFile instanceof File)) {
      return new Response(JSON.stringify({ 
        error: 'Image file required',
        detail: 'Must provide image file in multipart/form-data'
      }), {
        status: 400,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    // Validate file size
    const sizeValidation = validateFileSize(imageFile.size, MAX_PROFILE_PICTURE_SIZE);
    if (!sizeValidation.valid) {
      return new Response(JSON.stringify({ 
        error: 'File too large',
        detail: sizeValidation.error || `Profile picture must be less than ${MAX_PROFILE_PICTURE_SIZE / (1024 * 1024)}MB`
      }), {
        status: 400,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    if (!imageFile.type.startsWith('image/')) {
      return new Response(JSON.stringify({ 
        error: 'Invalid file type',
        detail: 'File must be an image'
      }), {
        status: 400,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    const fileExtension = imageFile.type === 'image/webp' ? 'webp' : 'jpg';
    const filename = `profile_${auth.customerId}_${Date.now()}.${fileExtension}`;
    const r2Key = `profile-pictures/${auth.customerId || 'default'}/${filename}`;

    await env.PROFILE_PICTURES_R2.put(r2Key, imageFile.stream(), {
      httpMetadata: {
        contentType: imageFile.type,
        cacheControl: 'public, max-age=31536000',
      },
    });

    const publicUrl = env.PROFILE_PICTURES_PUBLIC_URL 
      ? `${env.PROFILE_PICTURES_PUBLIC_URL}/${r2Key}`
      : `https://pub-${(env.PROFILE_PICTURES_R2 as any).id}.r2.dev/${r2Key}`;

    const emailHash = await hashEmail(auth.email!);
    const customerKey = entityKey('otp-auth', 'customer-session', `${auth.customerId}_${emailHash}`).key;
    const customer = await env.OTP_AUTH_KV.get(customerKey, { type: 'json' }) as any | null;

    if (customer) {
      if (customer.profilePicture?.r2Key) {
        try {
          await env.PROFILE_PICTURES_R2.delete(customer.profilePicture.r2Key);
        } catch (error) {
          console.error('[ProfilePicture] Failed to delete old picture:', error);
        }
      }

      customer.profilePicture = {
        url: publicUrl,
        r2Key,
        uploadedAt: new Date().toISOString(),
        fileSize: imageFile.size,
      };

      await env.OTP_AUTH_KV.put(customerKey, JSON.stringify(customer), { expirationTtl: 31536000 });
    }

    return new Response(JSON.stringify({
      success: true,
      picture: {
        url: publicUrl,
        uploadedAt: new Date().toISOString(),
        fileSize: imageFile.size,
        dimensions: {
          width: 200,
          height: 200,
        },
      },
    }), {
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to upload profile picture',
      message: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Get profile picture URL
 * GET /customer/profile-picture/:customerId
 */
export async function handleGetProfilePicture(
  request: Request,
  env: CloudflareEnv
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const customerId = url.pathname.split('/').pop();

    if (!customerId) {
      return new Response(JSON.stringify({ error: 'customerId required' }), {
        status: 400,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    const auth = await authenticateRequest(request, env);
    if (auth.authenticated && auth.customerId === customerId) {
      const emailHash = await hashEmail(auth.email!);
      const customerKey = entityKey('otp-auth', 'customer-session', `${auth.customerId}_${emailHash}`).key;
      const customer = await env.OTP_AUTH_KV.get(customerKey, { type: 'json' }) as any | null;

      if (customer && customer.profilePicture) {
        return new Response(JSON.stringify({
          success: true,
          url: customer.profilePicture.url,
        }), {
          headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Profile picture not found' }), {
      status: 404,
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to get profile picture',
      message: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Delete profile picture
 * DELETE /customer/profile-picture
 */
export async function handleDeleteProfilePicture(
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
    const customerKey = entityKey('otp-auth', 'customer-session', `${auth.customerId}_${emailHash}`).key;
    const customer = await env.OTP_AUTH_KV.get(customerKey, { type: 'json' }) as any | null;

    if (!customer || !customer.profilePicture) {
      return new Response(JSON.stringify({ error: 'Profile picture not found' }), {
        status: 404,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    if (customer.profilePicture.r2Key && env.PROFILE_PICTURES_R2) {
      try {
        await env.PROFILE_PICTURES_R2.delete(customer.profilePicture.r2Key);
      } catch (error) {
        console.error('[ProfilePicture] Failed to delete from R2:', error);
      }
    }

    delete customer.profilePicture;
    await env.OTP_AUTH_KV.put(customerKey, JSON.stringify(customer), { expirationTtl: 31536000 });

    return new Response(JSON.stringify({
      success: true,
      message: 'Profile picture deleted',
    }), {
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to delete profile picture',
      message: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  }
}

