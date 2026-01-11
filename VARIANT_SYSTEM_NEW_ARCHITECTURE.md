# VARIANT SYSTEM - NEW ARCHITECTURE PROPOSAL

**Date:** 2026-01-10  
**Status:** PROPOSAL - Not Yet Implemented  
**Goal:** Agnostic, reusable, maintainable version control system

---

## DESIGN PRINCIPLES

1. **Agnostic by Design** - Works for mods, plugins, themes, or any versioned resource
2. **Single Responsibility** - Each module has one clear job
3. **Separation of Concerns** - Clear boundaries between layers (handlers → services → repositories)
4. **Immutability** - Versions are immutable once created
5. **Testability** - Easy to unit test each layer
6. **Performance** - Minimize KV reads/writes

---

## TERMINOLOGY

| Term | Definition | Example |
|------|-----------|---------|
| **Resource** | Top-level entity (mod, plugin, theme) | `mod_123` |
| **Variant** | Alternative version of a resource (e.g., Forge vs. Fabric) | `variant_456` |
| **Version** | Specific release of a variant | `ver_789 (v1.2.3)` |
| **Current Version** | The "latest" or "default" version for a variant | `variant.currentVersionId` |

---

## DATA MODEL

### 1. Resource (Mod/Plugin/Theme)

**Purpose:** Top-level entity that groups variants

**Storage:**
- `customer_{customerId}/resource_{resourceId}` → `ResourceMetadata`
- `resource_{resourceId}` → `ResourceMetadata` (global, if public)

**Schema:**
```typescript
interface ResourceMetadata {
  resourceId: string;
  resourceType: 'mod' | 'plugin' | 'theme';  // Extensible
  title: string;
  description: string;
  slug: string;
  category?: string;
  tags: string[];
  visibility: 'public' | 'unlisted' | 'private';
  status: 'active' | 'deprecated' | 'archived';
  
  // Ownership
  authorId: string;
  customerId: string;
  authorDisplayName?: string;
  
  // Metadata
  thumbnailUrl?: string;
  gameId?: string;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  
  // Stats (computed/cached)
  totalDownloads?: number;
  variantCount?: number;
  
  // NO variants array - they're stored separately
}
```

**KV Keys:**
- Resource metadata: `customer_{customerId}/resource_{resourceId}`
- Resource variant list: `customer_{customerId}/resource_{resourceId}_variants` → `string[]`
- Resource slug index: `customer_{customerId}/slug_{slug}` → `resourceId`
- Global resource list: `resources_list_public` → `string[]`

---

### 2. Variant

**Purpose:** Alternative version of a resource (e.g., Forge vs. Fabric for a mod)

**Storage:**
- `customer_{customerId}/variant_{variantId}` → `VariantMetadata`
- `variant_{variantId}` → `VariantMetadata` (global, if parent is public)

**Schema:**
```typescript
interface VariantMetadata {
  variantId: string;
  
  // Parent relationship (agnostic)
  parentId: string;  // resourceId (modId, pluginId, etc.)
  parentType: 'mod' | 'plugin' | 'theme';
  
  // Identification
  name: string;  // e.g., "Forge", "Fabric", "Bukkit"
  description?: string;
  
  // Version control
  currentVersionId: string | null;  // Points to latest/default version
  
  // Ownership (inherited from parent)
  customerId: string;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  
  // Stats (computed/cached)
  versionCount?: number;
  totalDownloads?: number;
}
```

**KV Keys:**
- Variant metadata: `customer_{customerId}/variant_{variantId}`
- Variant version list: `customer_{customerId}/variant_{variantId}_versions` → `string[]`
- Parent's variant list: `customer_{customerId}/resource_{resourceId}_variants` → `string[]`

---

### 3. Version

**Purpose:** Specific release of a variant (immutable)

**Storage:**
- `customer_{customerId}/version_{versionId}` → `VersionMetadata`
- `version_{versionId}` → `VersionMetadata` (global, if parent is public)

