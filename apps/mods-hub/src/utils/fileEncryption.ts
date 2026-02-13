/**
 * File encryption utilities for mod uploads
 * Handles encryption and compression for all file uploads (main mod files, versions, and variants)
 */

import { encryptBinaryWithSharedKey } from '@strixun/api-framework';

/**
 * Get and validate the shared encryption key from environment
 * @throws Error if key is missing or invalid
 */
function getSharedEncryptionKey(): string {
    const sharedKey = import.meta.env.VITE_MODS_ENCRYPTION_KEY;
    if (!sharedKey || sharedKey.length < 32) {
        throw new Error('MODS_ENCRYPTION_KEY is required for file encryption. Please ensure the encryption key is configured in your environment.');
    }
    return sharedKey;
}

/**
 * Encrypt a file for upload using shared key encryption
 * 
 * This function:
 * 1. Validates the encryption key
 * 2. Reads the file buffer
 * 3. Encrypts with shared key (handles compression automatically via encryptBinaryWithSharedKey)
 * 4. Converts encrypted data back to a File object with .encrypted extension
 * 
 * @param file - The file to encrypt
 * @returns Encrypted File object ready for FormData upload
 * @throws Error if encryption key is invalid or encryption fails
 */
export async function encryptFileForUpload(file: File): Promise<File> {
    // SECURITY: Shared key encryption is MANDATORY for all file uploads
    // All files must be encrypted with shared key so any authenticated user can decrypt
    const sharedKey = getSharedEncryptionKey();
    
    // Read file buffer
    const fileBuffer = await file.arrayBuffer();
    
    // Encrypt with shared key (compression is handled automatically by encryptBinaryWithSharedKey)
    const encryptedFile = await encryptBinaryWithSharedKey(fileBuffer, sharedKey);
    
    // Create encrypted File object with .encrypted extension
    // Convert Uint8Array to ArrayBuffer for Blob constructor compatibility
    // Create a new ArrayBuffer copy to ensure type compatibility
    const encryptedArrayBuffer = encryptedFile.buffer.slice(
        encryptedFile.byteOffset,
        encryptedFile.byteOffset + encryptedFile.byteLength
    ) as ArrayBuffer;
    const encryptedBlob = new Blob([encryptedArrayBuffer], { type: 'application/octet-stream' });
    const encryptedFileObj = new File([encryptedBlob], `${file.name}.encrypted`, { type: 'application/octet-stream' });
    
    return encryptedFileObj;
}

/**
 * Download a file from an ArrayBuffer response
 * 
 * This function handles the download process for mod files:
 * 1. Converts ArrayBuffer to Blob
 * 2. Creates a temporary download URL
 * 3. Triggers the browser download
 * 4. Cleans up the temporary URL
 * 
 * Note: Files are decrypted server-side before being sent to the client,
 * so this function receives decrypted data ready for download.
 * 
 * @param data - ArrayBuffer containing the file data (decrypted)
 * @param fileName - Name for the downloaded file
 * @throws Error if download fails
 */
export function downloadFileFromArrayBuffer(data: ArrayBuffer, fileName: string): void {
    // Convert ArrayBuffer to Blob for download
    const blob = new Blob([data]);
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
}
