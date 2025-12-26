/**
 * JWT Token-Based Decryption for Dashboard Data
 * 
 * Decrypts encrypted dashboard responses using JWT token
 * Uses shared encryption suite from serverless/shared/encryption
 * 
 * This file re-exports the shared decryption function for use in the dashboard
 */

// Re-export from shared encryption suite
export { decryptWithJWT } from '@strixun/api-framework';
export type { EncryptedData } from '@strixun/api-framework';
