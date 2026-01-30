/**
 * Generic Config Handlers for Streamkit API
 * 
 * ONE API for ALL config types: text-cyclers, swaps, layouts, notes, etc.
 * Pattern: /configs/{type} and /configs/{type}/:id
 */

import { createEnhancedHandler } from '@strixun/api-framework';
import type { Env } from '../../src/env.d.js';
import { extractCustomerFromJWT } from '../../utils/auth.js';
import { getEntity, putEntity, deleteEntity } from '@strixun/kv-entities';

interface ConfigData {
  id: string;
  customerId: string;
  configType: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
}

/**
 * Create a new config
 * POST /configs/:type
 */
export const createConfig = createEnhancedHandler<Env>(async (request, context) => {
  const env = context.env as Env;
  const customerId = await extractCustomerFromJWT(request, env);
  const url = new URL(request.url);
  const configType = url.pathname.split('/')[2];
  
  const body = await request.json();
  const { id, ...config } = body;
  
  if (!id) {
    return Response.json({ detail: 'Config ID is required' }, { status: 400 });
  }
  
  // Entity ID combines customer, type, and config ID for unique lookup
  const entityId = `${customerId}:${configType}:${id}`;
  const data: ConfigData = {
    ...config,
    id,
    customerId,
    configType,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  await putEntity(env.STREAMKIT_KV, 'streamkit', 'config', entityId, data);
  
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
  
  // Use entity key prefix pattern from kv-entities
  const prefix = `streamkit:config:${customerId}:${configType}:`;
  const list = await env.STREAMKIT_KV.list({ prefix });
  
  const configs = await Promise.all(
    list.keys.map(async (key) => {
      const value = await env.STREAMKIT_KV.get(key.name, { type: 'json' }) as ConfigData | null;
      return value;
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
  
  const entityId = `${customerId}:${configType}:${configId}`;
  const config = await getEntity<ConfigData>(env.STREAMKIT_KV, 'streamkit', 'config', entityId);
  
  if (!config) {
    return Response.json({ detail: 'Config not found' }, { status: 404 });
  }
  
  return Response.json({ config, type: configType });
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
  
  const entityId = `${customerId}:${configType}:${configId}`;
  const existing = await getEntity<ConfigData>(env.STREAMKIT_KV, 'streamkit', 'config', entityId);
  
  if (!existing) {
    return Response.json({ detail: 'Config not found' }, { status: 404 });
  }
  
  const body = await request.json();
  const updated: ConfigData = {
    ...existing,
    ...body,
    id: configId,
    customerId,
    configType,
    updatedAt: new Date().toISOString(),
  };
  
  await putEntity(env.STREAMKIT_KV, 'streamkit', 'config', entityId, updated);
  
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
  
  const entityId = `${customerId}:${configType}:${configId}`;
  await deleteEntity(env.STREAMKIT_KV, 'streamkit', 'config', entityId);
  
  return Response.json({ 
    message: 'Config deleted',
    configId,
    type: configType 
  });
});
