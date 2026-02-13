# Dice Board Game

> **3D dice rolling board game with hexagonal board and procedural events** [FEATURE]

A realistic yet performant 3D dice rolling board game that can work standalone or within the existing game overlay. Features a hexagonal board with smart edge wrapping, procedural event generation with 3000+ possible scenarios, customizable 3D dice, and full integration with the game API.

---

## ★ Features

### Core Gameplay
- **Hexagonal Board System** - Procedurally generated board with smart edge wrapping
- **Fork Paths** - Multiple paths at junctions for strategic decision-making
- **3D Dice Rolling** - Realistic physics-based dice with customization options
- **Player Movement** - Movement tied to dice rolls with smooth animations
- **Procedural Events** - 3000+ unique event scenarios with smart templates

### Event System
- **Treasure Events** - Find items, gold, and rewards
- **Combat Encounters** - Battle enemies with difficulty scaling
- **NPC Interactions** - Merchants, quest givers, healers, and more
- **Traps** - Dangerous obstacles with consequences
- **Shrines** - Healing and blessing locations
- **Quests** - Mission-based objectives

### Items & Effects
- **Items** - Weapons, armor, consumables, accessories
- **Buffs** - Temporary stat boosts and effects
- **Debuffs** - Negative effects from traps and enemies
- **Rarity System** - Common, Uncommon, Rare, Epic, Legendary

### Integration
- **Game API** - Full save/load state integration
- **Standalone Mode** - Can run independently
- **Overlay Mode** - Integrates with existing game overlay
- **DOM Attachment** - Can attach to any DOM element (border-like wrapping)

---

## ★ Installation

```bash
pnpm install
```

---

## ★ Usage

### Basic Usage

```tsx
import { DiceBoardGameContainer } from '@strixun/dice-board-game/react';

function App() {
  return (
    <DiceBoardGameContainer
      width={800}
      height={600}
      config={{
        width: 20,
        height: 20,
        tileSize: 1,
        wrapEdges: true,
        forkProbability: 0.3,
        minForkChainLength: 5,
      }}
      diceConfig={{
        sides: 6,
        count: 2,
        size: 0.5,
        material: 'standard',
      }}
      onStateChange={(state) => {
        console.log('Game state changed:', state);
      }}
      onEventTriggered={(event) => {
        console.log('Event triggered:', event);
      }}
    />
  );
}
```

### With DOM Element Ref

```tsx
import { useRef } from 'react';
import { DiceBoardGameContainer } from '@strixun/dice-board-game/react';

function App() {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100vh' }}>
      <DiceBoardGameContainer
        containerRef={containerRef}
        config={{ /* ... */ }}
      />
    </div>
  );
}
```

### With Game API Integration

```tsx
import { DiceBoardGameContainer } from '@strixun/dice-board-game/react';

function App() {
  const authToken = 'your-jwt-token';
  const gameApiUrl = 'https://your-api-url.com';

  return (
    <DiceBoardGameContainer
      gameApiUrl={gameApiUrl}
      authToken={authToken}
      config={{ /* ... */ }}
    />
  );
}
```

---

## ★ Architecture

### Core Systems

```
dice-board-game/
├── src/
│   ├── types/           # TypeScript type definitions
│   ├── core/            # Core game logic
│   │   ├── board-generator.ts    # Procedural board generation
│   │   ├── dice-engine.ts        # 3D dice physics and rendering
│   │   ├── event-generator.ts    # Procedural event generation (3000+ scenarios)
│   │   └── game-state.ts         # Game state management
│   └── utils/
│       └── hex-math.ts           # Hexagonal grid mathematics
├── react/
│   ├── DiceBoardGame.tsx         # Main game component
│   ├── DiceBoardGameContainer.tsx # Container with DOM attachment
│   ├── BoardScene.tsx            # 3D board rendering
│   ├── DiceRoller.tsx            # 3D dice rolling component
│   └── GameUI.tsx                # UI overlay
└── index.ts                      # Core library exports
```

---

## ★ Procedural Generation

### Board Generation
- Uses seeded random for deterministic generation
- Creates main path with configurable length
- Generates fork paths at junctions
- Fills surrounding tiles for completeness
- Supports edge wrapping for border-like attachment

### Event Generation
- **3000+ Unique Scenarios** - Generated from smart templates
- **Template-Based** - Prevents garbage output with structured templates
- **Rarity System** - Events scale with game progress
- **Context-Aware** - Events match tile types and game state

### Event Types
- **Treasure** - Items, gold, experience
- **Combat** - Enemies with scaling difficulty
- **NPC** - Dialogue and interactions
- **Trap** - Damage and debuffs
- **Shrine** - Healing and blessings
- **Quest** - Mission objectives

---

## ★ Customization

### Dice Customization
- **Sides** - 4, 6, 8, 10, 12, 20 (or custom)
- **Count** - Number of dice to roll
- **Material** - Standard, Metal, Wood, Crystal
- **Color** - Custom color support
- **Size** - Adjustable dice size
- **Texture** - Custom texture support (future)

### Board Customization
- **Size** - Width and height in hex tiles
- **Tile Size** - Physical size of tiles
- **Edge Wrapping** - Enable/disable edge wrapping
- **Fork Probability** - Chance of fork at junctions
- **Min Fork Chain Length** - Minimum tiles before fork

---

## ★ API Integration

The game integrates with the existing game API:

- `POST /game/save-state` - Save game state
- `GET /game/save-state` - Load game state

All API calls use JWT authentication via `Authorization: Bearer <token>` header.

---

## ★ Performance

- **Optimized Rendering** - Uses React Three Fiber for efficient 3D rendering
- **Procedural Generation** - Deterministic generation for consistent performance
- **Smart Culling** - Only renders visible tiles
- **Efficient State** - Minimal state updates for smooth gameplay

---

## ★ Development

```bash
# Build
pnpm build

# Dev mode
pnpm dev

# Test
pnpm test
```

---

## ★ License

Private - Part of Strixun Stream Suite
