/**
 * Scene Activity Recording Handler
 * 
 * Records scene switches for activity tracking with 30-day TTL (FIFO)
 * POST /scene-activity/record
 */

import { createEnhancedHandler } from '@strixun/api-framework';
import type { Env } from '../../src/env.d.js';
import { extractCustomerFromJWT } from '../../utils/auth.js';

export const recordSceneSwitch = createEnhancedHandler<Env>(async (request, context) => {
  const env = context.env as Env;
  const customerId = await extractCustomerFromJWT(request, env);
  const { sceneName } = await request.json();
  
  if (!sceneName) {
    return Response.json({ detail: 'Scene name is required' }, { status: 400 });
  }
  
  const kvKey = `cust_${customerId}_scene_activity_${sceneName}`;
  const existing = await env.STREAMKIT_KV.get(kvKey);
  
  const data = existing ? JSON.parse(existing) : { count: 0, lastUsed: null };
  data.count++;
  data.lastUsed = new Date().toISOString();
  
  // Store with 30-day TTL (FIFO rolling overwrite)
  await env.STREAMKIT_KV.put(kvKey, JSON.stringify(data), {
    expirationTtl: 60 * 60 * 24 * 30, // 30 days in seconds
  });
  
  return Response.json({ 
    message: 'Scene activity recorded',
    sceneName,
    count: data.count 
  });
});
