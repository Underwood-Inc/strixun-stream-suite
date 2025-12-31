# Idle Game API Endpoints Reference

> **Complete API reference for all idle game endpoints** [FEATURE]

---

## [EMOJI] Authentication

All endpoints require JWT authentication via `Authorization: Bearer <token>` header.

---

## [EMOJI] Save State

### Save Game State
```
POST /game/save-state
Authorization: Bearer <token>
Content-Type: application/json

{
  "characterId": "char_123",
  "saveData": { ... },
  "version": "1.0.0"
}

Response: {
  "success": true,
  "savedAt": "2024-12-01T12:00:00Z"
}
```

### Load Game State
```
GET /game/save-state?characterId=char_123
Authorization: Bearer <token>

Response: {
  "success": true,
  "saveState": {
    "userId": "user_123",
    "characterId": "char_123",
    "saveData": { ... },
    "version": "1.0.0",
    "savedAt": "2024-12-01T12:00:00Z"
  }
}
```

---

##  Daily Loot Boxes

### Get Loot Box Status
```
GET /game/loot-box/status
Authorization: Bearer <token>

Response: {
  "success": true,
  "available": true,
  "nextAvailableAt": "2024-12-02T00:00:00Z",
  "streak": {
    "current": 7,
    "longest": 10,
    "bonus": 1.1
  }
}
```

### Claim Daily Loot Box
```
POST /game/loot-box/claim
Authorization: Bearer <token>
Content-Type: application/json

{}

Response: {
  "success": true,
  "rewards": {
    "gold": 550,
    "experience": 55,
    "materials": { "iron_ore": 5 },
    "items": []
  },
  "streak": {
    "current": 8,
    "longest": 10,
    "bonus": 1.25
  },
  "nextAvailableAt": "2024-12-02T00:00:00Z"
}
```

---

## [TIME] Idle Mechanics

### Get Idle Progress
```
GET /game/idle/progress
Authorization: Bearer <token>

Response: {
  "success": true,
  "offlineHours": 12,
  "cappedHours": 12,
  "lastActiveAt": "2024-12-01T00:00:00Z",
  "activeActivities": [
    {
      "id": "auto_mining",
      "startedAt": "2024-12-01T00:00:00Z",
      "slotIndex": 0
    }
  ],
  "rewards": {
    "gold": 240,
    "experience": 600,
    "materials": { "iron_ore": 36 }
  }
}
```

### Claim Idle Rewards
```
POST /game/idle/claim
Authorization: Bearer <token>
Content-Type: application/json

{
  "slotIndex": 0  // Optional: claim specific slot, or all if omitted
}

Response: {
  "success": true,
  "claimed": {
    "gold": 240,
    "experience": 600,
    "materials": { "iron_ore": 36 }
  }
}
```

### Start Idle Activity
```
POST /game/idle/activity/start
Authorization: Bearer <token>
Content-Type: application/json

{
  "activityId": "auto_mining",
  "slotIndex": 0  // Optional: auto-assigns if omitted
}

Response: {
  "success": true,
  "activity": {
    "id": "auto_mining",
    "startedAt": "2024-12-01T12:00:00Z",
    "slotIndex": 0
  }
}
```

### Stop Idle Activity
```
POST /game/idle/activity/stop
Authorization: Bearer <token>
Content-Type: application/json

{
  "slotIndex": 0
}

Response: {
  "success": true,
  "rewards": {
    "gold": 120,
    "experience": 300,
    "materials": { "iron_ore": 18 }
  },
  "stoppedAt": "2024-12-01T14:00:00Z"
}
```

---

##  End-Game Crafting

### Start Crafting Session
```
POST /game/crafting/start
Authorization: Bearer <token>
Content-Type: application/json

{
  "characterId": "char_123",
  "recipeId": "legendary_sword",
  "quantity": 1,
  "specialMaterials": [
    {
      "materialId": "quality_catalyst",
      "quantity": 2
    }
  ]
}

Response: {
  "success": true,
  "session": {
    "id": "craft_123",
    "characterId": "char_123",
    "recipeId": "legendary_sword",
    "startedAt": "2024-12-01T12:00:00Z",
    "completesAt": "2024-12-01T14:00:00Z",
    "status": "in_progress",
    "progressPercent": 0
  }
}
```

