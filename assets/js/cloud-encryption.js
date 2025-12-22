/**
 * Strixun Stream Suite - Cloud Storage Encryption
 * 
 * Passphrase-based encryption for cloud storage
 * - Client-side encryption (zero-knowledge)
 * - No user database needed
 * - Cross-device access with passphrase
 * - AES-GCM encryption via Web Crypto API
 * 
 * @version 1.0.0
 */

// ============ Configuration ============
const PASSPHRASE_KEY = 'sss_has_passphrase';
const SALT_KEY = 'sss_encryption_salt';
const PBKDF2_ITERATIONS = 100000;

// ============ Encryption Utilities ============

/**
 * Generate a random salt for key derivation
 * @returns {Uint8Array}
 */
function generateSalt() {
    return crypto.getRandomValues(new Uint8Array(16));
}

/**
 * Derive encryption key from passphrase
 * @param {string} passphrase - User's passphrase
 * @param {Uint8Array} salt - Salt for key derivation
 * @returns {Promise<CryptoKey>}
 */
async function deriveEncryptionKey(passphrase, salt) {
    // Convert passphrase to key material
    const encoder = new TextEncoder();
    const passphraseKey = await crypto.subtle.importKey(
        'raw',
        encoder.encode(passphrase),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
    );
    
    // Derive AES-GCM key
    return await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: PBKDF2_ITERATIONS,
            hash: 'SHA-256'
        },
        passphraseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

/**
 * Generate storage key (device ID) from passphrase
 * This allows same passphrase = same storage location
 * @param {string} passphrase
 * @returns {Promise<string>}
 */
async function deriveStorageKey(passphrase) {
    const encoder = new TextEncoder();
    const data = encoder.encode(passphrase + '_storage_key');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Format as valid device ID (alphanumeric, dashes, underscores)
    return 'sss_pass_' + hashHex.substring(0, 48);
}

/**
 * Encrypt data with passphrase
 * @param {object} data - Data to encrypt
 * @param {string} passphrase - User's passphrase
 * @returns {Promise<object>} Encrypted data with metadata
 */
async function encryptData(data, passphrase) {
    if (!passphrase || passphrase.length < 8) {
        throw new Error('Passphrase must be at least 8 characters');
    }
    
    // Get or generate salt
    let salt = getSalt();
    if (!salt) {
        salt = generateSalt();
        saveSalt(salt);
    }
    
    // Derive key
    const key = await deriveEncryptionKey(passphrase, salt);
    
    // Generate IV
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Encrypt
    const encoder = new TextEncoder();
    const dataStr = JSON.stringify(data);
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encoder.encode(dataStr)
    );
    
    // Return encrypted blob with metadata
    return {
        version: 1,
        encrypted: true,
        algorithm: 'AES-GCM-256',
        iv: arrayBufferToBase64(iv),
        salt: arrayBufferToBase64(salt),
        data: arrayBufferToBase64(encrypted),
        timestamp: new Date().toISOString()
    };
}

/**
 * Decrypt data with passphrase
 * @param {object} encryptedBlob - Encrypted data blob
 * @param {string} passphrase - User's passphrase
 * @returns {Promise<object>} Decrypted data
 */
async function decryptData(encryptedBlob, passphrase) {
    if (!encryptedBlob.encrypted) {
        // Data is not encrypted, return as-is (backward compatibility)
        return encryptedBlob;
    }
    
    if (!passphrase || passphrase.length < 8) {
        throw new Error('Passphrase must be at least 8 characters');
    }
    
    // Extract metadata
    const salt = base64ToArrayBuffer(encryptedBlob.salt);
    const iv = base64ToArrayBuffer(encryptedBlob.iv);
    const encryptedData = base64ToArrayBuffer(encryptedBlob.data);
    
    // Derive key
    const key = await deriveEncryptionKey(passphrase, salt);
    
    // Decrypt
    try {
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            encryptedData
        );
        
        const decoder = new TextDecoder();
        const dataStr = decoder.decode(decrypted);
        return JSON.parse(dataStr);
    } catch (error) {
        throw new Error('Decryption failed - incorrect passphrase?');
    }
}

/**
 * Verify passphrase is correct
 * @param {string} passphrase
 * @returns {Promise<boolean>}
 */
async function verifyPassphrase(passphrase) {
    // Try to decrypt a test payload
    const testData = { test: 'verification' };
    try {
        const encrypted = await encryptData(testData, passphrase);
        const decrypted = await decryptData(encrypted, passphrase);
        return decrypted.test === 'verification';
    } catch (error) {
        return false;
    }
}

// ============ Salt Management ============

/**
 * Save salt to storage
 * @param {Uint8Array} salt
 */
