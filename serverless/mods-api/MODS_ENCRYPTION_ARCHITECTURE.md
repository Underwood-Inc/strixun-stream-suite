# Mod Hub Encryption Architecture - Shared Key System

> **Complete guide to how mod uploads and downloads are encrypted and secured**

**Date:** 2025-01-XX  
**Status:** Implementation Plan

---

## 📋 Executive Summary

This document explains how mod files are encrypted when uploaded and decrypted when downloaded. The system uses a **shared encryption key** that allows any authenticated user to download mods, while access is controlled by **visibility settings** (public/unlisted/private).

### Key Points

- ✓ **All mod files are encrypted** before being stored
- ✓ **Any authenticated user** can download and decrypt mods
- ✓ **Access control** is handled by mod visibility settings, not encryption
- ✓ **Encryption happens on the client** (before upload)
- ✓ **Decryption happens on the server** (during download)
- ✓ **Files are stored encrypted** in cloud storage

---

## 🔐 Security Architecture Overview

```mermaid
graph TB
    subgraph "Client Side (Browser)"
        A[User Selects Mod File] --> B[Client Encrypts File]
        B --> C[Encrypted File Ready]
        C --> D[Upload to Server]
    end
    
    subgraph "Server Side (API)"
        D --> E[Server Receives Encrypted File]
        E --> F[Store in Cloud Storage]
        F --> G[File Stored Encrypted]
    end
    
    subgraph "Download Flow"
        H[Authenticated User Requests Download] --> I[Server Checks Visibility]
        I --> J{Access Allowed?}
        J -->|Yes| K[Server Decrypts File]
        J -->|No| L[Access Denied]
        K --> M[Send Decrypted File to User]
    end
    
    style B fill:#e1f5ff
    style K fill:#e1f5ff
    style I fill:#fff4e1
    style J fill:#fff4e1
```

---

## 🔄 Complete Lifecycle: Upload to Download

### Phase 1: Upload Process

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant API
    participant Storage
    
    User->>Browser: Selects mod file to upload
    Browser->>Browser: Get shared encryption key<br/>(from environment)
    Browser->>Browser: Compress file (gzip)
    Browser->>Browser: Encrypt with shared key<br/>(AES-GCM-256)
    Browser->>API: Upload encrypted file + metadata
    API->>API: Verify user authentication
    API->>API: Check upload permissions
    API->>API: Decrypt file temporarily<br/>(to calculate file hash)
    API->>API: Calculate SHA-256 hash<br/>(for integrity verification)
    API->>Storage: Store encrypted file
    API->>API: Save mod metadata<br/>(visibility, author, etc.)
    API->>Browser: Upload successful
    Browser->>User: Show success message
```

### Phase 2: Download Process

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant API
    participant Storage
    
    User->>Browser: Clicks download button
    Browser->>API: Request download<br/>(with JWT token)
    API->>API: Verify user authentication
    API->>API: Load mod metadata
    API->>API: Check mod visibility
    API->>API: Verify access permissions
    
    alt Access Allowed
        API->>Storage: Retrieve encrypted file
        Storage->>API: Return encrypted file
        API->>API: Get shared encryption key<br/>(from environment)
        API->>API: Decrypt file with shared key
        API->>API: Decompress file (if compressed)
        API->>Browser: Send decrypted file
        Browser->>User: File download starts
    else Access Denied
        API->>Browser: Return 404 (Not Found)
        Browser->>User: Show error message
    end
```

---

## 🔑 Encryption Key Management

### Shared Key System

The system uses a **single shared encryption key** for all mod files. This key is:

- ✓ Stored as a **GitHub environment secret** (for production)
- ✓ Stored in **local `.env` file** (for development)
- ✓ **Never sent to the client** (only used server-side for decryption)
- ✓ **Same key for all mods** (allows any authenticated user to decrypt)

### Key Flow Diagram