### Collect Crafting Result
```
POST /game/crafting/collect
Authorization: Bearer <token>
Content-Type: application/json

{
  "sessionId": "craft_123"
}

Response: {
  "success": true,
  "items": [
    {
      "itemTemplateId": "crafted_legendary_sword",
      "quantity": 1,
      "quality": 98,
      "modifiers": {
        "prefixes": [
          { "name": "Thunderous", "tier": 5 }
        ],
        "suffixes": [
          { "name": "of Power", "tier": 4 }
        ]
      }
    }
  ],
  "quality": 98,
  "modifiers": { ... },
  "experienceGained": 5000
}
```

### Get Crafting Sessions
```
GET /game/crafting/sessions?characterId=char_123
Authorization: Bearer <token>

Response: {
  "success": true,
  "sessions": [
    {
      "id": "craft_123",
      "recipeId": "legendary_sword",
      "status": "in_progress",
      "progressPercent": 45,
      "completesAt": "2024-12-01T14:00:00Z"
    }
  ]
}
```

---

##  Dungeons

### Start Dungeon Instance
```
POST /game/dungeons/start
Authorization: Bearer <token>
Content-Type: application/json

{
  "characterId": "char_123",
  "dungeonId": "shadow_depths",
  "difficulty": "master",
  "instanceType": "solo"  // or "party"
}

Response: {
  "success": true,
  "instance": {
    "id": "dungeon_123",
    "dungeonId": "shadow_depths",
    "characterId": "char_123",
    "difficulty": "master",
    "currentFloor": 1,
    "currentRoom": 1,
    "status": "in_progress",
    "startedAt": "2024-12-01T12:00:00Z"
  }
}
```

### Complete Dungeon Room
```
POST /game/dungeons/complete-room
Authorization: Bearer <token>
Content-Type: application/json

{
  "instanceId": "dungeon_123",
  "roomId": "room_1",
  "result": "victory"  // or "defeat", "skip"
}

Response: {
  "success": true,
  "instance": { ... },
  "rewards": {
    "experience": 2500,
    "gold": 1250,
    "materials": { "dungeon_scrap": 12 }
  }
}
```

### Complete Dungeon
```
POST /game/dungeons/complete
Authorization: Bearer <token>
Content-Type: application/json

{
  "instanceId": "dungeon_123"
}

Response: {
  "success": true,
  "finalRewards": {
    "experience": 125000,
    "gold": 25000,
    "items": [
      {
        "item": { ... },
        "quantity": 1,
        "source": "completion"
      }
    ],
    "materials": { ... }
  },
  "instance": { ... }
}
```

### Get Dungeon Instances
```
GET /game/dungeons/instances?characterId=char_123
Authorization: Bearer <token>

Response: {
  "success": true,
  "instances": [
    {
      "id": "dungeon_123",
      "dungeonId": "shadow_depths",
      "status": "in_progress",
      "currentFloor": 3,
      "currentRoom": 5
    }
  ]
}
```

---

##  Inventory

### Get Inventory
```
GET /game/inventory?characterId=char_123
Authorization: Bearer <token>

Response: {
  "success": true,
  "inventory": {
    "characterId": "char_123",
    "maxSlots": 100,
    "slots": [
      {
        "slotIndex": 0,
        "itemId": "item_123",
        "quantity": 1,
        "isEmpty": false
      }
    ],
    "usedSlots": 45,
    "freeSlots": 55
  },
  "equipment": {
    "characterId": "char_123",
    "slots": {
      "weapon": "item_456",
      "head": "item_789"
    }
  }
}
```

### Add Item to Inventory
```
POST /game/inventory/item
Authorization: Bearer <token>
Content-Type: application/json

{
  "characterId": "char_123",
  "item": {
    "templateId": 123,
    "quantity": 1,
    "statModifiers": { ... }
  }
}

Response: {
  "success": true,
  "itemId": "item_123",
  "slot": { ... },
  "inventory": { ... }
}
```

