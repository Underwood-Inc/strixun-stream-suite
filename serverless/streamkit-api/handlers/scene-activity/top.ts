/**
 * Top Scenes Handler
 * 
 * Retrieves top N most active scenes sorted by count and lastUsed
 * GET /scene-activity/top?limit=10
 */

import { createEnhancedHandler } from '@strixun/api-framework';
import type { Env } from '../../src/env.d.js';
import { extractCustomerFromJWT } from '../../utils/auth.js';

export const getTopScenes = createEnhancedHandler<Env>(async (request, env) => {
  const customerId = await extractCustomerFromJWT(request, env);
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '10');
  
  const prefix = `cust_${customerId}_scene_activity_`;
  const list = await env.STREAMKIT_KV.list({ prefix });
  
  const scenes = await Promise.all(
    list.keys.map(async (key) => {
      const value = await env.STREAMKIT_KV.get(key.name);
      const sceneName = key.name.replace(prefix, '');
      const data = value ? JSON.parse(value) : { count: 0, lastUsed: null };
      return { sceneName, ...data };
    })
  );
  
  // Sort by count DESC, then by lastUsed DESC
  scenes.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime();
  });
  
  return Response.json({ 
    scenes: scenes.slice(0, limit),
    total: scenes.length 
  });
});