```mermaid
graph LR
    subgraph "Development"
        A[.env file] --> B[MODS_ENCRYPTION_KEY]
    end
    
    subgraph "Production"
        C[GitHub Secrets] --> D[MODS_ENCRYPTION_KEY]
    end
    
    subgraph "Client Side"
        E[Environment Variable] --> F[Shared Key Value]
        F --> G[Encrypt Files]
    end
    
    subgraph "Server Side"
        H[Environment Variable] --> I[Shared Key Value]
        I --> J[Decrypt Files]
    end
    
    B --> E
    D --> H
    
    style B fill:#e1f5ff
    style D fill:#e1f5ff
    style F fill:#fff4e1
    style I fill:#fff4e1
```

---

## 🛡️ Access Control System

### How Access is Controlled

**Important:** Encryption does NOT control access. Access is controlled by **mod visibility settings**.

```mermaid
graph TB
    A[User Requests Download] --> B{User Authenticated?}
    B -->|No| C[Access Denied]
    B -->|Yes| D[Load Mod Metadata]
    D --> E{Check Visibility}
    
    E -->|Public| F{Check Status}
    E -->|Unlisted| F
    E -->|Private| G{Is Author or Admin?}
    
    F -->|Published/Approved| H[Allow Download]
    F -->|Draft| I{Is Author or Admin?}
    
    G -->|Yes| H
    G -->|No| C
    
    I -->|Yes| H
    I -->|No| C
    
    H --> J[Decrypt and Send File]
    
    style E fill:#fff4e1
    style F fill:#fff4e1
    style G fill:#fff4e1
    style I fill:#fff4e1
    style H fill:#e1f5ff
    style C fill:#ffe1e1
```

### Visibility Settings Explained

| Visibility | Who Can Download | Notes |
|------------|------------------|-------|
| **Public** | Any authenticated user | Visible in mod listings |
| **Unlisted** | Any authenticated user | Not visible in listings (need direct link) |
| **Private** | Only author or admin | Completely hidden from others |

**Note:** All mods start as "pending" status and must be approved by an admin before they're accessible, regardless of visibility setting.

---

## 🔒 Encryption Technical Details

### Encryption Process (Client-Side)

```mermaid
graph LR
    A[Original File] --> B[Compress with gzip]
    B --> C[Generate Random Salt]
    C --> D[Derive Key from Shared Key<br/>PBKDF2, 100,000 iterations]
    D --> E[Generate Random IV]
    E --> F[Encrypt with AES-GCM-256]
    F --> G[Add Metadata Header]
    G --> H[Encrypted File Ready]
    
    style A fill:#e1f5ff
    style H fill:#fff4e1
```

### Decryption Process (Server-Side)

```mermaid
graph LR
    A[Encrypted File] --> B[Read Metadata Header]
    B --> C[Extract Salt and IV]
    C --> D[Derive Key from Shared Key<br/>PBKDF2, 100,000 iterations]
    D --> E[Decrypt with AES-GCM-256]
    E --> F{Was Compressed?}
    F -->|Yes| G[Decompress with gzip]
    F -->|No| H[Original File]
    G --> H
    
    style A fill:#fff4e1
    style H fill:#e1f5ff
```

### Encryption Format

The encrypted file uses a **binary format (Version 5)** with the following structure:

```
[Header Section - 5 bytes]
├── Version (1 byte): Always 5
├── Compression Flag (1 byte): 1 = compressed, 0 = uncompressed
├── Salt Length (1 byte): Always 16
├── IV Length (1 byte): Always 12
└── Hash Length (1 byte): Always 32

[Data Section]
├── Salt (16 bytes): Random salt for key derivation
├── IV (12 bytes): Random initialization vector
├── Key Hash (32 bytes): SHA-256 hash of shared key (for verification)
└── Encrypted Data (variable): Encrypted and optionally compressed file content
```

---

## 🔄 Migration from JWT to Shared Key

### What Changed

