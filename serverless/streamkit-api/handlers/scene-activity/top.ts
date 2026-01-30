/**
 * Top Scenes Handler
 * 
 * Retrieves top N most active scenes sorted by count and lastUsed
 * GET /scene-activity/top?limit=10
 */

import { createEnhancedHandler } from '@strixun/api-framework';
import type { Env } from '../../src/env.d.js';
import { extractCustomerFromJWT } from '../../utils/auth.js';

interface SceneActivity {
  sceneName: string;
  customerId: string;
  count: number;
  lastUsed: string;
}

export const getTopScenes = createEnhancedHandler<Env>(async (request, context) => {
  const env = context.env as Env;
  const customerId = await extractCustomerFromJWT(request, env);
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '10');
  
  // Use entity key prefix pattern from kv-entities
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
  
  // Sort by count DESC, then by lastUsed DESC
  validScenes.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime();
  });
  
  return Response.json({ 
    scenes: validScenes.slice(0, limit),
    total: validScenes.length 
  });
});
