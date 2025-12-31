#  Profile Picture Storage Architecture

**Status:** Post-MVP Feature  
**Design Date:** December 2024

## Overview

Efficient, scalable profile picture storage using WebP format and Cloudflare R2 object storage.

---

## Architecture Principles

### ✓ Composable
- **Independent Service**: `ProfilePictureService` works standalone
- **No Dependencies**: Doesn't require other services
- **Reusable**: Can be used for any image upload needs

### ✓ Agnostic
- **Storage Agnostic**: Can work with R2, S3, or any object storage
- **Format Agnostic**: Supports multiple formats (converts to WebP)
- **Framework Agnostic**: Pure TypeScript

### ✓ Strongly Typed
- **Full TypeScript**: Complete type coverage
- **Interface-Based**: All configs and data structures are interfaces

---

## Storage Strategy

### Format: WebP 

**Why WebP?**
- **25-35% smaller** than JPEG
- **Better quality** than JPEG at same file size
- **Wide support**: Chrome, Firefox, Edge, Safari 14+
- **Transparency support**: Like PNG
- **Perfect for profile pictures**: Small, optimized images

**Conversion Process**:
1. Client-side conversion (browser Canvas API)
2. Target: 200x200px (maintains aspect ratio)
3. Quality: 0.85 (85% - good balance)
4. Result: <50KB per image

### Storage: Cloudflare R2

**Why R2?**
- **Integrated**: Works seamlessly with Cloudflare Workers
- **CDN Included**: Automatic global distribution
- **Cost-Effective**: $0.015/GB storage, $0.36/GB egress
- **S3-Compatible**: Can migrate to S3 if needed

**Storage Structure**:
```
profile-pictures/
  {customerId}/
    profile_{userId}_{timestamp}.webp
```

**Example**:
```
profile-pictures/
  cust_abc123/
    profile_user_xyz789_1703123456789.webp
```

---

## API Endpoints

### Upload Profile Picture
```
POST /user/profile-picture
Content-Type: multipart/form-data
Authorization: Bearer {token}

Body:
  image: File (WebP blob)
```

**Response**:
```json
{
  "success": true,
  "picture": {
    "url": "https://pub-xxx.r2.dev/profile-pictures/...",
    "uploadedAt": "2024-12-20T...",
    "fileSize": 45234,
    "dimensions": {
      "width": 200,
      "height": 200
    }
  }
}
```

### Get Profile Picture
```
GET /user/profile-picture/{userId}
Authorization: Bearer {token}
```

**Response**:
```json
{
  "success": true,
  "url": "https://pub-xxx.r2.dev/profile-pictures/..."
}
```

### Delete Profile Picture
```
DELETE /user/profile-picture
Authorization: Bearer {token}
```

**Response**:
```json
{
  "success": true,
  "message": "Profile picture deleted"
}
```

---

## Client-Side Implementation

### ProfilePictureService

**Features**:
- File validation (type, size)
- WebP conversion (Canvas API)
- Image resizing (maintains aspect ratio)
- Upload to server
- URL retrieval

**Usage**:
```typescript
import { ProfilePictureService } from './services/profilePicture';

const service = new ProfilePictureService({
  apiUrl: 'https://api.example.com',
  maxFileSize: 5 * 1024 * 1024, // 5MB
  targetDimensions: { width: 200, height: 200 },
  quality: 0.85,
});

// Upload
const file = input.files[0];
const picture = await service.uploadProfilePicture(file, token);

// Get URL
const url = await service.getProfilePictureUrl(userId, token);

// Delete
await service.deleteProfilePicture(token);
```

---

## Server-Side Implementation

### Cloudflare Worker Handler

**Features**:
- Multipart form data parsing
- File validation
- R2 upload
- User record update
- Old picture cleanup

**R2 Configuration**:
```toml
# wrangler.toml
[[r2_buckets]]
binding = "PROFILE_PICTURES_R2"
bucket_name = "profile-pictures"
preview_bucket_name = "profile-pictures-preview"

# Public URL (if using custom domain)
# Or use default: https://pub-{account-id}.r2.dev
```

---

## Security Considerations

### Access Control
- **Authentication Required**: All endpoints require JWT token
- **User Isolation**: Pictures stored per customer ID
- **Ownership**: Users can only modify their own pictures

### File Validation
- **Type Check**: Must be image/*
- **Size Limit**: 5MB maximum
- **Client Conversion**: Converts to WebP before upload

### URL Security
- **Public URLs**: R2 public bucket URLs
- **No Auth Required**: For viewing (public profile pictures)
- **CDN Caching**: 1 year cache (immutable after upload)

---

## Performance Optimization

### Image Optimization
- **WebP Format**: 25-35% smaller than JPEG
- **Target Size**: 200x200px (small, fast loading)
- **Quality**: 0.85 (good balance)
- **Result**: <50KB per image

### CDN Caching
- **Cache Control**: `public, max-age=31536000` (1 year)
- **Immutable**: Filename includes timestamp (cache forever)
- **Global Distribution**: Cloudflare CDN

### Lazy Loading
- **On-Demand**: Load pictures only when needed
- **Placeholder**: Show default avatar until loaded
- **Progressive**: Load low-res first, then high-res

---

## Cost Analysis

### Storage Costs
- **Per User**: ~50KB average
- **10,000 Users**: ~500MB = $0.0075/month
- **100,000 Users**: ~5GB = $0.075/month

### Bandwidth Costs
- **Per View**: ~50KB
- **10,000 Views/Month**: ~500MB = $0.18/month
- **100,000 Views/Month**: ~5GB = $1.80/month

### Total (100K users, 100K views/month)
- **Storage**: $0.075/month
- **Bandwidth**: $1.80/month
- **Total**: ~$1.88/month

**Very cost-effective!** ✓

---

## Migration Path

### From No Storage
1. Deploy R2 bucket
2. Configure public access
3. Deploy API endpoints
4. Update client to use service

### To Different Storage
- **S3-Compatible**: R2 is S3-compatible, easy migration
- **Other CDNs**: Download from R2, upload to new CDN
- **Self-Hosted**: Download from R2, serve from own server

---

## Future Enhancements

### Image Variants
- **Thumbnail**: 64x64px for lists
- **Small**: 128x128px for cards
- **Medium**: 200x200px for profiles
- **Large**: 400x400px for full view

### Image Processing
- **Auto-Crop**: Face detection and centering
- **Filters**: Optional image filters
- **Frames**: Optional decorative frames

### Analytics
- **Upload Stats**: Track upload frequency
- **Storage Usage**: Monitor storage per customer
- **Bandwidth Usage**: Track CDN usage

---

## Implementation Checklist

### Backend
- [ ] Create R2 bucket
- [ ] Configure public access
- [ ] Implement upload handler
- [ ] Implement get handler
- [ ] Implement delete handler
- [ ] Add routes to router

### Frontend
- [ ] Create ProfilePictureService
- [ ] Implement WebP conversion
- [ ] Add upload UI component
- [ ] Add display component
- [ ] Integrate with user profile

### Testing
- [ ] Unit tests for service
- [ ] Integration tests for API
- [ ] E2E tests for upload flow
- [ ] Performance tests

---

**Status**: Architecture designed, ready for implementation post-MVP

