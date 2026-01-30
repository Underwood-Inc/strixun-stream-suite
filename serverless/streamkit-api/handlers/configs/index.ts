/**
 * Generic Config Handlers for Streamkit API
 * 
 * ONE API for ALL config types: text-cyclers, swaps, layouts, notes, etc.
 * Pattern: /configs/{type} and /configs/{type}/:id
 */

import { createEnhancedHandler } from '@strixun/api-framework';
import type { Env } from '../../src/env.d.js';
import { extractCustomerFromJWT } from '../../utils/auth.js';
import { buildKVKey } from '../../utils/kv-keys.js';

/**
 * Create a new config
 * POST /configs/:type
 */
export const createConfig = createEnhancedHandler<Env>(async (request, context) => {
  const env = context.env as Env;
  const customerId = await extractCustomerFromJWT(request, env);
  const url = new URL(request.url);
  const configType = url.pathname.split('/')[2]; // e.g. "text-cyclers"
  
  const body = await request.json();
  const { id, ...config } = body;
  
  if (!id) {
    return Response.json({ detail: 'Config ID is required' }, { status: 400 });
  }
  
  const kvKey = buildKVKey(customerId, configType, id);
  const value = JSON.stringify({
    ...config,
    id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  
  await env.STREAMKIT_KV.put(kvKey, value);
  
  return Response.json({ 
    message: 'Config created',
    configId: id,
    type: configType 
  }, { status: 201 });
});

/**
 * List all configs of a type
 * GET /configs/:type
 */
export const listConfigs = createEnhancedHandler<Env>(async (request, context) => {
  const env = context.env as Env;
  const customerId = await extractCustomerFromJWT(request, env);
  const url = new URL(request.url);
  const configType = url.pathname.split('/')[2];
  
  const prefix = `cust_${customerId}_streamkit_${configType}_`;
  const list = await env.STREAMKIT_KV.list({ prefix });
  
  const configs = await Promise.all(
    list.keys.map(async (key) => {
      const value = await env.STREAMKIT_KV.get(key.name);
      return value ? JSON.parse(value) : null;
    })
  );
  
  return Response.json({ 
    configs: configs.filter(Boolean),
    type: configType,
    count: configs.length 
  });
});

/**
 * Get a specific config
 * GET /configs/:type/:id
 */
export const getConfig = createEnhancedHandler<Env>(async (request, context) => {
  const env = context.env as Env;
  const customerId = await extractCustomerFromJWT(request, env);
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const configType = pathParts[2];
  const configId = decodeURIComponent(pathParts[3]);
  
  if (!configId) {
    return Response.json({ detail: 'Config ID is required' }, { status: 400 });
  }
  
  const kvKey = buildKVKey(customerId, configType, configId);
  const value = await env.STREAMKIT_KV.get(kvKey);
  
  if (!value) {
    return Response.json({ detail: 'Config not found' }, { status: 404 });
  }
  
  return Response.json({ config: JSON.parse(value), type: configType });
});

/**
 * Update a config
 * PUT /configs/:type/:id
 */
export const updateConfig = createEnhancedHandler<Env>(async (request, context) => {
  const env = context.env as Env;
  const customerId = await extractCustomerFromJWT(request, env);
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const configType = pathParts[2];
  const configId = decodeURIComponent(pathParts[3]);
  
  if (!configId) {
    return Response.json({ detail: 'Config ID is required' }, { status: 400 });
  }
  
  const kvKey = buildKVKey(customerId, configType, configId);
  const existing = await env.STREAMKIT_KV.get(kvKey);
  
  if (!existing) {
    return Response.json({ detail: 'Config not found' }, { status: 404 });
  }
  
  const body = await request.json();
  const updated = {
    ...JSON.parse(existing),
    ...body,
    id: configId,
    updatedAt: new Date().toISOString(),
  };
  
  await env.STREAMKIT_KV.put(kvKey, JSON.stringify(updated));
  
  return Response.json({ 
    message: 'Config updated',
    configId,
    type: configType 
  });
});

/**
 * Delete a config
 * DELETE /configs/:type/:id
 */
export const deleteConfig = createEnhancedHandler<Env>(async (request, context) => {
  const env = context.env as Env;
  const customerId = await extractCustomerFromJWT(request, env);
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const configType = pathParts[2];
  const configId = decodeURIComponent(pathParts[3]);
  
  if (!configId) {
    return Response.json({ detail: 'Config ID is required' }, { status: 400 });
  }
  
  const kvKey = buildKVKey(customerId, configType, configId);
  await env.STREAMKIT_KV.delete(kvKey);
  
  return Response.json({ 
    message: 'Config deleted',
    configId,
    type: configType 
  });
});
