/**
 * Scene Activity Recording Handler
 * 
 * Records scene switches for activity tracking with 30-day TTL (FIFO)
 * POST /scene-activity/record
 */

import { createEnhancedHandler } from '@strixun/api-framework';
import type { Env } from '../../src/env.d.js';
import { extractCustomerFromJWT } from '../../utils/auth.js';
import { getEntity, putEntity } from '@strixun/kv-entities';

interface SceneActivity {
  sceneName: string;
  customerId: string;
  count: number;
  lastUsed: string;
}

export const recordSceneSwitch = createEnhancedHandler<Env>(async (request, context) => {
  const env = context.env as Env;
  const customerId = await extractCustomerFromJWT(request, env);
  const { sceneName } = await request.json();
  
  if (!sceneName) {
    return Response.json({ detail: 'Scene name is required' }, { status: 400 });
  }
  
  // Entity ID combines customer and scene for unique lookup
  const entityId = `${customerId}:${sceneName}`;
  const existing = await getEntity<SceneActivity>(env.STREAMKIT_KV, 'streamkit', 'scene-activity', entityId);
  
  const data: SceneActivity = {
    sceneName,
    customerId,
    count: (existing?.count || 0) + 1,
    lastUsed: new Date().toISOString(),
  };
  
  // Store with 30-day TTL (FIFO rolling overwrite)
  await putEntity(env.STREAMKIT_KV, 'streamkit', 'scene-activity', entityId, data, {
    expirationTtl: 60 * 60 * 24 * 30,
  });
  
  return Response.json({ 
    message: 'Scene activity recorded',
    sceneName,
    count: data.count 
  });
});
