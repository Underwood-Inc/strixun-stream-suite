/**
 * DOM Interference Detection Store
 * 
 * Tracks when client-side DOM manipulation is detected interfering
 * with application components (e.g., AdCarousel being hidden)
 */

import { writable } from 'svelte/store';

/**
 * Store indicating whether DOM interference has been detected
 */
export const domInterferenceDetected = writable<boolean>(false);

/**
 * Set interference detection state
 */
export function setDomInterferenceDetected(detected: boolean): void {
  domInterferenceDetected.set(detected);
}

