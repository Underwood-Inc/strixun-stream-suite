# Idle Game Overlay System

> **Comprehensive idle/mini-game system with RPG elements, loot boxes, and OTP integration** [FEATURE]

---

## ★ What's Implemented

### ✓ Core Type System

- **Character Customization** (`types/character-customization.ts`)
  - Pixel editor configuration
  - Custom textures (head, torso, arms, legs)
  - Equipment visualization
  - Subscription-tier access control

- **Loot System** (`types/loot.ts`)
  - Path of Exile-style modifiers
  - Prefix/suffix pools
  - Loot tables with rarity weights
  - Generated item types

- **End-Game Crafting** (`types/crafting.ts`)
  - 6 crafting tiers (basic  transcendent)
  - Special materials system
  - Modifier application
  - Quality calculation

- **Dungeons** (`types/dungeons.ts`)
  - Instanced dungeon system
  - Multiple difficulty levels
  - Boss encounters
  - Puzzle rooms
  - Party/raid support

- **Idle Mechanics** (`types/idle.ts`)
  - Offline progress calculation
  - Multiple activity slots
  - Resource generation rates
  - Subscription-tier limits

- **Daily Loot Boxes** (`types/loot-boxes.ts`)
  - Retention-focused rewards
  - Streak system (1-31+ days)
  - Multiple reward pools
  - Tier-based bonuses

### ✓ Core Systems

- **Loot Generator** (`core/loot-generator.ts`)
  - Path of Exile-style generation
  - Weighted rarity rolls
  - Prefix/suffix selection
  - Stat calculation
  - Item name generation
  - Seeded random (deterministic)

- **Pixel Editor** (`core/pixel-editor.ts`)
  - Canvas-based pixel art editor
  - Layer management
  - Undo/redo support
  - Export/import functionality
  - Tool system (pencil, eraser, fill, etc.)

- **Tooltip System** (`core/tooltip-system.ts`)
  - High fantasy themed tooltips
  - Smart z-index management
  - Nested tooltip support
  - Portal rendering
  - User-customizable tooltips

### ✓ API Integration

- **Game API Service** (`services/game-api.ts`)
  - Full API client for all game endpoints
  - Automatic response decryption using existing utilities
  - Integrated with OTP auth system
  - Type-safe API calls

- **Game State Store** (`stores/game-state.ts`)
  - Current character management
  - Loading/error states
  - Reactive state updates

### ✓ UI Components

- **GameOverlay** (`components/GameOverlay.svelte`)
  - Main overlay component with navigation
  - Screen routing
  - Auth integration
  - Keyboard shortcuts (Escape to close)

- **DailyLootBox** (`components/DailyLootBox.svelte`)
  - Daily reward claim interface
  - Streak tracking and bonuses
  - Reward display

- **InventoryScreen** (`components/InventoryScreen.svelte`)
  - Equipment slots display
  - Inventory grid management
  - Item tooltips on hover
  - Rarity-based styling

- **CharacterScreen** (`components/CharacterScreen.svelte`)
  - Character stats display
  - Pixel editor integration
  - Appearance customization
  - Layer selection (head, torso, arms, legs)

- **IdleProgress** (`components/IdleProgress.svelte`)
  - Offline progress calculation
  - Reward display and claiming
  - Active activities list
  - Auto-refresh every 30 seconds

- **CraftingScreen** (`components/CraftingScreen.svelte`)
  - Active crafting sessions
  - Progress tracking
  - Result collection
  - Time remaining display

- **DungeonScreen** (`components/DungeonScreen.svelte`)
  - Active dungeon instances
  - Room completion tracking
  - Dungeon completion
  - Status indicators

- **PixelEditor** (`components/PixelEditor.svelte`)
  - Canvas-based pixel art editor
  - Tool palette
  - Color picker
  - Layer management UI

- **ItemTooltip** (`components/ItemTooltip.svelte`)
  - High fantasy styled tooltips
  - Rarity-based colors
  - Stat display
  - Modifier information

- **Tooltip** (`components/Tooltip.svelte`)
  - Generic tooltip component
  - Portal rendering
  - Smart positioning

---

## ★ Architecture

See `docs/IDLE_GAME_SYSTEM_ARCHITECTURE.md` for full architecture documentation.

---

## ★ Usage

```svelte
<script>
  import { GameOverlay } from '@/shared-components/idle-game-overlay';
  import { loadCharacter } from '@/shared-components/idle-game-overlay/stores/game-state';

  let showOverlay = false;

  // Load character when user logs in
  async function handleLogin() {
    await loadCharacter('character-id-here');
    showOverlay = true;
  }
</script>

<GameOverlay 
  visible={showOverlay} 
  onClose={() => showOverlay = false} 
/>
```

---

## ★ Security

- **End-to-End Encryption**: All API responses automatically encrypted using existing JWT-based encryption
- **OTP Integration**: Passwordless save states using existing OTP auth system
- **Customer Isolation**: All data isolated by customer ID
- **No New Encryption Libraries**: Uses existing `decryptWithJWT` from `src/core/api/enhanced/encryption/jwt-encryption.js`

---

## ★ API Endpoints

All endpoints are documented in `docs/API_ENDPOINTS_REFERENCE.md`:

- Save State: `POST/GET /game/save-state`
- Daily Loot Box: `GET /game/loot-box/status`, `POST /game/loot-box/claim`
- Idle Mechanics: `GET /game/idle/progress`, `POST /game/idle/claim`, etc.
- Crafting: `POST /game/crafting/start`, `POST /game/crafting/collect`, etc.
- Dungeons: `POST /game/dungeons/start`, `POST /game/dungeons/complete-room`, etc.
- Inventory: `GET /game/inventory`, `POST /game/inventory/item`, etc.
- Character: `GET /game/character`, `POST /game/character`, `PUT /game/character/appearance`
- Loot Generation: `POST /game/loot/generate`, `GET /game/loot/tables`

---

**Status**: ✓ **Complete** - All core systems, API integration, and UI components implemented. Ready for integration into applications.

