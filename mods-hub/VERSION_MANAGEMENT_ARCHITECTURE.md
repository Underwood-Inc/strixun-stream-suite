# Version Management Architecture

## Component Hierarchy

```
ModManagePage
├── ModManageForm (existing - mod metadata)
├── VersionUploadForm (existing - upload new mod versions)
├── ModVersionManagement (NEW)
│   ├── Lists all mod versions
│   ├── Edit version metadata
│   ├── Delete versions
│   └── Download versions
└── VariantManagement (NEW)
    └── For each variant:
        ├── Variant metadata display
        ├── VariantVersionUpload (NEW)
        │   └── Upload new variant version form
        └── VariantVersionList (NEW)
            └── Lists all versions of this variant
                ├── Download specific version
                ├── Edit version metadata
                └── Delete version
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      ModManagePage                          │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │              ModVersionManagement                     │ │
│  │                                                       │ │
│  │  [v1.0.0] [Edit] [Delete] [Download]                 │ │
│  │  [v1.1.0] [Edit] [Delete] [Download]                 │ │
│  │  [v2.0.0] [Edit] [Delete] [Download]                 │ │
│  │                                                       │ │
│  │  useDeleteModVersion() ──────┐                       │ │
│  │  useUpdateModVersion() ──────┤                       │ │
│  └──────────────────────────────┼───────────────────────┘ │
│                                  │                         │
│  ┌──────────────────────────────┼───────────────────────┐ │
│  │          VariantManagement   │                       │ │
│  │                              │                       │ │
│  │  ┌─────────────────────────┐ │                       │ │
│  │  │ Variant: Fabric         │ │                       │ │
│  │  │ [Upload Version] [▼]    │ │                       │ │
│  │  │                         │ │                       │ │
│  │  │ ┌─────────────────────┐ │ │                       │ │
│  │  │ │VariantVersionUpload │ │ │                       │ │
│  │  │ │ [File] [Version]    │ │ │                       │ │
│  │  │ │ [Changelog]         │ │ │                       │ │
│  │  │ │ [Cancel] [Upload]   │ │ │                       │ │
│  │  │ └─────────────────────┘ │ │                       │ │
│  │  │                         │ │                       │ │
│  │  │ ┌─────────────────────┐ │ │                       │ │
│  │  │ │VariantVersionList   │ │ │                       │ │
│  │  │ │ v1.0.0 [Download]   │ │ │                       │ │
│  │  │ │ v1.1.0 [Download]   │ │ │                       │ │
│  │  │ │ v1.2.0 [Download]   │ │ │                       │ │
│  │  │ └─────────────────────┘ │ │                       │ │
│  │  └─────────────────────────┘ │                       │ │
│  │                              │                       │ │
│  │  useUploadVariantVersion() ──┤                       │ │
│  │  useDeleteVariantVersion() ──┤                       │ │
│  │  useVariantVersions() ────────┤                       │ │
│  └──────────────────────────────┼───────────────────────┘ │
│                                  │                         │
└──────────────────────────────────┼─────────────────────────┘
                                   │
                                   ▼
                        ┌──────────────────────┐
                        │   React Query Cache  │
                        │                      │
                        │  modKeys.detail()    │
                        │  modKeys.variant     │
                        │    Versions()        │
                        └──────────────────────┘
                                   │
                                   ▼
                        ┌──────────────────────┐
                        │    API Service       │
                        │                      │
                        │  uploadVariant       │
                        │    Version()         │
                        │  listVariant         │
                        │    Versions()        │
                        │  deleteModVersion()  │
                        │  updateModVersion()  │
                        └──────────────────────┘
                                   │
                                   ▼
                        ┌──────────────────────┐
                        │   Mods API Backend   │
                        │   (Cloudflare)       │
                        └──────────────────────┘
```

## Type Relationships

```
ModMetadata
├── modId: string
├── slug: string
├── title: string
├── latestVersion: string
└── variants: ModVariant[]
    └── ModVariant
        ├── variantId: string
        ├── modId: string (parent)
        ├── name: string
        ├── currentVersionId: string ──┐
        ├── versionCount: number       │
        └── totalDownloads: number     │
                                       │
                                       ▼
                            VariantVersion (separate query)
                            ├── variantVersionId: string
                            ├── variantId: string (parent)
                            ├── modId: string (grandparent)
                            ├── version: string
                            ├── changelog: string
                            ├── fileSize: number
                            ├── fileName: string
                            ├── r2Key: string
                            ├── downloadUrl: string
                            ├── sha256: string
                            ├── downloads: number
                            └── createdAt: string

ModVersion (separate from variants)
├── versionId: string
├── modId: string (parent)
├── version: string
├── changelog: string
├── fileSize: number
├── fileName: string
├── r2Key: string
├── downloadUrl: string
├── sha256: string
├── downloads: number
└── createdAt: string
```

## State Management

### React Query Keys

```typescript
// Mod detail with versions and variants
modKeys.detail(slug) → {
  mod: ModMetadata,
  versions: ModVersion[]
}

// Variant versions (lazy loaded)
modKeys.variantVersions(modSlug, variantId) → {
  versions: VariantVersion[]
}
```

### Query Invalidation Flow

```
User Action                 Mutation                Query Invalidation
───────────────────────────────────────────────────────────────────────

Upload Variant Version  →  useUploadVariant    →  modKeys.variantVersions()
                           Version()               modKeys.detail()

Delete Mod Version      →  useDeleteMod        →  modKeys.detail()
                           Version()

Update Mod Version      →  useUpdateMod        →  modKeys.detail()
                           Version()

Delete Variant Version  →  useDeleteVariant    →  modKeys.variantVersions()
                           Version()               modKeys.detail()

Update Variant Version  →  useUpdateVariant    →  modKeys.variantVersions()
                           Version()               modKeys.detail()
```

