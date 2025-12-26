/**
 * JWT Token-Based Decryption for Dashboard Data
 * 
 * Decrypts encrypted dashboard responses using JWT token
 * Uses shared encryption suite from serverless/shared/encryption
 * 
 * This file re-exports the shared decryption function for use in the dashboard
 */

// Re-export from shared encryption suite
// Note: Dashboard runs in browser, so we need to import from the shared location
// The shared encryption suite works in both Workers and browser environments
export { decryptWithJWT } from '@strixun/api-framework';
export type { EncryptedData } from '@strixun/api-framework';