**Schema:**
```typescript
interface VersionMetadata {
  versionId: string;
  
  // Parent relationship (agnostic)
  parentId: string;  // variantId or resourceId (for resources without variants)
  parentType: 'variant' | 'resource';
  
  // Version info
  version: string;  // Semantic version: "1.2.3"
  changelog?: string;
  
  // File info
  r2Key: string;
  fileName: string;
  fileSize: number;
  hash: string;
  
  // Compatibility (optional, resource-specific)
  gameVersions?: string[];
  dependencies?: Array<{
    resourceId: string;
    versionRange: string;  // e.g., ">=1.0.0 <2.0.0"
  }>;
  
  // Ownership (inherited)
  customerId: string;
  
  // Timestamps (immutable once created)
  createdAt: string;
  
  // Stats
  downloads: number;
}
```

**KV Keys:**
- Version metadata: `customer_{customerId}/version_{versionId}`
- Variant's version list: `customer_{customerId}/variant_{variantId}_versions` → `string[]`
- R2 file: `{r2Key}` → encrypted binary

---

## SERVICE LAYER

### 1. ResourceService

**Responsibilities:** CRUD operations for resources (mods, plugins, themes)

**Methods:**
```typescript
class ResourceService {
  async create(data: CreateResourceRequest, auth: Auth): Promise<ResourceMetadata>
  async get(resourceId: string, auth: Auth | null): Promise<ResourceMetadata | null>
  async update(resourceId: string, data: UpdateResourceRequest, auth: Auth): Promise<ResourceMetadata>
  async delete(resourceId: string, auth: Auth): Promise<void>
  async list(filters: ResourceListFilters, auth: Auth | null): Promise<ResourceMetadata[]>
  
  // Variant management
  async listVariants(resourceId: string, auth: Auth | null): Promise<VariantMetadata[]>
  async getVariantCount(resourceId: string): Promise<number>
}
```

**Example Implementation:**
```typescript
import { ResourceRepository } from '../repositories/resource-repository.js';
import { VariantRepository } from '../repositories/variant-repository.js';

export class ResourceService {
  constructor(
    private resourceRepo: ResourceRepository,
    private variantRepo: VariantRepository
  ) {}
  
  async create(data: CreateResourceRequest, auth: Auth): Promise<ResourceMetadata> {
    // Validate input
    validateResourceData(data);
    
    // Generate IDs
    const resourceId = generateResourceId();
    const slug = await this.generateUniqueSlug(data.title, auth.customerId);
    
    // Create resource
    const resource: ResourceMetadata = {
      resourceId,
      resourceType: data.resourceType,
      title: data.title,
      description: data.description,
      slug,
      category: data.category,
      tags: data.tags || [],
      visibility: data.visibility || 'private',
      status: 'active',
      authorId: auth.customerId,
      customerId: auth.customerId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    // Save to repository
    await this.resourceRepo.save(resource, auth.customerId);
    
    return resource;
  }
  
  async listVariants(resourceId: string, auth: Auth | null): Promise<VariantMetadata[]> {
    // Get resource
    const resource = await this.get(resourceId, auth);
    if (!resource) {
      throw new NotFoundError('Resource not found');
    }
    
    // Get variant IDs from list
    const variantIds = await this.resourceRepo.getVariantIds(resourceId, resource.customerId);
    
    // Fetch all variants
    const variants = await Promise.all(
      variantIds.map(id => this.variantRepo.get(id, resource.customerId))
    );
    
    return variants.filter(Boolean) as VariantMetadata[];
  }
}
```

---

### 2. VariantService

**Responsibilities:** CRUD operations for variants