### Remove Item from Inventory
```
DELETE /game/inventory/item?itemId=item_123&characterId=char_123
Authorization: Bearer <token>

Response: {
  "success": true,
  "inventory": { ... }
}
```

### Equip Item
```
POST /game/inventory/equip
Authorization: Bearer <token>
Content-Type: application/json

{
  "characterId": "char_123",
  "itemId": "item_456",
  "slot": "weapon"
}

Response: {
  "success": true,
  "equipment": { ... }
}
```

---

## [EMOJI] Character

### Get Character
```
GET /game/character?characterId=char_123
Authorization: Bearer <token>

Response: {
  "success": true,
  "character": {
    "id": "char_123",
    "name": "Shadowblade",
    "level": 50,
    "appearance": { ... },
    "stats": { ... }
  }
}
```

### Create Character
```
POST /game/character
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Shadowblade",
  "appearance": {
    "skinColor": "#D4A574",
    "bodyType": "default",
    "hairStyle": "spiky",
    "hairColor": "#2C1810",
    "customTextures": {
      "head": {
        "width": 64,
        "height": 64,
        "data": "data:image/png;base64,...",
        "format": "png"
      }
    }
  }
}

Response: {
  "success": true,
  "character": {
    "id": "char_123",
    "name": "Shadowblade",
    "level": 1,
    "appearance": { ... }
  }
}
```

### Update Character Appearance (Pixel Editor)
```
PUT /game/character/appearance
Authorization: Bearer <token>
Content-Type: application/json

{
  "characterId": "char_123",
  "appearance": {
    "skinColor": "#D4A574",
    "hairColor": "#FF0000"
  },
  "customTextures": {
    "head": {
      "width": 64,
      "height": 64,
      "data": "data:image/png;base64,...",
      "format": "png"
    },
    "torso": { ... },
    "arms": { ... },
    "legs": { ... }
  }
}

Response: {
  "success": true,
  "character": {
    "id": "char_123",
    "appearance": { ... }
  }
}
```

---

##  Loot Generation

### Generate Loot Item
```
POST /game/loot/generate
Authorization: Bearer <token>
Content-Type: application/json

{
  "lootTableId": "epic",
  "options": {
    "itemLevel": 50,
    "forcedRarity": "legendary",  // Optional
    "seed": "deterministic_seed"  // Optional
  }
}

Response: {
  "success": true,
  "item": {
    "template": { ... },
    "baseName": "Iron Sword",
    "fullName": "Thunderous Void Blade of Annihilation",
    "rarity": "legendary",
    "itemLevel": 50,
    "prefixes": [
      {
        "name": "Thunderous",
        "tier": 5,
        "stats": { "lightningDamage": 150, "attackSpeed": 25 }
      }
    ],
    "suffixes": [
      {
        "name": "of Annihilation",
        "tier": 5,
        "stats": { "strength": 100, "bossDamage": 50 }
      }
    ],
    "finalStats": { ... },
    "colorPalette": {
      "primary": "#ff8000",
      "secondary": "#cc6600",
      "glow": "#ffab4f"
    },
    "generatedAt": "2024-12-01T12:00:00Z"
  }
}
```

### Get Available Loot Tables
```
GET /game/loot/tables
Authorization: Bearer <token>

Response: {
  "success": true,
  "lootTables": [
    {
      "id": "common",
      "name": "Common Loot",
      "itemLevel": 1,
      "description": "Basic loot table"
    },
    {
      "id": "epic",
      "name": "Epic Loot",
      "itemLevel": 50,
      "description": "High-tier loot table"
    }
  ]
}
```

---

## [EMOJI] Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error Type",
  "message": "Human-readable error message"
}
```

Common status codes:
- `200` - Success
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (missing/invalid token)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error

---

## [EMOJI] Integration Notes

- All endpoints use **JWT authentication** from OTP auth system
- All data stored in **Cloudflare KV** with customer isolation
- **CORS headers** automatically included
- **Rate limiting** handled by existing OTP auth infrastructure
- **Error tracking** integrated with analytics system

---

**Last Updated:** December 2024  
**Version:** 1.0.0

