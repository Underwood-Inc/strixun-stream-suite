/**
 * Encryption Validation Utilities
 * 
 * Simple validation to ensure request body is encrypted and not plain JSON
 */

/**
 * Validate that encrypted body is actually encrypted (not plain JSON)
 * 
 * @param encryptedBody - Encrypted body string
 * @throws Error if body is not properly encrypted
 */
export function validateEncryptedBody(encryptedBody: string): void {
  if (!encryptedBody || typeof encryptedBody !== 'string') {
    throw new Error('Encrypted body must be a non-empty string');
  }

  // Try to parse as JSON
  let parsed: any;
  try {
    parsed = JSON.parse(encryptedBody);
  } catch {
    throw new Error('Encrypted body must be valid JSON');
  }

  // Check if it's plain JSON (not encrypted)
  // Plain JSON would have email/otp fields directly
  if (parsed.email !== undefined || parsed.otp !== undefined) {
    throw new Error('Request body appears to be unencrypted. Encryption is required for security.');
  }

  // Validate encrypted structure (from encryptWithJWT)
  if (!parsed.encrypted || parsed.encrypted !== true) {
    throw new Error('Encrypted body must have encrypted: true');
  }

  if (!parsed.version || typeof parsed.version !== 'number') {
    throw new Error('Encrypted body must have a version number');
  }

  if (!parsed.algorithm || typeof parsed.algorithm !== 'string') {
    throw new Error('Encrypted body must have an algorithm');
  }

  if (!parsed.iv || typeof parsed.iv !== 'string') {
    throw new Error('Encrypted body must have an IV');
  }

  if (!parsed.salt || typeof parsed.salt !== 'string') {
    throw new Error('Encrypted body must have a salt');
  }

  if (!parsed.data || typeof parsed.data !== 'string') {
    throw new Error('Encrypted body must have encrypted data');
  }
}
