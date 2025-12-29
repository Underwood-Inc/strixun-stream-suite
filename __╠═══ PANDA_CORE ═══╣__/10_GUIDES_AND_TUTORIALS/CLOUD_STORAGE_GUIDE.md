# Cloud Storage Integration Guide

> **Complete guide for integrating the cloud storage system with your Strixun Stream Suite**

**Date:** 2025-12-29

---

## 🎯 Overview

The cloud storage system provides **true cross-device configuration backup and sync** using Cloudflare Workers and KV storage. Your configs are stored securely in the cloud and can be accessed from any device.

---

## 📋 Features

- ✅ **Device-Based Authentication** - Automatic device ID generation
- ✅ **Multiple Save Slots** - default, backup1, backup2, autosave, custom names
- ✅ **Auto-Sync** - Optional automatic cloud saves every 5 minutes
- ✅ **Conflict Detection** - Smart timestamp-based conflict resolution
- ✅ **10MB Per Save** - Plenty of space for all your configs
- ✅ **1 Year Retention** - Auto-expires after 1 year (renewable on save)
- ✅ **Complete Backup** - Saves all config types (swaps, layouts, text cyclers, clips, opacity)

---

## 🚀 Quick Start

### Step 1: Deploy the Cloudflare Worker

1. **Navigate to serverless directory:**
   ```bash
   cd serverless
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Login to Cloudflare:**
   ```bash
   wrangler login
   ```

4. **Create KV namespace** (if not already created):
   ```bash
   wrangler kv namespace create "TWITCH_CACHE"
   ```
   Copy the returned ID and update `wrangler.toml` if needed.

5. **Set Twitch secrets** (for Twitch API features):
   ```bash
   wrangler secret put TWITCH_CLIENT_ID
   wrangler secret put TWITCH_CLIENT_SECRET
   ```

6. **Deploy:**
   ```bash
   wrangler deploy
   ```

7. **Note your Worker URL:**
   ```
   https://strixun-twitch-api.YOUR_SUBDOMAIN.workers.dev
   ```

### Step 2: Configure Client

1. **Update API URL** in `assets/js/cloud-storage.js`:
   ```javascript
   const CLOUD_API_URL = 'https://strixun-twitch-api.YOUR_SUBDOMAIN.workers.dev';
   ```

2. **Add scripts to your HTML** (if integrating into existing control panel):
   ```html
   <script src="assets/js/storage.js"></script>
   <script src="assets/js/cloud-storage.js"></script>
   ```

### Step 3: Use the Cloud Storage Panel

Option A: **Standalone Panel**
- Open `cloud-storage-panel.html` in a browser
- Works independently alongside your main control panel

Option B: **Integrate into Existing Panel**
- Copy the HTML structure from `cloud-storage-panel.html`
- Add to your control panel HTML
- Ensure scripts are loaded in the correct order

---

## Usage Examples

### JavaScript API

```javascript
// Get device ID (auto-generated)
const deviceId = CloudStorage.getDeviceId();

// Save current configs to cloud
await CloudStorage.saveToCloud('default', {
    note: 'My awesome setup',
    description: 'Pre-stream configuration'
});

// Load configs from cloud
const saveData = await CloudStorage.loadFromCloud('default');

// Apply loaded save (replace current configs)
CloudStorage.applyCloudSave(saveData, false);

// Or merge with current configs
CloudStorage.applyCloudSave(saveData, true);

// List all saves
const saves = await CloudStorage.listCloudSaves();
console.log(saves);

// Delete a save
await CloudStorage.deleteCloudSave('backup1');

// Enable auto-sync (saves every 5 minutes)
CloudStorage.enableAutoSync();

// Disable auto-sync
CloudStorage.disableAutoSync();

// Check conflict before loading
const cloudSave = await CloudStorage.loadFromCloud('default');
const conflict = CloudStorage.checkForConflicts(cloudSave);

