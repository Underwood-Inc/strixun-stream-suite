# Strixun Stream Suite - API Reference

> **Complete API documentation for developers**

This document provides comprehensive API reference for all endpoints, data structures, and integration patterns.

---

## Table of Contents

1. [Base URL & Authentication](#base-url--authentication)
2. [Twitch API Endpoints](#twitch-api-endpoints)
3. [Cloud Storage Endpoints](#cloud-storage-endpoints)
4. [System Endpoints](#system-endpoints)
5. [Data Structures](#data-structures)
6. [Error Handling](#error-handling)
7. [Rate Limits](#rate-limits)
8. [Integration Examples](#integration-examples)

---

## Base URL & Authentication

### Base URL

```
https://{worker-name}.{subdomain}.workers.dev
```

**Example:**
```
https://strixun-twitch-api.your-name.workers.dev
```

### Authentication

#### Cloud Storage Endpoints

All cloud storage endpoints require the `X-Device-ID` header:

```
X-Device-ID: sss_1234567890_abcdefghij
```

**Device ID Format:**
- Pattern: `sss_<timestamp>_<random>`
- Validation: `/^[a-zA-Z0-9_-]{8,64}$/`
- Generated client-side, stored locally

#### Twitch API Endpoints

Twitch API endpoints use **App Access Tokens** automatically managed by the worker. No authentication headers required from the client.

---

## Twitch API Endpoints

### GET /clips

Fetch Twitch clips for a channel.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `channel` | string | Yes | - | Twitch username |
| `limit` | number | No | 20 | Max clips to return (max 100) |
| `shuffle` | boolean | No | false | Randomize clip order |
| `start_date` | string | No | - | ISO 8601 start date |
| `end_date` | string | No | - | ISO 8601 end date |
| `prefer_featured` | boolean | No | false | Prioritize featured clips |

**Example Request:**
```http
GET /clips?channel=ninja&limit=10&shuffle=true&prefer_featured=true
```

**Example Response:**
```json
{
  "data": [
    {
      "id": "AwkwardHelplessSalamanderSwiftRage",
      "url": "https://clips.twitch.tv/AwkwardHelplessSalamanderSwiftRage",
      "embed_url": "https://clips.twitch.tv/embed?clip=AwkwardHelplessSalamanderSwiftRage",
      "broadcaster_id": "123456789",
      "broadcaster_name": "ninja",
      "creator_id": "987654321",
      "creator_name": "clipper_user",
      "video_id": "1234567890",
      "game_id": "33214",
      "title": "Amazing Play!",
      "view_count": 12345,
      "created_at": "2024-01-15T10:30:00Z",
      "thumbnail_url": "https://clips-media-assets2.twitch.tv/...",
      "duration": 30.5,
      "vod_offset": 1234,
      "clip_url": "https://clips-media-assets2.twitch.tv/...mp4",
      "item": 0
    }
  ],
  "pagination": {
    "cursor": "eyJiIjpudWxsLCJhIjp7Ik9mZnNldCI6MjB9fQ=="
  }
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `data` | Array | Array of clip objects |
| `data[].id` | string | Clip ID |
| `data[].clip_url` | string | Direct MP4 video URL (added by worker) |
| `data[].item` | number | Index in response array |
| `pagination` | object | Pagination cursor (if available) |

---

### GET /following

Get channels followed by a user.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `channel` | string | Yes | - | Twitch username |
| `limit` | number | No | 100 | Max results (max 100) |
| `ref` | string | No | - | Base64-encoded user OAuth token |
| `after` | string | No | - | Pagination cursor |

**Example Request:**
```http
GET /following?channel=ninja&limit=50&ref=base64_encoded_token
```

**Example Response:**
```json
{
  "data": [
    {
      "broadcaster_id": "123456789",
      "broadcaster_login": "shroud",
      "broadcaster_name": "Shroud",
      "followed_at": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "cursor": "eyJiIjpudWxsLCJhIjp7Ik9mZnNldCI6NTB9fQ=="
  }
}
```

**Note:** The `ref` parameter requires a user OAuth token (not app token) to access private following lists.

---

### GET /game

Get game information by game ID.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | string | Yes | - | Twitch game ID |

**Example Request:**
```http
GET /game?id=33214
```

**Example Response:**
```json
{
  "data": [
    {
      "id": "33214",
      "name": "Fortnite",
      "box_art_url": "https://static-cdn.jtvnw.net/ttv-boxart/33214-{width}x{height}.jpg",
      "igdb_id": "1905"
    }
  ]
}
```

**Caching:** Game data is cached for 7 days (604800 seconds).

---

### GET /user

Get user information by username.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `login` | string | Yes | - | Twitch username |

**Example Request:**
```http
GET /user?login=ninja
```

**Example Response:**
```json
{
  "data": [
    {
      "id": "123456789",
      "login": "ninja",
      "display_name": "Ninja",
      "type": "",
      "broadcaster_type": "partner",
      "description": "Professional gamer and streamer",
      "profile_image_url": "https://static-cdn.jtvnw.net/jtv_user_pictures/...",
      "offline_image_url": "https://static-cdn.jtvnw.net/jtv_user_pictures/...",
      "view_count": 123456789,
      "created_at": "2011-05-26T18:56:17Z"
    }
  ]
}
```

---

## Cloud Storage Endpoints

### POST /cloud/save

Save configurations to cloud storage.

**Headers:**
```
X-Device-ID: sss_1234567890_abcdefghij
Content-Type: application/json
```

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `slot` | string | No | default | Save slot name (1-32 chars, alphanumeric + dashes/underscores) |

**Request Body:**
```json
{
  "configs": {
    "swapConfigs": [...],
    "layoutPresets": [...],
    "textCyclerConfigs": [...],
    "clipsConfigs": [...],
    "sourceOpacityConfigs": {...}
  },
  "metadata": {
    "source": "manual",
    "note": "Pre-stream setup",
    "description": "My main configuration"
  }
}
```

**Example Request:**
```http
POST /cloud/save?slot=default
X-Device-ID: sss_1234567890_abcdefghij
Content-Type: application/json

{
  "configs": {
    "swapConfigs": [
      {
        "id": "swap1",
        "sourceA": "Webcam",
        "sourceB": "Game Capture",
        "hotkey": "F1"
      }
    ],
    "layoutPresets": [...]
  },
  "metadata": {
    "note": "Main setup"
  }
}
```

**Example Response:**
```json
{
  "success": true,
  "deviceId": "sss_1234567890_abcdefghij",
  "slot": "default",
  "timestamp": "2024-12-22T10:30:00.000Z",
  "size": 12345
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `Valid X-Device-ID header required` | Missing or invalid device ID |
| 400 | `Invalid slot name` | Slot name doesn't match pattern |
| 413 | `Save data too large (max 10MB)` | Payload exceeds size limit |
| 500 | `Failed to save` | Internal server error |

---

### GET /cloud/load

Load configurations from cloud storage.

**Headers:**
```
X-Device-ID: sss_1234567890_abcdefghij
```

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `slot` | string | No | default | Save slot name |

**Example Request:**
```http
GET /cloud/load?slot=default
X-Device-ID: sss_1234567890_abcdefghij
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "version": 2,
    "deviceId": "sss_1234567890_abcdefghij",
    "slot": "default",
    "timestamp": "2024-12-22T10:30:00.000Z",
    "userAgent": "Mozilla/5.0...",
    "configs": {
      "swapConfigs": [...],
      "layoutPresets": [...]
    },
    "metadata": {
      "source": "manual",
      "note": "Pre-stream setup"
    }
  }
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `Valid X-Device-ID header required` | Missing or invalid device ID |
| 404 | `Save not found` | Slot doesn't exist for this device |
| 500 | `Failed to load` | Internal server error |

---

### GET /cloud/list

List all save slots for a device.

**Headers:**
```
X-Device-ID: sss_1234567890_abcdefghij
```

**Example Request:**
```http
GET /cloud/list
X-Device-ID: sss_1234567890_abcdefghij
```

**Example Response:**
```json
{
  "success": true,
  "deviceId": "sss_1234567890_abcdefghij",
  "saves": [
    {
      "slot": "default",
      "timestamp": "2024-12-22T10:30:00.000Z",
      "version": 2,
      "size": 12345,
      "configCount": 5
    },
    {
      "slot": "backup1",
      "timestamp": "2024-12-21T15:20:00.000Z",
      "version": 2,
      "size": 11234,
      "configCount": 4
    }
  ]
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `Valid X-Device-ID header required` | Missing or invalid device ID |
| 500 | `Failed to list saves` | Internal server error |

---

### DELETE /cloud/delete

Delete a save slot.

**Headers:**
```
X-Device-ID: sss_1234567890_abcdefghij
```

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `slot` | string | No | default | Save slot name to delete |

**Example Request:**
```http
DELETE /cloud/delete?slot=backup1
X-Device-ID: sss_1234567890_abcdefghij
```

**Example Response:**
```json
{
  "success": true,
  "deviceId": "sss_1234567890_abcdefghij",
  "slot": "backup1",
  "message": "Save deleted"
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `Valid X-Device-ID header required` | Missing or invalid device ID |
| 500 | `Failed to delete` | Internal server error |

---

## System Endpoints

### GET /health

Health check endpoint.

**Example Request:**
```http
GET /health
```

**Example Response:**
```json
{
  "status": "ok",
  "message": "Strixun Stream Suite API is running",
  "features": ["twitch-api", "cloud-storage"],
  "timestamp": "2024-12-22T10:30:00.000Z"
}
```

**Error Response:**
```json
{
  "status": "error",
  "message": "Failed to get app access token: 401"
}
```

---

### GET /

Root endpoint (same as `/health`).

---

## Data Structures

### Swap Configuration

```typescript
interface SwapConfig {
    id: string;                    // Unique identifier
    name?: string;                  // Display name
    sourceA: string;               // First source name
    sourceB: string;               // Second source name
    hotkey?: string;                // OBS hotkey identifier
    enabled: boolean;               // Whether swap is active
}
```

### Layout Preset

```typescript
interface LayoutPreset {
    id: string;                     // Unique identifier
    name: string;                   // Display name
    scene: string;                   // OBS scene name
    sources: Array<{                 // Source positions
        name: string;                // Source name
        x: number;                   // X position
        y: number;                   // Y position
        width: number;               // Width
        height: number;              // Height
        visible: boolean;            // Visibility state
    }>;
    animationDuration?: number;     // Animation duration in ms
    staggerDelay?: number;          // Delay between source animations
    hotkey?: string;                 // OBS hotkey identifier
}
```

### Text Cycler Configuration

```typescript
interface TextCyclerConfig {
    id: string;                     // Unique identifier
    name: string;                   // Display name
    texts: string[];                 // Array of text strings
    interval: number;                // Cycle interval in ms
    transition: 'none' | 'obfuscate' | 'typewriter' | 'glitch' | 'scramble' | 'wave' | 'fade' | 'slide' | 'pop';
    enabled: boolean;                // Whether cycler is active
}
```

### Clips Configuration

```typescript
interface ClipsConfig {
    id: string;                     // Unique identifier
    name: string;                   // Display name
    channel: string;                 // Twitch channel name
    limit: number;                   // Max clips to fetch
    shuffle: boolean;                // Randomize order
    startDate?: string;              // ISO 8601 start date
    endDate?: string;                // ISO 8601 end date
    preferFeatured: boolean;         // Prioritize featured clips
    theme?: string;                  // Player theme
    autoplay: boolean;               // Auto-play clips
}
```

### Source Opacity Configuration

```typescript
interface SourceOpacityConfigs {
    [sourceName: string]: number;   // Source name -> opacity (0-100)
}
```

---

## Error Handling

### Error Response Format

All error responses follow this format:

```json
{
  "error": "Error type",
  "message": "Detailed error message (optional)"
}
```

### HTTP Status Codes

| Code | Meaning | When Used |
|------|---------|-----------|
| 200 | OK | Successful request |
| 400 | Bad Request | Invalid parameters or missing required fields |
| 404 | Not Found | Resource doesn't exist |
| 413 | Payload Too Large | Request body exceeds size limit |
| 500 | Internal Server Error | Server-side error |

### Error Handling Best Practices

```javascript
async function saveToCloud(configs, slot = 'default') {
    try {
        const response = await fetch(`${API_URL}/cloud/save?slot=${slot}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Device-ID': getDeviceId()
            },
            body: JSON.stringify({ configs })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || error.error);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Cloud save failed:', error);
        // Handle error (retry, fallback, etc.)
        throw error;
    }
}
```

---

## Rate Limits

### Current Limits

| Endpoint | Limit | Notes |
|----------|-------|-------|
| Twitch API endpoints | Twitch rate limits apply | Token caching reduces calls |
| Cloud Storage endpoints | No explicit limit | 10MB per save, reasonable usage expected |

### Twitch API Rate Limits

The worker caches responses to minimize Twitch API calls:
- **App Access Token:** Cached for 4 hours
- **User IDs:** Cached for 24 hours
- **Game Data:** Cached for 7 days

### Best Practices

1. **Cache responses client-side** when possible
2. **Batch operations** instead of multiple requests
3. **Handle rate limit errors** gracefully with retry logic
4. **Monitor token cache** to avoid unnecessary token refreshes

---

## Integration Examples

### JavaScript/TypeScript

#### Basic Cloud Save

```javascript
const API_URL = 'https://strixun-twitch-api.your-name.workers.dev';
const DEVICE_ID = 'sss_1234567890_abcdefghij';

async function saveConfigs(configs, slot = 'default') {
    const response = await fetch(`${API_URL}/cloud/save?slot=${slot}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Device-ID': DEVICE_ID
        },
        body: JSON.stringify({
            configs,
            metadata: {
                source: 'manual',
                note: 'My configuration'
            }
        })
    });
    
    if (!response.ok) {
        throw new Error(`Save failed: ${response.status}`);
    }
    
    return await response.json();
}
```

#### Loading Configs

```javascript
async function loadConfigs(slot = 'default') {
    const response = await fetch(`${API_URL}/cloud/load?slot=${slot}`, {
        headers: {
            'X-Device-ID': DEVICE_ID
        }
    });
    
    if (!response.ok) {
        if (response.status === 404) {
            return null; // Save doesn't exist
        }
        throw new Error(`Load failed: ${response.status}`);
    }
    
    const result = await response.json();
    return result.data;
}
```

#### Fetching Clips

```javascript
async function fetchClips(channel, options = {}) {
    const params = new URLSearchParams({
        channel,
        limit: options.limit || 20,
        shuffle: options.shuffle ? 'true' : 'false',
        prefer_featured: options.preferFeatured ? 'true' : 'false'
    });
    
    if (options.startDate) params.append('start_date', options.startDate);
    if (options.endDate) params.append('end_date', options.endDate);
    
    const response = await fetch(`${API_URL}/clips?${params}`);
    
    if (!response.ok) {
        throw new Error(`Failed to fetch clips: ${response.status}`);
    }
    
    return await response.json();
}
```

### cURL Examples

#### Save to Cloud

```bash
curl -X POST "https://strixun-twitch-api.your-name.workers.dev/cloud/save?slot=default" \
  -H "Content-Type: application/json" \
  -H "X-Device-ID: sss_1234567890_abcdefghij" \
  -d '{
    "configs": {
      "swapConfigs": []
    },
    "metadata": {
      "note": "Test save"
    }
  }'
```

#### Load from Cloud

```bash
curl "https://strixun-twitch-api.your-name.workers.dev/cloud/load?slot=default" \
  -H "X-Device-ID: sss_1234567890_abcdefghij"
```

#### Fetch Clips

```bash
curl "https://strixun-twitch-api.your-name.workers.dev/clips?channel=ninja&limit=10&shuffle=true"
```

---

## CORS Configuration

The API includes CORS headers for cross-origin requests:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Device-ID
Access-Control-Max-Age: 86400
```

**Note:** For production, consider restricting `Access-Control-Allow-Origin` to specific domains in `worker.js`.

---

## WebSocket API (OBS Communication)

The control panel communicates with OBS via WebSocket (not HTTP API). This is documented separately in the [Technical Architecture](../02_ARCHITECTURE/TECHNICAL_ARCHITECTURE.md) document.

**WebSocket Endpoint:**
```
ws://localhost:4455
```

**Protocol:** OBS WebSocket Protocol v5.x

---

*For architecture details, see [TECHNICAL_ARCHITECTURE.md](../02_ARCHITECTURE/TECHNICAL_ARCHITECTURE.md)*  
*For database schemas, see [DATABASE_SCHEMA.md](../12_REFERENCE/DATABASE_SCHEMA.md)*
