/**
 * Generic Config Handlers for Streamkit API
 * 
 * ONE API for ALL config types: text-cyclers, swaps, layouts, notes, etc.
 * Pattern: /configs/{type} and /configs/{type}/:id
 * 
 * These are plain async handlers (NOT wrapped by createEnhancedHandler).
 * createEnhancedHandler expects handlers to return plain data objects, but these
 * handlers need to return full Response objects with proper status codes (201, 400, 404).
 * CORS headers are applied by withCORSHeaders in worker.ts.
 */

import type { ExecutionContext } from '@cloudflare/workers-types';
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

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function authErrorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : 'Authentication failed';
  return jsonResponse({
    type: 'https://tools.ietf.org/html/rfc7235#section-3.1',
    title: 'Unauthorized',
    status: 401,
    detail: message,
  }, 401);
}

/**
 * Create a new config
 * POST /configs/:type
 */
export async function createConfig(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
  let customerId: string;
  try {
    customerId = await extractCustomerFromJWT(request, env);
  } catch (err) {
    return authErrorResponse(err);
  }

  const url = new URL(request.url);
  const configType = url.pathname.split('/')[2];
  
  const body = await request.json() as Record<string, any>;
  const { id, ...config } = body;
  
  if (!id) {
    return jsonResponse({ detail: 'Config ID is required' }, 400);
  }
  
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
  
  return jsonResponse({ message: 'Config created', configId: id, type: configType }, 201);
}

/**
 * List all configs of a type
 * GET /configs/:type
 */
export async function listConfigs(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
  let customerId: string;
  try {
    customerId = await extractCustomerFromJWT(request, env);
  } catch (err) {
    return authErrorResponse(err);
  }

  const url = new URL(request.url);
  const configType = url.pathname.split('/')[2];
  
  const prefix = `streamkit:config:${customerId}:${configType}:`;
  const list = await env.STREAMKIT_KV.list({ prefix });
  
  const configs = await Promise.all(
    list.keys.map(async (key) => {
      const value = await env.STREAMKIT_KV.get(key.name, { type: 'json' }) as ConfigData | null;
      return value;
    })
  );
  
  const filtered = configs.filter(Boolean);
  return jsonResponse({ configs: filtered, type: configType, count: filtered.length });
}

/**
 * Get a specific config
 * GET /configs/:type/:id
 */
export async function getConfig(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
  let customerId: string;
  try {
    customerId = await extractCustomerFromJWT(request, env);
  } catch (err) {
    return authErrorResponse(err);
  }

  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const configType = pathParts[2];
  const configId = decodeURIComponent(pathParts[3]);
  
  if (!configId) {
    return jsonResponse({ detail: 'Config ID is required' }, 400);
  }
  
  const entityId = `${customerId}:${configType}:${configId}`;
  const config = await getEntity<ConfigData>(env.STREAMKIT_KV, 'streamkit', 'config', entityId);
  
  if (!config) {
    return jsonResponse({ detail: 'Config not found' }, 404);
  }
  
  return jsonResponse({ config, type: configType });
}

/**
 * Update a config
 * PUT /configs/:type/:id
 */
export async function updateConfig(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
  let customerId: string;
  try {
    customerId = await extractCustomerFromJWT(request, env);
  } catch (err) {
    return authErrorResponse(err);
  }

  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const configType = pathParts[2];
  const configId = decodeURIComponent(pathParts[3]);
  
  if (!configId) {
    return jsonResponse({ detail: 'Config ID is required' }, 400);
  }
  
  const entityId = `${customerId}:${configType}:${configId}`;
  const existing = await getEntity<ConfigData>(env.STREAMKIT_KV, 'streamkit', 'config', entityId);
  
  if (!existing) {
    return jsonResponse({ detail: 'Config not found' }, 404);
  }
  
  const body = await request.json() as Record<string, any>;
  const updated: ConfigData = {
    ...existing,
    ...body,
    id: configId,
    customerId,
    configType,
    updatedAt: new Date().toISOString(),
  };
  
  await putEntity(env.STREAMKIT_KV, 'streamkit', 'config', entityId, updated);
  
  return jsonResponse({ message: 'Config updated', configId, type: configType });
}

/**
 * Delete a config
 * DELETE /configs/:type/:id
 */
export async function deleteConfig(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
  let customerId: string;
  try {
    customerId = await extractCustomerFromJWT(request, env);
  } catch (err) {
    return authErrorResponse(err);
  }

  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const configType = pathParts[2];
  const configId = decodeURIComponent(pathParts[3]);
  
  if (!configId) {
    return jsonResponse({ detail: 'Config ID is required' }, 400);
  }
  
  const entityId = `${customerId}:${configType}:${configId}`;
  await deleteEntity(env.STREAMKIT_KV, 'streamkit', 'config', entityId);
  
  return jsonResponse({ message: 'Config deleted', configId, type: configType });
}
