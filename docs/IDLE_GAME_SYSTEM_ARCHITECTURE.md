# Idle Game System Architecture

> **Comprehensive idle/mini-game system with RPG elements, loot boxes, and OTP integration** ❓✨

---

## 🎯 Overview

This document describes the architecture for an agnostic idle game overlay component that can be dropped into both applications. The system includes:

- **Idle Game Mechanics** - Offline progress, resource generation
- **Daily Loot Boxes** - Retention-focused rewards
- **Complex Loot System** - Path of Exile-style prefix/suffix generation
- **Player Inventory** - Full inventory management screens
- **Marketplace** - Player-driven trading
- **OTP Integration** - Passwordless save state
- **Gameplay Loops** - Quests, achievements, seasonal events

---

## ❓❓ Architecture

### Component Structure

```
shared-components/
└── idle-game-overlay/
    ├── core/
    │   ├── loot-generator.ts          # Path of Exile-style loot generation
    │   ├── idle-mechanics.ts          # Offline progress, resource generation
    │   ├── loot-box-system.ts         # Daily loot box mechanics
    │   └── save-state-manager.ts      # OTP-integrated save state
    ├── types/
    │   ├── loot.ts                    # Loot table, prefix/suffix types
    │   ├── idle.ts                    # Idle mechanics types
    │   └── gameplay-loops.ts          # Quests, achievements types
    ├── components/
    │   ├── IdleGameOverlay.svelte     # Main overlay component
    │   ├── InventoryScreen.svelte     # Inventory management
    │   ├── LootBoxScreen.svelte       # Daily loot box UI
    │   ├── MarketplaceScreen.svelte   # Player marketplace
    │   └── QuestScreen.svelte         # Quests and achievements
    └── services/
        ├── game-state-service.ts      # Game state management
        └── otp-sync-service.ts        # OTP auth integration
```

---

## ❓ Loot System (Path of Exile Style)

### Prefix/Suffix Generation

Items can have **multiple prefixes and suffixes** that modify stats:

```typescript
interface ItemModifier {
  id: string;
  name: string;           // "of the Bear", "Fiery", etc.
  type: 'prefix' | 'suffix';
  tier: 1 | 2 | 3 | 4 | 5; // Higher tier = better stats
  rarity: ItemRarity;      // Affects spawn chance
  statModifiers: ItemStats; // What stats it modifies
  tags: string[];          // "combat", "defense", "elemental", etc.
}
```

### Loot Table System

```typescript
interface LootTable {
  id: string;
  name: string;
  itemLevel: number;      // Base item level
  baseRarity: ItemRarity; // Base rarity roll
  
  // Prefix/Suffix pools
  prefixPools: ModifierPool[];
  suffixPools: ModifierPool[];
  
  // Drop chances
  dropChances: {
    common: number;
    uncommon: number;
    rare: number;
    epic: number;
    legendary: number;
    unique: number;
  };
  
  // Modifier count ranges (based on rarity)
  modifierCounts: {
    [key in ItemRarity]: {
      minPrefixes: number;
      maxPrefixes: number;
      minSuffixes: number;
      maxSuffixes: number;
    };
  };
}
```

### Generation Algorithm

1. **Roll Base Rarity** - Weighted random based on loot table
2. **Determine Modifier Count** - Based on rarity tier
3. **Roll Prefixes** - Select from available prefix pools
4. **Roll Suffixes** - Select from available suffix pools
5. **Calculate Final Stats** - Combine base + all modifiers
6. **Generate Item Name** - Combine prefixes + base name + suffixes

**Example:**
- Base: "Iron Sword"
- Prefix: "Fiery" (+10 fire damage)
- Suffix: "of the Bear" (+20 strength)
- Result: **"Fiery Iron Sword of the Bear"**

---

## 📦 Daily Loot Box System

### Retention Mechanics

Daily loot boxes encourage daily return visits:

```typescript
interface DailyLootBox {
  id: string;
  type: 'daily' | 'weekly' | 'event';
  availableAt: Date;
  expiresAt: Date;
  claimedAt?: Date;
  
  // Reward pools
  rewardPools: LootBoxRewardPool[];
  
  // Streak bonuses
  streakDays: number;      // Current streak
  streakBonus: number;    // Multiplier for streak
}
```

### Reward Tiers

- **Common** (60%) - Basic materials, small currency
- **Uncommon** (25%) - Better materials, medium currency
- **Rare** (10%) - Equipment, rare materials
- **Epic** (4%) - High-tier equipment, valuable items
- **Legendary** (0.9%) - Exceptional items
- **Unique** (0.1%) - Ultra-rare exclusive items

### Streak System

- **Day 1-3**: Base rewards
- **Day 4-7**: +10% bonus
- **Day 8-14**: +25% bonus
- **Day 15-30**: +50% bonus
- **Day 31+**: +100% bonus (double rewards)

---

## ⏱️ Idle Mechanics

### Offline Progress

Players earn resources even when offline:

```typescript
interface IdleProgress {
  lastActiveAt: Date;
  offlineHours: number;
  maxOfflineHours: number; // Based on subscription tier
  
  // Resource generation rates
  resourceRates: {
    gold: number;      // Gold per hour
    experience: number; // XP per hour
    materials: Record<string, number>; // Material per hour
  };
  
  // Calculated rewards
  rewards: {
    gold: number;
    experience: number;
    materials: Record<string, number>;
    items: GameItem[];
  };
}
```

