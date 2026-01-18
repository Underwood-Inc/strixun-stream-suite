/**
 * Scene Activity Tracking Module
 * 
 * Records scene switches and retrieves top active scenes from Streamkit API
 */

import { STREAMKIT_API_URL } from '../config/api';

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
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }
  
  return response;
}

/**
 * Record a scene switch for activity tracking
 */
export async function recordSceneSwitch(sceneName: string): Promise<void> {
  try {
    await authenticatedFetch(`${STREAMKIT_API_URL}/scene-activity/record`, {
      method: 'POST',
      body: JSON.stringify({ sceneName }),
    });
    console.log(`[Scene Activity] Recorded: ${sceneName}`);
  } catch (e) {
    console.warn(`[Scene Activity] Failed to record:`, e);
  }
}

/**
 * Get top N most active scenes
 */
export async function getTopScenes(limit: number = 10): Promise<Array<{ sceneName: string; count: number; lastUsed: string }>> {
  try {
    const response = await authenticatedFetch(`${STREAMKIT_API_URL}/scene-activity/top?limit=${limit}`);
    const data = await response.json();
    return data.scenes || [];
  } catch (e) {
    console.warn(`[Scene Activity] Failed to fetch top scenes:`, e);
    return [];
  }
}

/**
 * Sort scene list by activity (most active first)
 */
export function sortScenesByActivity(
  scenes: Array<{ sceneName: string; sceneIndex: number }>,
  activityData: Array<{ sceneName: string; count: number }>
): Array<{ sceneName: string; sceneIndex: number }> {
  return scenes.sort((a, b) => {
    const activityA = activityData.find(s => s.sceneName === a.sceneName)?.count || 0;
    const activityB = activityData.find(s => s.sceneName === b.sceneName)?.count || 0;
    return activityB - activityA; // Most active first
  });
}
