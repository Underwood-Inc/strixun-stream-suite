/**
 * Streamkit API Service - Dedicated Cloudflare Worker
 * 
 * Handles ALL Streamkit cloud storage:
 * - Text Cyclers, Swaps, Layouts, Notes (generic config API)
 * - Scene Activity Tracking (FIFO, 30-day TTL)
 * 
 * @version 1.0.0
 */

import type { ExecutionContext } from '@cloudflare/workers-types';
import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import type { Env } from './src/env.d.js';
import { createConfig, listConfigs, getConfig, updateConfig, deleteConfig } from './handlers/configs/index.js';
import { recordSceneSwitch } from './handlers/scene-activity/record.js';
import { getTopScenes } from './handlers/scene-activity/top.js';

/**
 * Health check endpoint
 */
async function handleHealth(request: Request, env: Env): Promise<Response> {
  const envName = env.ENVIRONMENT || 'production';
  const corsHeaders = createCORSHeaders(request, {
    allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || ['*'],
  });
  
  return new Response(JSON.stringify({
    status: 'healthy',
    service: 'streamkit-api',
    version: '1.0.0',
    environment: envName,
    timestamp: new Date().toISOString(),
    kv: {
      STREAMKIT_KV: !!env.STREAMKIT_KV,
    },
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...Object.fromEntries(corsHeaders.entries()),
    },
  });
}

/**
 * Main request handler
 */
async function handleRequest(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  
  // Health check
  if (path === '/health' || path === '/') {
    return handleHealth(request, env);
  }
  
  // Route handling
  const pathParts = path.split('/').filter(Boolean);
  
  // /configs/:type or /configs/:type/:id
  if (pathParts[0] === 'configs' && pathParts[1]) {
    const configType = pathParts[1];
    const configId = pathParts[2];
    
    if (configId) {
      // /configs/:type/:id
      if (request.method === 'GET') {
        return await getConfig(request, env);
      } else if (request.method === 'PUT') {
        return await updateConfig(request, env);
      } else if (request.method === 'DELETE') {
        return await deleteConfig(request, env);
      }
    } else {
      // /configs/:type
      if (request.method === 'GET') {
        return await listConfigs(request, env);
      } else if (request.method === 'POST') {
        return await createConfig(request, env);
      }
    }
  }
  
  // /scene-activity/record
  if (path === '/scene-activity/record' && request.method === 'POST') {
    return await recordSceneSwitch(request, env);
  }
  
  // /scene-activity/top
  if (path === '/scene-activity/top' && request.method === 'GET') {
    return await getTopScenes(request, env);
  }
  
  // 404
  const corsHeaders = createCORSHeaders(request, {
    allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || ['*'],
  });
  
  return new Response(JSON.stringify({
    type: 'https://tools.ietf.org/html/rfc7231#section-6.5.4',
    title: 'Not Found',
    status: 404,
    detail: 'The requested endpoint was not found',
    instance: request.url,
  }), {
    status: 404,
    headers: {
      'Content-Type': 'application/problem+json',
      ...Object.fromEntries(corsHeaders.entries()),
    },
  });
}

/**
 * Worker export
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      const corsHeaders = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || ['*'],
      });
      return new Response(null, {
        status: 204,
        headers: Object.fromEntries(corsHeaders.entries()),
      });
    }
    
    try {
      return await handleRequest(request, env, ctx);
    } catch (error) {
      console.error('[StreamkitAPI] Unhandled error:', error);
      
      const corsHeaders = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || ['*'],
      });
      
      return new Response(JSON.stringify({
        type: 'https://tools.ietf.org/html/rfc7231#section-6.6.1',
        title: 'Internal Server Error',
        status: 500,
        detail: error instanceof Error ? error.message : 'Unknown error',
        instance: request.url,
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/problem+json',
          ...Object.fromEntries(corsHeaders.entries()),
        },
      });
    }
  },
};
