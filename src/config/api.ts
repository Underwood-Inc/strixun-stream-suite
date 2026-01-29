/**
 * API Configuration for Streamkit
 * 
 * Defines base URLs for backend API services
 */

/**
 * Streamkit API URL
 * - Production: https://streamkit-api.idling.app
 * - Development: Goes through Vite proxy at /streamkit-api for cookie forwarding
 */
export const STREAMKIT_API_URL = import.meta.env.PROD 
  ? 'https://streamkit-api.idling.app' 
  : '/streamkit-api';