**Methods:**
```typescript
class VariantService {
  async create(parentId: string, data: CreateVariantRequest, auth: Auth): Promise<VariantMetadata>
  async get(variantId: string, auth: Auth | null): Promise<VariantMetadata | null>
  async update(variantId: string, data: UpdateVariantRequest, auth: Auth): Promise<VariantMetadata>
  async delete(variantId: string, auth: Auth): Promise<void>
  
  // Version management
  async listVersions(variantId: string, auth: Auth | null): Promise<VersionMetadata[]>
  async getVersion(variantId: string, versionId: string, auth: Auth | null): Promise<VersionMetadata | null>
  async getCurrentVersion(variantId: string, auth: Auth | null): Promise<VersionMetadata | null>
  async setCurrentVersion(variantId: string, versionId: string, auth: Auth): Promise<void>
}
```

**Example Implementation:**
```typescript
import { VariantRepository } from '../repositories/variant-repository.js';
import { VersionRepository } from '../repositories/version-repository.js';
import { ResourceRepository } from '../repositories/resource-repository.js';

export class VariantService {
  constructor(
    private variantRepo: VariantRepository,
    private versionRepo: VersionRepository,
    private resourceRepo: ResourceRepository
  ) {}
  
  async create(parentId: string, data: CreateVariantRequest, auth: Auth): Promise<VariantMetadata> {
    // Verify parent exists and user has permission
    const parent = await this.resourceRepo.get(parentId, auth.customerId);
    if (!parent) {
      throw new NotFoundError('Parent resource not found');
    }
    if (parent.authorId !== auth.customerId) {
      throw new ForbiddenError('Not authorized to create variants for this resource');
    }
    
    // Validate input
    validateVariantData(data);
    
    // Generate ID
    const variantId = generateVariantId();
    
    // Create variant
    const variant: VariantMetadata = {
      variantId,
      parentId,
      parentType: parent.resourceType,
      name: data.name,
      description: data.description,
      currentVersionId: null,  // No versions yet
      customerId: auth.customerId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    // Save variant
    await this.variantRepo.save(variant, auth.customerId);
    
    // Add to parent's variant list
    await this.resourceRepo.addVariant(parentId, variantId, auth.customerId);
    
    return variant;
  }
  
  async setCurrentVersion(variantId: string, versionId: string, auth: Auth): Promise<void> {
    // Get variant
    const variant = await this.get(variantId, auth);
    if (!variant) {
      throw new NotFoundError('Variant not found');
    }
    
    // Verify version exists and belongs to this variant
    const version = await this.versionRepo.get(versionId, variant.customerId);
    if (!version || version.parentId !== variantId) {
      throw new BadRequestError('Version not found or does not belong to this variant');
    }
    
    // Update variant
    variant.currentVersionId = versionId;
    variant.updatedAt = new Date().toISOString();
    
    await this.variantRepo.save(variant, variant.customerId);
  }
}
```

---

### 3. VersionService

**Responsibilities:** Version uploads, downloads, and management

**Methods:**
```typescript
class VersionService {
  async upload(parentId: string, file: File, metadata: VersionUploadMetadata, auth: Auth): Promise<VersionMetadata>
  async download(versionId: string, auth: Auth | null): Promise<DownloadResponse>
  async list(parentId: string, auth: Auth | null): Promise<VersionMetadata[]>
  async delete(versionId: string, auth: Auth): Promise<void>
}
```