**Before (JWT-Based):**
- Files encrypted with uploader's JWT token
- Only uploader could decrypt
- Each user had different encryption keys

**After (Shared Key):**
- Files encrypted with shared key
- Any authenticated user can decrypt
- All users use the same encryption key

### Migration Impact

```mermaid
graph TB
    A[Old Files: JWT Encrypted] --> B{Re-upload Required?}
    B -->|Yes| C[User Re-uploads Mod]
    C --> D[New File: Shared Key Encrypted]
    B -->|No| E[File Remains JWT Encrypted]
    E --> F[Download Fails<br/>Need to Re-upload]
    
    D --> G[Any User Can Download]
    
    style A fill:#ffe1e1
    style D fill:#e1f5ff
    style E fill:#fff4e1
    style G fill:#e1f5ff
```

**Note:** Files encrypted with the old JWT system will need to be re-uploaded to work with the new shared key system. The system will detect the encryption format and handle accordingly.

---

## 🎯 Security Benefits

### What This System Provides

1. **Encryption at Rest**
   - Files are encrypted before being stored
   - Even if storage is compromised, files are protected

2. **Access Control**
   - Visibility settings control who can download
   - Authentication required for all downloads
   - Private mods only accessible to author/admin

3. **Integrity Verification**
   - SHA-256 hash stored with each file
   - Verifies file hasn't been tampered with
   - Hash calculated on decrypted content

4. **Compression**
   - Files compressed before encryption
   - Reduces storage and bandwidth costs
   - Transparent to end users

### Security Layers

```mermaid
graph TB
    A[User Request] --> B[Layer 1: Authentication]
    B --> C{Valid JWT Token?}
    C -->|No| D[Access Denied]
    C -->|Yes| E[Layer 2: Visibility Check]
    E --> F{Access Allowed?}
    F -->|No| D
    F -->|Yes| G[Layer 3: Decryption]
    G --> H[Layer 4: Integrity Check]
    H --> I[File Delivered]
    
    style B fill:#fff4e1
    style E fill:#fff4e1
    style G fill:#e1f5ff
    style H fill:#e1f5ff
```

---

## 📊 Data Flow Summary

### Upload Flow

```
User File → Compress → Encrypt (Shared Key) → Upload → Server Decrypts (Temp) → Calculate Hash → Store Encrypted → Save Metadata
```

### Download Flow

```
User Request → Authenticate → Check Visibility → Retrieve Encrypted → Decrypt (Shared Key) → Decompress → Verify Hash → Send to User
```

---

## 🔧 Technical Implementation Notes

### Environment Variables

**Required Secret:**
- `MODS_ENCRYPTION_KEY` - Shared encryption key (minimum 32 characters)

**Where Used:**
- Client-side: For encrypting files before upload
- Server-side: For decrypting files during download

### API Framework Methods

**New Functions (to be created):**
- `encryptBinaryWithSharedKey()` - Encrypts binary data with shared key
- `decryptBinaryWithSharedKey()` - Decrypts binary data with shared key

**Reused Functions:**
- `compressData()` - Gzip compression
- `decompressData()` - Gzip decompression
- PBKDF2 key derivation (same as JWT encryption)

### File Format Detection

The system automatically detects encryption format:
- **Version 5** (binary with compression) - New shared key format
- **Version 4** (binary without compression) - Legacy format
- **Version 3** (JSON format) - Legacy format

---

## ✓ Summary

This architecture provides:

1. ✓ **Secure encryption** for all mod files
2. ✓ **Shared key system** allowing any authenticated user to download
3. ✓ **Visibility-based access control** (not encryption-based)
4. ✓ **Compression** to reduce storage costs
5. ✓ **Integrity verification** via SHA-256 hashes
6. ✓ **Backward compatibility** with format detection

The system is designed to be secure, efficient, and user-friendly while maintaining proper access controls through visibility settings rather than encryption keys.