## User Interaction Flow

### Scenario: Upload New Variant Version

```
1. User navigates to /manage/my-mod
   │
   ▼
2. ModManagePage loads
   │
   ├─→ Fetches mod detail (modKeys.detail)
   │   └─→ Gets mod metadata, versions, variants
   │
   ▼
3. User scrolls to "Variant Management"
   │
   ▼
4. User clicks "Upload Version" on "Fabric" variant
   │
   ├─→ Sets uploadingVariant state to variantId
   │
   ▼
5. VariantVersionUpload component renders
   │
   ├─→ User selects file
   ├─→ User enters version number
   ├─→ User enters changelog
   ├─→ User enters game versions
   │
   ▼
6. User clicks "Upload Version"
   │
   ├─→ Calls uploadVariantVersion.mutateAsync()
   │   │
   │   ├─→ Encrypts file
   │   ├─→ Creates FormData
   │   ├─→ POSTs to /mods/:modId/variants/:variantId/versions
   │   │
   │   ▼
   │   Backend processes upload
   │   │
   │   ├─→ Decrypts file
   │   ├─→ Validates metadata
   │   ├─→ Generates variantVersionId
   │   ├─→ Uploads to R2
   │   ├─→ Saves to KV
   │   ├─→ Updates variant metadata
   │   │
   │   ▼
   │   Returns success
   │
   ▼
7. Mutation onSuccess handler
   │
   ├─→ Invalidates modKeys.variantVersions()
   ├─→ Invalidates modKeys.detail()
   ├─→ Shows success notification
   ├─→ Closes upload form
   │
   ▼
8. React Query refetches invalidated queries
   │
   ├─→ New version appears in list
   ├─→ Version count increments
   └─→ UI updates automatically
```

## Storage Architecture

### KV Storage Keys

```
Mod Metadata
customer_{customerId}_mod_{modId}

Mod Versions
customer_{customerId}_version_{versionId}
customer_{customerId}_mod_{modId}_versions: [versionId1, versionId2, ...]

Variant Metadata
customer_{customerId}_variant_{variantId}

Variant Versions
customer_{customerId}_variant_version_{variantVersionId}
customer_{customerId}_variant_{variantId}_versions: [variantVersionId1, ...]
```

### R2 Storage Structure

```
mods/
├── {modId}/
│   ├── versions/
│   │   ├── {versionId}.zip
│   │   └── {versionId}.zip
│   └── variants/
│       ├── {variantId}/
│       │   ├── {variantVersionId}.zip
│       │   └── {variantVersionId}.zip
│       └── {variantId}/
│           └── {variantVersionId}.zip
```

## API Endpoints

### Mod Version Endpoints

```
POST   /mods/:modId/versions
       Upload new mod version
       Body: FormData (file, metadata)
       Returns: { version: ModVersion }

GET    /mods/:slug/versions/:versionId/download
       Download specific mod version
       Returns: Decrypted file (binary)

PUT    /mods/:modId/versions/:versionId
       Update mod version metadata
       Body: { version?, changelog?, gameVersions? }
       Returns: { version: ModVersion }

DELETE /mods/:modId/versions/:versionId
       Delete mod version
       Returns: { success: true }
```

### Variant Version Endpoints

```
POST   /mods/:modId/variants/:variantId/versions
       Upload new variant version
       Body: FormData (file, metadata)
       Returns: { variantVersion: VariantVersion }

GET    /mods/:slug/variants/:variantId/versions
       List all versions of a variant
       Returns: { versions: VariantVersion[] }

GET    /mods/:slug/variants/:variantId/versions/:variantVersionId/download
       Download specific variant version
       Returns: Decrypted file (binary)

PUT    /mods/:modId/variants/:variantId/versions/:variantVersionId
       Update variant version metadata
       Body: { version?, changelog?, gameVersions? }
       Returns: { variantVersion: VariantVersion }

DELETE /mods/:modId/variants/:variantId/versions/:variantVersionId
       Delete variant version
       Returns: { success: true }

GET    /mods/:slug/variants/:variantId/download
       Download latest variant version (convenience endpoint)
       Returns: Decrypted file (binary)
```

## Security Model

```
Request
  │
  ├─→ Authentication Check (JWT token)
  │   └─→ Fail: 401 Unauthorized
  │
  ├─→ Ownership Check (authorId === userId OR isAdmin)
  │   └─→ Fail: 403 Forbidden
  │
  ├─→ Permission Check (mod-management permission)
  │   └─→ Fail: 403 Forbidden
  │
  ├─→ Customer Scope Check (customerId matches)
  │   └─→ Fail: 403 Forbidden
  │
  └─→ Process Request
      │
      ├─→ File Encryption/Decryption (AES-256-GCM)
      ├─→ SHA-256 Hash Verification
      ├─→ File Size Validation
      └─→ Extension Validation
```

## Error Handling

```
Component Level
├── Try-catch blocks around async operations
├── Error state management (useState)
├── User-friendly error messages
└── Timeout-based error dismissal

Hook Level (React Query)
├── onError handlers
├── Error notifications via useUIStore
├── Automatic retry logic (configurable)
└── Error boundary fallbacks

API Level
├── HTTP status code handling
├── Response validation
├── Network error handling
└── Timeout handling

Backend Level
├── Input validation
├── Authentication errors
├── Authorization errors
├── Storage errors (KV, R2)
└── Encryption/decryption errors
```

---

**This architecture provides a robust, scalable, and user-friendly version management system that aligns perfectly with the backend implementation!**
