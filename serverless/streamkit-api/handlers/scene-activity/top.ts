/**
 * Top Scenes Handler
 * 
 * Retrieves top N most active scenes sorted by count and lastUsed
 * GET /scene-activity/top?limit=10
 */

import type { ExecutionContext } from '@cloudflare/workers-types';
import type { Env } from '../../src/env.d.js';
import { extractCustomerFromJWT } from '../../utils/auth.js';

interface SceneActivity {
  sceneName: string;
  customerId: string;
  count: number;
  lastUsed: string;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function getTopScenes(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
  let customerId: string;
  try {
    customerId = await extractCustomerFromJWT(request, env);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Authentication failed';
    return jsonResponse({
      type: 'https://tools.ietf.org/html/rfc7235#section-3.1',
      title: 'Unauthorized',
      status: 401,
      detail: message,
    }, 401);
  }

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '10');
  
  const prefix = `streamkit:scene-activity:${customerId}:`;
  const list = await env.STREAMKIT_KV.list({ prefix });
  
  const scenes = await Promise.all(
    list.keys.map(async (key) => {
      const value = await env.STREAMKIT_KV.get(key.name, { type: 'json' }) as SceneActivity | null;
      if (!value) return null;
      return value;
    })
  );
  
  const validScenes = scenes.filter((s): s is SceneActivity => s !== null);
  
  validScenes.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime();
  });
  
  return jsonResponse({ scenes: validScenes.slice(0, limit), total: validScenes.length });
}