function saveSalt(salt) {
    const saltBase64 = arrayBufferToBase64(salt);
    
    if (typeof storage !== 'undefined') {
        storage.setRaw(SALT_KEY, saltBase64);
    }
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SALT_KEY, saltBase64);
    }
}

/**
 * Get salt from storage
 * @returns {Uint8Array|null}
 */
function getSalt() {
    let saltBase64 = null;
    
    if (typeof storage !== 'undefined') {
        saltBase64 = storage.getRaw(SALT_KEY);
    }
    
    if (!saltBase64 && typeof localStorage !== 'undefined') {
        saltBase64 = localStorage.getItem(SALT_KEY);
    }
    
    return saltBase64 ? base64ToArrayBuffer(saltBase64) : null;
}

// ============ Passphrase State Management ============

/**
 * Mark that passphrase is set
 * @param {boolean} isSet
 */
function setPassphraseState(isSet) {
    if (typeof storage !== 'undefined') {
        storage.set(PASSPHRASE_KEY, isSet);
    }
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem(PASSPHRASE_KEY, isSet ? 'true' : 'false');
    }
}

/**
 * Check if passphrase is set
 * @returns {boolean}
 */
function hasPassphrase() {
    if (typeof storage !== 'undefined') {
        return storage.get(PASSPHRASE_KEY) === true;
    }
    if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(PASSPHRASE_KEY) === 'true';
    }
    return false;
}

/**
 * Clear passphrase state
 */
function clearPassphraseState() {
    if (typeof storage !== 'undefined') {
        storage.remove(PASSPHRASE_KEY);
        storage.remove(SALT_KEY);
    }
    if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(PASSPHRASE_KEY);
        localStorage.removeItem(SALT_KEY);
    }
}

// ============ Utility Functions ============

/**
 * Convert ArrayBuffer to Base64
 * @param {ArrayBuffer} buffer
 * @returns {string}
 */
function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Convert Base64 to ArrayBuffer
 * @param {string} base64
 * @returns {Uint8Array}
 */
function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

/**
 * Generate a strong passphrase suggestion
 * @returns {string}
 */
function generateStrongPassphrase() {
    const words = [
        'Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot',
        'Golf', 'Hotel', 'India', 'Juliet', 'Kilo', 'Lima',
        'Mike', 'November', 'Oscar', 'Papa', 'Quebec', 'Romeo',
        'Sierra', 'Tango', 'Uniform', 'Victor', 'Whiskey', 'X-ray',
        'Yankee', 'Zulu'
    ];
    
    const word1 = words[Math.floor(Math.random() * words.length)];
    const word2 = words[Math.floor(Math.random() * words.length)];
    const number = Math.floor(Math.random() * 10000);
    const symbols = ['!', '@', '#', '$', '%', '&', '*'];
    const symbol = symbols[Math.floor(Math.random() * symbols.length)];
    
    return `${word1}${word2}${number}${symbol}`;
}

/**
 * Check passphrase strength
 * @param {string} passphrase
 * @returns {object} Strength info
 */
function checkPassphraseStrength(passphrase) {
    const length = passphrase.length;
    const hasLower = /[a-z]/.test(passphrase);
    const hasUpper = /[A-Z]/.test(passphrase);
    const hasNumber = /[0-9]/.test(passphrase);
    const hasSymbol = /[^a-zA-Z0-9]/.test(passphrase);
    
    let score = 0;
    if (length >= 8) score++;
    if (length >= 12) score++;
    if (length >= 16) score++;
    if (hasLower && hasUpper) score++;
    if (hasNumber) score++;
    if (hasSymbol) score++;
    
    let strength = 'weak';
    let color = '#f44336';
    if (score >= 4) {
        strength = 'medium';
        color = '#ff9800';
    }
    if (score >= 6) {
        strength = 'strong';
        color = '#4caf50';
    }
    
    return {
        score,
        strength,
        color,
        suggestions: [
            length < 12 ? 'Use at least 12 characters' : null,
            !hasUpper ? 'Add uppercase letters' : null,
            !hasLower ? 'Add lowercase letters' : null,
            !hasNumber ? 'Add numbers' : null,
            !hasSymbol ? 'Add symbols (!@#$%&*)' : null
        ].filter(Boolean)
    };
}

// ============ Exports ============
if (typeof window !== 'undefined') {
    window.CloudEncryption = {
        // Encryption/Decryption
        encryptData,
        decryptData,
        verifyPassphrase,
        
        // Key Derivation
        deriveStorageKey,
        
        // Passphrase State
        setPassphraseState,
        hasPassphrase,
        clearPassphraseState,
        
        // Utilities
        generateStrongPassphrase,
        checkPassphraseStrength,
    };
}

