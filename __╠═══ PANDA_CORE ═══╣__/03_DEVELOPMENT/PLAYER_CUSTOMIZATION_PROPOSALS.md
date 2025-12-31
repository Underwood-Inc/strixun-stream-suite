# Player Customization System Proposals

> **Proposals for player customization leveraging existing avatar systems** [EMOJI][FEATURE]

---

## [EMOJI] Found Systems

### 1. **DiceBear Adventurer** (Current Profile System)
- **Location**: `idling.app__UI/src/app/components/avatar/Avatar.tsx`
- **Library**: `@dicebear/collection` (adventurer style)
- **Method**: Seed-based generation
- **Use Case**: Profile pictures, user avatars
- **Features**: Deterministic, cached, simple

### 2. **Blocky Character Appearance** (Game System)
- **Location**: `idling.app__UI/src/lib/idle-game/GAME_DESIGN_DOCUMENT.md`
- **Style**: Pixel-art, blocky aesthetic
- **Customization**: Detailed (skin, hair, eyes, body type, height, clothing)
- **Use Case**: In-game character representation
- **Features**: Full customization system

---

## [EMOJI] Proposal Options

### **Option 1: Enhanced DiceBear Multi-Style System**  RECOMMENDED

**Concept**: Use DiceBear's collection with multiple styles, allowing players to choose their preferred aesthetic.

**Implementation**:
```typescript
interface CharacterAvatar {
  seed: string;                    // User ID or custom seed
  style: 'adventurer' | 'pixel-art' | 'lorelei' | 'bottts' | 'avataaars';
  customizations?: {
    // Style-specific options
    backgroundColor?: string;
    accessories?: string[];
    clothing?: string;
  };
}
```

**Pros**:
- [OK] Leverages existing DiceBear infrastructure
- [OK] Multiple art styles (pixel-art, adventurer, etc.)
- [OK] Deterministic (same seed = same avatar)
- [OK] Easy to implement
- [OK] Cached automatically
- [OK] Works well for overlay (small size)

**Cons**:
- [WARNING] Limited customization depth
- [WARNING] Style-dependent options

**Best For**: Quick implementation, consistent look, profile-style avatars

---

### **Option 2: Hybrid Blocky + DiceBear System**

**Concept**: Combine blocky pixel-art customization with DiceBear seed-based generation for unique combinations.

**Implementation**:
```typescript
interface HybridCharacterAppearance {
  // Base from DiceBear (seed-based)
  baseAvatar: {
    seed: string;
    style: 'pixel-art' | 'bottts';
  };
  
  // Customizable layers (blocky style)
  layers: {
    skinColor: string;
    hairStyle: string;
    hairColor: string;
    eyeColor: string;
    clothing: {
      top: string;
      bottom: string;
      shoes: string;
    };
    accessories: string[];
    bodyType: 'default' | 'slim' | 'bulky';
    height: number; // 0.8 - 1.2
  };
  
  // Equipment visualization
  equippedItems: {
    weapon?: string;      // Visual weapon sprite
    armor?: string;      // Visual armor overlay
    accessories?: string[]; // Visual accessory overlays
  };
}
```

**Pros**:
- [OK] Best of both worlds
- [OK] Seed-based uniqueness + customization
- [OK] Equipment visualization
- [OK] Deep customization options
- [OK] Pixel-art aesthetic fits idle game

**Cons**:
- [WARNING] More complex implementation
- [WARNING] Requires sprite/asset management
- [WARNING] Larger data structure

**Best For**: Rich customization, equipment visualization, pixel-art aesthetic

---

### **Option 3: Procedural Pixel-Art Generator**

**Concept**: Create a custom procedural pixel-art generator inspired by DiceBear but tailored for idle game aesthetics.

**Implementation**:
```typescript
interface ProceduralCharacter {
  seed: string;
  
  // Procedural generation
  parts: {
    head: {
      shape: 'round' | 'square' | 'oval';
      size: number;
    };
    hair: {
      style: string;      // Generated from seed
      color: string;      // Generated from seed
      length: number;
    };
    face: {
      eyes: { style: string; color: string; };
      mouth: { style: string; };
      nose: { style: string; };
    };
    body: {
      type: 'default' | 'slim' | 'bulky';
      height: number;
      clothing: {
        top: string;
        bottom: string;
        pattern: string;
      };
    };
  };
  
  // Equipment overlays
  equipment: EquipmentVisualization;
}
```

**Pros**:
- [OK] Fully customizable
- [OK] Unique to our game
- [OK] Pixel-art optimized
- [OK] Equipment integration
- [OK] No external dependencies

**Cons**:
- [WARNING] Most development time
- [WARNING] Requires art assets
- [WARNING] Need to build generator

**Best For**: Unique identity, full control, pixel-art focus

---

### **Option 4: Modular Sprite System**

**Concept**: Pre-made sprite parts that players can mix and match, similar to character creators in RPGs.

**Implementation**:
```typescript
interface ModularCharacter {
  // Base parts (from sprite sheets)
  parts: {
    head: SpritePart;
    hair: SpritePart;
    eyes: SpritePart;
    mouth: SpritePart;
    body: SpritePart;
    clothing: {
      top: SpritePart;
      bottom: SpritePart;
      shoes: SpritePart;
    };
  };
  
  // Colors (customizable)
  palette: {
    skin: string;
    hair: string;
    eyes: string;
    clothing: string[];
  };
  
  // Equipment (overlay sprites)
  equipment: EquipmentSprites;
}
```

**Pros**:
- [OK] High-quality art
- [OK] Consistent style
- [OK] Easy to add new parts
- [OK] Equipment integration
- [OK] Professional look

**Cons**:
- [WARNING] Requires art assets
- [WARNING] Asset management
- [WARNING] Larger file sizes

**Best For**: Professional polish, consistent art style

---

## [EMOJI] Recommendation Matrix

| Feature | Option 1 | Option 2 | Option 3 | Option 4 |
|---------|----------|----------|----------|----------|
| **Development Speed** |  |  |  |  |
| **Customization Depth** |  |  |  |  |
| **Equipment Integration** |  |  |  |  |
| **Art Quality** |  |  |  |  |
| **Uniqueness** |  |  |  |  |
| **Maintenance** |  |  |  |  |

---

## [EMOJI] Visual Style Comparison

### Option 1: DiceBear Multi-Style
- **Look**: Clean, modern, varied styles
- **Size**: Small, perfect for overlays
- **Example**: Profile picture style avatars

### Option 2: Hybrid System
- **Look**: Pixel-art base with customizable layers
- **Size**: Medium, detailed
- **Example**: Stardew Valley meets DiceBear

### Option 3: Procedural Pixel
- **Look**: Unique pixel-art characters
- **Size**: Medium, detailed
- **Example**: Custom pixel-art generator

### Option 4: Modular Sprites
- **Look**: Professional RPG-style sprites
- **Size**: Large, very detailed
- **Example**: Final Fantasy character creator

---

## [OK] Selected: Pixel Editor System

**Decision**: Use the original pixel-style customizable system with pixel editor (Option 3 Enhanced)

**Implementation**:
- Canvas-based pixel art editor
- Custom textures for head, torso, arms, legs
- Subscription-tier access (basic  pro)
- Equipment visualization overlays
- Export/import pixel art
- Color palette system

---

## [EMOJI] Implementation Plan

Now implementing:
1. [OK] Pixel editor component with canvas drawing
2. [OK] Character customization system
3. [OK] End-game crafting integration
4. [OK] Dungeon system
5. [OK] Loot generation and idle mechanics
6. [OK] Full integration
