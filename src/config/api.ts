/**
 * API Configuration for Streamkit
 * 
 * Defines base URLs for backend API services
 */

/**
 * Streamkit API URL
 * - Production: https://streamkit-api.idling.app
 * - Development: http://localhost:8796
 */
export const STREAMKIT_API_URL = import.meta.env.PROD 
  ? 'https://streamkit-api.idling.app' 
  : 'http://localhost:8796';
