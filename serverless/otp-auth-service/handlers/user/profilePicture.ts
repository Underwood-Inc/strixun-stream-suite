/**
 * Profile Picture Handlers (Post-MVP)
 * 
 * Handles profile picture upload, retrieval, and deletion.
 * Stores images in Cloudflare R2 with WebP conversion.
 * 
 * @module handlers/user/profilePicture
 */

import { getCorsHeaders } from '../../utils/cors.js';
import { getCustomerKey } from '../../services/customer.js';
import { verifyJWT, getJWTSecret, hashEmail } from '../../utils/crypto.js';

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
  userId?: string;
  email?: string;
  customerId?: string | null;
}

interface User {
  userId: string;
  email: string;
  displayName?: string;
  customerId?: string;
  profilePicture?: {
    url: string;
    r2Key: string;
    uploadedAt: string;
    fileSize: number;
  };
  [key: string]: any;
}

/**
 * Authenticate request using JWT token
 */
async function authenticateRequest(
  request: Request,
  env: CloudflareEnv
): Promise<AuthResult> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authenticated: false, status: 401, error: 'Authorization header required' };
  }

  const token = authHeader.substring(7);
  const jwtSecret = getJWTSecret(env);
  const payload = await verifyJWT(token, jwtSecret);

  if (!payload) {
    return { authenticated: false, status: 401, error: 'Invalid or expired token' };
  }

  return {
    authenticated: true,
    userId: (payload as any).userId || (payload as any).sub,
    email: (payload as any).email,
    customerId: (payload as any).customerId || null,
  };
}

/**
 * Upload profile picture
 * POST /user/profile-picture
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

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (imageFile.size > maxSize) {
      return new Response(JSON.stringify({ 
        error: 'File too large',
        detail: 'Profile picture must be less than 5MB'
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
    const filename = `profile_${auth.userId}_${Date.now()}.${fileExtension}`;
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
    const userKey = getCustomerKey(auth.customerId || null, `user_${emailHash}`);
    const user = await env.OTP_AUTH_KV.get(userKey, { type: 'json' }) as User | null;

    if (user) {
      if (user.profilePicture?.r2Key) {
        try {
          await env.PROFILE_PICTURES_R2.delete(user.profilePicture.r2Key);
        } catch (error) {
          console.error('[ProfilePicture] Failed to delete old picture:', error);
        }
      }

      user.profilePicture = {
        url: publicUrl,
        r2Key,
        uploadedAt: new Date().toISOString(),
        fileSize: imageFile.size,
      };

      await env.OTP_AUTH_KV.put(userKey, JSON.stringify(user), { expirationTtl: 31536000 });
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
 * GET /user/profile-picture/:userId
 */
export async function handleGetProfilePicture(
  request: Request,
  env: CloudflareEnv
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const userId = url.pathname.split('/').pop();

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId required' }), {
        status: 400,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    const auth = await authenticateRequest(request, env);
    if (auth.authenticated && auth.userId === userId) {
      const emailHash = await hashEmail(auth.email!);
      const userKey = getCustomerKey(auth.customerId || null, `user_${emailHash}`);
      const user = await env.OTP_AUTH_KV.get(userKey, { type: 'json' }) as User | null;

      if (user && user.profilePicture) {
        return new Response(JSON.stringify({
          success: true,
          url: user.profilePicture.url,
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
 * DELETE /user/profile-picture
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
    const userKey = getCustomerKey(auth.customerId || null, `user_${emailHash}`);
    const user = await env.OTP_AUTH_KV.get(userKey, { type: 'json' }) as User | null;

    if (!user || !user.profilePicture) {
      return new Response(JSON.stringify({ error: 'Profile picture not found' }), {
        status: 404,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    if (user.profilePicture.r2Key && env.PROFILE_PICTURES_R2) {
      try {
        await env.PROFILE_PICTURES_R2.delete(user.profilePicture.r2Key);
      } catch (error) {
        console.error('[ProfilePicture] Failed to delete from R2:', error);
      }
    }

    delete user.profilePicture;
    await env.OTP_AUTH_KV.put(userKey, JSON.stringify(user), { expirationTtl: 31536000 });

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