**Example Implementation:**
```typescript
import { VersionRepository } from '../repositories/version-repository.js';
import { VariantRepository } from '../repositories/variant-repository.js';
import { StorageService } from './storage-service.js';

export class VersionService {
  constructor(
    private versionRepo: VersionRepository,
    private variantRepo: VariantRepository,
    private storageService: StorageService
  ) {}
  
  async upload(parentId: string, file: File, metadata: VersionUploadMetadata, auth: Auth): Promise<VersionMetadata> {
    // Get parent (variant)
    const parent = await this.variantRepo.get(parentId, auth.customerId);
    if (!parent) {
      throw new NotFoundError('Variant not found');
    }
    if (parent.customerId !== auth.customerId) {
      throw new ForbiddenError('Not authorized to upload versions for this variant');
    }
    
    // Validate file
    validateFile(file, metadata);
    
    // Generate IDs
    const versionId = generateVersionId();
    const r2Key = generateR2Key(parent.customerId, parentId, versionId);
    
    // Upload file to R2 (encrypted)
    const { hash, size } = await this.storageService.uploadFile(file, r2Key);
    
    // Create version metadata
    const version: VersionMetadata = {
      versionId,
      parentId,
      parentType: 'variant',
      version: metadata.version,
      changelog: metadata.changelog,
      r2Key,
      fileName: file.name,
      fileSize: size,
      hash,
      gameVersions: metadata.gameVersions,
      dependencies: metadata.dependencies,
      customerId: auth.customerId,
      createdAt: new Date().toISOString(),
      downloads: 0,
    };
    
    // Save version
    await this.versionRepo.save(version, auth.customerId);
    
    // Add to parent's version list
    await this.variantRepo.addVersion(parentId, versionId, auth.customerId);
    
    // If this is the first version, set as current
    if (parent.currentVersionId === null) {
      await this.variantRepo.setCurrentVersion(parentId, versionId, auth.customerId);
    }
    
    return version;
  }
  
  async download(versionId: string, auth: Auth | null): Promise<DownloadResponse> {
    // Get version (check visibility based on auth)
    const version = await this.versionRepo.get(versionId, auth?.customerId || null);
    if (!version) {
      throw new NotFoundError('Version not found');
    }
    
    // Get file from R2
    const encryptedFile = await this.storageService.downloadFile(version.r2Key);
    
    // Decrypt file
    const decryptedFile = await this.storageService.decryptFile(encryptedFile);
    
    // Increment download counter (async, don't block response)
    this.versionRepo.incrementDownloads(versionId, version.customerId).catch(err => {
      console.error('[VersionService] Failed to increment download counter:', err);
    });
    
    return {
      file: decryptedFile,
      fileName: version.fileName,
      contentType: 'application/octet-stream',
    };
  }
}
```

---

### 4. StorageService

**Responsibilities:** KV and R2 abstraction

**Methods:**
```typescript
class StorageService {
  async uploadFile(file: File, r2Key: string): Promise<{ hash: string; size: number }>
  async downloadFile(r2Key: string): Promise<ArrayBuffer>
  async deleteFile(r2Key: string): Promise<void>
  async encryptFile(data: ArrayBuffer): Promise<ArrayBuffer>
  async decryptFile(data: ArrayBuffer): Promise<ArrayBuffer>
}
```

---

## REPOSITORY LAYER

### 1. ResourceRepository

**Responsibilities:** KV operations for resources

**Methods:**
```typescript
class ResourceRepository {
  async save(resource: ResourceMetadata, customerId: string): Promise<void>
  async get(resourceId: string, customerId: string | null): Promise<ResourceMetadata | null>
  async delete(resourceId: string, customerId: string): Promise<void>
  async list(filters: ResourceListFilters, customerId: string | null): Promise<ResourceMetadata[]>
  
  async getVariantIds(resourceId: string, customerId: string): Promise<string[]>
  async addVariant(resourceId: string, variantId: string, customerId: string): Promise<void>
  async removeVariant(resourceId: string, variantId: string, customerId: string): Promise<void>
}
```

**Example Implementation:**
```typescript
export class ResourceRepository {
  constructor(private kv: KVNamespace) {}
  
  async save(resource: ResourceMetadata, customerId: string): Promise<void> {
    const key = getCustomerKey(customerId, `resource_${resource.resourceId}`);
    await this.kv.put(key, JSON.stringify(resource));
    
    // Also save to global if public
    if (resource.visibility === 'public') {
      await this.kv.put(`resource_${resource.resourceId}`, JSON.stringify(resource));
    }
  }
  
  async get(resourceId: string, customerId: string | null): Promise<ResourceMetadata | null> {
    // Try customer scope first
    if (customerId) {
      const key = getCustomerKey(customerId, `resource_${resourceId}`);
      const data = await this.kv.get(key, { type: 'json' });
      if (data) return data as ResourceMetadata;
    }
    
    // Fall back to global
    const data = await this.kv.get(`resource_${resourceId}`, { type: 'json' });
    return data as ResourceMetadata | null;
  }
  
  async addVariant(resourceId: string, variantId: string, customerId: string): Promise<void> {
    const listKey = getCustomerKey(customerId, `resource_${resourceId}_variants`);
    const variants = await this.kv.get(listKey, { type: 'json' }) as string[] | null;
    const updated = [...(variants || []), variantId];
    await this.kv.put(listKey, JSON.stringify(updated));
  }
}
```

