# File Integrity System Documentation

**Last Updated:** 2025-12-29
**Status:** [SUCCESS] Complete - All files are verified for integrity using SHA-256 hashing

---

## Overview

The mods API uses a comprehensive file integrity system based on SHA-256 cryptographic hashing. This ensures that:

1. **Uploaded files match downloaded files** - No corruption during storage/retrieval
2. **Tampering is detected** - Any modification to files is immediately detectable
3. **Compression doesn't affect integrity** - Hashes are calculated on original content, not compressed data
4. **End-to-end verification** - Clients can verify file integrity independently

---

## How It Works

### 1. Upload Process

```
1. Client encrypts file -> Encrypted file
2. Client uploads encrypted file
3. Server decrypts file temporarily
4. Server calculates SHA-256 hash on DECRYPTED content
5. Server stores hash in version metadata
6. Server stores encrypted file in R2
```

**Critical:** The hash is calculated on the **decrypted, original content**, not the encrypted or compressed version. This ensures:
- Hash represents the actual file content
- Compression/decompression doesn't affect hash
- Encryption/decryption doesn't affect hash

### 2. Download Process

```
1. Client requests file download
2. Server retrieves encrypted file from R2
3. Server decrypts file
4. Server returns decrypted file with hash headers:
   - X-Strixun-File-Hash: strixun:sha256:<hash>
   - X-Strixun-SHA256: <hash>
5. Client can verify downloaded file matches hash
```

### 3. Verification Process

```
1. Client requests verification: GET /mods/:modId/versions/:versionId/verify
2. Server retrieves file from R2
3. Server calculates current hash
4. Server compares with stored hash
5. Server returns verification result
```

---

## Hash Calculation

### Implementation

Located in: `serverless/mods-api/utils/hash.ts`

The system uses **HMAC-SHA256** with a secret keyphrase from environment variables:

```typescript
export async function calculateStrixunHash(
    file: File | ArrayBuffer | Uint8Array,
    env?: { FILE_INTEGRITY_KEYPHRASE?: string }
): Promise<string> {
    // Uses HMAC-SHA256 with secret keyphrase
    // Keyphrase is baked into the hash calculation (not just prefixed)
    // Returns hex-encoded signature (64 characters)
}
```

### Properties

- **Algorithm:** HMAC-SHA256 (cryptographically secure keyed hash)
- **Keyphrase:** From `FILE_INTEGRITY_KEYPHRASE` environment variable
- **Output:** 64-character hexadecimal signature
- **Deterministic:** Same input + same keyphrase = same signature
- **Unforgeable:** Cannot create valid signature without knowing the keyphrase
- **Collision-resistant:** Different inputs produce different signatures (with extremely high probability)

### Why HMAC Instead of Plain Hash?

1. **True Signature:** The keyphrase is baked into the hash calculation, not just prefixed
2. **Unforgeable:** Without the keyphrase, signatures cannot be forged
3. **Tamper Detection:** Any modification to file or keyphrase produces different signature
4. **Security:** Industry-standard approach for integrity verification

---

## Compression and Integrity

### Important: Compression Does NOT Affect Hash

The hash is **always calculated on the original, uncompressed content**, not on compressed data. This means:

1. **Upload:** Hash is calculated on decrypted content (before any compression)
2. **Storage:** File may be compressed, but hash represents original content
3. **Download:** File is decompressed, hash still matches original content
4. **Verification:** Hash comparison works regardless of compression state

### Example Flow

```
Original File (1000 bytes)
  ->
Hash Calculated: abc123... (on original 1000 bytes)
  ->
Compressed (600 bytes) -> Hash NOT calculated here
  ->
Encrypted (700 bytes) -> Hash NOT calculated here
  ->
Stored in R2 (700 bytes)
  ->
Retrieved from R2 (700 bytes)
  ->
Decrypted (600 bytes)
  ->
Decompressed (1000 bytes) -> Hash matches original!
```

---

## Strixun Hash Format

### Format

```
strixun:sha256:<64-character-hex-signature>
```

The signature is a **true HMAC-SHA256 signature**, not just a prefixed hash. The keyphrase is baked into the calculation.

### Example

```
strixun:sha256:a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

### Functions

- `calculateStrixunHash(file, env)` - Calculates HMAC-SHA256 signature with keyphrase
- `verifyStrixunHash(file, signature, env)` - Verifies signature matches file
- `formatStrixunHash(signature)` - Formats signature with Strixun prefix
- `parseStrixunHash(identifier)` - Extracts signature from identifier
- Validates format and hex characters

### Environment Variable

**Required:** `FILE_INTEGRITY_KEYPHRASE`

Set via:
- Cloudflare Workers: `wrangler secret put FILE_INTEGRITY_KEYPHRASE`
- Local development: `.env` file
- GitHub Actions: GitHub Secrets

See `ENVIRONMENT_SETUP.md` for detailed setup instructions.

---

## Integrity Verification

### Client-Side Verification

Clients can verify file integrity in two ways:

#### Method 1: Using Download Headers

```typescript
const response = await fetch('/mods/:modId/versions/:versionId/download', {
    headers: { 'Authorization': `Bearer ${token}` }
});

