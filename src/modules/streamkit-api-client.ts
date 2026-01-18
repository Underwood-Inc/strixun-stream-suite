/**
 * Streamkit API Client
 * 
 * Client library for interacting with the Streamkit API for cloud storage
 * Handles text cyclers, swaps, layouts, notes, and scene activity
 */

import { STREAMKIT_API_URL } from '../config/api';
import type { TextCyclerConfig, SwapConfig, LayoutPreset } from '../types';

/**
 * Generic config type (text-cyclers, swaps, layouts, notes)
 */
type ConfigType = 'text-cyclers' | 'swaps' | 'layouts' | 'notes';

/**
 * Authenticated fetch wrapper
 * Uses auth_token HttpOnly cookie for authentication
 */
async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const response = await fetch(url, {
    ...options,
    credentials: 'include', // Include HttpOnly cookies
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
  }
  
  return response;
}

/**
 * Create a new config
 */
export async function createConfig(type: ConfigType, data: any): Promise<any> {
  const response = await authenticatedFetch(`${STREAMKIT_API_URL}/configs/${type}`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return await response.json();
}

/**
 * List all configs of a type
 */
export async function listConfigs(type: ConfigType): Promise<any[]> {
  const response = await authenticatedFetch(`${STREAMKIT_API_URL}/configs/${type}`);
  const data = await response.json();
  return data.configs || [];
}

/**
 * Get a specific config
 */
export async function getConfig(type: ConfigType, id: string): Promise<any> {
  const response = await authenticatedFetch(`${STREAMKIT_API_URL}/configs/${type}/${id}`);
  return await response.json();
}

/**
 * Update a config
 */
export async function updateConfig(type: ConfigType, id: string, data: any): Promise<any> {
  const response = await authenticatedFetch(`${STREAMKIT_API_URL}/configs/${type}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return await response.json();
}

/**
 * Delete a config
 */
export async function deleteConfig(type: ConfigType, id: string): Promise<void> {
  await authenticatedFetch(`${STREAMKIT_API_URL}/configs/${type}/${id}`, {
    method: 'DELETE',
  });
}

/**
 * Type-safe wrappers for specific config types
 */

// Text Cyclers
export const textCyclers = {
  create: (config: TextCyclerConfig) => createConfig('text-cyclers', config),
  list: () => listConfigs('text-cyclers') as Promise<TextCyclerConfig[]>,
  get: (id: string) => getConfig('text-cyclers', id) as Promise<TextCyclerConfig>,
  update: (id: string, config: TextCyclerConfig) => updateConfig('text-cyclers', id, config),
  delete: (id: string) => deleteConfig('text-cyclers', id),
};

// Swaps
export const swaps = {
  create: (config: SwapConfig) => createConfig('swaps', config),
  list: () => listConfigs('swaps') as Promise<SwapConfig[]>,
  get: (id: string) => getConfig('swaps', id) as Promise<SwapConfig>,
  update: (id: string, config: SwapConfig) => updateConfig('swaps', id, config),
  delete: (id: string) => deleteConfig('swaps', id),
};

// Layouts
export const layouts = {
  create: (preset: LayoutPreset) => createConfig('layouts', preset),
  list: () => listConfigs('layouts') as Promise<LayoutPreset[]>,
  get: (id: string) => getConfig('layouts', id) as Promise<LayoutPreset>,
  update: (id: string, preset: LayoutPreset) => updateConfig('layouts', id, preset),
  delete: (id: string) => deleteConfig('layouts', id),
};

// Notes
export const notes = {
  create: (note: { title: string; content: string }) => createConfig('notes', note),
  list: () => listConfigs('notes') as Promise<Array<{ id: string; title: string; content: string; createdAt: string; updatedAt: string }>>,
  get: (id: string) => getConfig('notes', id) as Promise<{ id: string; title: string; content: string; createdAt: string; updatedAt: string }>,
  update: (id: string, note: { title: string; content: string }) => updateConfig('notes', id, note),
  delete: (id: string) => deleteConfig('notes', id),
};