### Active Idle Systems

- **Auto-mining** - Generates ores while idle
- **Auto-crafting** - Completes crafting queues
- **Auto-combat** - Fights enemies for XP/loot
- **Resource Generation** - Passive income streams

---

## ❓ Gameplay Loops

### Quests

```typescript
interface Quest {
  id: string;
  name: string;
  description: string;
  type: 'daily' | 'weekly' | 'story' | 'achievement';
  
  objectives: QuestObjective[];
  rewards: QuestReward[];
  
  progress: {
    current: number;
    required: number;
    completed: boolean;
  };
}
```

### Achievements

```typescript
interface Achievement {
  id: string;
  name: string;
  description: string;
  category: string;
  
  requirements: AchievementRequirement[];
  rewards: AchievementReward[];
  
  unlockedAt?: Date;
  progress: number;
}
```

### Seasonal Events

Time-limited events with unique rewards:

- **Holiday Events** - Special themed loot
- **Seasonal Challenges** - Limited-time quests
- **Community Goals** - Server-wide objectives

---

## 🔐 OTP Integration

### Save State Management

Game state is automatically synced with OTP auth:

```typescript
interface GameSaveState {
  userId: string;        // From OTP auth
  characterId: number;
  
  // Encrypted game data
  encryptedData: string;
  iv: string;
  authTag: string;
  
  // Metadata
  lastSavedAt: Date;
  version: string;
  subscriptionTier: string;
}
```

### Auto-Save

- **On Action** - Saves after major actions (combat, crafting, trading)
- **Periodic** - Auto-saves every 60 seconds
- **On Close** - Saves when component unmounts
- **On OTP Login** - Loads save state automatically

### Cross-Device Sync

- Save state stored in cloud (via OTP auth)
- Automatic sync on login
- Conflict resolution (timestamp-based)

---

## ❓ Marketplace Integration

Leverages existing marketplace system from `idling.app__UI`:

- **List Items** - Sell items to other players
- **Browse Listings** - Search and filter items
- **Make Offers** - Negotiate prices
- **Trade History** - Track transactions

---

## 📊 Inventory System

### Inventory Management

- **Grid Layout** - Visual inventory grid
- **Sorting** - By rarity, type, level, etc.
- **Filtering** - Search and filter items
- **Equipment Slots** - Equip items for stat bonuses
- **Stacking** - Stackable items auto-merge

### Item Comparison

- **Stat Comparison** - Compare equipped vs. inventory items
- **Upgrade Suggestions** - Highlight better items
- **Set Bonuses** - Track set item bonuses

---

## 🎨 UI Components

### Main Overlay

`IdleGameOverlay.svelte` - Main component that can be dropped into any app:

```svelte
<IdleGameOverlay
  apiUrl={OTP_API_URL}
  onLogin={handleLogin}
  onSave={handleSave}
/>
```

### Features

- **Minimizable** - Can be minimized to corner
- **Resizable** - Adjustable size
- **Themed** - Matches app theme
- **Responsive** - Works on mobile/desktop

---

## 🔄 Integration Points

### With Existing Systems

1. **OTP Auth** - Uses `shared-components/otp-login`
2. **Storage** - Uses existing storage system
3. **Marketplace** - Integrates with existing marketplace
4. **Inventory** - Extends existing inventory types

### API Endpoints

```
POST /game/save-state          # Save game state
GET  /game/save-state          # Load game state
POST /game/loot-box/claim      # Claim daily loot box
GET  /game/loot-box/status     # Get loot box status
POST /game/idle/claim          # Claim idle rewards
GET  /game/idle/progress       # Get idle progress
```

---

## 📈 Performance Considerations

### Optimization

- **Lazy Loading** - Load components on demand
- **Virtual Scrolling** - For large inventories
- **Debounced Saves** - Prevent excessive API calls
- **Caching** - Cache loot tables and item templates

### Offline Support

- **Local Cache** - Store game state locally
- **Queue Actions** - Queue actions when offline
- **Sync on Reconnect** - Auto-sync when online

---

## 🧪 Testing Strategy

### Unit Tests

- Loot generation algorithms
- Idle progress calculations
- Save state encryption/decryption

### Integration Tests

- OTP auth flow
- Save/load cycle
- Marketplace transactions

### E2E Tests

- Complete gameplay loops
- Cross-device sync
- Daily loot box claims

---

## 📝 Implementation Phases

### Phase 1: Core Systems ✅
- [x] Loot generation system
- [x] Daily loot boxes
- [x] Idle mechanics
- [x] Save state manager

### Phase 2: UI Components
- [ ] Main overlay component
- [ ] Inventory screen
- [ ] Loot box screen
- [ ] Marketplace integration

### Phase 3: Gameplay Loops
- [ ] Quest system
- [ ] Achievement system
- [ ] Seasonal events

### Phase 4: Polish
- [ ] Animations
- [ ] Sound effects
- [ ] Tutorial
- [ ] Documentation

---

## 🚀 Future Enhancements

- **Guild System** - Player groups and cooperation
- **PvP** - Player vs. player combat
- **Dungeons** - Instanced content
- **Crafting 2.0** - Advanced crafting with modifiers
- **Pets** - Companion system
- **Housing** - Player-owned spaces

---

**Last Updated:** December 2024  
**Version:** 1.0.0

