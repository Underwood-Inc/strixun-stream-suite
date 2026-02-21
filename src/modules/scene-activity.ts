/**
 * Scene Activity Tracking Module
 *
 * Records scene switches and retrieves top active scenes from Streamkit API
 */

import { STREAMKIT_API_URL } from '../config/api';
import { tryRefreshSession } from '../stores/auth';

/**
 * Authenticated fetch wrapper. On 401, tries session refresh and retries once.
 */
async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const opts = {
    ...options,
    credentials: 'include' as RequestCredentials,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    },
  };
  let response = await fetch(url, opts);
  if (response.status === 401) {
    const refreshed = await tryRefreshSession();
    if (refreshed) {
      response = await fetch(url, opts);
    }
  }
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }
  return response;
}

/**
 * Record a scene switch for activity tracking
 */
export async function recordSceneSwitch(sceneName: string): Promise<void> {
  const url = `${STREAMKIT_API_URL}/scene-activity/record`;
  console.log(`[Scene Activity] Recording scene switch to: "${sceneName}" at ${url}`);
  
  try {
    const response = await authenticatedFetch(url, {
      method: 'POST',
      body: JSON.stringify({ sceneName }),
    });
    console.log(`[Scene Activity] ✓ Successfully recorded: ${sceneName}`);
  } catch (e) {
    console.warn(`[Scene Activity] ✗ Failed to record "${sceneName}":`, e);
    if (e instanceof Error) {
      console.warn(`[Scene Activity] Error details:`, e.message);
    }
  }
}

/**
 * Get top N most active scenes
 */
export async function getTopScenes(limit: number = 10): Promise<Array<{ sceneName: string; count: number; lastUsed: string }>> {
  const url = `${STREAMKIT_API_URL}/scene-activity/top?limit=${limit}`;
  console.log(`[Scene Activity] Fetching top scenes from: ${url}`);
  
  try {
    const response = await authenticatedFetch(url);
    const data = await response.json();
    const scenes = data.scenes || [];
    console.log(`[Scene Activity] ✓ Fetched ${scenes.length} active scenes:`, scenes);
    return scenes;
  } catch (e) {
    console.warn(`[Scene Activity] ✗ Failed to fetch top scenes:`, e);
    if (e instanceof Error) {
      console.warn(`[Scene Activity] Error details:`, e.message);
    }
    return [];
  }
}

/**
 * Sort scene list by activity (most active first), with OBS order as tiebreaker
 * 
 * Sorting logic:
 * 1. Scenes with more activity appear first
 * 2. Scenes with equal activity maintain their original OBS order (sceneIndex)
 * 3. This creates a stable sort that respects OBS ordering while promoting active scenes
 */
export function sortScenesByActivity(
  scenes: Array<{ sceneName: string; sceneIndex: number }>,
  activityData: Array<{ sceneName: string; count: number }>
): Array<{ sceneName: string; sceneIndex: number }> {
  return scenes.sort((a, b) => {
    const activityA = activityData.find(s => s.sceneName === a.sceneName)?.count || 0;
    const activityB = activityData.find(s => s.sceneName === b.sceneName)?.count || 0;
    
    // Primary sort: by activity count (descending - most active first)
    if (activityB !== activityA) {
      return activityB - activityA;
    }
    
    // Secondary sort (tiebreaker): by OBS scene index (ascending - original order)
    return a.sceneIndex - b.sceneIndex;
  });
}