const expectedHash = response.headers.get('X-Strixun-SHA256');
const fileData = await response.arrayBuffer();
const actualHash = await calculateFileHash(fileData);

if (actualHash === expectedHash) {
    console.log('File integrity verified!');
} else {
    console.error('File integrity check failed!');
}
```

#### Method 2: Using Verification Endpoint

```typescript
const response = await fetch('/mods/:modId/versions/:versionId/verify');
const result = await response.json();

if (result.verified) {
    console.log('File integrity verified!');
} else {
    console.error('File integrity check failed!');
    console.log('Expected:', result.expectedHash);
    console.log('Actual:', result.currentHash);
}
```

### Server-Side Verification

The `/verify` endpoint automatically:
1. Retrieves file from R2
2. Calculates current hash
3. Compares with stored hash
4. Returns verification result

---

## Badge System

### Integrity Badge

The system provides SVG badges showing file integrity status:

```
GET /mods/:modId/versions/:versionId/badge
```

**Badge States:**
- [SUCCESS] **Verified** (green) - Hash exists and matches
- [ERROR] **Unverified** (red) - Hash missing or mismatch

**Badge Styles:**
- `flat` (default)
- `flat-square`
- `plastic`

---

## Security Properties

### 1. Tamper Detection

Any modification to the file (even 1 byte) will produce a completely different hash:

```typescript
Original: "Hello World"
Hash: abc123...

Modified: "Hello Worlx" (1 byte changed)
Hash: def456... (completely different)
```

### 2. Collision Resistance

SHA-256 is cryptographically secure. The probability of two different files having the same hash is:
- Approximately 1 in 2^256
- For practical purposes: impossible

### 3. Deterministic

Same file always produces same hash:
- Upload: hash = abc123...
- Download: hash = abc123... (matches!)
- Re-upload: hash = abc123... (still matches!)

---

## Test Coverage

### Unit Tests

- [SUCCESS] `serverless/mods-api/utils/hash.test.ts` - Hash utility tests
- [SUCCESS] `serverless/mods-api/handlers/versions/verify.test.ts` - Verification handler tests
- [SUCCESS] `serverless/mods-api/handlers/mods/upload-integrity.test.ts` - Upload integrity tests
- [SUCCESS] `serverless/mods-api/handlers/versions/download-integrity.test.ts` - Download integrity tests

### Test Scenarios

1. **Hash Calculation**
   - Different input types (File, ArrayBuffer, Uint8Array)
   - Same content produces same hash
   - Different content produces different hash
   - Empty file handling
   - Large file handling
   - Single byte change detection

2. **Compression Integrity**
   - Hash calculated on original content
   - Compression doesn't affect hash
   - Decompression restores original hash

3. **Upload/Download Round-Trip**
   - Upload hash matches download hash
   - Encryption/decryption doesn't affect hash
   - Storage/retrieval maintains integrity

4. **Tamper Detection**
   - Single byte change detected
   - Binary file integrity
   - Case-insensitive hash comparison

---

## Implementation Details

### Hash Storage

Hashes are stored in version metadata:

```typescript
interface ModVersion {
    versionId: string;
    modId: string;
    sha256: string; // SHA-256 hash of decrypted file
    // ... other fields
}
```

### Hash Calculation Timing

**During Upload:**
1. File is decrypted (temporarily)
2. Hash is calculated on decrypted content
3. Hash is stored in version metadata
4. Encrypted file is stored in R2

**During Download:**
1. Encrypted file is retrieved from R2
2. File is decrypted
3. Hash header is added to response
4. Decrypted file is returned

**During Verification:**
1. File is retrieved from R2
2. Hash is calculated on current file content
3. Hash is compared with stored hash
4. Result is returned

---

## Best Practices

### For Developers

1. **Always verify hash on download** - Don't trust files without verification
2. **Use verification endpoint** - For automated integrity checks
3. **Display integrity badges** - Show users file verification status
4. **Handle hash mismatches** - Alert users if integrity check fails

### For Users

1. **Check integrity badges** - Look for verified status
2. **Verify downloads** - Use verification endpoint if suspicious
3. **Report mismatches** - Contact support if hash doesn't match

---

## Troubleshooting

### Hash Mismatch

If hash verification fails:

1. **Check file corruption** - File may have been corrupted during transfer
2. **Check encryption** - Ensure file was encrypted/decrypted correctly
3. **Check compression** - Ensure compression/decompression is lossless
4. **Check storage** - Ensure R2 storage is not corrupting files

### Missing Hash

If hash is missing:

1. **Legacy files** - Files uploaded before hash system may not have hashes
2. **Upload error** - Hash calculation may have failed during upload
3. **Metadata corruption** - Version metadata may be corrupted

---

## Conclusion

The file integrity system provides:

[SUCCESS] **Cryptographically secure verification** using SHA-256  
[SUCCESS] **Tamper detection** for any file modification  
[SUCCESS] **Compression-safe** hashing (hash on original content)  
[SUCCESS] **End-to-end verification** from upload to download  
[SUCCESS] **Client-verifiable** integrity checks  
[SUCCESS] **Comprehensive test coverage**

All files are protected against corruption and tampering!