---

### 2. VariantRepository

Similar pattern to `ResourceRepository`, focused on variant operations.

---

### 3. VersionRepository

Similar pattern to `ResourceRepository`, focused on version operations.

---

## API ENDPOINTS

### Resource Endpoints:
```
POST   /resources                        # Create resource
GET    /resources/:id                    # Get resource
PATCH  /resources/:id                    # Update resource metadata
DELETE /resources/:id                    # Delete resource (cascade)
GET    /resources                        # List resources

GET    /resources/:id/variants           # List variants for resource
POST   /resources/:id/variants           # Create variant
```

### Variant Endpoints:
```
GET    /variants/:id                     # Get variant
PATCH  /variants/:id                     # Update variant metadata
DELETE /variants/:id                     # Delete variant (cascade)

GET    /variants/:id/versions            # List versions for variant
POST   /variants/:id/versions            # Upload new version
GET    /variants/:id/current             # Get current version metadata
POST   /variants/:id/current/:versionId  # Set current version
GET    /variants/:id/download            # Download current version
```

### Version Endpoints:
```
GET    /versions/:id                     # Get version metadata
DELETE /versions/:id                     # Delete version
GET    /versions/:id/download            # Download specific version
```

---

## MIGRATION STRATEGY

### Phase 1: Build New System (Parallel)
1. Implement service layer
2. Implement repository layer
3. Add comprehensive unit tests
4. Create new API endpoints

### Phase 2: Data Migration
1. Run migration script:
   - Read all existing mods with variants
   - Create separate `variant_{variantId}` keys
   - Create version lists
   - Verify `currentVersionId` is set for all variants
2. Keep old data for rollback

### Phase 3: Switch Traffic
1. Update frontend to use new endpoints
2. Monitor for errors
3. Gradually deprecate old endpoints

### Phase 4: Clean Up
1. Delete old variant data (after verification period)
2. Remove old handlers
3. Update documentation

---

## BENEFITS OF NEW ARCHITECTURE

1. **Agnostic** - Works for any resource type (mods, plugins, themes)
2. **Scalable** - Direct variant access without loading entire mod
3. **Testable** - Each layer can be unit tested
4. **Maintainable** - Clear separation of concerns
5. **Performant** - Fewer KV reads, more targeted queries
6. **Reliable** - Single responsibility, less coupling
7. **Extensible** - Easy to add new resource types

---

## COMPARISON: OLD VS NEW

| Aspect | Old System | New System |
|--------|-----------|------------|
| **Variant Storage** | Embedded in mod | Separate KV keys |
| **Data Access** | Load entire mod | Direct variant access |
| **Coupling** | Tight (handlers call handlers) | Loose (services) |
| **Testing** | Difficult (mocks everywhere) | Easy (unit testable) |
| **Reusability** | Low (mod-specific) | High (agnostic) |
| **Performance** | Multiple KV reads | Targeted queries |
| **Maintainability** | Low (tangled logic) | High (clean layers) |

---

## CONCLUSION

The new architecture provides a **solid foundation** for version control across all resource types. It's **agnostic, testable, maintainable,** and **scalable**. While it requires upfront effort to implement and migrate, the long-term benefits far outweigh the costs.

**Recommended Action:** Implement the immediate fix (save variant to KV before upload) to unblock users, then proceed with full refactor in parallel.

---

**End of Proposal**
