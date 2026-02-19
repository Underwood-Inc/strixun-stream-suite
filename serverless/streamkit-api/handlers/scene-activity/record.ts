/**
 * Scene Activity Recording Handler
 * 
 * Records scene switches for activity tracking with 30-day TTL (FIFO)
 * POST /scene-activity/record
 */

import type { ExecutionContext } from '@cloudflare/workers-types';
import type { Env } from '../../src/env.d.js';
import { extractCustomerFromJWT } from '../../utils/auth.js';
import { getEntity, putEntity } from '@strixun/kv-entities';

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

export async function recordSceneSwitch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
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

  const { sceneName } = await request.json() as { sceneName?: string };
  
  if (!sceneName) {
    return jsonResponse({ detail: 'Scene name is required' }, 400);
  }
  
  const entityId = `${customerId}:${sceneName}`;
  const existing = await getEntity<SceneActivity>(env.STREAMKIT_KV, 'streamkit', 'scene-activity', entityId);
  
  const data: SceneActivity = {
    sceneName,
    customerId,
    count: (existing?.count || 0) + 1,
    lastUsed: new Date().toISOString(),
  };
  
  await putEntity(env.STREAMKIT_KV, 'streamkit', 'scene-activity', entityId, data, {
    expirationTtl: 60 * 60 * 24 * 30,
  });
  
  return jsonResponse({ message: 'Scene activity recorded', sceneName, count: data.count });
}