if (conflict.hasConflict) {
    console.log(`Recommendation: ${conflict.recommendation}`);
    console.log(`Reason: ${conflict.reason}`);
}
```

### UI Panel Features

1. **Device ID Display** - Shows your unique device identifier
2. **Save Slot Input** - Enter custom save slot names
3. **Save to Cloud** - Backs up current configs
4. **Load from Cloud** - Restores configs from a save
5. **List Saves** - Shows all available cloud saves
6. **Auto-Sync Toggle** - Enable/disable automatic saves
7. **Save Management** - Load or delete individual saves
8. **Status Messages** - Real-time feedback on operations

---

## 🔧 Configuration

### Save Slot Naming

- Alphanumeric, dashes, underscores only
- 1-32 characters
- Examples: `default`, `backup1`, `pre_stream`, `tournament_setup`

### Storage Limits

- **Per Save:** 10MB (compressed JSON)
- **Retention:** 1 year (TTL renewed on each save)
- **Device ID:** Stored permanently in localStorage + storage system

### Auto-Sync Behavior

When enabled:
- Saves to `autosave` slot every 5 minutes
- Only saves if changes detected
- Runs in background (non-blocking)
- Fails gracefully (logs warning, doesn't interrupt workflow)

---

## 🛡️ Security & Privacy

### Device Identification
- Device ID is auto-generated locally
- Format: `sss_<timestamp>_<random>`
- Stored in localStorage and IndexedDB
- No personal information collected

### Data Storage
- All data stored in Cloudflare KV (encrypted at rest)
- CORS enabled for your domains only (configurable in worker)
- No authentication required (device ID acts as key)
- Data accessible only with valid device ID

### Data Privacy
- No user tracking or analytics
- No third-party services (except Cloudflare)
- You control your Cloudflare account and data
- Can delete all data via Cloudflare dashboard

---

## 🔍 Troubleshooting

### "Failed to save: API error 500"
- Check Worker deployment status
- Verify KV namespace is correctly bound in `wrangler.toml`
- Check Worker logs: `wrangler tail`

### "Save data too large"
- Max save size is 10MB
- Reduce config complexity or split across multiple slots
- Check for large embedded data in configs

### "Device ID invalid"
- Device ID must be 8-64 alphanumeric characters
- Reset device ID: `CloudStorage.resetDeviceId()`
- Clear browser cache and localStorage

### "Save not found"
- Verify slot name is correct (case-sensitive)
- Check if save expired (1 year TTL)
- Verify device ID matches (different device = different saves)

### CORS Errors
- Update CORS headers in `worker.js` to include your domain
- Verify API URL is correct in `cloud-storage.js`
- Check browser console for specific CORS error

---

## 🔗 Integration with Existing Storage

The cloud storage system integrates seamlessly with your existing multi-layer storage:

```
┌─────────────────────────────────────┐
│       Cloud Storage (NEW!)          │ → Cross-device backup
├─────────────────────────────────────┤
│       OBS Persistent Data           │ → Cross-client sync
├─────────────────────────────────────┤
│       IndexedDB (Primary)           │ → Survives cache clears
├─────────────────────────────────────┤
│       localStorage (Backup)        │ → Synced on every write
├─────────────────────────────────────┤
│       Recovery Snapshot             │ → Emergency recovery
└─────────────────────────────────────┘
```

---

## 📊 Storage Architecture

### Worker Side (Cloudflare)
```
KV Storage Keys:
├── cloudsave_{deviceId}_{slot}          // Save data
└── cloudsave_{deviceId}_slots           // Slot list

Save Data Structure:
{
    "version": 2,
    "deviceId": "sss_abc123_xyz789",
    "slot": "default",
    "timestamp": "2025-12-22T08:30:00.000Z",
    "userAgent": "Mozilla/5.0...",
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
        "configCounts": { ... }
    }
}
```

### Client Side (Browser)
```
localStorage:
├── sss_device_id                        // Device identifier
├── sss_auto_sync_enabled                // Auto-sync preference
└── sss_last_cloud_sync                  // Last sync timestamp
```

---

## Advanced Usage

### Custom API URL at Runtime
```javascript
CloudStorage.setApiUrl('https://your-custom-worker.dev');
```

### Manual Conflict Resolution
```javascript
const cloudSave = await CloudStorage.loadFromCloud('default');
const conflict = CloudStorage.checkForConflicts(cloudSave);

if (conflict.hasConflict) {
    if (conflict.cloudNewer) {
        // Cloud is newer, load it
        CloudStorage.applyCloudSave(cloudSave, false);
    } else {
        // Local is newer, save it
        await CloudStorage.saveToCloud('default');
    }
}
```

### Scheduled Backups
```javascript
// Save to dated backup slots
const today = new Date().toISOString().split('T')[0];
await CloudStorage.saveToCloud(`backup_${today}`);
```

### Multi-Device Sync
```javascript
// On device A: Save
await CloudStorage.saveToCloud('shared');

// On device B: Load (use same device ID)
// Copy device ID from device A
localStorage.setItem('sss_device_id', 'DEVICE_A_ID');
const saveData = await CloudStorage.loadFromCloud('shared');
CloudStorage.applyCloudSave(saveData, false);
```

---

## 📝 API Reference

See `serverless/README.md` for complete API endpoint documentation.

---

## Support

- **Worker Logs:** `wrangler tail`
- **Browser Console:** Check for errors and debug messages
- **KV Dashboard:** View/edit data at Cloudflare dashboard
- **GitHub Issues:** Report bugs and feature requests

---

**Last Updated**: 2025-12-29

